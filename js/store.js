// ============================================================
//  Datenspeicher – alles bleibt auf dem Handy (localStorage).
//  Neues Feld nötig? -> SCHEMA erhöhen und unten in migrate()
//  einen Schritt ergänzen. Alte Daten der Nutzer bleiben erhalten.
// ============================================================
const KEY = "happen.data";
export const SCHEMA = 1;

export const MEALS = [
  { id: "breakfast", label: "Frühstück", icon: "sunrise", share: 0.25 },
  { id: "lunch", label: "Mittagessen", icon: "sun", share: 0.35 },
  { id: "dinner", label: "Abendessen", icon: "moon", share: 0.3 },
  { id: "snack", label: "Snacks", icon: "apple", share: 0.1 }
];

function defaults() {
  return {
    schema: SCHEMA,
    profile: {
      name: "", sex: "f", birthYear: 1995, heightCm: 170, startWeight: 70, goalWeight: 65,
      activity: 1.375, goal: "lose", pace: 0.5, onboarded: false, createdAt: todayKey()
    },
    goals: { mode: "auto", manualKcal: 2000, diet: "balanced", carbsPct: 50, proteinPct: 20, fatPct: 30, waterMl: 2000, weekendBonus: 0 },
    diary: {},
    weights: [],
    body: [],
    products: {},
    customFoods: {},
    favorites: [],
    recent: [],
    recipes: {},
    savedMeals: {},
    fasting: { plan: "16:8", active: null, history: [] },
    settings: { theme: "system", aiKey: "", aiModel: "claude-haiku-5-5", showMicros: true, addBurned: true }
  };
}

function migrate(data) {
  const base = defaults();
  if (!data || typeof data !== "object") return base;
  // Fehlende Felder aus den Standardwerten ergänzen (für alle Versionen).
  for (const k of Object.keys(base)) {
    if (data[k] === undefined) data[k] = base[k];
    else if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      for (const kk of Object.keys(base[k])) if (data[k][kk] === undefined) data[k][kk] = base[k][kk];
    }
  }
  // Beispiel für spätere Versionen:
  // if (data.schema < 2) { ...umbauen...; data.schema = 2; }
  data.schema = SCHEMA;
  return data;
}

function load() {
  try { return migrate(JSON.parse(localStorage.getItem(KEY))); }
  catch { return defaults(); }
}

export const state = load();
// Flüchtiger UI-Zustand (wird nicht gespeichert)
export const ui = { date: null };
const listeners = new Set();
let saveTimer = null;

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn("Speichern fehlgeschlagen", e); trimCache(); }
  }, 150);
}
export function commit() { save(); listeners.forEach((fn) => fn()); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Speicherplatz schützen: alte Produkte aus dem Cache entfernen.
function trimCache(max = 400) {
  const list = Object.entries(state.products).sort((a, b) => (b[1].usedAt || 0) - (a[1].usedAt || 0));
  state.products = Object.fromEntries(list.slice(0, max));
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export function replaceAll(data) {
  const fresh = migrate(data);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
  commit();
}
export function resetAll() { replaceAll(defaults()); }

// ---------- Datum ----------
export function todayKey(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export function shiftDay(key, n) {
  const d = new Date(key + "T12:00:00");
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

// ---------- Tagebuch ----------
export function day(key) {
  if (!state.diary[key]) state.diary[key] = { meals: { breakfast: [], lunch: [], dinner: [], snack: [] }, water: 0, activities: [] };
  return state.diary[key];
}
export function peekDay(key) { return state.diary[key] || null; }

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function addEntry(key, meal, entry) {
  day(key).meals[meal].push({ id: uid(), ...entry, at: Date.now() });
  if (entry.ref) markRecent(entry.ref);
  commit();
}
export function updateEntry(key, meal, id, patch) {
  const list = day(key).meals[meal];
  const e = list.find((x) => x.id === id);
  if (e) Object.assign(e, patch);
  commit();
}
export function removeEntry(key, meal, id) {
  const d = day(key);
  d.meals[meal] = d.meals[meal].filter((x) => x.id !== id);
  commit();
}

export function markRecent(ref) {
  state.recent = [ref, ...state.recent.filter((r) => r !== ref)].slice(0, 40);
}
export function toggleFavorite(ref) {
  const i = state.favorites.indexOf(ref);
  if (i >= 0) state.favorites.splice(i, 1); else state.favorites.unshift(ref);
  commit();
  return i < 0;
}

export function cacheProduct(p) {
  state.products[p.code] = { ...p, usedAt: Date.now() };
  if (Object.keys(state.products).length > 450) trimCache();
  save();
}

// ---------- Gewicht ----------
export function latestWeight() {
  const w = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  return w.length ? w[w.length - 1].kg : state.profile.startWeight;
}
export function setWeight(date, kg) {
  state.weights = state.weights.filter((w) => w.date !== date);
  state.weights.push({ date, kg });
  state.weights.sort((a, b) => a.date.localeCompare(b.date));
  commit();
}
