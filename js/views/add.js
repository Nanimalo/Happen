// Lebensmittel hinzufügen: Suche, Scanner, KI-Foto, Schnelleintrag, Eigenes
import { state, MEALS, addEntry, removeEntry, uid, commit, todayKey } from "../store.js";
import { fmt, entryValues } from "../nutrition.js";
import { icon, esc, sheet, toast, foodThumb, debounce } from "../ui.js";
import { searchProducts, fetchByBarcode, contributeUrl } from "../off.js";
import { scanBarcode, takePhoto } from "../scanner.js";
import { recognizeMeal, readLabel, aiReady } from "../ai.js";
import { getFood, localSearch, defaultServing, toEntry, allRecipes, recipeFood } from "../foods.js";
import { openProduct } from "./product.js";
import { BASICS } from "../../data/basics.js";

export function mealForNow() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return "breakfast";
  if (h < 14.5) return "lunch";
  if (h < 17.5) return "snack";
  if (h < 21.5) return "dinner";
  return "snack";
}
const mealLabel = (m) => MEALS.find((x) => x.id === m).label;

function foodRow(f, { quick = true } = {}) {
  const sv = defaultServing(f);
  const kcal = ((f.per100?.kcal || 0) * sv.g) / 100;
  const tag = f.source === "basic" ? "" : f.source === "custom" ? '<span class="src-tag">Eigen</span>' : f.source === "recipe" ? '<span class="src-tag">Rezept</span>' : "";
  return `<div class="item" data-ref="${esc(f.ref)}">
    ${foodThumb(f)}
    <button class="t" data-open style="border:0;background:none;padding:0;text-align:left;color:inherit">
      <b>${esc(f.name)}${tag}</b>
      <span>${esc([f.brand, sv.label].filter(Boolean).join(" · "))}</span>
    </button>
    <span class="k num">${fmt(kcal)}<small>kcal</small></span>
    ${quick ? `<button class="quick-add" data-quick aria-label="${esc(f.name)} schnell hinzufügen">${icon("plus")}</button>` : ""}
  </div>`;
}

