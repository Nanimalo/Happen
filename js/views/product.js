// Produktdetails + Mengenauswahl (neu hinzufügen oder Eintrag bearbeiten)
import { state, MEALS, addEntry, updateEntry, removeEntry, day, commit, toggleFavorite } from "../store.js";
import { NUTRIENTS, fmt, fmt1 } from "../nutrition.js";
import { icon, esc, sheet, toast, foodThumb, nutriScore } from "../ui.js";
import { toEntry, getFood } from "../foods.js";
import { productUrl } from "../off.js";

const NOVA = { 1: "Unverarbeitet", 2: "Verarbeitete Zutat", 3: "Verarbeitet", 4: "Hoch verarbeitet" };
const ALLERGEN_DE = { gluten: "Gluten", milk: "Milch", eggs: "Ei", nuts: "Schalenfrüchte", peanuts: "Erdnüsse", soybeans: "Soja", fish: "Fisch", crustaceans: "Krebstiere", molluscs: "Weichtiere", celery: "Sellerie", mustard: "Senf", "sesame-seeds": "Sesam", "sulphur-dioxide-and-sulphites": "Sulfite", lupin: "Lupinen" };

function nutrientRows(per100, grams) {
  const f = grams / 100;
  const val = (k) => (per100[k] == null ? null : per100[k] * f);
  const row = (n, sub = false) => {
    const v = val(n.k);
    if (v == null) return "";
    const pct = n.ref ? ` <span class="pct">${fmt((v / n.ref) * 100)} %</span>` : "";
    const d = n.unit === "kcal" ? 0 : n.unit === "g" ? (v < 1 ? 2 : v < 10 ? 1 : 0) : v < 1 ? 2 : 1;
    return `<tr class="${sub ? "sub" : ""}"><td>${n.label}</td><td>${fmt(v, d)} ${n.unit}${pct}</td></tr>`;
  };
  const by = (g) => NUTRIENTS.filter((n) => n.group === g);
  const main = ["kcal", "fat", "satFat", "carbs", "sugar", "fiber", "protein", "salt"].map((k) => row(NUTRIENTS.find((n) => n.k === k), ["satFat", "sugar"].includes(k))).join("");
  const micro = state.settings.showMicros ? [...by("vit"), ...by("min")].map((n) => row(n)).join("") : "";
  return `<table class="nut-table">${main}</table>` + (micro ? `<p class="section-label" style="margin:10px 2px 0">Vitamine & Mineralstoffe</p><table class="nut-table">${micro}</table>` : "");
}

