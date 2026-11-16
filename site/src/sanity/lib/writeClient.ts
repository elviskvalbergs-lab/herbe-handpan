import "server-only";
import { client } from "./client";
import { writeToken } from "../env";

/** Server-only client with the write token, for the request API routes. Null until configured. */
export const writeClient = writeToken ? client.withConfig({ token: writeToken, useCdn: false }) : null;
