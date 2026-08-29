/* Minimal service worker (no Workbox):
 * - app shell (navigation + static assets): cache-first, refreshed in the background;
 * - GET /api/*: network-first with a cache fallback, so dictionaries (types, statuses,
 *   organizations) and the last loaded marks are available offline.
 * Non-GET requests are never intercepted. */
const VERSION = "wave4-1";
const SHELL_CACHE = `shell-${VERSION}`;
const API_CACHE = `api-${VERSION}`;
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icon.svg", "/vite.svg"];

/** API paths worth keeping offline (read-only dictionaries and lists). */
const CACHEABLE_API = [
    /^\/api\/marks\/types$/,
    /^\/api\/marks\/statuses$/,
    /^\/api\/tasks\/statuses$/,
    /^\/api\/organizations$/,
    /^\/api\/marks(\?.*)?$/,
    /^\/api\/map\/admin-boundaries/,
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== API_CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

function isCacheableApi(url) {
    const path = url.pathname + url.search;
    return CACHEABLE_API.some((re) => re.test(path));
}

/** Network first; a successful response is cached (keyed by URL + Accept-Language). */
async function networkFirst(request) {
    const key = cacheKey(request);
    const cache = await caches.open(API_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(key, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(key);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

/** Dictionaries are localized: keep one cached copy per language. */
function cacheKey(request) {
    const lang = request.headers.get("Accept-Language") || "";
    const url = new URL(request.url);
    url.searchParams.set("__lang", lang);
    return new Request(url.toString(), { method: "GET" });
}

/** Cache first for the app shell; the cache is refreshed in the background. */
async function cacheFirst(request) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request)
        .then((response) => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => undefined);
    if (cached) {
        return cached;
    }
    const response = await network;
    if (response) {
        return response;
    }
    // offline and nothing cached for this URL: fall back to the shell for navigations
    if (request.mode === "navigate") {
        const shell = await cache.match("/");
        if (shell) {
            return shell;
        }
    }
    return Response.error();
}

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") {
        return;
    }
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) {
        return; // map tiles, fonts, etc. are left to the browser
    }
    if (url.pathname.startsWith("/api/")) {
        if (isCacheableApi(url)) {
            event.respondWith(networkFirst(request));
        }
        return;
    }
    if (request.mode === "navigate" || /\.(js|css|svg|png|ico|woff2?|webmanifest)$/.test(url.pathname)) {
        event.respondWith(cacheFirst(request));
    }
});