function body(f, { mode, meal }) {
  const isFav = state.favorites.includes(f.ref);
  const units = [...(f.servings || []), { label: f.unit === "ml" ? "Milliliter" : "Gramm", g: 1, base: true }];
  return `
    <div class="prod-top">${f.imageLarge || f.image ? `<img src="${esc(f.imageLarge || f.image)}" alt="" style="object-fit:contain;background:#fff" referrerpolicy="no-referrer">` : foodThumb(f)}
      <div class="t"><h3>${esc(f.name)}</h3><span>${esc([f.brand, f.quantity].filter(Boolean).join(" · "))}</span></div>
    </div>
    ${f.nutriscore || f.nova || f.labels?.length || f.allergens?.length ? `<div class="badges">
      ${nutriScore(f.nutriscore)}
      ${f.nova ? `<span class="badge">NOVA ${f.nova} · ${NOVA[f.nova] || ""}</span>` : ""}
      ${(f.allergens || []).map((a) => `<span class="badge warn">${esc(ALLERGEN_DE[a] || a)}</span>`).join("")}
    </div>` : ""}
    ${f.offline ? `<div class="notice warn">${icon("bulb")}<div class="small">Offline – gespeicherte Version wird angezeigt.</div></div>` : ""}
    ${mode === "add" || mode === "edit" ? `
    <div class="chips">${MEALS.map((m) => `<button class="chip ${m.id === meal ? "on" : ""}" data-meal="${m.id}">${m.label}</button>`).join("")}</div>
    <div class="amount">
      <div class="stepper"><button data-step="-1" aria-label="weniger">${icon("minus")}</button><input id="p-qty" type="number" inputmode="decimal" step="any"><button data-step="1" aria-label="mehr">${icon("plus")}</button></div>
      <select class="input" id="p-unit">${units.map((u, i) => `<option value="${i}">${esc(u.base ? u.label : u.label + (u.label.includes("(") ? "" : ` (${fmt(u.g)} ${f.unit || "g"})`))}</option>`).join("")}</select>
    </div>` : ""}
    <div class="big-kcal" data-big></div>
    <section class="card" data-nut></section>
    ${f.ingredients ? `<details class="more card"><summary>Zutaten</summary><p class="small muted">${esc(f.ingredients)}</p></details>` : ""}
    <div class="row-btns" style="margin-top:0">
      <button class="btn ghost" data-fav aria-pressed="${isFav}">${icon("star", isFav ? "fav-on" : "")} ${isFav ? "Favorit" : "Merken"}</button>
      ${f.source === "off" ? `<a class="btn ghost" href="${productUrl(f.code)}" target="_blank" rel="noopener">Quelle</a>` : ""}
    </div>
    ${f.source === "off" ? `<p class="small muted" style="margin:0">Daten: Open Food Facts (ODbL), live abgerufen${f.updated ? ", zuletzt geändert am " + new Date(f.updated * 1000).toLocaleDateString("de-DE") : ""}. Werte können von der Verpackung abweichen.</p>` : ""}
    ${mode ? `<div class="sheet-foot"><div class="row-btns" style="margin:0">${mode === "edit" ? `<button class="btn ghost" data-del aria-label="Löschen">${icon("trash")}</button>` : ""}<button class="btn primary" data-ok style="flex:3">${mode === "edit" ? "Speichern" : "Hinzufügen"}</button></div></div>` : ""}`;
}

function wire(s, f, { mode, meal, grams, label, onSave, onDelete }) {
  const units = [...(f.servings || []), { label: f.unit === "ml" ? "Milliliter" : "Gramm", g: 1, base: true }];
  const qty = s.querySelector("#p-qty");
  const sel = s.querySelector("#p-unit");
  let curMeal = meal;
  // Startwert: passende Portion oder Gramm
  let ui = units.findIndex((u) => !u.base && label && u.label === label);
  if (ui < 0 && grams == null && units.length > 1) ui = f.defaultServing || 0;
  if (ui < 0) ui = units.length - 1;
  const g0 = grams ?? units[ui].g * (units[ui].base ? 100 : 1);
  if (sel) { sel.value = ui; qty.value = units[ui].base ? Math.round(g0 * 10) / 10 : Math.round((g0 / units[ui].g) * 100) / 100; }

  const curGrams = () => {
    if (!sel) return 100;
    const u = units[+sel.value];
    return Math.max(0, (+String(qty.value).replace(",", ".") || 0) * u.g);
  };
  const update = () => {
    const g = curGrams();
    const v = (k) => ((f.per100[k] || 0) * g) / 100;
    s.querySelector("[data-big]").innerHTML = `
      <div class="kc"><b class="num">${fmt(v("kcal"))}</b><span>kcal</span></div>
      <div class="c"><b class="num">${fmt1(v("carbs"))}</b><span>KH (g)</span></div>
      <div class="p"><b class="num">${fmt1(v("protein"))}</b><span>Eiweiß (g)</span></div>
      <div class="f"><b class="num">${fmt1(v("fat"))}</b><span>Fett (g)</span></div>`;
    s.querySelector("[data-nut]").innerHTML = `<div class="card-head"><h3>Nährwerte</h3><span class="muted small num">für ${fmt(g)} ${f.unit || "g"}</span></div>` + nutrientRows(f.per100, g);
  };
  if (sel) {
    qty.oninput = update;
    sel.onchange = () => {
      const g = curGrams();
      const u = units[+sel.value];
      qty.value = u.base ? Math.round(g) || 100 : 1;
      update();
    };
    s.querySelectorAll("[data-step]").forEach((b) => (b.onclick = () => {
      const u = units[+sel.value];
      const step = u.base ? (u.g === 1 ? 10 : 1) : 0.5;
      qty.value = Math.max(0, Math.round(((+qty.value || 0) + +b.dataset.step * step) * 100) / 100);
      update();
    }));
    s.querySelectorAll("[data-meal]").forEach((b) => (b.onclick = () => { curMeal = b.dataset.meal; s.querySelectorAll("[data-meal]").forEach((x) => x.classList.toggle("on", x === b)); }));
  }
  update();
  s.querySelector("[data-fav]").onclick = (e) => {
    if (!f.ref) return toast("KI-Schätzungen können nicht gemerkt werden");
    if (f.source === "off") state.products[f.code] = { ...f, usedAt: Date.now() };
    const on = toggleFavorite(f.ref);
    const b = e.currentTarget;
    b.innerHTML = `${icon("star", on ? "fav-on" : "")} ${on ? "Favorit" : "Merken"}`;
    toast(on ? "Zu Favoriten hinzugefügt" : "Aus Favoriten entfernt");
  };
  s.querySelector("[data-ok]")?.addEventListener("click", () => {
    const g = curGrams();
    if (!(g > 0)) return qty.focus();
    const u = units[+sel.value];
    const q = +String(qty.value).replace(",", ".");
    const lbl = u.base ? null : q === 1 ? u.label : `${fmt(q, 2)} × ${u.label.replace(/^1 /, "")}`;
    onSave(g, lbl, curMeal);
  });
  s.querySelector("[data-del]")?.addEventListener("click", onDelete);
}

