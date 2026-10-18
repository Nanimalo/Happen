// ============================================================
//  KI-Funktionen (optional): Mahlzeit per Foto erkennen,
//  Nährwerttabelle abfotografieren, Ernährungs-Coach.
//  Nutzt die Claude-API mit einem eigenen API-Schlüssel
//  (Profil -> KI-Funktionen). Der Schlüssel bleibt auf dem Handy.
// ============================================================
import { state } from "./store.js";

export const aiReady = () => !!state.settings.aiKey;

async function toJpegBase64(blob, max = 1024) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82).split(",")[1];
}

async function callClaude(content, maxTokens = 1200) {
  if (!aiReady()) throw new Error("Für diese Funktion brauchst du einen API-Schlüssel (Profil → KI-Funktionen).");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": state.settings.aiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({ model: state.settings.aiModel || "claude-haiku-5-5", max_tokens: maxTokens, messages: [{ role: "user", content }] })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = data?.error?.message || res.statusText;
    if (res.status === 401) throw new Error("Der API-Schlüssel ist ungültig. Prüfe ihn unter Profil → KI-Funktionen.");
    if (res.status === 404) throw new Error("Das gewählte KI-Modell gibt es nicht. Ändere es unter Profil → KI-Funktionen.");
    throw new Error("KI-Anfrage fehlgeschlagen: " + m);
  }
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function parseJson(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("Die KI hat keine verwertbare Antwort geliefert. Versuch es mit einem deutlicheren Foto.");
  return JSON.parse(text.slice(a, b + 1));
}

// Foto einer Mahlzeit -> Liste geschätzter Lebensmittel mit Gramm und Nährwerten
export async function recognizeMeal(blob, hint = "") {
  const img = await toJpegBase64(blob);
  const text = await callClaude([
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: img } },
    { type: "text", text:
`Du bist ein Ernährungsassistent in einer Kalorienzähler-App. Erkenne alle Lebensmittel und Getränke auf dem Foto und schätze realistische Portionsgrößen.
${hint ? "Zusatzinfo vom Nutzer: " + hint + "\n" : ""}Antworte NUR mit JSON in genau diesem Format, Namen auf Deutsch:
{"items":[{"name":"Spaghetti Bolognese","grams":350,"kcal":520,"carbs":62,"protein":24,"fat":18,"sugar":8,"fiber":5}],"confidence":"hoch|mittel|niedrig","note":"kurzer Hinweis, z. B. was unsicher ist"}
Die Nährwerte gelten für die geschätzte Menge (nicht pro 100 g). Bei Getränken grams = ml. Ist kein Essen zu sehen, gib "items":[] zurück.` }
  ]);
  const data = parseJson(text);
  data.items = (data.items || []).filter((i) => i && i.name && i.grams > 0).map((i) => {
    const f = 100 / i.grams;
    const per100 = {};
    for (const k of ["kcal", "carbs", "protein", "fat", "sugar", "fiber"]) if (i[k] != null) per100[k] = +i[k] * f;
    return { name: i.name, grams: Math.round(i.grams), per100 };
  });
  return data;
}

// Foto der Nährwerttabelle -> Werte pro 100 g für ein eigenes Produkt
export async function readLabel(blob) {
  const img = await toJpegBase64(blob, 1400);
  const text = await callClaude([
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: img } },
    { type: "text", text:
`Lies die Nährwerttabelle auf diesem Verpackungsfoto. Gib die Werte PRO 100 g bzw. 100 ml zurück.
Antworte NUR mit JSON: {"name":"Produktname falls lesbar sonst leer","brand":"","kcal":0,"carbs":0,"sugar":0,"fiber":0,"protein":0,"fat":0,"satFat":0,"salt":0,"servingG":0,"unit":"g oder ml"}
Unbekannte Werte als null. servingG = Portionsgröße in g/ml falls angegeben, sonst null.` }
  ], 600);
  return parseJson(text);
}

// Ernährungs-Coach: kurze, persönliche Auswertung der letzten Tage
export async function coachAdvice(summary) {
  return callClaude([{ type: "text", text:
`Du bist ein freundlicher, sachlicher Ernährungscoach in einer Kalorienzähler-App. Hier sind die Daten des Nutzers der letzten Tage:
${summary}
Gib 3 kurze, konkrete und alltagstaugliche Tipps auf Deutsch (je 1–2 Sätze, als Liste mit "• "). Keine Diagnosen, keine extremen Diäten, kein Kaloriendefizit unter dem Ziel empfehlen. Lob, was gut läuft.` }], 600);
}
