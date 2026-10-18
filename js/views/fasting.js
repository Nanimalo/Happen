// Intervallfasten: Pläne, Live-Timer, Phasen, Verlauf
import { state, commit } from "../store.js";
import { icon, esc, ring, sheet, toast, ask } from "../ui.js";
import { fmt1 } from "../nutrition.js";

export const live = true;

const PLANS = [
  { id: "12:12", h: 12, hint: "Einstieg" },
  { id: "14:10", h: 14, hint: "Sanft" },
  { id: "16:8", h: 16, hint: "Klassiker" },
  { id: "18:6", h: 18, hint: "Fortgeschritten" },
  { id: "20:4", h: 20, hint: "Warrior" },
  { id: "23:1", h: 23, hint: "Eine Mahlzeit" }
];
const PHASES = [
  [0, "Verdauung", "Dein Körper verarbeitet die letzte Mahlzeit."],
  [4, "Blutzucker sinkt", "Der Insulinspiegel geht zurück."],
  [8, "Umstellung", "Die Kohlenhydratspeicher (Glykogen) werden angezapft."],
  [12, "Fettverbrennung", "Der Körper nutzt zunehmend Fett als Energiequelle."],
  [16, "Ketose beginnt", "Bei vielen Menschen steigen jetzt die Ketonkörper – individuell verschieden."]
];

