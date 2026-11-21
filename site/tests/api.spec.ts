import { beforeEach, describe, expect, it, vi } from "vitest";

// The route handlers, with Sanity and Jira replaced: who may post, how often,
// how much, and what happens when Sanity fails.
const sanity = vi.hoisted(() => {
  const commit = vi.fn(async () => ({ votes: 4 }));
  const patch = vi.fn(() => { const p = { setIfMissing: () => p, inc: () => p, set: () => p, commit }; return p; });
  return {
    commit, patch,
    create: vi.fn(async () => ({})),
    fetch: vi.fn(async (): Promise<{ public?: boolean } | null> => ({ public: true })),
    upload: vi.fn(async () => ({ _id: "file-1", url: "https://cdn.sanity.io/files/a.webm" })),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/sanity/lib/writeClient", () => ({
  writeClient: { create: sanity.create, fetch: sanity.fetch, patch: sanity.patch, assets: { upload: sanity.upload } },
}));
vi.mock("@/lib/jiraSend", () => ({ jiraOn: false, jiraSettings: { project: "", issueType: "Task" }, sendFeedbackToJira: vi.fn(), createJiraIssue: vi.fn(), attachToJiraIssue: vi.fn() }));

const ORIGIN = "https://oakhum.com";
let ip = 0;
/** A request from a fresh address, so one test's limit doesn't reach the next. */
const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://oakhum.com${url}`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": `203.0.113.${++ip}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => { vi.clearAllMocks(); sanity.fetch.mockResolvedValue({ public: true }); sanity.commit.mockResolvedValue({ votes: 4 }); });

describe("POST /api/requests", async () => {
  const { POST } = await import("@/app/api/requests/route");
  const good = { kind: "instrument", title: "17-key kalimba" };

  it("saves a request hidden, with one vote", async () => {
    const res = await POST(post("/api/requests", good));
    expect(res.status).toBe(200);
    expect(sanity.create).toHaveBeenCalledWith(expect.objectContaining({ _type: "request", title: "17-key kalimba", public: false, votes: 1 }));
  });

  it("refuses another site's page, a missing Origin and a body that isn't the form", async () => {
    expect((await POST(post("/api/requests", good, { origin: "https://evil.example" }))).status).toBe(403);
    const noOrigin = new Request("https://oakhum.com/api/requests", { method: "POST", body: JSON.stringify(good) });
    expect((await POST(noOrigin)).status).toBe(403);
    expect((await POST(post("/api/requests", { ...good, details: "x".repeat(20_000) }))).status).toBe(413);
    expect((await POST(post("/api/requests", "not json"))).status).toBe(400);
    expect(sanity.create).not.toHaveBeenCalled();
  });

  it("stops the sixth request in ten minutes from one address", async () => {
    const from = { "x-forwarded-for": "198.51.100.1" };
    for (let i = 0; i < 5; i++) expect((await POST(post("/api/requests", good, from))).status).toBe(200);
    const res = await POST(post("/api/requests", good, from));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(sanity.create).toHaveBeenCalledTimes(5);
  });

  it("says so plainly when Sanity fails", async () => {
    sanity.create.mockRejectedValueOnce(new Error("down"));
    const res = await POST(post("/api/requests", good));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/try again/);
  });
});

describe("POST /api/requests/vote", async () => {
  const { POST } = await import("@/app/api/requests/vote/route");

  it("adds a vote to a public request", async () => {
    const res = await POST(post("/api/requests/vote", { id: "abc123" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ votes: 4 });
  });

  it("refuses unknown, hidden and draft requests, and other sites", async () => {
    expect((await POST(post("/api/requests/vote", { id: "drafts.abc" }))).status).toBe(400);
    expect((await POST(post("/api/requests/vote", { id: "a b" }))).status).toBe(400);
    sanity.fetch.mockResolvedValueOnce({ public: false });
    expect((await POST(post("/api/requests/vote", { id: "hidden1" }))).status).toBe(404);
    expect((await POST(post("/api/requests/vote", { id: "abc123" }, { origin: "https://evil.example" }))).status).toBe(403);
    expect(sanity.patch).not.toHaveBeenCalled();
  });

  it("counts one vote a day per address for the same request", async () => {
    const from = { "x-forwarded-for": "198.51.100.2" };
    expect((await POST(post("/api/requests/vote", { id: "same1" }, from))).status).toBe(200);
    expect((await POST(post("/api/requests/vote", { id: "same1" }, from))).status).toBe(429);
    expect((await POST(post("/api/requests/vote", { id: "other1" }, from))).status).toBe(200);
    expect(sanity.patch).toHaveBeenCalledTimes(2);
  });

  it("answers 502, not a crash, when the vote can't be written", async () => {
    sanity.commit.mockRejectedValueOnce(new Error("patch failed"));
    const res = await POST(post("/api/requests/vote", { id: "abc124" }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/didn't go through/);
  });
});

describe("POST /api/listen-report", async () => {
  const { POST, OPTIONS } = await import("@/app/api/listen-report/route");
  const meta = { where: "setup", family: "handpan", mode: "guided", heard: ["D3"], raw: [50], comment: "wrong note", takes: [] };
  const report = (headers: Record<string, string> = {}) => {
    const form = new FormData();
    form.set("meta", JSON.stringify(meta));
    return new Request("https://oakhum.com/api/listen-report", { method: "POST", headers: { origin: ORIGIN, "x-forwarded-for": `203.0.113.${++ip}`, ...headers }, body: form });
  };

  it("saves a report sent from the app", async () => {
    const res = await POST(report());
    expect(res.status).toBe(200);
    expect(sanity.create).toHaveBeenCalledWith(expect.objectContaining({ _type: "listenReport", comment: "wrong note" }));
  });

  it("answers the app's own Vercel address across origins, and nobody else", async () => {
    const res = await POST(report({ origin: "https://oakhum.vercel.app" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://oakhum.vercel.app");
    const evil = await POST(report({ origin: "https://evil.example" }));
    expect(evil.status).toBe(403);
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
    expect(OPTIONS(new Request("https://oakhum.com/api/listen-report", { method: "OPTIONS", headers: { origin: "https://evil.example" } })).headers.get("access-control-allow-origin")).toBeNull();
  });

  it("refuses an upload that is too big before reading it", async () => {
    const res = await POST(report({ "content-length": "9000000" }));
    expect(res.status).toBe(413);
    expect(sanity.create).not.toHaveBeenCalled();
  });

  it("stops the sixth report in ten minutes from one address", async () => {
    const from = { "x-forwarded-for": "198.51.100.3" };
    for (let i = 0; i < 5; i++) expect((await POST(report(from))).status).toBe(200);
    expect((await POST(report(from))).status).toBe(429);
  });
});
