// Rezepte: Sammlung, Details, eigener Rezept-Baukasten
import { state, ui, commit, uid } from "../store.js";
import { fmt, fmt1 } from "../nutrition.js";
import { icon, esc, sheet, toast, ask, foodThumb, debounce } from "../ui.js";
import { allRecipes, recipeFood, localSearch, defaultServing } from "../foods.js";
import { searchProducts } from "../off.js";
import { openProduct } from "./product.js";
import { mealForNow } from "./add.js";

let filter = "Alle";
const HUES = [152, 28, 205, 340, 45, 265, 10, 180];
const hue = (s) => HUES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
const art = (r, big = false) => `<div class="art" style="background:linear-gradient(135deg,hsl(${hue(r.name)} 52% 46%),hsl(${(hue(r.name) + 30) % 360} 60% 38%));${big ? "border-radius:18px;aspect-ratio:2.2" : ""}">${esc(r.name.split(" ").slice(0, 2).map((w) => w[0]).join(""))}<small>${r.minutes ? r.minutes + " Min." : "Rezept"}</small></div>`;

export function render(root) {
  const list = allRecipes();
  const tags = ["Alle", "Meine", ...new Set(list.flatMap((r) => r.tags || []))];
  const shown = list.filter((r) => filter === "Alle" || (filter === "Meine" ? !r.builtin : (r.tags || []).includes(filter)));
  root.innerHTML = `
    <header class="page-head"><h1>Rezepte</h1><button class="btn small primary" data-new>${icon("plus")} Neues Rezept</button></header>
    <div class="chips">${tags.map((t) => `<button class="chip ${t === filter ? "on" : ""}" data-f="${esc(t)}">${esc(t)}</button>`).join("")}</div>
    ${shown.length ? `<div class="recipe-grid">${shown.map((r) => {
      const f = recipeFood(r);
      const p = f.servings[0].g;
      return `<button class="recipe-card" data-r="${esc(r.id)}">${art(r)}<div class="t"><b>${esc(r.name)}</b><span class="num">${fmt((f.per100.kcal * p) / 100)} kcal · ${fmt((f.per100.protein * p) / 100)} g Eiweiß</span></div></button>`;
    }).join("")}</div>` : `<div class="card empty"><b>Noch keine eigenen Rezepte</b>Erstelle dein erstes Rezept – die Nährwerte pro Portion rechnet die App automatisch aus.</div>`}`;
  root.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { filter = b.dataset.f; render(root); }));
  root.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => openRecipe(list.find((r) => r.id === b.dataset.r))));
  root.querySelector("[data-new]").onclick = () => editRecipe();
}