export function openAdd(meal, dateKey = todayKey()) {
  meal = meal || mealForNow();
  let added = 0;
  let tab = state.recent.length ? "recent" : "basics";
  let q = "";
  let liveResults = null, liveError = null, loading = false, reqId = 0;
  const foods = new Map();

  return sheet({
    title: "Hinzufügen",
    full: true,
    body: `
      <div class="chips" data-meals>${MEALS.map((m) => `<button class="chip" data-meal="${m.id}">${m.label}</button>`).join("")}</div>
      <div class="search-box">${icon("search")}<input id="add-q" type="search" placeholder="Lebensmittel, Marke oder Gericht" autocomplete="off" enterkeyhint="search"><button class="icon-btn" data-scan aria-label="Barcode scannen">${icon("scan")}</button></div>
      <div class="tools">
        <button class="tool hero" data-tool="scan">${icon("scan")}Scannen</button>
        <button class="tool" data-tool="photo">${icon("sparkle")}Foto-KI</button>
        <button class="tool" data-tool="quick">${icon("bolt")}Schnell</button>
        <button class="tool" data-tool="custom">${icon("edit")}Eigenes</button>
      </div>
      <div class="chips" data-tabs>
        <button class="chip" data-tab="recent">Zuletzt</button>
        <button class="chip" data-tab="fav">Favoriten</button>
        <button class="chip" data-tab="own">Eigene</button>
        <button class="chip" data-tab="basics">Grundnahrungsmittel</button>
      </div>
      <div data-results class="card list" style="padding:4px 14px"></div>`,
    onMount: (s, close) => {
      const slot = s.querySelector(".sheet-slot");
      const results = s.querySelector("[data-results]");
      const input = s.querySelector("#add-q");
      const setSlot = () => { slot.innerHTML = added ? `<button class="btn small primary" data-done>Fertig (${added})</button>` : ""; slot.querySelector("[data-done]")?.addEventListener("click", () => close()); };
      const setMeal = () => s.querySelectorAll("[data-meal]").forEach((b) => b.classList.toggle("on", b.dataset.meal === meal));
      setMeal();
      s.querySelectorAll("[data-meal]").forEach((b) => (b.onclick = () => { meal = b.dataset.meal; setMeal(); }));
      const onAdded = (n = 1) => { added += n; setSlot(); };

      const list = (arr, quick = true) => { arr.forEach((f) => foods.set(f.ref, f)); return arr.map((f) => foodRow(f, { quick })).join(""); };

      function draw() {
        s.querySelector("[data-tabs]").hidden = !!q;
        s.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
        let html = "";
        if (q.length >= 2) {
          const local = localSearch(q);
          if (local.length) html += `<p class="section-label" style="margin:10px 0 0">Schnell gefunden</p>` + list(local.slice(0, 8));
          html += `<p class="section-label" style="margin:14px 0 0">Produktdatenbank · live</p>`;
          if (loading) html += `<div class="loader">Suche in über 3 Mio. Produkten …</div>`;
          else if (liveError) html += `<div class="empty"><b>Keine Verbindung</b>Die Online-Suche ist gerade nicht erreichbar. Gespeicherte Produkte findest du oben.</div>`;
          else if (liveResults && !liveResults.length) html += `<div class="empty"><b>Nichts gefunden</b>Versuch es mit einem anderen Begriff, scanne den Barcode oder lege das Lebensmittel selbst an.</div>`;
          else if (liveResults) html += list(liveResults.filter((f) => !local.some((l) => l.ref === f.ref)));
        } else if (tab === "recent") {
          const r = state.recent.map(getFood).filter(Boolean);
          html = r.length ? list(r) : `<div class="empty"><b>Noch nichts eingetragen</b>Suche oben oder scanne einen Barcode.</div>`;
        } else if (tab === "fav") {
          const r = state.favorites.map(getFood).filter(Boolean);
          html = r.length ? list(r) : `<div class="empty"><b>Keine Favoriten</b>Tippe bei einem Lebensmittel auf den Stern, um es hier zu sammeln.</div>`;
        } else if (tab === "own") {
          const meals = Object.values(state.savedMeals);
          const own = Object.values(state.customFoods);
          const recs = allRecipes().filter((r) => !r.builtin).map(recipeFood);
          html = (meals.length ? `<p class="section-label" style="margin:10px 0 0">Gespeicherte Mahlzeiten</p>` + meals.map((m) => {
            const kcal = m.items.reduce((sum, e) => sum + (entryValues(e).kcal || 0), 0);
            return `<div class="item"><span class="meal-ic">${icon("bookmark")}</span><span class="t"><b>${esc(m.name)}</b><span>${m.items.length} Lebensmittel</span></span><span class="k num">${fmt(kcal)}<small>kcal</small></span><button class="quick-add" data-savedmeal="${m.id}" aria-label="Hinzufügen">${icon("plus")}</button></div>`;
          }).join("") : "")
            + (recs.length ? `<p class="section-label" style="margin:14px 0 0">Meine Rezepte</p>` + list(recs) : "")
            + (own.length ? `<p class="section-label" style="margin:14px 0 0">Eigene Lebensmittel</p>` + list(own) : "");
          if (!html) html = `<div class="empty"><b>Noch nichts Eigenes</b>Lege eigene Lebensmittel an, speichere Mahlzeiten oder erstelle Rezepte.</div>`;
        } else {
          const groups = {};
          for (const f of BASICS) (groups[f.category] ||= []).push(f);
          html = Object.entries(groups).map(([g, arr]) => `<p class="section-label" style="margin:12px 0 0">${esc(g)}</p>` + list(arr)).join("");
        }
        results.innerHTML = html;
      }

      const live = debounce(async () => {
        if (q.length < 2) return;
        const my = ++reqId;
        loading = true; liveError = null; draw();
        try { const r = await searchProducts(q); if (my === reqId) liveResults = r; }
        catch { if (my === reqId) liveError = true; }
        if (my === reqId) { loading = false; draw(); }
      }, 450);

      input.addEventListener("input", () => { q = input.value.trim(); liveResults = null; draw(); live(); });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
      s.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));

      results.addEventListener("click", async (e) => {
        const sm = e.target.closest("[data-savedmeal]");
        if (sm) {
          const m = state.savedMeals[sm.dataset.savedmeal];
          m.items.forEach((it) => addEntry(dateKey, meal, { ...it }));
          onAdded(m.items.length);
          toast(`${m.name} → ${mealLabel(meal)}`);
          return;
        }
        const row = e.target.closest("[data-ref]");
        if (!row) return;
        const f = foods.get(row.dataset.ref);
        if (e.target.closest("[data-quick]")) {
          const sv = defaultServing(f);
          addEntry(dateKey, meal, toEntry(f, sv.g, sv.label));
          onAdded();
          const d = state.diary[dateKey].meals[meal];
          const last = d[d.length - 1];
          toast(`${f.name} → ${mealLabel(meal)}`, { label: "Rückgängig", run: () => { removeEntry(dateKey, meal, last.id); added--; setSlot(); } });
        } else if (e.target.closest("[data-open]") || e.target.closest(".thumb")) {
          const ok = await openProduct(f, { meal, dateKey });
          if (ok) onAdded();
        }
      });

      const doScan = async () => { const n = await scanAndAdd(meal, dateKey, true); if (n) onAdded(n); };
      s.querySelector("[data-scan]").onclick = doScan;
      s.querySelector('[data-tool="scan"]').onclick = doScan;
      s.querySelector('[data-tool="photo"]').onclick = async () => { const n = await photoMeal(meal, dateKey); if (n) onAdded(n); };
      s.querySelector('[data-tool="quick"]').onclick = async () => { if (await quickAdd(meal, dateKey)) onAdded(); };
      s.querySelector('[data-tool="custom"]').onclick = async () => {
        const f = await editCustomFood();
        if (f) { tab = "own"; draw(); const ok = await openProduct(f, { meal, dateKey }); if (ok) onAdded(); }
      };
      draw();
    }
  });
}

