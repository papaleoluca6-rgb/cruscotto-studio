# PWA technical capabilities and free services for a no-backend study planner used from mainland China (late 2026)

Note on method: besides web sources, on 2026-11-19 I ran CORS preflight probes (`curl -X OPTIONS` with `Origin: https://example.github.io`, `Access-Control-Request-Method: POST`, `Access-Control-Request-Headers: authorization,content-type`) against each AI endpoint from the user's PC. The egress IP of that PC geolocated to **JP** (ipinfo.io), i.e. the VPN was very likely on, so these probes test CORS headers, NOT reachability from a Chinese IP. Probe results are cited as "[probe 2026-11-19]".

## 1. Notifications / reminders without a server on Android Chrome

### Takeaway
No browser API can reliably fire a notification at a future time without a push server: Notification Triggers is dead, and Periodic Background Sync is opportunistic (roughly daily at best, not on time). The reliable serverless option is to write `reminders` (popup) onto the study events through the Calendar API and let the Google Calendar Android app ring them. In-app notifications only work while the app is open or the service worker happens to be running.

### Cited Findings
- Notification Triggers API (`showTrigger` + `TimestampTrigger`): Chrome's page says development "has ended". Origin trial "Complete", Launch "Not started". Reason given: "It wasn't clear that we could provide consistent and reliable experiences across platforms." — [Chrome for Developers: Notification Triggers](https://developer.chrome.com/docs/web-platform/notification-triggers)
- Periodic Background Sync works only for an installed app launched as a standalone app, "not available in the context of a regular tab". The `periodicsync` event "won't be fired at all unless the engagement score is greater than zero". Frequency follows how often the user opens the app. Syncs run only on a previously connected network, and the browser also weighs battery and connectivity. You get "the opportunity to sync, not a guarantee". The example uses `minInterval` of one day. — [Chrome for Developers: Periodic Background Sync](https://developer.chrome.com/docs/capabilities/periodic-background-sync)
- Calendar `reminders`: `useDefault` (boolean) plus `overrides[]` with `method` = `"email"` or `"popup"` and `minutes` 0–40320 (4 weeks). "The maximum number of override reminders is 5." Changing reminders does not update the event's `updated` timestamp. Reminders are "for the authenticated user". — [Calendar API v3 Events resource](https://developers.google.com/workspace/calendar/api/v3/reference/events)
- On Android an installed PWA gets a notification dot on its icon automatically when it has an unread notification. — [Chrome for Developers: Badging API](https://developer.chrome.com/docs/capabilities/web-apis/badging-api)

### Inferences
- Most reliable reminder: when the app creates or moves a study session (already behind preview and confirmation), set `reminders: {useDefault:false, overrides:[{method:'popup', minutes:10}]}`. It needs no new scope (`calendar.events` already covers it). The Google Calendar Android app then rings the popup even when the PWA is closed. Caveat for China: the Calendar app must have synced the event (VPN on at some point after the write). After that the alarm is presumably scheduled locally on the phone, but I found no source confirming offline popup delivery.
- In-app: `registration.showNotification()` from the service worker works when triggered while the app or SW is alive, for example an "open the app → check overdue sessions → notify" pattern or a `setTimeout` while the tab is open. Treat it as best effort.
- Periodic Background Sync could pre-fetch Calendar data about once a day, but in China it would fail when the VPN is off. It also has no Google token, since GIS tokens are in memory and need a UI context. So it is of little use here beyond local recomputation and a local notification.
- Web Push (VAPID) needs a server to send pushes, and the push service for Chrome (FCM) is Google-hosted, so it needs VPN in China. Not compatible with "no backend".

### Gaps
- No official source on whether Google Calendar Android popup reminders fire while offline, or with the VPN off after sync.
- No 2026 Chrome source on any successor to Notification Triggers (none found).

## 2. Sync between phone and PC without a backend

### Takeaway
Google Drive `appDataFolder` (scope `drive.appdata`, "non-sensitive") is the best fit. It is hidden from the user, callable from the browser (CORS OK), and free within the user's Drive space, but it needs the VPN in China like Calendar. File System Access is local only (no cross-device sync), so the JSON export/import remains the China-without-VPN fallback.

### Cited Findings
- `appDataFolder` requires scope `https://www.googleapis.com/auth/drive.appdata`, described as a "non-sensitive scope". Its contents are "hidden from the user and from other Google Drive apps", it "can't be accessed using the Drive UI", and only the creating app can access it. Files can't be shared, moved between spaces or trashed (`notSupportedForAppDataFolderFiles`). "The application data folder is deleted when a user uninstalls your app from their My Drive." To create: `files.create` with `parents:['appDataFolder']`. To list: `files.list` with `spaces=appDataFolder`. To download: `files.get?alt=media`. — [Drive API: Store application-specific data](https://developers.google.com/workspace/drive/api/guides/appdata)
- The Drive v3 endpoint answers a CORS preflight from a github.io origin with `Access-Control-Allow-Origin: https://example.github.io`, methods including PATCH and POST, and headers `authorization,content-type`. — [probe 2026-11-19]
- File System Access API: Chrome docs say it is "supported on most Chromium browsers on Windows, macOS, ChromeOS, Linux, and Android". Older text said Android support was "being worked on" (crbug 1011535). — [Chrome for Developers: File System Access](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access); the save-a-file pattern recommends feature detection with an `<a download>` fallback — [web.dev: Save a file](https://web.dev/patterns/files/save-a-file)

### Inferences
- Implementation: request `calendar.events drive.appdata` in the same GIS token client (incremental consent is possible). Store one `cruscotto-sync.json` (or one file per table) and use `modifiedTime` or a version counter for last-write-wins or merge. Since the same Google account and VPN are already needed for Calendar, Drive adds no new dependency. It is a new scope, though, so the OAuth consent screen changes. `drive.appdata` is non-sensitive, so no Google verification burden is expected.
- Plausible Drive-free sync options: a manual JSON file shared through WeChat "File Transfer" (文件传输助手) or a QR code for small payloads. Both work in China without a VPN and need no service.
- File System Access does not sync across devices by itself. Pointing it at a folder synced by a third-party client (OneDrive, Nutstore/坚果云) works only on the PC.

### Gaps
- Not confirmed from the official page: whether `appDataFolder` files count against the user's 15 GB Drive quota (widely believed yes, but the page fetched does not say).
- Free China-reachable cloud stores with browser CORS and no server (for example Nutstore WebDAV) were not researched. WebDAV from the browser usually lacks CORS, which is unverified.

## 3. Free AI providers callable directly from the browser and reachable from China

### Takeaway
Several Chinese providers answer CORS preflights with permissive headers and expose OpenAI-compatible `/chat/completions` on domestic hosts, so the existing "OpenAI-compatible" provider can target them without code changes beyond presets. The strongest free candidates are **SiliconFlow free models** (CORS `*`), **ModelScope API-Inference** (CORS `*`, 2,000 req/day), **Zhipu GLM-*-Flash** (free, but the preflight response lacked `Access-Control-Allow-Origin`: likely blocked in the browser), and **Tencent hunyuan-lite / Baidu Qianfan Speed/Lite** (CORS OK, free status needs console check). **Groq is blocked for Greater China.** **Cloudflare Workers AI's REST API has no CORS**, so it needs a Worker, which counts as a server. **OpenRouter** has CORS `*` and `:free` models but is a foreign host (reachability without VPN not confirmed).

### Cited Findings
CORS probe results [probe 2026-11-19] (preflight for POST with `authorization,content-type`):
- `api.siliconflow.cn/v1/chat/completions`: 204, `Access-Control-Allow-Origin: *`, Allow-Headers `*`. Browser OK.
- `api-inference.modelscope.cn/v1/chat/completions`: 204, ACAO `*`, Allow-Headers includes `Authorization, Content-Type`. Browser OK.
- `dashscope.aliyuncs.com/compatible-mode/v1/...` (Alibaba Bailian/Qwen): 200, ACAO `*`, headers `authorization, content-type`. Browser OK.
- `qianfan.baidubce.com/v2/chat/completions` (Baidu): 200, ACAO `*`, headers `*`. Browser OK.
- `api.hunyuan.cloud.tencent.com/v1/chat/completions` (Tencent): ACAO echoes origin, headers `authorization,content-type` (status 404 on OPTIONS, but CORS headers present). Probably OK; verify in a real browser.
- `api.deepseek.com/chat/completions`: ACAO echoes origin. Browser OK (paid only, no free tier).
- `ark.cn-beijing.volces.com/api/v3` (ByteDance Volcengine Ark): ACAO echoes origin. Browser OK.
- `open.bigmodel.cn/api/paas/v4/chat/completions` (Zhipu): **OPTIONS returned 200 with no `Access-Control-Allow-Origin` header** (only `Vary: Origin`). The actual POST (401) did carry ACAO. Since browsers require ACAO on the preflight, direct browser calls with an `Authorization` header are **likely blocked**. Needs confirming in Chrome DevTools.
- `openrouter.ai/api/v1/chat/completions`: 204, ACAO `*`. Browser OK.
- `generativelanguage.googleapis.com/v1beta/openai/...` (Gemini OpenAI-compat): ACAO echoes origin. Browser OK (VPN needed in China).
- `api.groq.com`: **403 "Access denied. Please check your network settings."** even from the JP egress.
- `api.cloudflare.com/client/v4/.../ai/...`: no CORS headers on OPTIONS (405) or POST.
- `spark-api-open.xf-yun.com` (iFlytek Spark): 403 on OPTIONS, no CORS headers. Likely not browser-callable.

Provider facts:
- Zhipu: GLM-4-Flash-250414 is "智谱首个免费的大模型 API", 128K context, free. No rate limits published on the page. — [BigModel docs: GLM-4-Flash-250414](https://docs.bigmodel.cn/cn/guide/models/free/glm-4-flash-250414). Aggregator (May 2026) lists GLM-4.7-Flash, GLM-4.6V-Flash (vision) and GLM-4.5-Flash as free, OpenAI-compatible, sign-up by email or phone at open.bigmodel.cn, no card. — [free-model.com: China's free LLM ecosystem (2026-05-14)](https://fremodel.pages.dev/blog/china-free-llm-ecosystem). Aggregators report about 1 concurrent request on free Flash models, and one says GLM-4.5-Flash retirement was announced (unconfirmed, conflicting). — [freellm.net GLM-4.5-Flash](https://freellm.net/models/z-ai-zhipu-ai/glm-4-5-flash-retirement-announced), [developersdigest](https://www.developersdigest.tech/models/free-api/zai)
- SiliconFlow: free models (e.g. DeepSeek-R1-Distill-Qwen-7B, Qwen3-8B, GLM-4-9B-Chat), base URL `https://api.siliconflow.cn/v1`, OpenAI-compatible. **Phone verification required for Chinese users.** Aggregator figure: 1,000 RPM / 50K TPM for free models. — [free-model.com](https://fremodel.pages.dev/blog/china-free-llm-ecosystem). Conflicting aggregator figure: 30 RPM / 60K TPM for one free model. Official docs give general chat ranges "RPM=1000-10000 TPM=50000-5000000" without confirming free-tier values. — [SiliconFlow rate limits](https://docs.siliconflow.cn/en/userguide/rate-limits/rate-limit-and-upgradation)
- ModelScope (Alibaba): `https://api-inference.modelscope.cn/v1`, OpenAI-compatible, free Qwen3.5-35B-A3B and Qwen3.5-27B. Limit 2,000 requests/day total, ≤500 per model. Sign-up with an Alibaba Cloud account or phone, then an access token. — [free-model.com](https://fremodel.pages.dev/blog/china-free-llm-ecosystem)
- Tencent hunyuan-lite: reportedly made free in the May 2024 price cut. Aggregator lists 1M tokens and 5 RPM. OpenAI-compatible base `https://api.hunyuan.cloud.tencent.com/v1`. Sources conflict on pricing; check the Tencent Cloud console. — [CometAPI hunyuan-lite](https://www.cometapi.com/zh-CN/models/hunyuan/hunyuan-lite/), [yangmao.ai Hunyuan](https://yangmao.ai/zh/providers/hunyuan/)
- Baidu Qianfan ERNIE Speed/Lite: described as free for verified users, but "verify the current free list" before claiming permanent free. Qianfan/AI Studio offer OpenAI-compatible access. — [yangmao.ai ERNIE](https://yangmao.ai/zh/providers/ernie/open-source-alternative/), [Baidu AI Studio docs](https://ai.baidu.com/ai-doc/AISTUDIO/Mmhslv9lf)
- OpenRouter `:free` models: 20 req/min and 50 req/day (accounts with <$10 lifetime credit purchases). A one-time $10 purchase raises this to 1,000/day, which is paid. Failed calls count. Resets at 00:00 UTC. — [OpenRouter pricing](https://openrouter.ai/pricing), [OpenRouter FAQ](https://openrouter.ai/docs/faq.md)
- Groq: the community forum says GroqCloud serves everywhere except restricted regions including **Greater China**. Users in China report 403. — [Groq community: geographic regions](https://community.groq.com/t/what-geographic-regions-does-groqcloud-serve/833), [Groq community: 403 China](https://community.groq.com/t/api-key-403-forbidden-china/1168)

### Inferences
- Recommended presets for the existing OpenAI-compatible provider, all on domestic hosts and expected to work without VPN: SiliconFlow (`https://api.siliconflow.cn/v1`), ModelScope (`https://api-inference.modelscope.cn/v1`), Alibaba Bailian/DashScope (`https://dashscope.aliyuncs.com/compatible-mode/v1`, with a signup token grant rather than a permanent free tier), Tencent Hunyuan (`https://api.hunyuan.cloud.tencent.com/v1`), Baidu Qianfan v2 (`https://qianfan.baidubce.com/v2`). Zhipu should be offered only after a real-browser test, given the missing preflight ACAO.
- All Chinese providers effectively require a Chinese phone number for sign-up (SiliconFlow explicitly, others "phone or Alibaba account"). The user lives in China, so this is likely feasible, but it is a precondition to state. Some may require real-name verification (实名认证) for API keys; this was not confirmed.
- A key stored in `db.settings` and sent from the browser is visible to the device owner only. That is acceptable for a personal app, but keys must never be committed (public repo).
- Free tiers (ModelScope 2,000/day, SiliconFlow free models, Zhipu Flash) are ample for a few planning calls per day. Low concurrency (Zhipu: 1) means requests should be serialized.
- The specific error messages required by CLAUDE.md map naturally onto these cases: Groq-style 403 means "region blocked"; a CORS failure shows up as `TypeError: Failed to fetch` with no status.

### Gaps
- Reachability without VPN from a Chinese IP was not tested (probe egress was JP). It is inferred from domestic `.cn`/`.com.cn`-operated hosts.
- Zhipu's CORS behaviour in an actual browser was not tested (curl only).
- Official free-tier RPM/RPD for SiliconFlow, Zhipu, Hunyuan and Qianfan are not published or not confirmed. Aggregators conflict.
- Whether OpenRouter (`openrouter.ai`) is reachable from mainland China without VPN in 2026: no reliable source found.
- Cloudflare Workers AI free allocation was not researched further, since it needs a Worker (a server) for CORS and `*.workers.dev` reachability in China is unreliable (unverified).

## 4. Other PWA conveniences on Android (Chrome, installed WebAPK)

### Takeaway
App shortcuts (max 3 shown on Android), Web Share / Share Target, notifications with the automatic icon dot, Wake Lock, and Vibration are usable. The numeric Badging API is desktop only (Windows/macOS), and home-screen widgets for PWAs are not available on Android.

### Cited Findings
- App shortcuts: defined in manifest `shortcuts` (`name`, `url`, optional `short_name`, `description`, `icons`), static, "best-effort", only when installed. "Chrome on Android shows only the first three", followed by "App Info" and "Site Settings". Desktop shows up to 10. Available "on Android with WebAPK". — [web.dev Learn PWA: Enhancements](https://web.dev/learn/pwa/enhancements)
- Badging API (`navigator.setAppBadge(n)`): Windows and macOS on Chrome/Edge 81+; **not supported on Android**, where Android only shows a dot driven by unread notifications. Requires an installed app. — [Chrome for Developers: Badging API](https://developer.chrome.com/docs/capabilities/web-apis/badging-api), [MDN: Display a badge on the app icon](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Display_badge_on_app_icon)
- 2026: Chrome for Android lets installed PWAs draw edge to edge behind the status bar. — [tech-ish, 2026-07-15](https://tech-ish.com/2026/07/15/google-chrome-for-android-pwa-edge-to-edge/)
- PWA home-screen widgets: searches turned up no Android/Chrome support. The web.dev enhancements page does not document widgets. — [web.dev Learn PWA: Enhancements](https://web.dev/learn/pwa/enhancements)

### Inferences
- Useful shortcuts (max 3 on Android): "Oggi", "Segna sessione", "Flashcard" via `?action=` URLs.
- PC (Windows, installed): `setAppBadge(count of sessions due today)`. Android gets a dot only when a notification is pending.
- Web Share (`navigator.share`) can send the week's plan as text or a JSON backup file to WeChat or email, which doubles as a no-server sync path. The Web Share Target manifest entry could let the user share text or a JSON backup into the app (e.g. "import backup" from the file manager or WeChat). This is believed supported on Android installed WebAPKs but not confirmed by a source fetched here.
- Screen Wake Lock (keep the screen on during a Pomodoro or study timer) and `navigator.vibrate` (end-of-timer buzz) are believed supported on Chrome Android. Not verified against MDN in this session.
- Offline-first: the current Dexie + `vite-plugin-pwa` precache already matches the pattern. Add a queue of pending Calendar writes, replayed when online and the token is valid, and show a "VPN/online" state indicator.

### Gaps
- Web Share Target, Wake Lock and Vibration support details were not fetched from MDN or Chrome docs (time budget). Verify before speccing.
- No authoritative 2026 statement on PWA widgets (Windows Widgets Board support for PWAs existed earlier in Edge; Android not found).

## 5. Google Calendar API features useful here

### Takeaway
Use `extendedProperties.private` (queryable with `privateExtendedProperty=key=value`) to tag app-created study events instead of parsing titles. Use `reminders.overrides` for phone alarms, `colorId` for status colour, `source` for a back-link, and `syncToken` for cheap incremental refresh. Push notifications (`watch`) need an HTTPS server, so they are not usable. Quotas are generous and free.

### Cited Findings
- `extendedProperties.private`: "Properties that are private to the copy of the event that appears on this calendar". `shared`: shared between attendees' copies. Key-value strings. — [Events resource](https://developers.google.com/workspace/calendar/api/v3/reference/events)
- `events.list` `privateExtendedProperty`: "Extended properties constraint specified as propertyName=value. Matches only private properties." It can be repeated. `syncToken` returns only entries changed since the last list, and an expired token returns 410 GONE. `updatedMin` filters by last modification time. `timeZone` sets the response time zone. `singleEvents` expands recurring events. — [Events: list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
- `colorId` refers to the `event` palette from the colors endpoint. The newer `eventLabelId` "supersedes the index-based colorId". `source` {`title`, `url` (http/https)} "can only be seen or modified by the creator of the event". — [Events resource](https://developers.google.com/workspace/calendar/api/v3/reference/events)
- Reminders: `popup`/`email`, ≤5 overrides, 0–40320 minutes, per authenticated user. — [Events resource](https://developers.google.com/workspace/calendar/api/v3/reference/events)
- Push notifications require an HTTPS `address` with a valid, non-self-signed SSL certificate that handles POSTs. Channels expire and do not auto-renew. "Notifications are not 100% reliable." **This needs a server, so it is excluded.** — [Calendar API: Push notifications](https://developers.google.com/workspace/calendar/api/guides/push)
- Quotas: 600 requests per minute per user per project, and 10,000 per minute per project, on a sliding window. "All use of the Google Calendar API is available at no additional cost". Exceeding quota causes no charges. Errors: 403 `userRateLimitExceeded` / `quotaExceeded`. — [Calendar API: Manage quotas](https://developers.google.com/workspace/calendar/api/guides/quota); a third-party source mentions a 1,000,000/day billing threshold with billing details "later in 2026", which is unconfirmed by Google — [Nylas guide](https://cli.nylas.com/guides/google-calendar-api-quotas)

### Inferences
- Tag events created or moved by the app with `extendedProperties.private = {cruscotto:'1', subjectId, sessionId}`. This makes the "only study events, never lessons" rule robust: filter with `privateExtendedProperty=cruscotto=1`. Keep title parsing as a fallback for events the user created by hand. Private properties are not shared to attendees and are visible only on this calendar copy.
- `syncToken` plus Dexie cache means the app can do a cheap delta refresh whenever it is opened with the VPN on, which replaces push.
- `colorId` can mirror status (done, partial, rescheduled) alongside the allowed ✅ ◐ ↻ ✗ title markers. Note that `eventLabelId` is newer, and its availability via the API should be checked.
- `source.url` can deep-link the event back to the PWA (e.g. `https://<user>.github.io/cruscotto-studio/#/session/<id>`). It is visible only to the creator.

### Gaps
- Whether `eventLabelId` is generally available or how it maps to `colorId` was not researched.
- No official confirmation of the "later in 2026" Calendar API billing change mentioned by Nylas.
