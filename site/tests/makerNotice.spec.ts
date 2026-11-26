import { describe, expect, it } from "vitest";
import { makerNotice } from "@/lib/makerNotice";

const REQUEST = {
  name: "Tartu Kalimba", slug: "tartu-kalimba", kind: "shop", place: "Tartu", country: "EE",
  website: "https://tartu.example", families: ["kalimba", "tongue-drum"], request_note: "We sell about 200 a year.\nMostly 17-key.",
  resent: false, email: "shop@example.com",
};

describe("the owner's email about a maker request", () => {
  it("says who asks, what they make, how to reach them, and where to approve it", () => {
    const n = makerNotice(REQUEST, "https://oakhum.com/")!;
    expect(n.subject).toBe("New maker request: Tartu Kalimba");
    expect(n.text).toContain("Tartu Kalimba asks to join Oakhum as a shop.");
    expect(n.text).toContain("Shop · Tartu, Estonia");
    expect(n.text).toContain("Makes or sells: kalimba, tongue drum");
    expect(n.text).toContain("Website: https://tartu.example");
    expect(n.text).toContain("Email: shop@example.com");
    expect(n.text).toContain("https://oakhum.com/makers/tartu-kalimba");
    expect(n.text).toContain("We sell about 200 a year.\nMostly 17-key.");
    expect(n.text).toContain("https://oakhum.com/play#maker/review");
    expect(n.text).not.toMatch(/\n\n\n/);
  });

  it("a request sent again says so", () => {
    const n = makerNotice({ ...REQUEST, resent: true }, "https://oakhum.com")!;
    expect(n.subject).toBe("Maker request, sent again: Tartu Kalimba");
    expect(n.text).toContain("has changed their request and sent it again");
  });

  it("nothing the maker typed can break the subject or claim a website that isn't one", () => {
    const n = makerNotice({ ...REQUEST, name: "Evil\r\nBcc: everyone@example.com", website: "javascript:alert(1)", request_note: "" }, "https://oakhum.com")!;
    expect(n.subject).not.toMatch(/[\r\n]/);
    expect(n.text).toContain("Website: none given");
    expect(n.text).toContain("No note.");
  });

  it("no request, no email", () => {
    expect(makerNotice(null, "https://oakhum.com")).toBeNull();
    expect(makerNotice({ name: "" }, "https://oakhum.com")).toBeNull();
    expect(makerNotice("nope", "https://oakhum.com")).toBeNull();
  });
});
