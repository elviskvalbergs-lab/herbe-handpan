import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestForm } from "@/components/RequestForm";
import { RequestVotes } from "@/components/RequestVotes";
import { container } from "@/lib/ui";
import { getPublicRequests } from "@/sanity/lib/data";

export const metadata: Metadata = {
  title: "Ask for an instrument or a feature",
  description: "Missing an instrument, a tuning or a feature in Oakhum? Ask for it, and vote for what others have asked for.",
};

export default async function RequestPage() {
  const requests = await getPublicRequests();
  return (
    <div className={`${container} flex flex-wrap items-start gap-16 pt-14 pb-24`}>
      <div className="min-w-0 max-w-[640px] flex-[1_1_520px]">
        <h1 className="m-0 mb-4 text-[clamp(38px,5vw,56px)] font-semibold leading-[1.04] tracking-[-0.025em]">Ask for what you play</h1>
        <p className="m-0 mb-9 text-[19px] text-body">Missing an instrument, a tuning or a feature? Tell us. The most requested ones are built first.</p>
        <Suspense fallback={null}>
          <RequestForm />
        </Suspense>
      </div>
      <aside className="min-w-0 flex-[1_1_360px]">
        <h2 className="m-0 mb-1.5 text-[28px] font-semibold">Asked for by others</h2>
        <p className="m-0 mb-5 text-body">Vote for the ones you’d use. Votes move them up the list.</p>
        <RequestVotes requests={requests} />
      </aside>
    </div>
  );
}