const pad = (n) => String(n).padStart(2, "0");
const hms = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };
const time = (ts) => new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const dayTime = (ts) => new Date(ts).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" });
const toLocalInput = (ts) => { const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

function planHours() { return PLANS.find((p) => p.id === state.fasting.plan)?.h ?? 16; }

export function render(root) {
  const F = state.fasting;
  const a = F.active;
  const goalH = a ? a.goalH : planHours();
  const hist = [...F.history].sort((x, y) => y.end - x.end);
  const reached = hist.filter((h) => (h.end - h.start) / 36e5 >= h.goalH).length;
  const avg = hist.length ? hist.reduce((s, h) => s + (h.end - h.start), 0) / hist.length / 36e5 : 0;
  const longest = hist.length ? Math.max(...hist.map((h) => (h.end - h.start) / 36e5)) : 0;

  root.innerHTML = `
    <header class="page-head"><h1>Fasten</h1><span class="badge">${esc(a ? a.plan || state.fasting.plan : state.fasting.plan)}</span></header>
    <section class="card fast-hero">
      <div class="fast-ring">
        <div data-ring>${ring(0, 1, { size: 240, stroke: 16, cls: "fast" })}</div>
        <div class="center">
          <small data-label>${a ? "Du fastest seit" : "Bereit zum Fasten"}</small>
          <b data-time class="num">${a ? "00:00:00" : goalH + " h"}</b>
          <small data-sub>${a ? "" : `${24 - goalH} h Essfenster`}</small>
        </div>
      </div>
      ${a ? `<div class="fast-times">
        <div><small>Gestartet</small><b class="num">${dayTime(a.start)}</b> <button class="link-btn" data-editstart>${icon("edit")}</button></div>
        <div><small>Ziel</small><b class="num">${dayTime(a.start + goalH * 36e5)}</b></div>
      </div>` : ""}
      <button class="btn ${a ? "ghost" : "accent"} block" data-toggle>${a ? "Fasten beenden" : "Fasten starten"}</button>
    </section>

    ${a ? `<section class="card"><div class="card-head"><h3>Was gerade passiert</h3></div><div class="phases" data-phases></div></section>` : `
    <section class="card">
      <div class="card-head"><h3>Dein Plan</h3></div>
      <div class="plan-grid">${PLANS.map((p) => `<button class="plan ${p.id === F.plan ? "on" : ""}" data-plan="${p.id}"><b>${p.id}</b><span>${p.hint}</span></button>`).join("")}</div>
      <p class="muted small" style="margin:12px 0 0">${planHours()} Stunden fasten, ${24 - planHours()} Stunden essen. Wasser, Tee und schwarzer Kaffee sind während der Fastenzeit erlaubt.</p>
    </section>`}

    <section class="card">
      <div class="card-head"><h3>Statistik</h3></div>
      <div class="stat-grid">
        <div class="stat"><small>Fastentage</small><b class="num">${hist.length}</b></div>
        <div class="stat"><small>Ø Dauer</small><b class="num">${fmt1(avg)}<small> h</small></b></div>
        <div class="stat"><small>Längstes</small><b class="num">${fmt1(longest)}<small> h</small></b></div>
      </div>
      ${hist.length ? `<div class="list" style="margin-top:8px">${hist.slice(0, 7).map((h) => {
        const dur = (h.end - h.start) / 36e5;
        return `<div class="item"><span class="t"><b>${new Date(h.end).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "short" })}</b><span>${time(h.start)} – ${time(h.end)} · Ziel ${h.goalH} h</span></span>
          <span class="k num" style="color:${dur >= h.goalH ? "var(--ok)" : "var(--muted)"}">${fmt1(dur)} h</span><button class="icon-btn" data-delh="${h.start}" aria-label="Löschen">${icon("trash")}</button></div>`;
      }).join("")}</div><p class="muted small" style="margin:6px 0 0">${reached} von ${hist.length} Fastenperioden mit erreichtem Ziel.</p>` : ""}
    </section>
    <p class="muted small" style="margin:0 4px">Intervallfasten ist nicht für alle geeignet, etwa in Schwangerschaft und Stillzeit, bei Diabetes oder Essstörungen. Sprich im Zweifel mit deiner Ärztin oder deinem Arzt.</p>`;

  const tick = () => {
    if (!F.active) return;
    const el = Date.now() - F.active.start;
    const goal = goalH * 36e5;
    root.querySelector("[data-time]").textContent = hms(el);
    root.querySelector("[data-sub]").textContent = el < goal ? `noch ${hms(goal - el)}` : `Ziel erreicht · +${hms(el - goal)}`;
    root.querySelector("[data-ring]").innerHTML = ring(el, goal, { size: 240, stroke: 16, cls: "fast" });
    const h = el / 36e5;
    const ph = root.querySelector("[data-phases]");
    if (ph) ph.innerHTML = PHASES.map(([from, t, d], i) => {
      const next = PHASES[i + 1]?.[0] ?? Infinity;
      const cls = h >= next ? "done" : h >= from ? "now" : "";
      return `<div class="phase ${cls}"><span class="dot"></span><div><b>${t} <span class="muted small">ab ${from} h</span></b><span>${d}</span></div></div>`;
    }).join("");
  };
  tick();
  const iv = setInterval(tick, 1000);

  root.querySelectorAll("[data-plan]").forEach((b) => (b.onclick = () => { F.plan = b.dataset.plan; commit(); }));
  root.querySelector("[data-toggle]").onclick = async () => {
    if (!F.active) {
      F.active = { start: Date.now(), goalH: planHours(), plan: F.plan };
      commit();
      toast(`Fasten gestartet – Ziel ${planHours()} Stunden`);
    } else {
      const dur = (Date.now() - F.active.start) / 36e5;
      if (dur < F.active.goalH && !(await ask("Fasten beenden?", `Du hast ${fmt1(dur)} von ${F.active.goalH} Stunden geschafft.`, "Beenden"))) return;
      if (dur >= 0.25) F.history.push({ start: F.active.start, end: Date.now(), goalH: F.active.goalH });
      F.history = F.history.slice(-200);
      F.active = null;
      commit();
      toast(dur >= goalH ? `Geschafft: ${fmt1(dur)} Stunden!` : `${fmt1(dur)} Stunden gefastet`);
    }
  };
  root.querySelector("[data-editstart]")?.addEventListener("click", () => sheet({
    title: "Startzeit ändern",
    body: `<label class="field"><span>Begonnen am</span><input class="input" type="datetime-local" id="fs" value="${toLocalInput(F.active.start)}" max="${toLocalInput(Date.now())}"></label><button class="btn primary block" data-ok>Speichern</button>`,
    onMount: (s, close) => (s.querySelector("[data-ok]").onclick = () => {
      const t = new Date(s.querySelector("#fs").value).getTime();
      if (t && t <= Date.now()) { F.active.start = t; commit(); close(); }
    })
  }));
  root.querySelectorAll("[data-delh]").forEach((b) => (b.onclick = () => { F.history = F.history.filter((h) => h.start !== +b.dataset.delh); commit(); }));
  return () => clearInterval(iv);
}
