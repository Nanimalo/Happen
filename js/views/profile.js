// Profil: Ziele, Körperdaten, KI, Darstellung, Datensicherung
import { state, commit, todayKey, resetAll, replaceAll, latestWeight, MEALS } from "../store.js";
import { DIETS, ACTIVITY_LEVELS, goalFor, autoKcal, tdee, bmr, minKcal, fmt, fmt1, entryValues } from "../nutrition.js";
import { icon, esc, sheet, toast, ask } from "../ui.js";
import { applyTheme } from "../app.js";

export const live = true;
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });

export function render(root) {
  const p = state.profile, g = goalFor(todayKey()), s = state.settings;
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  root.innerHTML = `
    <header class="page-head"><a class="icon-btn" href="#diary" aria-label="Zurück">${icon("left")}</a><h1>Profil</h1></header>
    <section class="card profile-hero">
      <span class="avatar">${esc((p.name || "?")[0].toUpperCase())}</span>
      <div style="flex:1;min-width:0"><h3>${esc(p.name || "Ohne Namen")}</h3><span class="muted small">${fmt1(latestWeight())} kg · Ziel ${fmt1(p.goalWeight)} kg</span></div>
      <span class="pro-badge">PRO</span>
    </section>

    <p class="section-label">Ziele</p>
    <section class="card list" style="padding:2px 16px">
      <button class="menu-item" data-open="goals">${icon("flame")}<span>Kalorien & Makros</span><em class="num">${fmt(g.kcal)} kcal</em>${icon("right")}</button>
      <button class="menu-item" data-open="body">${icon("user")}<span>Körperdaten & Gewichtsziel</span><em>${p.goal === "lose" ? "Abnehmen" : p.goal === "gain" ? "Zunehmen" : "Halten"}</em>${icon("right")}</button>
      <button class="menu-item" data-open="water">${icon("drop")}<span>Trinkziel</span><em class="num">${fmt1(state.goals.waterMl / 1000)} l</em>${icon("right")}</button>
    </section>

    <p class="section-label">KI-Funktionen</p>
    <section class="card list" style="padding:2px 16px">
      <button class="menu-item" data-open="ai">${icon("sparkle")}<span>Foto-Erkennung & KI-Coach</span><em>${s.aiKey ? "Aktiv" : "Einrichten"}</em>${icon("right")}</button>
    </section>

    <p class="section-label">Einstellungen</p>
    <section class="card form">
      <div><span class="small muted">Design</span>
        <div class="seg" style="margin-top:6px">${[["system", "System"], ["light", "Hell"], ["dark", "Dunkel"]].map(([v, l]) => `<button data-theme-set="${v}" class="${s.theme === v ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <label class="switch"><span>Vitamine & Mineralstoffe anzeigen</span><input type="checkbox" id="set-micros" ${s.showMicros ? "checked" : ""}></label>
      <label class="switch"><span>Verbrannte Kalorien zum Tagesbudget addieren</span><input type="checkbox" id="set-burn" ${s.addBurned !== false ? "checked" : ""}></label>
    </section>

    <p class="section-label">Deine Daten</p>
    <section class="card list" style="padding:2px 16px">
      <button class="menu-item" data-a="backup">${icon("bookmark")}<span>Sicherung speichern</span>${icon("right")}</button>
      <label class="menu-item">${icon("copy")}<span>Sicherung wiederherstellen</span>${icon("right")}<input type="file" accept="application/json,.json" hidden id="restore"></label>
      <button class="menu-item" data-a="csv">${icon("book")}<span>Tagebuch als Tabelle (CSV)</span>${icon("right")}</button>
      <button class="menu-item" data-a="reset" style="color:var(--danger)">${icon("trash")}<span>Alle Daten löschen</span></button>
    </section>
    <p class="muted small" style="margin:0 4px">Deine Daten liegen nur auf diesem Gerät. Speichere ab und zu eine Sicherung – z. B. bevor du das Handy wechselst.</p>

    <p class="section-label">App</p>
    <section class="card list" style="padding:2px 16px">
      ${standalone ? "" : `<button class="menu-item" data-a="install">${icon("plus")}<span>Auf den Startbildschirm</span>${icon("right")}</button>`}
      <button class="menu-item" data-a="update">${icon("bolt")}<span>Nach Updates suchen</span><em class="num">Version ${esc(self.APP_VERSION)}</em></button>
      <a class="menu-item" href="https://de.openfoodfacts.org" target="_blank" rel="noopener">${icon("heart")}<span>Produktdaten: Open Food Facts</span>${icon("right")}</a>
    </section>
    <p class="muted small" style="margin:0 4px 8px">Happen ersetzt keine ärztliche oder ernährungsmedizinische Beratung.</p>`;

  root.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => ({ goals: goalsSheet, body: bodySheet, water: waterSheet, ai: aiSheet })[b.dataset.open]()));
  root.querySelectorAll("[data-theme-set]").forEach((b) => (b.onclick = () => { s.theme = b.dataset.themeSet; applyTheme(); commit(); }));
  root.querySelector("#set-micros").onchange = (e) => { s.showMicros = e.target.checked; commit(); };
  root.querySelector("#set-burn").onchange = (e) => { s.addBurned = e.target.checked; commit(); };
  root.querySelector('[data-a="backup"]').onclick = () => download(`happen-sicherung-${todayKey()}.json`, JSON.stringify({ ...state, settings: { ...state.settings, aiKey: "" } }, null, 1), "application/json");
  root.querySelector('[data-a="csv"]').onclick = exportCsv;
  root.querySelector("#restore").onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!data.profile || !data.diary) throw 0;
      if (!(await ask("Sicherung wiederherstellen?", "Die aktuellen Daten auf diesem Gerät werden ersetzt.", "Wiederherstellen"))) return;
      const key = state.settings.aiKey;
      replaceAll(data);
      if (!state.settings.aiKey) state.settings.aiKey = key;
      applyTheme(); commit(); toast("Sicherung wiederhergestellt");
    } catch { toast("Diese Datei ist keine gültige Happen-Sicherung"); }
  };
  root.querySelector('[data-a="reset"]').onclick = async () => {
    if (await ask("Wirklich alles löschen?", "Tagebuch, Gewicht, Rezepte und Einstellungen werden von diesem Gerät entfernt. Das kann nicht rückgängig gemacht werden.", "Alles löschen", true)) { resetAll(); location.reload(); }
  };
  root.querySelector('[data-a="install"]')?.addEventListener("click", async () => {
    if (installEvt) { installEvt.prompt(); installEvt = null; return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    sheet({
      title: "App installieren",
      body: ios
        ? `<ol class="steps"><li>Öffne diese Seite in <b>Safari</b>.</li><li>Tippe unten auf <b>Teilen</b> (Quadrat mit Pfeil).</li><li>Wähle <b>Zum Home-Bildschirm</b> und tippe auf <b>Hinzufügen</b>.</li></ol>`
        : `<ol class="steps"><li>Öffne diese Seite in <b>Chrome</b>.</li><li>Tippe oben rechts auf das Menü <b>⋮</b>.</li><li>Wähle <b>App installieren</b> bzw. <b>Zum Startbildschirm hinzufügen</b>.</li></ol>`
    });
  });
  root.querySelector('[data-a="update"]').onclick = async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) return toast("Updates sind nur in der installierten App verfügbar");
    await reg.update().catch(() => {});
    setTimeout(() => toast(reg.waiting || reg.installing ? "Update gefunden – tippe oben auf „Jetzt aktualisieren“" : "Du hast die neueste Version"), 1200);
  };
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Datei gespeichert: " + name);
}

function exportCsv() {
  const rows = [["Datum", "Mahlzeit", "Lebensmittel", "Marke", "Menge", "Einheit", "kcal", "Kohlenhydrate", "Zucker", "Eiweiß", "Fett", "Ballaststoffe", "Salz"]];
  for (const k of Object.keys(state.diary).sort()) for (const m of MEALS) for (const e of state.diary[k].meals[m.id]) {
    const v = entryValues(e);
    rows.push([k, m.label, e.name, e.brand || "", e.grams, e.unit || "g", ...["kcal", "carbs", "sugar", "protein", "fat", "fiber", "salt"].map((x) => (v[x] == null ? "" : String(Math.round(v[x] * 10) / 10).replace(".", ",")))]);
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  download(`happen-tagebuch-${todayKey()}.csv`, "﻿" + csv, "text/csv");
}

function goalsSheet() {
  const G = state.goals;
  return sheet({
    title: "Kalorien & Makros",
    full: true,
    back: true,
    body: `<div class="form">
      <div class="seg"><button data-mode="auto" class="${G.mode === "auto" ? "on" : ""}">Automatisch</button><button data-mode="manual" class="${G.mode === "manual" ? "on" : ""}">Eigener Wert</button></div>
      <div class="card" data-auto>
        <table class="nut-table">
          <tr><td>Grundumsatz</td><td>${fmt(bmr())} kcal</td></tr>
          <tr><td>Gesamtumsatz (mit Aktivität)</td><td>${fmt(tdee())} kcal</td></tr>
          <tr><td><b>Dein Ziel</b></td><td><b>${fmt(autoKcal())} kcal</b></td></tr>
        </table>
      </div>
      <label class="field" data-manual><span>Tägliches Kalorienziel (kcal)</span><input class="input" id="g-kcal" type="number" inputmode="numeric" value="${G.manualKcal}"></label>
      <p class="section-label">Ernährungsform</p>
      <div class="chips" style="flex-wrap:wrap">${Object.entries(DIETS).map(([k, d]) => `<button class="chip ${G.diet === k ? "on" : ""}" data-diet="${k}">${d.label}</button>`).join("")}</div>
      <div class="grid3">
        <label class="field"><span>KH %</span><input class="input" id="g-c" type="number" inputmode="numeric" value="${G.carbsPct}"></label>
        <label class="field"><span>Eiweiß %</span><input class="input" id="g-p" type="number" inputmode="numeric" value="${G.proteinPct}"></label>
        <label class="field"><span>Fett %</span><input class="input" id="g-f" type="number" inputmode="numeric" value="${G.fatPct}"></label>
      </div>
      <p class="small" data-pctsum></p>
      <p class="section-label">Flexible Wochenenden</p>
      <p class="muted small" style="margin:-6px 0 0">Unter der Woche etwas weniger, dafür am Samstag und Sonntag mehr – die Wochensumme bleibt gleich.</p>
      <div class="seg">${[0, 100, 150, 200].map((v) => `<button data-wb="${v}" class="${G.weekendBonus === v ? "on" : ""}">${v ? "−" + v + " Mo–Fr" : "Aus"}</button>`).join("")}</div>
      <button class="btn primary block" data-ok>Speichern</button>
    </div>`,
    onMount: (s, close) => {
      let mode = G.mode, diet = G.diet, wb = G.weekendBonus;
      const sync = () => {
        s.querySelector("[data-auto]").hidden = mode !== "auto";
        s.querySelector("[data-manual]").hidden = mode !== "manual";
        const sum = ["#g-c", "#g-p", "#g-f"].reduce((a, id) => a + (+s.querySelector(id).value || 0), 0);
        const el = s.querySelector("[data-pctsum]");
        el.textContent = sum === 100 ? "Summe 100 % ✓" : `Summe ${sum} % – muss 100 % ergeben`;
        el.style.color = sum === 100 ? "var(--ok)" : "var(--danger)";
        return sum === 100;
      };
      sync();
      s.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { mode = b.dataset.mode; s.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("on", x === b)); sync(); }));
      s.querySelectorAll("[data-wb]").forEach((b) => (b.onclick = () => { wb = +b.dataset.wb; s.querySelectorAll("[data-wb]").forEach((x) => x.classList.toggle("on", x === b)); }));
      s.querySelectorAll("[data-diet]").forEach((b) => (b.onclick = () => {
        diet = b.dataset.diet;
        s.querySelectorAll("[data-diet]").forEach((x) => x.classList.toggle("on", x === b));
        const d = DIETS[diet];
        if (d.carbsPct) { s.querySelector("#g-c").value = d.carbsPct; s.querySelector("#g-p").value = d.proteinPct; s.querySelector("#g-f").value = d.fatPct; }
        sync();
      }));
      ["#g-c", "#g-p", "#g-f"].forEach((id) => s.querySelector(id).addEventListener("input", () => { diet = "custom"; s.querySelectorAll("[data-diet]").forEach((x) => x.classList.toggle("on", x.dataset.diet === "custom")); sync(); }));
      s.querySelector("[data-ok]").onclick = async () => {
        if (!sync()) return;
        const k = +s.querySelector("#g-kcal").value;
        if (mode === "manual" && k < minKcal()) {
          if (!(await ask("Sehr niedriges Ziel", `Unter ${minKcal()} kcal am Tag ist es schwer, ausreichend Nährstoffe aufzunehmen. Bitte nur mit ärztlicher Begleitung. Trotzdem ${minKcal()} kcal als Ziel nehmen?`, `${minKcal()} kcal nehmen`))) return;
          s.querySelector("#g-kcal").value = minKcal();
        }
        Object.assign(G, { mode, diet, weekendBonus: wb, manualKcal: Math.max(minKcal(), +s.querySelector("#g-kcal").value || 2000), carbsPct: +s.querySelector("#g-c").value, proteinPct: +s.querySelector("#g-p").value, fatPct: +s.querySelector("#g-f").value });
        commit(); toast("Ziele gespeichert"); close();
      };
    }
  });
}

function bodySheet() {
  const p = state.profile;
  return sheet({
    title: "Körperdaten & Ziel",
    full: true,
    back: true,
    body: `<div class="form">
      <label class="field"><span>Name</span><input class="input" id="b-name" value="${esc(p.name)}"></label>
      <div class="seg"><button data-sex="f" class="${p.sex === "f" ? "on" : ""}">Weiblich</button><button data-sex="m" class="${p.sex === "m" ? "on" : ""}">Männlich</button></div>
      <div class="grid2">
        <label class="field"><span>Geburtsjahr</span><input class="input" id="b-year" type="number" inputmode="numeric" value="${p.birthYear}"></label>
        <label class="field"><span>Größe (cm)</span><input class="input" id="b-h" type="number" inputmode="numeric" value="${p.heightCm}"></label>
        <label class="field"><span>Startgewicht (kg)</span><input class="input" id="b-sw" type="number" inputmode="decimal" step="0.1" value="${p.startWeight}"></label>
        <label class="field"><span>Zielgewicht (kg)</span><input class="input" id="b-gw" type="number" inputmode="decimal" step="0.1" value="${p.goalWeight}"></label>
      </div>
      <p class="section-label">Ziel</p>
      <div class="seg">${[["lose", "Abnehmen"], ["keep", "Halten"], ["gain", "Zunehmen"]].map(([v, l]) => `<button data-goal="${v}" class="${p.goal === v ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="seg" data-pacebox>${[[0.25, "0,25 kg/Woche"], [0.5, "0,5 kg/Woche"]].map(([v, l]) => `<button data-pace="${v}" class="${p.pace === v ? "on" : ""}">${l}</button>`).join("")}</div>
      <p class="section-label">Aktivität im Alltag</p>
      <div class="list">${ACTIVITY_LEVELS.map((a) => `<button class="choice ${p.activity === a.v ? "on" : ""}" data-act="${a.v}" style="margin-bottom:8px"><b>${a.label}</b><span>${a.hint}</span></button>`).join("")}</div>
      <div class="notice warn" data-warn hidden></div>
      <button class="btn primary block" data-ok>Speichern</button>
    </div>`,
    onMount: (s, close) => {
      const draft = { sex: p.sex, goal: p.goal, pace: p.pace, activity: p.activity };
      const sel = (attr, key, cast = (x) => x) => s.querySelectorAll(`[data-${attr}]`).forEach((b) => (b.onclick = () => {
        draft[key] = cast(b.dataset[attr]);
        s.querySelectorAll(`[data-${attr}]`).forEach((x) => x.classList.toggle("on", x === b));
        s.querySelector("[data-pacebox]").hidden = draft.goal === "keep";
      }));
      sel("sex", "sex"); sel("goal", "goal"); sel("pace", "pace", Number); sel("act", "activity", Number);
      s.querySelector("[data-pacebox]").hidden = draft.goal === "keep";
      s.querySelector("[data-ok]").onclick = () => {
        const num = (id) => +String(s.querySelector(id).value).replace(",", ".");
        const h = num("#b-h"), gw = num("#b-gw");
        const warn = s.querySelector("[data-warn]");
        if (draft.goal === "lose" && gw / (h / 100) ** 2 < 18.5) { warn.hidden = false; warn.textContent = "Dieses Zielgewicht läge unter dem gesunden Bereich (BMI unter 18,5). Bitte wähle ein höheres Ziel."; return; }
        Object.assign(p, draft, { name: s.querySelector("#b-name").value.trim().slice(0, 30), birthYear: num("#b-year") || p.birthYear, heightCm: h || p.heightCm, startWeight: num("#b-sw") || p.startWeight, goalWeight: gw || p.goalWeight });
        commit(); toast("Gespeichert"); close();
      };
    }
  });
}

