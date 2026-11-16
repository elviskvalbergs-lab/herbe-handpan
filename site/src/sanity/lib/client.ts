import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId } from "../env";

// The placeholder id only keeps the client constructor from throwing when the
// project is not provisioned yet; every read goes through `fetchData`, which
// returns null while `hasSanity` is false.
//
// `stega.studioUrl` is what lets Sanity encode "edit this field" links into
// strings. Stega stays off on the client itself: `fetchData` turns it on per
// request, and only in draft mode, so published pages never carry it. The
// relative URL points at the Studio embedded at /studio on whatever origin the
// site is served from.
export const client = createClient({
  projectId: projectId || "missing-project-id",
  dataset,
  apiVersion,
  // Not the API CDN: a refetch after an edit could get the revision from before it.
  useCdn: false,
  perspective: "published",
  stega: { studioUrl: "/studio" },
});
