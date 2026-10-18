// ============================================================
//  HAPPEN – Start der App: Navigation, Design, Updates.
//  Neue Seite hinzufügen: Datei in js/views/ anlegen,
//  unten in ROUTES eintragen und in sw.js aufnehmen.
// ============================================================
import { state, ui, subscribe, todayKey, commit } from "./store.js";
import { closeAllSheets, closeTopSheet, toast } from "./ui.js";
import * as diary from "./views/diary.js";
import * as fasting from "./views/fasting.js";
import * as recipes from "./views/recipes.js";
import * as progress from "./views/progress.js";
import * as profile from "./views/profile.js";
import { runOnboarding } from "./views/onboarding.js";
import { openAdd, scanAndAdd } from "./views/add.js";

const ROUTES = { diary, fasting, recipes, progress, profile };
const view = document.getElementById("view");
let current = null;
let cleanup = null;

ui.date = todayKey();

// ---------- Design (hell/dunkel) ----------
export function applyTheme() {
  const t = state.settings.theme;
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}
applyTheme();

// ---------- Navigation ----------
function route() {
  let name = location.hash.slice(1) || "diary";
  if (name === "scan") { history.replaceState(null, "", "#diary"); name = "diary"; setTimeout(() => scanAndAdd(), 300); }
  if (!ROUTES[name]) name = "diary";
  if (name !== current) {
    cleanup?.(); cleanup = null;
    current = name;
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("#tabbar a").forEach((a) => a.classList.toggle("active", a.dataset.tab === current));
  render();
}

let rafId = 0;
function render() {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    const y = window.scrollY;
    const r = ROUTES[current];
    const c = r.render(view);
    if (typeof c === "function") { cleanup?.(); cleanup = c; }
    window.scrollTo(0, y);
  });
}

subscribe(() => { if (ROUTES[current]?.live !== false) render(); });
window.addEventListener("hashchange", () => { closeAllSheets(); route(); });

document.getElementById("tab-add").onclick = () => openAdd(null, ui.date);

// Zurück-Taste (Android) schließt zuerst offene Fenster
window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeTopSheet(); });

// Tageswechsel um Mitternacht: "Heute" springt mit
let lastToday = todayKey();
setInterval(() => {
  const t = todayKey();
  if (t !== lastToday) { if (ui.date === lastToday) ui.date = t; lastToday = t; render(); }
}, 60000);

// ---------- Updates & Offline ----------
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((reg) => {
    const bar = document.getElementById("update-bar");
    const offer = (w) => {
      bar.hidden = false;
      document.getElementById("update-btn").onclick = () => { w.postMessage("SKIP_WAITING"); bar.hidden = true; };
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offer(w); });
    });
    // Beim Zurückkehren in die App nach Updates schauen
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
}
navigator.storage?.persist?.().catch(() => {});
window.addEventListener("offline", () => toast("Offline – Suche nutzt gespeicherte Produkte"));

// ---------- Start ----------
(async () => {
  if (!state.profile.onboarded) {
    document.body.classList.add("onboarding");
    await runOnboarding();
    document.body.classList.remove("onboarding");
    state.profile.onboarded = true;
    commit();
  }
  route();
})();
