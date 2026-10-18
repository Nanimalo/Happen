// ============================================================
//  Barcode- & QR-Scanner über die Handykamera.
//  Android/Chrome: eingebauter BarcodeDetector (sehr schnell).
//  iPhone/andere: ZXing-Bibliothek, wird bei Bedarf geladen.
// ============================================================
import { icon, esc } from "./ui.js";

const ZXING_URL = "https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js";
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"];

let zxingPromise;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  zxingPromise ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = ZXING_URL;
    s.onload = () => res(window.ZXing);
    s.onerror = () => { zxingPromise = null; rej(new Error("Scanner-Bibliothek konnte nicht geladen werden (offline?).")); };
    document.head.appendChild(s);
  });
  return zxingPromise;
}

async function makeDecoder() {
  if ("BarcodeDetector" in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.includes("ean_13")) {
        const det = new window.BarcodeDetector({ formats });
        return async (source) => {
          const r = await det.detect(source);
          return r[0] ? { text: r[0].rawValue, format: r[0].format } : null;
        };
      }
    } catch {}
  }
  const Z = await loadZXing();
  const hints = new Map();
  const F = Z.BarcodeFormat;
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.QR_CODE]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (source) => {
    const sw = source.videoWidth || source.naturalWidth || source.width;
    const sh = source.videoHeight || source.naturalHeight || source.height;
    if (!sw || !sh) return null;
    // Mittleren Bereich nehmen (dort ist der Rahmen) und verkleinern -> schneller
    const cw = Math.round(sw * 0.85), ch = Math.round(sh * 0.55);
    const scale = Math.min(1, 900 / cw);
    canvas.width = Math.round(cw * scale); canvas.height = Math.round(ch * scale);
    ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const lum = new Uint8ClampedArray(width * height);
    for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    try {
      const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, width, height)));
      const r = reader.decodeWithState(bmp);
      return { text: r.getText(), format: String(r.getBarcodeFormat()) };
    } catch { return null; } finally { reader.reset(); }
  };
}

// GS1 Digital Link (neue QR-Codes auf Verpackungen) -> EAN herausziehen
export function toBarcode(text) {
  const t = String(text).trim();
  if (/^\d{8,14}$/.test(t)) return t.length === 14 && t.startsWith("0") ? t.slice(1) : t;
  const m = t.match(/\/01\/(\d{14})/);
  if (m) return m[1].startsWith("0") ? m[1].slice(1) : m[1];
  return null;
}

// Öffnet den Scanner. Ergebnis: { code } | { text } | { manual: true } | null
export function scanBarcode({ title = "Barcode scannen" } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "scanner";
    el.innerHTML = `
      <video playsinline muted autoplay></video>
      <div class="scan-shade"><div class="scan-frame"><i></i></div></div>
      <header class="scan-top">
        <button type="button" class="icon-btn on-dark" data-x aria-label="Schließen">${icon("close")}</button>
        <strong>${esc(title)}</strong>
        <button type="button" class="icon-btn on-dark" data-torch aria-label="Licht" style="visibility:hidden">${icon("bolt")}</button>
      </header>
      <p class="scan-msg">Barcode oder QR-Code in den Rahmen halten</p>
      <footer class="scan-bottom">
        <label class="btn on-dark">${icon("camera")} Foto wählen<input type="file" accept="image/*" hidden></label>
        <button type="button" class="btn on-dark" data-manual>${icon("keyboard")} Nummer eingeben</button>
      </footer>`;
    document.body.appendChild(el);
    document.body.classList.add("no-scroll");
    const video = el.querySelector("video");
    const msg = el.querySelector(".scan-msg");
    let stream, running = true, last = null, hits = 0;

    const finish = (val) => {
      running = false;
      stream?.getTracks().forEach((t) => t.stop());
      el.classList.add("closing");
      setTimeout(() => { el.remove(); document.body.classList.remove("no-scroll"); }, 180);
      resolve(val);
    };
    const found = (r) => {
      navigator.vibrate?.(60);
      el.classList.add("hit");
      const code = toBarcode(r.text);
      setTimeout(() => finish(code ? { code } : { text: r.text }), 160);
    };

    el.querySelector("[data-x]").onclick = () => finish(null);
    el.querySelector("[data-manual]").onclick = () => finish({ manual: true });
    el.querySelector("input[type=file]").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      msg.textContent = "Bild wird ausgewertet …";
      try {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await img.decode();
        const decode = await makeDecoder();
        const r = await decode(img);
        if (r) found(r); else msg.textContent = "Kein Code im Foto gefunden. Näher heran und scharf fotografieren.";
      } catch (err) { msg.textContent = err.message; }
    };

    (async () => {
      let decode;
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("nocam"), { name: "NotSupported" });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
        });
        if (!running) return stream.getTracks().forEach((t) => t.stop());
        video.srcObject = stream;
        await video.play().catch(() => {});
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() || {};
        if (caps.torch) {
          const b = el.querySelector("[data-torch]");
          let on = false;
          b.style.visibility = "visible";
          b.onclick = () => { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {}); b.classList.toggle("active", on); };
        }
        if (caps.focusMode?.includes?.("continuous")) track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
        decode = await makeDecoder();
      } catch (err) {
        const denied = err.name === "NotAllowedError" || err.name === "SecurityError";
        msg.innerHTML = denied
          ? "Kein Kamerazugriff. Erlaube die Kamera in den Einstellungen deines Browsers für diese Seite – oder wähle ein Foto bzw. gib die Nummer ein."
          : err.name === "NotSupported" ? "Dieses Gerät unterstützt keine Live-Kamera im Browser. Wähle ein Foto oder gib die Nummer ein."
          : err.name === "NotFoundError" ? "Keine Kamera gefunden. Wähle ein Foto oder gib die Nummer ein."
          : err.name === "NotReadableError" ? "Die Kamera wird gerade von einer anderen App benutzt. Schließe sie und versuch es erneut."
          : esc(err.message || "Kamera konnte nicht gestartet werden.");
        el.classList.add("nocam");
        return;
      }
      const loop = async () => {
        if (!running) return;
        if (video.readyState >= 2) {
          try {
            const r = await decode(video);
            if (r) {
              // Zweimal gleiches Ergebnis = sicher erkannt
              if (r.text === last || r.format?.toLowerCase().includes("qr")) hits++; else hits = 1;
              last = r.text;
              if (hits >= 2 || r.format?.toLowerCase().includes("qr")) return found(r);
            }
          } catch {}
        }
        setTimeout(() => requestAnimationFrame(loop), 90);
      };
      loop();
    })();
  });
}

// Einfaches Foto aufnehmen (für die KI-Erkennung). Gibt ein Blob zurück.
export function takePhoto() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = () => resolve(input.files[0] || null);
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}
