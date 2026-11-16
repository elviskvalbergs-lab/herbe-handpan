import { body, point, qa, seo } from "./shared";
import { siteSettings } from "./siteSettings";
import { homePage } from "./homePage";
import { instrument } from "./instrument";
import { feature } from "./feature";
import { request } from "./request";
import { page } from "./page";

export const schemaTypes = [siteSettings, homePage, instrument, feature, request, page, point, qa, seo, body];