function waterSheet() {
  return sheet({
    title: "Trinkziel",
    body: `<div class="seg" style="flex-wrap:wrap">${[1500, 2000, 2500, 3000, 3500].map((v) => `<button data-v="${v}" class="${state.goals.waterMl === v ? "on" : ""}">${fmt1(v / 1000)} l</button>`).join("")}</div>
      <p class="muted small" style="margin:0">Faustregel: etwa 30–35 ml pro kg Körpergewicht, an heißen Tagen und beim Sport mehr.</p>`,
    onMount: (s, close) => s.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => { state.goals.waterMl = +b.dataset.v; commit(); close(); }))
  });
}

function aiSheet() {
  const S = state.settings;
  return sheet({
    title: "KI-Funktionen",
    full: true,
    back: true,
    body: `<div class="form">
      <div class="notice">${icon("sparkle")}<div><b>Was die KI kann</b><div class="small">Mahlzeiten per Foto erkennen, Nährwerttabellen abfotografieren und deine Woche persönlich auswerten.</div></div></div>
      <ol class="steps small">
        <li>Erstelle auf <b>console.anthropic.com</b> ein Konto und lade ein kleines Guthaben auf (ein Foto kostet meist unter 1 Cent).</li>
        <li>Lege unter „API Keys“ einen Schlüssel an und kopiere ihn.</li>
        <li>Füge ihn hier ein. Er wird nur auf diesem Handy gespeichert und nicht in Sicherungen übernommen.</li>
      </ol>
      <label class="field"><span>API-Schlüssel</span><input class="input" id="ai-key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(S.aiKey)}"></label>
      <label class="field"><span>Modell</span>
        <select class="input" id="ai-model">${[["claude-haiku-5-5", "Haiku – schnell & günstig"], ["claude-sonnet-5-5", "Sonnet – genauer"], ["claude-opus-5-5", "Opus – am genauesten"]].map(([v, l]) => `<option value="${v}" ${S.aiModel === v ? "selected" : ""}>${l}</option>`).join("")}${["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"].includes(S.aiModel) ? "" : `<option value="${esc(S.aiModel)}" selected>${esc(S.aiModel)}</option>`}</select></label>
      <label class="field"><span>Eigener Modellname (optional, für neuere Modelle)</span><input class="input" id="ai-custom" placeholder="z. B. claude-sonnet-6" autocomplete="off"></label>
      <div class="row-btns">${S.aiKey ? `<button class="btn ghost" data-rm>Entfernen</button>` : ""}<button class="btn primary" data-ok style="flex:2">Speichern</button></div>
    </div>`,
    onMount: (s, close) => {
      s.querySelector("[data-ok]").onclick = () => {
        S.aiKey = s.querySelector("#ai-key").value.trim();
        S.aiModel = s.querySelector("#ai-custom").value.trim() || s.querySelector("#ai-model").value;
        commit(); toast(S.aiKey ? "KI-Funktionen aktiviert" : "Gespeichert"); close();
      };
      s.querySelector("[data-rm]")?.addEventListener("click", () => { S.aiKey = ""; commit(); toast("Schlüssel entfernt"); close(); });
    }
  });
}