export function openRecipe(r) {
  const f = recipeFood(r);
  let portions = 1;
  return sheet({
    title: r.name,
    full: true,
    body: `${art(r, true)}
      <div class="big-kcal" data-big></div>
      <div class="badges">${(r.tags || []).map((t) => `<span class="badge">${esc(t)}</span>`).join("")}${r.minutes ? `<span class="badge">${icon("clock")} ${r.minutes} Min.</span>` : ""}</div>
      <section class="card">
        <div class="card-head"><h3>Zutaten</h3>
          <div class="stepper" style="width:150px"><button data-p="-1" aria-label="weniger">${icon("minus")}</button><input id="rp" readonly value="1 Portion"><button data-p="1" aria-label="mehr">${icon("plus")}</button></div>
        </div>
        <div class="list" data-ing></div>
      </section>
      ${r.steps?.length ? `<section class="card"><div class="card-head"><h3>Zubereitung</h3></div><ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>` : ""}
      <div class="sheet-foot"><div class="row-btns" style="margin:0">
        <button class="btn ghost" data-edit>${icon(r.builtin ? "copy" : "edit")} ${r.builtin ? "Anpassen" : "Bearbeiten"}</button>
        <button class="btn primary" data-log style="flex:2">Ins Tagebuch</button>
      </div></div>`,
    onMount: (s, close) => {
      const draw = () => {
        const g = f.servings[0].g * portions;
        const v = (k) => ((f.per100[k] || 0) * g) / 100;
        s.querySelector("#rp").value = portions + (portions === 1 ? " Portion" : " Portionen");
        s.querySelector("[data-big]").innerHTML = `<div class="kc"><b class="num">${fmt(v("kcal"))}</b><span>kcal</span></div><div class="c"><b class="num">${fmt1(v("carbs"))}</b><span>KH (g)</span></div><div class="p"><b class="num">${fmt1(v("protein"))}</b><span>Eiweiß (g)</span></div><div class="f"><b class="num">${fmt1(v("fat"))}</b><span>Fett (g)</span></div>`;
        s.querySelector("[data-ing]").innerHTML = r.ingredients.map((i) => `<div class="item"><span class="t"><b>${esc(i.name)}</b></span><span class="k num">${fmt((i.grams / (r.servings || 1)) * portions)} ${i.unit || "g"}</span></div>`).join("");
      };
      s.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { portions = Math.max(1, Math.min(20, portions + +b.dataset.p)); draw(); }));
      draw();
      s.querySelector("[data-log]").onclick = () => { openProduct(f, { meal: mealForNow(), dateKey: ui.date }); };
      s.querySelector("[data-edit]").onclick = async () => {
        close();
        editRecipe(r.builtin ? { ...structuredClone(r), id: null, builtin: false, name: r.name + " (meins)" } : r);
      };
    }
  });
}

function pickIngredient() {
  return sheet({
    title: "Zutat hinzufügen",
    full: true,
    back: true,
    body: `<div class="search-box">${icon("search")}<input id="iq" type="search" placeholder="Zutat suchen" autocomplete="off"></div><div class="card list" data-res style="padding:4px 14px"><div class="empty">Tippe z. B. „Haferflocken“ oder eine Marke.</div></div>`,
    onMount: (s, close) => {
      const input = s.querySelector("#iq");
      const res = s.querySelector("[data-res]");
      const map = new Map();
      let req = 0;
      const show = (arr, loading) => {
        arr.forEach((f) => map.set(f.ref, f));
        res.innerHTML = arr.filter((f) => f.source !== "recipe").map((f) => `<button class="item" data-ref="${esc(f.ref)}">${foodThumb(f)}<span class="t"><b>${esc(f.name)}</b><span>${esc(f.brand || f.category || "")}</span></span><span class="k num">${fmt(f.per100.kcal)}<small>kcal/100</small></span></button>`).join("") + (loading ? `<div class="loader">Suche online …</div>` : "");
      };
      const online = debounce(async (q) => {
        const my = ++req;
        try { const r = await searchProducts(q); if (my === req) show([...localSearch(q), ...r]); } catch { if (my === req) show(localSearch(q)); }
      }, 450);
      input.oninput = () => { const q = input.value.trim(); if (q.length < 2) return; show(localSearch(q), true); online(q); };
      setTimeout(() => input.focus(), 300);
      res.onclick = async (e) => {
        const b = e.target.closest("[data-ref]");
        if (!b) return;
        const f = map.get(b.dataset.ref);
        const sv = defaultServing(f);
        const g = await sheet({
          title: f.name,
          body: `<label class="field"><span>Menge (${f.unit || "g"})</span><input class="input" id="ig" type="number" inputmode="decimal" value="${sv.g}"></label><button class="btn primary block" data-ok>Übernehmen</button>`,
          onMount: (s2, c2) => { const i = s2.querySelector("#ig"); i.select(); s2.querySelector("[data-ok]").onclick = () => c2(+i.value); }
        });
        if (g > 0) close({ ref: f.ref, name: f.name, grams: g, per100: f.per100, unit: f.unit || "g" });
      };
    }
  });
}

