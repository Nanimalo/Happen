// ============================================================
//  Produktdatenbank: Open Food Facts (offen, kostenlos, über 3 Mio.
//  Produkte, wird laufend von der Community aktualisiert).
//  Jede Suche und jeder Scan fragt LIVE ab -> immer aktueller Stand.
// ============================================================
import { state, cacheProduct } from "./store.js";
import { NUTRIENTS } from "./nutrition.js";

const FIELDS = [
  "code", "product_name", "product_name_de", "generic_name_de", "brands", "quantity", "serving_size",
  "serving_quantity", "nutriments", "nutriscore_grade", "nova_group", "ecoscore_grade",
  "image_front_small_url", "image_front_url", "ingredients_text_de", "ingredients_text",
  "allergens_tags", "labels_tags", "countries_tags", "last_modified_t"
].join(",");

const API = "https://world.openfoodfacts.org";
const SEARCH = "https://search.openfoodfacts.org/search";

function timeout(ms) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

const num = (v) => (v === "" || v == null || Number.isNaN(+v) ? null : +v);
const firstBrand = (b) => (Array.isArray(b) ? b[0] : (b || "").split(",")[0]).trim();

export function normalize(p) {
  const n = p.nutriments || {};
  const per100 = {};
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal == null && num(n["energy_100g"]) != null) kcal = num(n["energy_100g"]) / 4.184;
  if (kcal == null && num(n["energy-kj_100g"]) != null) kcal = num(n["energy-kj_100g"]) / 4.184;
  per100.kcal = kcal;
  for (const d of NUTRIENTS) {
    if (!d.off) continue;
    const v = num(n[d.off + "_100g"]);
    if (v != null) per100[d.k] = v * d.f;
  }
  if (per100.salt == null && num(n["sodium_100g"]) != null) per100.salt = num(n["sodium_100g"]) * 2.5;

  const qty = (p.quantity || "").toLowerCase();
  const liquid = /\d\s*(ml|cl|l)\b/.test(qty);
  const serving = num(p.serving_quantity);
  return {
    source: "off",
    ref: "off:" + p.code,
    code: String(p.code),
    name: (p.product_name_de || p.product_name || p.generic_name_de || "Unbenanntes Produkt").trim(),
    brand: firstBrand(p.brands),
    quantity: p.quantity || "",
    unit: liquid ? "ml" : "g",
    servings: serving && serving > 0 ? [{ label: "1 Portion" + (p.serving_size ? ` (${p.serving_size})` : ""), g: serving }] : [],
    per100,
    complete: per100.kcal != null,
    nutriscore: (p.nutriscore_grade || "").length === 1 ? p.nutriscore_grade : null,
    nova: p.nova_group || null,
    eco: (p.ecoscore_grade || "").length === 1 ? p.ecoscore_grade : null,
    image: p.image_front_small_url || null,
    imageLarge: p.image_front_url || null,
    ingredients: p.ingredients_text_de || p.ingredients_text || "",
    allergens: (p.allergens_tags || []).map((t) => t.split(":").pop()),
    labels: (p.labels_tags || []).map((t) => t.split(":").pop()).slice(0, 6),
    sold: (p.countries_tags || []).includes("en:germany"),
    updated: p.last_modified_t || null
  };
}

export async function fetchByBarcode(code) {
  code = String(code).replace(/\D/g, "");
  try {
    const res = await fetch(`${API}/api/v2/product/${code}.json?fields=${FIELDS}`, { signal: timeout(9000) });
    if (res.status === 404) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = normalize({ ...data.product, code });
    cacheProduct(p);
    return p;
  } catch (e) {
    // Offline: auf zuletzt gespeicherte Version zurückfallen
    if (state.products[code]) return { ...state.products[code], offline: true };
    throw e;
  }
}

function rank(list, q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return list
    .filter((p) => p.complete)
    .map((p) => {
      const hay = (p.name + " " + p.brand).toLowerCase();
      let s = 0;
      for (const w of words) if (hay.includes(w)) s += 3;
      if (p.name.toLowerCase().startsWith(words[0] || "")) s += 2;
      if (p.sold) s += 2;
      if (p.image) s += 1;
      return { p, s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}

export async function searchProducts(q, page = 1) {
  q = q.trim();
  if (q.length < 2) return [];
  // 1) Neue Volltextsuche (schnell)
  try {
    const url = `${SEARCH}?q=${encodeURIComponent(q)}&langs=de,en&page_size=30&page=${page}&fields=${FIELDS}`;
    const res = await fetch(url, { signal: timeout(7000) });
    if (res.ok) {
      const data = await res.json();
      const hits = (data.hits || []).filter((h) => h.code).map(normalize);
      if (hits.length) return rank(hits, q);
    }
  } catch {}
  // 2) Klassische Suche über die deutsche Datenbank (Fallback)
  const url = `https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&page=${page}&fields=${FIELDS}`;
  const res = await fetch(url, { signal: timeout(10000) });
  const data = await res.json();
  return rank((data.products || []).filter((p) => p.code).map(normalize), q);
}

// Link, um ein fehlendes Produkt selbst zur Datenbank hinzuzufügen.
export const contributeUrl = (code) => `https://de.openfoodfacts.org/cgi/product.pl?type=search_or_add&action=process&code=${encodeURIComponent(code)}`;
export const productUrl = (code) => `https://de.openfoodfacts.org/produkt/${encodeURIComponent(code)}`;