// ---------- Scannen ----------
export async function scanAndAdd(meal = mealForNow(), dateKey = todayKey(), stay = false) {
  const r = await scanBarcode();
  if (!r) return 0;
  if (r.text) { toast("QR-Code: " + r.text.slice(0, 60)); return 0; }
  let code = r.code;
  if (r.manual) {
    code = await sheet({
      title: "Barcode eingeben",
      body: `<label class="field"><span>Nummer unter dem Strichcode (8–14 Ziffern)</span><input class="input" id="bc" inputmode="numeric" pattern="[0-9]*" autocomplete="off"></label><button class="btn primary block" data-ok>Suchen</button>`,
      onMount: (s, close) => { const i = s.querySelector("#bc"); setTimeout(() => i.focus(), 300); const go = () => { const v = i.value.replace(/\D/g, ""); if (v.length >= 8) close(v); }; s.querySelector("[data-ok]").onclick = go; i.onkeydown = (e) => e.key === "Enter" && go(); }
    });
    if (!code) return 0;
  }
  return openBarcode(code, meal, dateKey);
}

export async function openBarcode(code, meal, dateKey) {
  // Eigene Produkte mit diesem Barcode haben Vorrang
  const own = Object.values(state.customFoods).find((f) => f.code === code);
  if (own) return (await openProduct(own, { meal, dateKey })) ? 1 : 0;
  toast("Suche Produkt " + code + " …");
  let p = null;
  try { p = await fetchByBarcode(code); }
  catch { toast("Keine Verbindung – Produkt konnte nicht geladen werden"); return 0; }
  if (p && p.complete) return (await openProduct(p, { meal, dateKey })) ? 1 : 0;
  // Nicht gefunden oder ohne Nährwerte
  const choice = await sheet({
    title: p ? "Nährwerte fehlen" : "Produkt nicht gefunden",
    body: `
      ${p ? `<div class="prod-top">${foodThumb(p)}<div class="t"><h3>${esc(p.name)}</h3><span>${esc(p.brand)}</span></div></div>` : ""}
      <p class="muted">${p ? "Zu diesem Produkt sind noch keine Nährwerte hinterlegt." : `Der Barcode <b class="num">${esc(code)}</b> ist noch nicht in der Datenbank.`} Leg es einfach selbst an – am schnellsten, indem du die Nährwerttabelle fotografierst.</p>
      <button class="btn primary block" data-c="create">${icon("edit")} Selbst anlegen</button>
      <a class="btn ghost block" href="${contributeUrl(code)}" target="_blank" rel="noopener">Für alle bei Open Food Facts ergänzen</a>`,
    onMount: (s, close) => { s.querySelector('[data-c="create"]').onclick = () => close("create"); }
  });
  if (choice !== "create") return 0;
  const f = await editCustomFood({ code, name: p?.name || "", brand: p?.brand || "", image: p?.image || null });
  if (!f) return 0;
  return (await openProduct(f, { meal, dateKey })) ? 1 : 0;
}

