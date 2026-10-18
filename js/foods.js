// Einheitlicher Zugriff auf alle Lebensmittel-Quellen:
// Grundnahrungsmittel, Open-Food-Facts-Produkte, eigene Lebensmittel, Rezepte.
import { state } from "./store.js";
import { BASICS } from "../data/basics.js";
import { BUILTIN_RECIPES } from "../data/recipes.js";
import { NUTRIENTS } from "./nutrition.js";

const BASIC_BY_ID = Object.fromEntries(BASICS.map((b) => [b.id, b]));
export const basicById = (id) => BASIC_BY_ID[id];

// Mitgelieferte Rezepte in das gleiche Format wie eigene Rezepte bringen
export const BUILTIN = BUILTIN_RECIPES.map((r) => ({
  ...r,
  builtin: true,
  ingredients: r.ingredients.map(([id, grams]) => {
    const b = BASIC_BY_ID[id];
    return { ref: b.ref, name: b.name, grams, per100: b.per100, unit: b.unit };
  })
}));

export function allRecipes() {
  return [...Object.values(state.recipes), ...BUILTIN];
}

export function recipeFood(r) {
  const total = r.ingredients.reduce((s, i) => s + i.grams, 0) || 1;
  const per100 = {};
  for (const n of NUTRIENTS) {
    let v = 0, has = false;
    for (const i of r.ingredients) if (i.per100?.[n.k] != null) { v += (i.per100[n.k] * i.grams) / 100; has = true; }
    if (has) per100[n.k] = (v / total) * 100;
  }
  const portion = Math.round(total / (r.servings || 1));
  return {
    source: "recipe", ref: "recipe:" + r.id, id: r.id, name: r.name, brand: "Rezept", unit: "g",
    servings: [{ label: "1 Portion", g: portion }, ...(r.servings > 1 ? [{ label: "Ganzes Rezept", g: total }] : [])],
    defaultServing: 0, per100, complete: true, recipe: r, category: "rezept"
  };
}

export function getFood(ref) {
  if (!ref) return null;
  const [src, ...rest] = ref.split(":");
  const id = rest.join(":");
  if (src === "basic") return BASIC_BY_ID[id] || null;
  if (src === "off") return state.products[id] || null;
  if (src === "custom") return state.customFoods[id] || null;
  if (src === "recipe") { const r = allRecipes().find((x) => x.id === id); return r ? recipeFood(r) : null; }
  return null;
}

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");

export function localSearch(q) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const pool = [
    ...Object.values(state.customFoods),
    ...allRecipes().map(recipeFood),
    ...BASICS,
    ...Object.values(state.products).filter((p) => p.complete)
  ];
  const seen = new Set();
  return pool
    .map((f) => {
      const hay = norm(f.name + " " + (f.brand || "") + " " + (f.category || ""));
      if (!words.every((w) => hay.includes(w))) return null;
      let s = 0;
      if (norm(f.name).startsWith(words[0])) s += 3;
      if (f.source === "custom") s += 2;
      if (state.favorites.includes(f.ref)) s += 2;
      if (state.recent.includes(f.ref)) s += 1;
      return { f, s };
    })
    .filter(Boolean)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.f)
    .filter((f) => (seen.has(f.ref) ? false : seen.add(f.ref)))
    .slice(0, 25);
}

export function defaultServing(f) {
  if (f.servings?.length) return f.servings[f.defaultServing || 0];
  return { label: "100 " + (f.unit || "g"), g: 100 };
}

// Lebensmittel -> Tagebuch-Eintrag (Nährwerte werden mitkopiert,
// damit alte Einträge stabil bleiben, auch wenn sich das Produkt ändert)
export function toEntry(f, grams, label) {
  return {
    ref: f.ref, name: f.name, brand: f.brand || "", grams: Math.round(grams * 10) / 10, unit: f.unit || "g",
    amountLabel: label || null, per100: { ...f.per100 }, image: f.image || null, category: f.category || f.source
  };
}