export function editRecipe(src) {
  const r = src ? structuredClone(src) : { id: null, name: "", servings: 2, minutes: 20, tags: [], ingredients: [], steps: [] };
  return sheet({
    title: r.id ? "Rezept bearbeiten" : "Neues Rezept",
    full: true,
    body: `<div class="form">
      <label class="field"><span>Name *</span><input class="input" id="rn" value="${esc(r.name)}" placeholder="z. B. Omas Linsensuppe"></label>
      <div class="grid2">
        <label class="field"><span>Portionen</span><input class="input" id="rs" type="number" inputmode="numeric" value="${r.servings}"></label>
        <label class="field"><span>Zeit (Min.)</span><input class="input" id="rm" type="number" inputmode="numeric" value="${r.minutes || ""}"></label>
      </div>
      <label class="field"><span>Kategorien (mit Komma getrennt)</span><input class="input" id="rt" value="${esc((r.tags || []).join(", "))}" placeholder="Abendessen, Vegetarisch"></label>
      <section class="card"><div class="card-head"><h3>Zutaten</h3><button class="link" data-addi>+ Zutat</button></div><div class="list" data-ings></div><p class="small muted" data-sum style="margin:8px 0 0"></p></section>
      <label class="field"><span>Zubereitung (ein Schritt pro Zeile)</span><textarea class="input" id="rz" rows="6">${esc((r.steps || []).join("\n"))}</textarea></label>
      <div class="row-btns">${r.id ? `<button class="btn ghost" data-del>${icon("trash")}</button>` : ""}<button class="btn primary" data-ok style="flex:3">Rezept speichern</button></div>
    </div>`,
    onMount: (s, close) => {
      const draw = () => {
        s.querySelector("[data-ings]").innerHTML = r.ingredients.length ? r.ingredients.map((i, n) => `<div class="item"><span class="t"><b>${esc(i.name)}</b><span class="num">${fmt((i.per100.kcal * i.grams) / 100)} kcal</span></span><span class="k num">${fmt(i.grams)} ${i.unit || "g"}</span><button class="icon-btn" data-rm="${n}" aria-label="Entfernen">${icon("trash")}</button></div>`).join("") : `<p class="muted small" style="margin:0">Noch keine Zutaten.</p>`;
        const servings = Math.max(1, +s.querySelector("#rs").value || 1);
        const kcal = r.ingredients.reduce((a, i) => a + ((i.per100.kcal || 0) * i.grams) / 100, 0);
        s.querySelector("[data-sum]").textContent = r.ingredients.length ? `Gesamt ${fmt(kcal)} kcal · ${fmt(kcal / servings)} kcal pro Portion` : "";
        s.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { r.ingredients.splice(+b.dataset.rm, 1); draw(); }));
      };
      draw();
      s.querySelector("#rs").oninput = draw;
      s.querySelector("[data-addi]").onclick = async () => { const i = await pickIngredient(); if (i) { r.ingredients.push(i); draw(); } };
      s.querySelector("[data-ok]").onclick = () => {
        r.name = s.querySelector("#rn").value.trim();
        if (!r.name) return s.querySelector("#rn").focus();
        if (!r.ingredients.length) return toast("Füge mindestens eine Zutat hinzu");
        r.servings = Math.max(1, +s.querySelector("#rs").value || 1);
        r.minutes = +s.querySelector("#rm").value || null;
        r.tags = s.querySelector("#rt").value.split(",").map((t) => t.trim()).filter(Boolean);
        r.steps = s.querySelector("#rz").value.split("\n").map((t) => t.trim()).filter(Boolean);
        r.id ||= uid();
        delete r.builtin;
        state.recipes[r.id] = r;
        commit();
        toast("Rezept gespeichert");
        close(r);
      };
      s.querySelector("[data-del]")?.addEventListener("click", async () => {
        if (await ask("Rezept löschen?", r.name, "Löschen", true)) { delete state.recipes[r.id]; commit(); close(); }
      });
    }
  });
}