export function openProduct(f, { meal, dateKey }) {
  return sheet({
    title: "Lebensmittel",
    full: true,
    back: true,
    body: body(f, { mode: "add", meal }),
    onMount: (s, close) => wire(s, f, {
      mode: "add", meal,
      onSave: (g, lbl, m) => {
        if (f.source === "off") state.products[f.code] = { ...f, usedAt: Date.now() };
        addEntry(dateKey, m, toEntry(f, g, lbl));
        toast(`${f.name} hinzugefügt`);
        close(true);
      }
    })
  });
}

export function openEntry(e, dateKey, meal) {
  // Aktuelle Produktdaten (z. B. mit Bild) nutzen, aber Werte des Eintrags behalten
  const src = getFood(e.ref);
  const f = { ...(src || {}), ref: e.ref, name: e.name, brand: e.brand, per100: e.per100, unit: e.unit, image: e.image || src?.image, servings: src?.servings || [], source: src?.source || "entry" };
  return sheet({
    title: "Eintrag bearbeiten",
    full: true,
    body: body(f, { mode: "edit", meal }),
    onMount: (s, close) => wire(s, f, {
      mode: "edit", meal, grams: e.grams, label: e.amountLabel?.includes(" × ") ? "1 " + e.amountLabel.split(" × ")[1] : e.amountLabel,
      onSave: (g, lbl, m) => {
        if (m !== meal) {
          removeEntry(dateKey, meal, e.id);
          day(dateKey).meals[m].push({ ...e, grams: g, amountLabel: lbl });
          commit();
        } else updateEntry(dateKey, meal, e.id, { grams: g, amountLabel: lbl });
        toast("Gespeichert");
        close(true);
      },
      onDelete: () => {
        removeEntry(dateKey, meal, e.id);
        toast(`${e.name} gelöscht`, { label: "Rückgängig", run: () => { day(dateKey).meals[meal].push(e); commit(); } });
        close(true);
      }
    })
  });
}

// Nur ansehen (z. B. aus Favoriten)
export function viewFood(f) {
  return sheet({ title: "Lebensmittel", full: true, back: true, body: body(f, { mode: null }), onMount: (s) => wire(s, f, {}) });
}
