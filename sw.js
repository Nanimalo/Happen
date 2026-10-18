// Service Worker: macht die App offline-fähig und installierbar.
// Die Versionsnummer kommt aus version.js – hier nichts ändern.
importScripts("./version.js");

const CACHE = "happen-shell-" + self.APP_VERSION;
const RUNTIME = "happen-runtime";

// Alle Dateien der App. Neue Datei angelegt? Hier eintragen.
const SHELL = [
  "./",
  "./index.html",
  "./version.js",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/store.js",
  "./js/ui.js",
  "./js/nutrition.js",
  "./js/off.js",
  "./js/scanner.js",
  "./js/ai.js",
  "./js/foods.js",
  "./js/garmin.js",
  "./js/views/onboarding.js",
  "./js/views/diary.js",
  "./js/views/add.js",
  "./js/views/product.js",
  "./js/views/fasting.js",
  "./js/views/recipes.js",
  "./js/views/progress.js",
  "./js/views/profile.js",
  "./data/basics.js",
  "./data/activities.js",
  "./data/recipes.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  // Kein skipWaiting hier: die App fragt den Nutzer, ob sie neu laden darf.
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("happen-shell-") && k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Produktdatenbank & KI immer live aus dem Netz (die App cacht Produkte selbst).
  if (url.hostname.includes("openfoodfacts") || url.hostname === "api.anthropic.com") return;

  // Schriften und Scanner-Bibliothek: einmal laden, dann offline verfügbar.
  if (url.hostname.includes("fonts.g") || url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(
      caches.open(RUNTIME).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // Eigene Dateien: zuerst aus dem Cache (schnell + offline).
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => caches.match("./index.html")))
    );
  }
});
