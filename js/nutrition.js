// Berechnungen: Bedarf, Ziele, Summen, Nährstoffe.
import { state, MEALS, peekDay, latestWeight } from "./store.js";

// Alle Nährwerte. per100 speichert sie in der Einheit "unit".
// off = Feldname bei Open Food Facts (dort immer in g pro 100 g), f = Umrechnungsfaktor g -> unit
// ref = Tagesreferenz (EU-NRV bzw. DGE-Orientierung) für Prozentanzeige.
export const NUTRIENTS = [
  { k: "kcal", label: "Kalorien", unit: "kcal", group: "main" },
  { k: "carbs", label: "Kohlenhydrate", unit: "g", off: "carbohydrates", f: 1, group: "main" },
  { k: "sugar", label: "davon Zucker", unit: "g", off: "sugars", f: 1, group: "detail", ref: 50, limit: true },
  { k: "fiber", label: "Ballaststoffe", unit: "g", off: "fiber", f: 1, group: "detail", ref: 30 },
  { k: "protein", label: "Eiweiß", unit: "g", off: "proteins", f: 1, group: "main" },
  { k: "fat", label: "Fett", unit: "g", off: "fat", f: 1, group: "main" },
  { k: "satFat", label: "davon gesättigt", unit: "g", off: "saturated-fat", f: 1, group: "detail", ref: 20, limit: true },
  { k: "salt", label: "Salz", unit: "g", off: "salt", f: 1, group: "detail", ref: 6, limit: true },
  { k: "vitA", label: "Vitamin A", unit: "µg", off: "vitamin-a", f: 1e6, group: "vit", ref: 800 },
  { k: "vitB1", label: "Vitamin B1", unit: "mg", off: "vitamin-b1", f: 1e3, group: "vit", ref: 1.1 },
  { k: "vitB2", label: "Vitamin B2", unit: "mg", off: "vitamin-b2", f: 1e3, group: "vit", ref: 1.4 },
  { k: "vitB6", label: "Vitamin B6", unit: "mg", off: "vitamin-b6", f: 1e3, group: "vit", ref: 1.4 },
  { k: "vitB12", label: "Vitamin B12", unit: "µg", off: "vitamin-b12", f: 1e6, group: "vit", ref: 2.5 },
  { k: "folate", label: "Folsäure", unit: "µg", off: "vitamin-b9", f: 1e6, group: "vit", ref: 200 },
  { k: "vitC", label: "Vitamin C", unit: "mg", off: "vitamin-c", f: 1e3, group: "vit", ref: 80 },
  { k: "vitD", label: "Vitamin D", unit: "µg", off: "vitamin-d", f: 1e6, group: "vit", ref: 20 },
  { k: "vitE", label: "Vitamin E", unit: "mg", off: "vitamin-e", f: 1e3, group: "vit", ref: 12 },
  { k: "vitK", label: "Vitamin K", unit: "µg", off: "vitamin-k", f: 1e6, group: "vit", ref: 75 },
  { k: "calcium", label: "Calcium", unit: "mg", off: "calcium", f: 1e3, group: "min", ref: 1000 },
  { k: "iron", label: "Eisen", unit: "mg", off: "iron", f: 1e3, group: "min", ref: 14 },
  { k: "magnesium", label: "Magnesium", unit: "mg", off: "magnesium", f: 1e3, group: "min", ref: 375 },
  { k: "potassium", label: "Kalium", unit: "mg", off: "potassium", f: 1e3, group: "min", ref: 2000 },
  { k: "zinc", label: "Zink", unit: "mg", off: "zinc", f: 1e3, group: "min", ref: 10 },
  { k: "iodine", label: "Jod", unit: "µg", off: "iodine", f: 1e6, group: "min", ref: 150 }
];
export const NUTRIENT = Object.fromEntries(NUTRIENTS.map((n) => [n.k, n]));

export const DIETS = {
  balanced: { label: "Ausgewogen", carbsPct: 50, proteinPct: 20, fatPct: 30 },
  highProtein: { label: "High Protein", carbsPct: 40, proteinPct: 30, fatPct: 30 },
  lowCarb: { label: "Low Carb", carbsPct: 25, proteinPct: 35, fatPct: 40 },
  lowFat: { label: "Fettarm", carbsPct: 55, proteinPct: 25, fatPct: 20 },
  custom: { label: "Eigene Verteilung" }
};

export const ACTIVITY_LEVELS = [
  { v: 1.2, label: "Kaum aktiv", hint: "Bürojob, wenig Bewegung" },
  { v: 1.375, label: "Leicht aktiv", hint: "Viel unterwegs oder 1–2× Sport" },
  { v: 1.55, label: "Aktiv", hint: "3–5× Sport pro Woche" },
  { v: 1.725, label: "Sehr aktiv", hint: "Täglich Sport oder körperliche Arbeit" }
];

export function age() { return new Date().getFullYear() - (state.profile.birthYear || 1995); }

export function bmr(kg = latestWeight()) {
  const p = state.profile;
  return Math.round(10 * kg + 6.25 * p.heightCm - 5 * age() + (p.sex === "m" ? 5 : -161));
}
export function tdee() { return Math.round(bmr() * state.profile.activity); }
export function minKcal() { return state.profile.sex === "m" ? 1500 : 1200; }

export function autoKcal() {
  const p = state.profile;
  const delta = Math.round((p.pace * 7700) / 7);
  let k = tdee();
  if (p.goal === "lose") k -= Math.min(delta, 750);
  if (p.goal === "gain") k += Math.min(delta, 500);
  return Math.max(minKcal(), Math.round(k / 10) * 10);
}

// Tagesziel inkl. Wochenend-Bonus (eigene Idee: flexibles Wochenende).
export function goalFor(dateKey) {
  const g = state.goals;
  let kcal = g.mode === "manual" ? g.manualKcal : autoKcal();
  const wd = new Date(dateKey + "T12:00:00").getDay();
  if (g.weekendBonus) kcal += (wd === 0 || wd === 6) ? g.weekendBonus * 2.5 : -g.weekendBonus;
  kcal = Math.round(kcal);
  return {
    kcal,
    carbs: Math.round((kcal * g.carbsPct) / 100 / 4),
    protein: Math.round((kcal * g.proteinPct) / 100 / 4),
    fat: Math.round((kcal * g.fatPct) / 100 / 9),
    water: g.waterMl
  };
}

export function entryValues(e) {
  const f = (e.grams || 0) / 100;
  const out = {};
  for (const n of NUTRIENTS) {
    const v = e.per100?.[n.k];
    if (v != null && !Number.isNaN(v)) out[n.k] = v * f;
  }
  return out;
}
export function sumEntries(list) {
  const t = {};
  for (const e of list) for (const [k, v] of Object.entries(entryValues(e))) t[k] = (t[k] || 0) + v;
  return t;
}
export function dayTotals(key) {
  const d = peekDay(key);
  const all = d ? MEALS.flatMap((m) => d.meals[m.id]) : [];
  const t = sumEntries(all);
  t.burned = d ? d.activities.reduce((s, a) => s + (a.kcal || 0), 0) : 0;
  t.water = d ? d.water : 0;
  t.count = all.length;
  return t;
}

// Gewichtsverlauf -> BMI
export function bmi(kg = latestWeight()) {
  const m = state.profile.heightCm / 100;
  return kg / (m * m);
}

export const fmt = (v, d = 0) =>
  v == null || Number.isNaN(v) ? "–" : Number(v).toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const fmt1 = (v) => fmt(v, 1);
