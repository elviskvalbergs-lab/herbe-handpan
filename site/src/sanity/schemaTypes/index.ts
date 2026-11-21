import { body, point, qa, seo } from "./shared";
import { siteSettings } from "./siteSettings";
import { homePage } from "./homePage";
import { makersPage } from "./makersPage";
import { songsPage } from "./songsPage";
import { instrument } from "./instrument";
import { feature } from "./feature";
import { request } from "./request";
import { listenReport } from "./listenReport";
import { page } from "./page";

export const schemaTypes = [siteSettings, homePage, makersPage, songsPage, instrument, feature, request, listenReport, page, point, qa, seo, body];