// ---------- KI-Foto ----------
export async function photoMeal(meal, dateKey) {
  if (!aiReady()) {
    await sheet({
      title: "Foto-Erkennung",
      body: `<div class="notice">${icon("sparkle")}<div>Fotografiere dein Essen – die KI erkennt die Lebensmittel und schätzt Menge und Kalorien.</div></div>
        <p class="muted small">Dafür brauchst du einen eigenen Claude-API-Schlüssel (kostet pro Foto weniger als 1 Cent). Hinterlege ihn unter Profil → KI-Funktionen.</p>
        <a class="btn primary block" href="#profile" data-go>Zum Profil</a>`,
      onMount: (s, close) => { s.querySelector("[data-go]").onclick = () => close(); }
    });
    return 0;
  }
  const blob = await takePhoto();
  if (!blob) return 0;
  const url = URL.createObjectURL(blob);
  return sheet({
    title: "Foto-Erkennung",
    full: true,
    body: `<img src="${url}" alt="Dein Foto" style="border-radius:16px;max-height:34vh;object-fit:cover;width:100%">
      <div data-out><div class="loader">Erkenne Lebensmittel …</div></div>`,
    onMount: (s, close) => {
      const out = s.querySelector("[data-out]");
      recognizeMeal(blob).then((res) => {
        if (!res.items.length) { out.innerHTML = `<div class="empty"><b>Kein Essen erkannt</b>Versuch es mit einem Foto von oben und gutem Licht.</div>`; return; }
        out.innerHTML = `
          ${res.note ? `<div class="notice">${icon("bulb")}<div>${esc(res.note)}${res.confidence ? ` <span class="muted">(Sicherheit: ${esc(res.confidence)})</span>` : ""}</div></div>` : ""}
          <p class="muted small" style="margin:0">Prüfe die Mengen – du kannst sie anpassen oder Einträge abwählen.</p>
          <div class="card list" style="padding:4px 14px">${res.items.map((it, i) => `
            <label class="item"><input type="checkbox" checked data-i="${i}" style="width:20px;height:20px;accent-color:var(--brand)">
              <span class="t"><b>${esc(it.name)}</b><span class="num" data-k="${i}">${fmt((it.per100.kcal || 0) * it.grams / 100)} kcal</span></span>
              <input class="input num" type="number" inputmode="numeric" data-g="${i}" value="${it.grams}" style="width:84px;min-height:40px;padding:8px;text-align:right"><span class="muted">g</span>
            </label>`).join("")}</div>
          <button class="btn primary block" data-ok>Zu ${esc(mealLabel(meal))} hinzufügen</button>`;
        s.querySelectorAll("[data-g]").forEach((inp) => (inp.oninput = () => {
          const it = res.items[+inp.dataset.g];
          s.querySelector(`[data-k="${inp.dataset.g}"]`).textContent = fmt(((it.per100.kcal || 0) * (+inp.value || 0)) / 100) + " kcal";
        }));
        s.querySelector("[data-ok]").onclick = () => {
          let n = 0;
          res.items.forEach((it, i) => {
            if (!s.querySelector(`[data-i="${i}"]`).checked) return;
            const g = +s.querySelector(`[data-g="${i}"]`).value || it.grams;
            addEntry(dateKey, meal, { ref: null, name: it.name, brand: "KI-Schätzung", grams: g, unit: "g", per100: it.per100, category: "ki" });
            n++;
          });
          toast(`${n} Lebensmittel hinzugefügt`);
          close(n);
        };
      }).catch((err) => { out.innerHTML = `<div class="notice warn">${icon("bulb")}<div>${esc(err.message)}</div></div>`; });
      return () => URL.revokeObjectURL(url);
    }
  });
}

// ---------- Schnelleintrag ----------
export function quickAdd(meal, dateKey) {
  return sheet({
    title: "Schnelleintrag",
    body: `<p class="muted small" style="margin:0">Nur Kalorien eintragen – z. B. im Restaurant.</p>
      <label class="field"><span>Bezeichnung</span><input class="input" id="qa-name" value="Schnelleintrag"></label>
      <label class="field"><span>Kalorien (kcal)</span><input class="input" id="qa-kcal" type="number" inputmode="numeric"></label>
      <div class="grid3">
        <label class="field"><span>KH (g)</span><input class="input" id="qa-c" type="number" inputmode="decimal"></label>
        <label class="field"><span>Eiweiß (g)</span><input class="input" id="qa-p" type="number" inputmode="decimal"></label>
        <label class="field"><span>Fett (g)</span><input class="input" id="qa-f" type="number" inputmode="decimal"></label>
      </div>
      <button class="btn primary block" data-ok>Hinzufügen</button>`,
    onMount: (s, close) => {
      setTimeout(() => s.querySelector("#qa-kcal").focus(), 300);
      s.querySelector("[data-ok]").onclick = () => {
        const v = (id) => { const x = s.querySelector(id).value; return x === "" ? null : +x.replace(",", "."); };
        const kcal = v("#qa-kcal");
        if (!(kcal > 0)) return s.querySelector("#qa-kcal").focus();
        // Gespeichert als "100 g" mit den Absolutwerten
        addEntry(dateKey, meal, {
          ref: null, name: s.querySelector("#qa-name").value.trim() || "Schnelleintrag", brand: "", grams: 100, unit: "g", amountLabel: "1 Eintrag",
          per100: { kcal, carbs: v("#qa-c"), protein: v("#qa-p"), fat: v("#qa-f") }, category: "schnell"
        });
        toast("Eingetragen");
        close(true);
      };
    }
  });
}

// ---------- Eigenes Lebensmittel ----------
export function editCustomFood(pre = {}) {
  const f = pre.id ? pre : { per100: {}, unit: "g", ...pre };
  const v = (k) => (f.per100?.[k] ?? "");
  const fields = [["kcal", "Kalorien (kcal)"], ["carbs", "Kohlenhydrate (g)"], ["sugar", "davon Zucker (g)"], ["fiber", "Ballaststoffe (g)"], ["protein", "Eiweiß (g)"], ["fat", "Fett (g)"], ["satFat", "davon gesättigt (g)"], ["salt", "Salz (g)"]];
  return sheet({
    title: f.id ? "Lebensmittel bearbeiten" : "Eigenes Lebensmittel",
    full: true,
    body: `<div class="form">
      ${aiReady() ? `<button class="btn accent block" data-label>${icon("camera")} Nährwerttabelle fotografieren</button>` : `<div class="notice">${icon("bulb")}<div class="small">Tipp: Mit einem KI-Schlüssel (Profil) liest die App die Nährwerttabelle direkt vom Foto ab.</div></div>`}
      <label class="field"><span>Name *</span><input class="input" id="cf-name" value="${esc(f.name || "")}" required></label>
      <div class="grid2">
        <label class="field"><span>Marke</span><input class="input" id="cf-brand" value="${esc(f.brand || "")}"></label>
        <label class="field"><span>Barcode</span><input class="input" id="cf-code" inputmode="numeric" value="${esc(f.code || "")}"></label>
      </div>
      <div class="seg" data-unit><button data-u="g" class="${f.unit !== "ml" ? "on" : ""}">pro 100 g</button><button data-u="ml" class="${f.unit === "ml" ? "on" : ""}">pro 100 ml</button></div>
      <div class="grid2">${fields.map(([k, l]) => `<label class="field"><span>${l}${k === "kcal" ? " *" : ""}</span><input class="input" data-n="${k}" type="number" inputmode="decimal" step="any" value="${v(k)}"></label>`).join("")}</div>
      <label class="field"><span>Portionsgröße (optional, in g/ml)</span><input class="input" id="cf-serv" type="number" inputmode="decimal" value="${f.servings?.[0]?.g || ""}"></label>
      <button class="btn primary block" data-ok>Speichern</button>
    </div>`,
    onMount: (s, close) => {
      let unit = f.unit || "g";
      s.querySelectorAll("[data-u]").forEach((b) => (b.onclick = () => { unit = b.dataset.u; s.querySelectorAll("[data-u]").forEach((x) => x.classList.toggle("on", x === b)); }));
      s.querySelector("[data-label]")?.addEventListener("click", async (e) => {
        const blob = await takePhoto();
        if (!blob) return;
        const btn = e.target.closest("button");
        btn.disabled = true; btn.textContent = "Lese Nährwerte …";
        try {
          const r = await readLabel(blob);
          if (r.name && !s.querySelector("#cf-name").value) s.querySelector("#cf-name").value = r.name;
          if (r.brand && !s.querySelector("#cf-brand").value) s.querySelector("#cf-brand").value = r.brand;
          for (const [k] of fields) if (r[k] != null) s.querySelector(`[data-n="${k}"]`).value = r[k];
          if (r.servingG) s.querySelector("#cf-serv").value = r.servingG;
          if (r.unit === "ml") s.querySelector('[data-u="ml"]').click();
          toast("Werte übernommen – bitte kurz prüfen");
        } catch (err) { toast(err.message); }
        btn.disabled = false; btn.innerHTML = `${icon("camera")} Nährwerttabelle fotografieren`;
      });
      s.querySelector("[data-ok]").onclick = () => {
        const name = s.querySelector("#cf-name").value.trim();
        const per100 = {};
        s.querySelectorAll("[data-n]").forEach((i) => { if (i.value !== "") per100[i.dataset.n] = +i.value.replace(",", "."); });
        if (!name) return s.querySelector("#cf-name").focus();
        if (per100.kcal == null) return s.querySelector('[data-n="kcal"]').focus();
        const id = f.id || uid();
        const serv = +s.querySelector("#cf-serv").value;
        const food = {
          source: "custom", ref: "custom:" + id, id, name, brand: s.querySelector("#cf-brand").value.trim(),
          code: s.querySelector("#cf-code").value.replace(/\D/g, ""), unit, per100, complete: true,
          servings: serv > 0 ? [{ label: "1 Portion", g: serv }] : [], image: f.image || null, category: "eigen"
        };
        state.customFoods[id] = food;
        commit();
        toast("Gespeichert");
        close(food);
      };
    }
  });
}
