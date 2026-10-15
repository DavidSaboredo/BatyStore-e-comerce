/*
  Panel de la tienda (#/admin)

  Pensado para el dueño: entra con la clave, carga diseños con su imagen,
  ajusta precios y datos de cobro, y publica.

  - La clave se verifica contra /api/store; nunca vive en el código.
  - Todo lo que se edita queda en un borrador en este dispositivo, así no se
    pierde si se cierra la pestaña. Los clientes lo ven recién al publicar.
*/

import { ADMIN_SESSION_KEY, CONFIG, MATERIALS, PRODUCTS, STORAGE_KEYS } from "./app-data.js";

const DRAFT_KEY = "batystore.admin.draft.v1";
const PRICE_LIMIT = 1_000_000;
const MAX_IMAGE_MB = 10;

const TABS = [
  { id: "disenos", label: "Diseños" },
  { id: "precios", label: "Precios" },
  { id: "cobro", label: "Cobro y envío" },
];

const COLOR_SWATCH = {
  Negro: "#141418",
  Blanco: "#f4f4f6",
  Gris: "#8b8b96",
  Azul: "#2b55a8",
  Rojo: "#c4302b",
  Beige: "#d8c6a2",
};

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  order: '<path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4"/>',
  external:
    '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="m3 3 18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
};

function icon(name) {
  return `<svg class="adm-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ""}</svg>`;
}

/* ===== Estado del panel ===== */
let api = null; // funciones de la tienda (app.js)
let host = null; // contenedor #app
let mountToken = 0;
let base = null; // lo publicado, normalizado
let draft = null; // lo que se está editando
let publishedAt = null;
let tab = "disenos";
let query = "";
let ordering = false;
let publishTried = false;
let publishing = false;
let editor = null; // diseño abierto en el editor
let editorReturn = ""; // a dónde vuelve el foco al cerrar el editor
const shownErrors = new Set();

const esc = (value) => api.escapeHtml(value ?? "");
const clone = (value) => JSON.parse(JSON.stringify(value));
const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");
const toAmount = (value) => Math.max(0, Math.round(Number(value) || 0));
const formatAmount = (value) => (toAmount(value) ? toAmount(value).toLocaleString("es-AR") : "");
const money = (value) => api.formatMoney(toAmount(value));
const plainText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
const productById = (id) => PRODUCTS.find((p) => p.id === id) || null;
const productByType = (type) => PRODUCTS.find((p) => p.type === type) || null;
const materialById = (id) => MATERIALS.find((m) => m.id === id) || MATERIALS[0];

/* ===== Sesión ===== */
function readKey() {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) || localStorage.getItem(ADMIN_SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function saveKey(key, remember) {
  try {
    sessionStorage.setItem(ADMIN_SESSION_KEY, key);
    if (remember) localStorage.setItem(ADMIN_SESSION_KEY, key);
    else localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {}
}

function clearKey() {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {}
}

// La pantalla de configuración vieja guardaba la clave junto a los ajustes de la tienda
function forgetOldKey() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    const settings = raw ? JSON.parse(raw) : null;
    if (settings && typeof settings === "object" && "adminKey" in settings) {
      delete settings.adminKey;
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    }
  } catch {}
}

/* ===== Servidor ===== */
async function postStore(key, body) {
  try {
    const res = await fetch("/api/store", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch {
    return { status: 0, data: {} };
  }
}

async function fetchStore() {
  try {
    const res = await fetch("/api/store", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

/* ===== Datos ===== */
function normalizeDesign(design) {
  return {
    id: String(design?.id || ""),
    name: String(design?.name || ""),
    price: toAmount(design?.price),
    productId: String(design?.productId || "remera-basica"),
    allowedSizes: Array.isArray(design?.allowedSizes) ? design.allowedSizes.slice() : [],
    imageUrl: String(design?.imageUrl || ""),
    fixedColor: String(design?.fixedColor || ""),
    fixedSize: String(design?.fixedSize || ""),
    materialId: String(design?.materialId || ""),
  };
}

// Lo que hoy ve el cliente, con los precios efectivos (un 0 en la base cae al precio de app-data.js)
function snapshot() {
  const pricing = api.getPricing();
  const remera = productByType("Remera");
  const info = api.businessInfo();
  return {
    designs: api.getDesigns().map(normalizeDesign),
    pricing: {
      productBase: {
        remeraPeinado: toAmount(api.productBasePriceFor(remera, "peinado")),
        remeraAlgodon100: toAmount(api.productBasePriceFor(remera, "algodon100")),
        buzo: toAmount(api.productBasePriceFor(productByType("Buzo"), "")),
        gorra: toAmount(api.productBasePriceFor(productByType("Gorra"), "")),
      },
      stampSizes: {
        chico: toAmount(pricing.stampSizes?.chico),
        mediano: toAmount(pricing.stampSizes?.mediano),
        grande: toAmount(pricing.stampSizes?.grande),
      },
      hatStamp: toAmount(pricing.hatStamp),
      shipping: {
        pickupLabel: String(pricing.shipping?.pickupLabel || CONFIG.shipping.pickupLabel),
        deliveryLabel: String(pricing.shipping?.deliveryLabel || CONFIG.shipping.deliveryLabel),
        deliveryFlatRate: toAmount(pricing.shipping?.deliveryFlatRate),
      },
    },
    business: {
      whatsappNumber: onlyDigits(info.whatsappNumber),
      bank: { ...info.bank },
    },
  };
}

function prendaPrice(productId, materialId) {
  const product = productById(productId);
  const prices = draft.pricing.productBase;
  if (product?.type === "Remera") return materialId === "algodon100" ? prices.remeraAlgodon100 : prices.remeraPeinado;
  if (product?.type === "Buzo") return prices.buzo;
  if (product?.type === "Gorra") return prices.gorra;
  return product?.basePrice || 0;
}

function sizeOptions(productId, materialId) {
  const product = productById(productId);
  if (!product) return [];
  if (product.type === "Remera") {
    const max = Number(materialById(materialId)?.maxSize) || 0;
    return Array.from({ length: max }, (_, i) => String(i + 1));
  }
  return (product.sizes || []).map(String);
}

function designMeta(design) {
  const product = productById(design.productId);
  return [
    product?.type,
    product?.type === "Remera" ? (materialById(design.materialId)?.label || "").replace(/^Algodón\s+/i, "") : "",
    design.fixedColor,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* ===== Borrador ===== */
function looksLikeDraft(value) {
  return Boolean(
    value &&
      Array.isArray(value.designs) &&
      value.pricing?.productBase &&
      value.pricing?.stampSizes &&
      value.pricing?.shipping &&
      value.business?.bank,
  );
}

function restoreDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (!saved) return { draft: null, stale: false };
    if (saved.baseAt !== publishedAt || !looksLikeDraft(saved.draft)) {
      localStorage.removeItem(DRAFT_KEY);
      return { draft: null, stale: true };
    }
    return {
      draft: {
        designs: saved.draft.designs.map(normalizeDesign),
        pricing: saved.draft.pricing,
        business: saved.draft.business,
      },
      stale: false,
    };
  } catch {
    return { draft: null, stale: false };
  }
}

function saveDraft() {
  try {
    if (changes().count > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify({ baseAt: publishedAt, draft }));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

function countLeafChanges(a, b) {
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let total = 0;
    for (const key of keys) total += countLeafChanges(a[key], b[key]);
    return total;
  }
  return a === b ? 0 : 1;
}

// Cuántos cambios hay sin publicar y cuáles diseños son nuevos o editados
function changes() {
  const before = new Map(base.designs.map((d) => [d.id, JSON.stringify(d)]));
  const after = new Set(draft.designs.map((d) => d.id));
  const status = new Map();
  let count = 0;

  for (const design of draft.designs) {
    const previous = before.get(design.id);
    if (previous === undefined) {
      status.set(design.id, "new");
      count += 1;
    } else if (previous !== JSON.stringify(design)) {
      status.set(design.id, "edited");
      count += 1;
    }
  }
  for (const id of before.keys()) if (!after.has(id)) count += 1;

  const keptBefore = base.designs.map((d) => d.id).filter((id) => after.has(id));
  const keptAfter = draft.designs.map((d) => d.id).filter((id) => before.has(id));
  if (keptBefore.join("|") !== keptAfter.join("|")) count += 1;

  count += countLeafChanges(base.pricing, draft.pricing) + countLeafChanges(base.business, draft.business);
  return { count, status };
}

function afterChange() {
  saveDraft();
  refreshChrome();
}

function payload() {
  const text = (value, max) => String(value ?? "").trim().slice(0, max);
  const pricing = clone(draft.pricing);
  pricing.shipping.pickupLabel = text(pricing.shipping.pickupLabel, 80);
  pricing.shipping.deliveryLabel = text(pricing.shipping.deliveryLabel, 80);
  const bank = draft.business.bank;
  return {
    designs: clone(draft.designs),
    pricing,
    business: {
      whatsappNumber: onlyDigits(draft.business.whatsappNumber).slice(0, 15),
      bank: {
        alias: text(bank.alias, 60),
        cvuCbu: text(bank.cvuCbu, 40).replace(/\s/g, ""),
        holder: text(bank.holder, 80),
        cuit: text(bank.cuit, 20),
      },
    },
  };
}

/* ===== Campos de precios y cobro ===== */
const FIELDS = [
  { id: "pb-remeraPeinado", tab: "precios", path: ["pricing", "productBase", "remeraPeinado"], kind: "money", required: true },
  { id: "pb-remeraAlgodon100", tab: "precios", path: ["pricing", "productBase", "remeraAlgodon100"], kind: "money", required: true },
  { id: "pb-buzo", tab: "precios", path: ["pricing", "productBase", "buzo"], kind: "money", required: true },
  { id: "pb-gorra", tab: "precios", path: ["pricing", "productBase", "gorra"], kind: "money", required: true },
  { id: "st-chico", tab: "precios", path: ["pricing", "stampSizes", "chico"], kind: "money" },
  { id: "st-mediano", tab: "precios", path: ["pricing", "stampSizes", "mediano"], kind: "money" },
  { id: "st-grande", tab: "precios", path: ["pricing", "stampSizes", "grande"], kind: "money" },
  { id: "st-gorra", tab: "precios", path: ["pricing", "hatStamp"], kind: "money" },
  {
    id: "bk-alias",
    tab: "cobro",
    path: ["business", "bank", "alias"],
    max: 60,
    check: (v) =>
      !v || /^[a-z0-9.-]{6,20}$/i.test(v) ? "" : "El alias tiene entre 6 y 20 caracteres: letras, números, puntos o guiones.",
  },
  {
    id: "bk-cvuCbu",
    tab: "cobro",
    path: ["business", "bank", "cvuCbu"],
    max: 40,
    check: (v) => (!v || /^\d{22}$/.test(v.replace(/\s/g, "")) ? "" : "El CBU o CVU tiene 22 números."),
  },
  { id: "bk-holder", tab: "cobro", path: ["business", "bank", "holder"], max: 80 },
  {
    id: "bk-cuit",
    tab: "cobro",
    path: ["business", "bank", "cuit"],
    max: 20,
    check: (v) => (!v || onlyDigits(v).length === 11 ? "" : "El CUIT tiene 11 números."),
  },
  {
    id: "wa-number",
    tab: "cobro",
    path: ["business", "whatsappNumber"],
    kind: "phone",
    max: 30,
    check: (v) => {
      const digits = onlyDigits(v);
      if (!digits) return "Escribí el número de WhatsApp de la tienda.";
      if (digits.startsWith("0")) return "Escribilo sin el 0 del principio.";
      if (digits.length < 10 || digits.length > 13) return "Escribí el número completo con código de área, por ejemplo 3442 409755.";
      return "";
    },
  },
  { id: "sh-pickup", tab: "cobro", path: ["pricing", "shipping", "pickupLabel"], max: 80, required: true },
  { id: "sh-delivery", tab: "cobro", path: ["pricing", "shipping", "deliveryLabel"], max: 80, required: true },
  { id: "sh-rate", tab: "cobro", path: ["pricing", "shipping", "deliveryFlatRate"], kind: "money" },
];
const FIELD = Object.fromEntries(FIELDS.map((f) => [f.id, f]));

function fieldValue(field) {
  return field.path.reduce((obj, key) => (obj == null ? obj : obj[key]), draft);
}

function setFieldValue(field, value) {
  const parent = field.path.slice(0, -1).reduce((obj, key) => obj[key], draft);
  parent[field.path[field.path.length - 1]] = value;
}

function fieldError(field) {
  const value = fieldValue(field);
  if (field.kind === "money") {
    if (field.required && !value) return "Poné el precio.";
    if (value > PRICE_LIMIT) return "El máximo es $1.000.000.";
    return "";
  }
  const text = String(value ?? "").trim();
  if (field.required && !text) return "Este dato no puede quedar vacío.";
  return field.check ? field.check(text) : "";
}

function allErrors() {
  return FIELDS.filter((f) => fieldError(f));
}

function showFieldError(id) {
  const field = FIELD[id];
  const input = document.getElementById(id);
  const box = document.getElementById(`${id}-error`);
  if (!field || !input || !box) return;
  const message = shownErrors.has(id) ? fieldError(field) : "";
  input.setAttribute("aria-invalid", message ? "true" : "false");
  box.textContent = message;
  box.hidden = !message;
}

function moneyRow(id, label, detail = "") {
  return `
    <div class="adm-row${label.length > 18 ? " adm-row-long" : ""}">
      <label class="adm-row-label" for="${id}">${esc(label)}${detail ? `<small>${esc(detail)}</small>` : ""}</label>
      <div class="adm-row-field">
        <div class="adm-money">
          <span aria-hidden="true">$</span>
          <input id="${id}" data-field="${id}" inputmode="numeric" autocomplete="off" placeholder="0"
            value="${formatAmount(fieldValue(FIELD[id]))}" aria-describedby="${id}-error" />
        </div>
        <p class="adm-error" id="${id}-error" hidden></p>
      </div>
    </div>
  `;
}

function textField(id, label, { hint = "", placeholder = "", inputmode = "", autocomplete = "off" } = {}) {
  const field = FIELD[id];
  const describedBy = [hint ? `${id}-hint` : "", `${id}-error`].filter(Boolean).join(" ");
  return `
    <div class="adm-field">
      <label for="${id}">${esc(label)}</label>
      <input id="${id}" data-field="${id}" maxlength="${field.max || 80}" autocomplete="${autocomplete}"
        ${inputmode ? `inputmode="${inputmode}"` : ""} placeholder="${esc(placeholder)}"
        value="${esc(fieldValue(field))}" aria-describedby="${describedBy}" />
      ${hint ? `<p class="adm-hint" id="${id}-hint">${esc(hint)}</p>` : ""}
      <p class="adm-error" id="${id}-error" hidden></p>
    </div>
  `;
}

/* ===== Entrada ===== */
export function mountAdmin(container, storeApi) {
  api = storeApi;
  host = container;
  mountToken += 1;
  editor = null;
  forgetOldKey();
  const key = readKey();
  if (!key) {
    renderLogin();
    return;
  }
  start(key, mountToken, false);
}

async function start(key, token, alreadyChecked) {
  renderLoading();
  const [check, store] = await Promise.all([
    alreadyChecked ? Promise.resolve({ status: 200, data: {} }) : postStore(key, { action: "check" }),
    fetchStore(),
  ]);
  if (token !== mountToken) return;

  if (check.status === 401) {
    clearKey();
    renderLogin({ error: "La clave guardada ya no sirve. Entrá de nuevo." });
    return;
  }
  if (check.status !== 200 || !store) {
    renderFailure();
    return;
  }

  api.setPublishedStore(store);
  publishedAt = typeof store.updatedAt === "number" ? store.updatedAt : null;
  base = snapshot();
  const restored = restoreDraft();
  draft = restored.draft || clone(base);
  tab = "disenos";
  query = "";
  ordering = false;
  publishTried = false;
  shownErrors.clear();
  renderShell();

  if (restored.draft && changes().count > 0) {
    toast("Recuperamos los cambios que no habías publicado.", { tone: "info" });
  } else if (restored.stale) {
    toast("Había cambios sin publicar de una versión anterior de la tienda y no se pudieron recuperar.", { tone: "info" });
  }
}

function renderLoading() {
  host.innerHTML = `
    <div class="adm adm-center">
      <p class="adm-loading" role="status"><span class="adm-spinner" aria-hidden="true"></span>Cargando la tienda…</p>
    </div>
  `;
}

function renderFailure() {
  host.innerHTML = `
    <div class="adm adm-center">
      <div class="adm-login">
        <span class="adm-login-icon">${icon("alert")}</span>
        <h1 class="adm-login-title">No pudimos cargar la tienda</h1>
        <p class="adm-login-text">Revisá tu conexión a internet y probá de nuevo.</p>
        <button type="button" class="adm-btn adm-btn-primary adm-btn-block" id="admRetry">Reintentar</button>
        <a class="adm-login-back" href="#/">${icon("left")}Volver a la tienda</a>
      </div>
    </div>
  `;
  document.getElementById("admRetry")?.addEventListener("click", () => mountAdmin(host, api));
}

function renderLogin({ error = "" } = {}) {
  host.innerHTML = `
    <div class="adm adm-center">
      <form class="adm-login" id="admLogin" novalidate>
        <img class="adm-login-logo" src="./baty-logo.jpg" alt="" width="56" height="56" />
        <div>
          <h1 class="adm-login-title">Panel de ${esc(CONFIG.storeName)}</h1>
          <p class="adm-login-text">Entrá con la clave del panel para cargar diseños y cambiar precios.</p>
        </div>
        <input type="text" name="username" value="${esc(CONFIG.storeName)}" autocomplete="username"
          class="adm-sr" tabindex="-1" aria-hidden="true" />
        <div class="adm-field">
          <label for="admKey">Clave del panel</label>
          <div class="adm-pass">
            <input id="admKey" name="password" type="password" autocomplete="current-password"
              aria-describedby="admLoginError" ${error ? 'aria-invalid="true"' : ""} />
            <button type="button" class="adm-pass-toggle" id="admKeyToggle" aria-pressed="false">
              ${icon("eye")}<span class="adm-sr">Mostrar la clave</span>
            </button>
          </div>
          <p class="adm-error" id="admLoginError" ${error ? "" : "hidden"}>${esc(error)}</p>
        </div>
        <label class="adm-check">
          <input type="checkbox" id="admRemember" />
          <span>Recordarme en este dispositivo</span>
        </label>
        <button class="adm-btn adm-btn-primary adm-btn-block" type="submit" id="admLoginBtn">Entrar</button>
        <a class="adm-login-back" href="#/">${icon("left")}Volver a la tienda</a>
      </form>
    </div>
  `;

  const form = document.getElementById("admLogin");
  const input = document.getElementById("admKey");
  const toggle = document.getElementById("admKeyToggle");
  const button = document.getElementById("admLoginBtn");
  const errorBox = document.getElementById("admLoginError");
  const token = mountToken;

  const setError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = !message;
    input.setAttribute("aria-invalid", message ? "true" : "false");
  };

  toggle.addEventListener("click", () => {
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    toggle.setAttribute("aria-pressed", String(!visible));
    toggle.innerHTML = `${icon(visible ? "eye" : "eyeOff")}<span class="adm-sr">${visible ? "Mostrar" : "Ocultar"} la clave</span>`;
    input.focus();
  });

  input.addEventListener("input", () => {
    if (!errorBox.hidden) setError("");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const key = input.value.trim();
    if (!key) {
      setError("Escribí la clave.");
      input.focus();
      return;
    }
    button.disabled = true;
    button.innerHTML = `<span class="adm-spinner" aria-hidden="true"></span>Entrando…`;
    const res = await postStore(key, { action: "check" });
    if (token !== mountToken) return;
    if (res.status === 200) {
      saveKey(key, document.getElementById("admRemember").checked);
      start(key, token, true);
      return;
    }
    button.disabled = false;
    button.textContent = "Entrar";
    if (res.status === 401) setError("La clave no es correcta. Revisala y probá de nuevo.");
    else if (res.status === 500 && /ADMIN_KEY/.test(String(res.data?.error || "")))
      setError("El panel todavía no tiene una clave configurada en el servidor.");
    else setError("No pudimos conectar con la tienda. Revisá tu conexión y probá de nuevo.");
    input.select();
  });

  input.focus({ preventScroll: true });
}

function logout() {
  clearKey();
  mountToken += 1;
  editor = null;
  renderLogin();
}

/* ===== Estructura del panel ===== */
function renderShell() {
  host.innerHTML = `
    <div class="adm" id="adm">
      <header class="adm-top">
        <div class="adm-wrap adm-top-row">
          <div class="adm-brand">
            <img src="./baty-logo.jpg" alt="" width="40" height="40" />
            <div>
              <strong>${esc(CONFIG.storeName)}</strong>
              <span>Panel de la tienda</span>
            </div>
          </div>
          <div class="adm-top-actions">
            <span class="adm-status" id="admStatus"></span>
            <a class="adm-toplink" href="./" target="_blank" rel="noopener" aria-label="Ver tienda (se abre en otra pestaña)">
              ${icon("external")}<span>Ver tienda</span>
            </a>
            <button type="button" class="adm-toplink" data-action="logout" aria-label="Salir del panel">
              ${icon("logout")}<span>Salir</span>
            </button>
          </div>
        </div>
        <nav class="adm-wrap adm-tabs" role="tablist" aria-label="Secciones del panel">
          ${TABS.map(
            (t) => `
              <button type="button" class="adm-tab" role="tab" id="adm-tab-${t.id}" data-tab="${t.id}"
                aria-controls="admMain" aria-selected="${t.id === tab}" tabindex="${t.id === tab ? 0 : -1}">
                ${esc(t.label)}${t.id === "disenos" ? ` <span class="adm-tab-count" id="admDesignsCount"></span>` : ""}
              </button>`,
          ).join("")}
        </nav>
      </header>

      <main class="adm-wrap adm-main" id="admMain" role="tabpanel" aria-labelledby="adm-tab-${tab}"></main>

      <div class="adm-publish" id="admPublish" hidden>
        <div class="adm-wrap adm-publish-inner">
          <p class="adm-publish-text">
            <strong id="admPublishCount"></strong>
            <span>Los clientes siguen viendo la versión anterior hasta que publiques.</span>
          </p>
          <div class="adm-publish-actions">
            <button type="button" class="adm-btn" data-action="discard" id="admDiscardBtn">Descartar</button>
            <button type="button" class="adm-btn adm-btn-primary" data-action="publish" id="admPublishBtn">Publicar cambios</button>
          </div>
        </div>
      </div>

      <div class="adm-toasts" id="admToasts" aria-live="polite"></div>
      <p class="adm-sr" id="admLive" aria-live="polite"></p>
      <dialog class="adm-dialog" id="admEditor" aria-labelledby="admEditorTitle"></dialog>
      <dialog class="adm-dialog adm-dialog-small" id="admConfirm" aria-labelledby="admConfirmTitle"></dialog>
    </div>
  `;

  const root = document.getElementById("adm");
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("focusout", onFocusOut);
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("submit", onSubmit);

  const editorDialog = document.getElementById("admEditor");
  editorDialog.addEventListener("cancel", (event) => {
    if (editor?.touched) {
      event.preventDefault();
      requestCloseEditor();
    }
  });
  editorDialog.addEventListener("close", () => {
    if (editor) closeEditor();
  });
  editorDialog.addEventListener("dragover", (event) => {
    const drop = event.target instanceof Element ? event.target.closest(".adm-drop") : null;
    if (drop) drop.classList.add("is-drag");
  });
  editorDialog.addEventListener("dragleave", (event) => {
    const drop = event.target instanceof Element ? event.target.closest(".adm-drop") : null;
    if (drop) drop.classList.remove("is-drag");
  });

  renderTab();
  refreshChrome();
}

function refreshChrome() {
  const root = document.getElementById("adm");
  if (!root) return;
  const { count } = changes();

  const status = document.getElementById("admStatus");
  status.className = `adm-status ${count ? "is-pending" : "is-ok"}`;
  status.innerHTML = count
    ? `<span class="adm-dot" aria-hidden="true"></span><span class="adm-status-long">${count} ${
        count === 1 ? "cambio" : "cambios"
      } sin publicar</span><span class="adm-status-short">Sin publicar</span>`
    : `<span class="adm-dot" aria-hidden="true"></span><span class="adm-status-long">Todo publicado</span><span class="adm-status-short">Publicado</span>`;
  status.title = publishedAt
    ? `Última publicación: ${new Date(publishedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}`
    : "";

  document.getElementById("admPublish").hidden = !count;
  root.classList.toggle("has-pending", Boolean(count));
  document.getElementById("admPublishCount").textContent = `${count} ${
    count === 1 ? "cambio sin publicar" : "cambios sin publicar"
  }`;
  document.getElementById("admDesignsCount").textContent = String(draft.designs.length);

  // Marca las pestañas que tienen datos por corregir
  const errorTabs = new Set(publishTried ? allErrors().map((f) => f.tab) : []);
  for (const t of TABS) {
    root.querySelector(`[data-tab="${t.id}"]`)?.classList.toggle("has-error", errorTabs.has(t.id));
  }
}

function switchTab(id) {
  tab = id;
  ordering = false;
  for (const button of document.querySelectorAll(".adm-tab")) {
    const active = button.dataset.tab === id;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  }
  document.getElementById("admMain")?.setAttribute("aria-labelledby", `adm-tab-${id}`);
  renderTab();
  window.scrollTo({ top: 0 });
}

function renderTab() {
  if (tab === "precios") renderPricesTab();
  else if (tab === "cobro") renderBillingTab();
  else renderDesignsTab();
  for (const field of FIELDS) showFieldError(field.id);
}

/* ===== Diseños ===== */
function renderDesignsTab() {
  const main = document.getElementById("admMain");
  main.innerHTML = `
    <div class="adm-head">
      <div>
        <h1 class="adm-h1">Diseños</h1>
        <p class="adm-sub">Los que aparecen en el catálogo, en este mismo orden. Tocá uno para editarlo.</p>
      </div>
    </div>
    <div class="adm-toolbar">
      <label class="adm-search">
        ${icon("search")}
        <span class="adm-sr">Buscar diseño</span>
        <input type="search" id="admSearch" placeholder="Buscar por nombre" autocomplete="off"
          value="${esc(query)}" ${ordering ? "disabled" : ""} />
      </label>
      <div class="adm-toolbar-actions">
        <button type="button" class="adm-btn" data-action="order" aria-pressed="${ordering}">
          ${ordering ? `${icon("check")}Listo` : `${icon("order")}Ordenar`}
        </button>
        <button type="button" class="adm-btn adm-btn-primary" data-action="add">${icon("plus")}Agregar diseño</button>
      </div>
    </div>
    ${
      ordering
        ? `<p class="adm-note">${icon("info")}<span>Usá las flechas para mover cada diseño. Así se van a ordenar en la tienda.</span></p>`
        : ""
    }
    <div class="adm-grid" id="admGrid"></div>
  `;
  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById("admGrid");
  if (!grid) return;
  const { status } = changes();
  const search = plainText(query);
  const items = draft.designs
    .map((design, index) => ({ design, index }))
    .filter(({ design }) => !search || plainText(design.name).includes(search));

  if (draft.designs.length === 0) {
    grid.innerHTML = `
      <div class="adm-empty">
        ${icon("image")}
        <strong>Todavía no hay diseños</strong>
        <span>Agregá el primero con el botón «Agregar diseño».</span>
      </div>`;
    return;
  }
  if (items.length === 0) {
    grid.innerHTML = `
      <div class="adm-empty">
        ${icon("search")}
        <strong>No hay diseños con «${esc(query.trim())}»</strong>
        <button type="button" class="adm-linkbtn" data-action="clear-search">Ver todos los diseños</button>
      </div>`;
    return;
  }

  const last = draft.designs.length - 1;
  grid.innerHTML = items
    .map(({ design, index }) => {
      const name = esc(design.name);
      const state = status.get(design.id);
      const badge =
        state === "new"
          ? `<span class="adm-badge is-new">Nuevo</span>`
          : state === "edited"
            ? `<span class="adm-badge">Editado</span>`
            : "";
      const image = design.imageUrl
        ? `<img src="${esc(api.cloudinaryOptimized(design.imageUrl, 400))}" alt="" loading="lazy" />`
        : `<span class="adm-tile-noimg">${icon("image")}Sin imagen</span>`;

      if (ordering) {
        return `
          <article class="adm-tile" data-id="${esc(design.id)}">
            <div class="adm-tile-img">${image}${badge}</div>
            <div class="adm-tile-body"><span class="adm-tile-name">${name}</span></div>
            <div class="adm-tile-move">
              <button type="button" class="adm-icon-btn" data-move="-1" data-id="${esc(design.id)}" ${index === 0 ? "disabled" : ""}>
                ${icon("left")}<span class="adm-sr">Mover ${name} antes</span>
              </button>
              <span class="adm-tile-pos" aria-hidden="true">${index + 1}</span>
              <button type="button" class="adm-icon-btn" data-move="1" data-id="${esc(design.id)}" ${index === last ? "disabled" : ""}>
                ${icon("right")}<span class="adm-sr">Mover ${name} después</span>
              </button>
            </div>
          </article>`;
      }

      return `
        <article class="adm-tile">
          <button type="button" class="adm-tile-btn" data-edit="${esc(design.id)}">
            <span class="adm-tile-img">${image}${badge}<span class="adm-tile-pen" aria-hidden="true">${icon("pencil")}</span></span>
            <span class="adm-tile-body">
              <span class="adm-sr">Editar </span>
              <span class="adm-tile-name">${name}</span>
              <span class="adm-tile-meta">${esc(designMeta(design))}</span>
              <span class="adm-tile-price">${money(prendaPrice(design.productId, design.materialId) + design.price)}</span>
            </span>
          </button>
        </article>`;
    })
    .join("");
}

function moveDesign(id, direction) {
  const from = draft.designs.findIndex((d) => d.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= draft.designs.length) return;
  [draft.designs[from], draft.designs[to]] = [draft.designs[to], draft.designs[from]];
  afterChange();
  renderGrid();
  const selector = (dir) => `[data-move="${dir}"][data-id="${CSS.escape(id)}"]`;
  const same = document.querySelector(selector(direction));
  (same && !same.disabled ? same : document.querySelector(selector(-direction)))?.focus();
  announce(`${draft.designs[to].name} quedó en el lugar ${to + 1} de ${draft.designs.length}.`);
}

/* ===== Editor de diseño ===== */
function openEditor(id) {
  const existing = id ? draft.designs.find((d) => d.id === id) : null;
  const productId = productById(existing?.productId) ? existing.productId : PRODUCTS[0].id;
  const product = productById(productId);
  const materialId = product.type === "Remera" ? materialById(existing?.materialId).id : "";
  const options = sizeOptions(productId, materialId);

  let sizes = options.slice();
  if (existing?.fixedSize) sizes = [existing.fixedSize];
  else if (existing?.allowedSizes?.length) sizes = existing.allowedSizes.map(String).filter((s) => options.includes(s));
  if (sizes.length === 0) sizes = options.slice();

  editor = {
    id: existing?.id || null,
    name: existing?.name || "",
    productId,
    materialId,
    color: existing?.fixedColor && product.colors.includes(existing.fixedColor) ? existing.fixedColor : product.colors[0] || "",
    sizes: new Set(sizes),
    price: existing?.price || 0,
    imageUrl: existing?.imageUrl || "",
    preview: "",
    uploading: false,
    imageError: "",
    showUrl: false,
    touched: false,
    tried: false,
    confirmClose: false,
  };
  editorReturn = id ? `[data-edit="${CSS.escape(id)}"]` : `[data-action="add"]`;

  renderEditor();
  const dialog = document.getElementById("admEditor");
  dialog.showModal();
  if (!id) document.getElementById("admName")?.focus();
}

function renderEditor() {
  const dialog = document.getElementById("admEditor");
  if (!dialog || !editor) return;
  const e = editor;
  const product = productById(e.productId);
  const options = sizeOptions(e.productId, e.materialId);
  const errors = editorErrors(e);
  const shownImage = e.preview || (e.imageUrl ? api.cloudinaryOptimized(e.imageUrl, 600) : "");
  const imageMessage = e.imageError || (e.tried ? errors.image : "");

  // Conserva el foco y el scroll al redibujar (por ejemplo, al cambiar de prenda)
  const active = document.activeElement;
  const focusSelector =
    active instanceof HTMLInputElement && active.type === "radio"
      ? `input[name="${active.name}"][value="${CSS.escape(active.value)}"]`
      : active?.id
        ? `#${CSS.escape(active.id)}`
        : "";
  const scrollTop = dialog.querySelector(".adm-dialog-body")?.scrollTop || 0;

  dialog.innerHTML = `
    <form class="adm-editor" id="admEditorForm" novalidate>
      <header class="adm-dialog-head">
        <h2 id="admEditorTitle">${e.id ? "Editar diseño" : "Nuevo diseño"}</h2>
        <button type="button" class="adm-icon-btn adm-icon-btn-quiet" data-action="editor-close">
          ${icon("x")}<span class="adm-sr">Cerrar</span>
        </button>
      </header>

      <div class="adm-dialog-body">
        <div class="adm-editor-grid">
          <div class="adm-editor-media">
            <p class="adm-label" id="admImageLabel">Imagen del diseño</p>
            <div class="adm-drop ${shownImage ? "has-image" : ""} ${imageMessage ? "is-invalid" : ""}">
              ${
                shownImage
                  ? `<img src="${esc(shownImage)}" alt="Vista previa del diseño" />`
                  : `<div class="adm-drop-empty">${icon("upload")}<strong>Subí la imagen</strong><span>Arrastrala acá o tocá para elegirla</span></div>`
              }
              ${
                e.uploading
                  ? `<div class="adm-drop-busy" role="status"><span class="adm-spinner" aria-hidden="true"></span>Subiendo imagen…</div>`
                  : ""
              }
              <input type="file" id="admFile" class="adm-drop-input" accept="image/png,image/jpeg,image/webp"
                aria-labelledby="admImageLabel" aria-describedby="admImageHelp admImageError" ${e.uploading ? "disabled" : ""} />
            </div>
            <p class="adm-hint" id="admImageHelp">${shownImage ? "Tocá la imagen para cambiarla." : "JPG, PNG o WEBP, hasta 10 MB."}</p>
            <p class="adm-error" id="admImageError" ${imageMessage ? "" : "hidden"}>${esc(imageMessage)}</p>
            <details class="adm-more" ${e.showUrl ? "open" : ""}>
              <summary>Usar un link de imagen</summary>
              <div class="adm-field">
                <label class="adm-sr" for="admImageUrl">Link de la imagen</label>
                <input id="admImageUrl" type="url" inputmode="url" placeholder="https://…" value="${esc(e.imageUrl)}" />
              </div>
            </details>
          </div>

          <div class="adm-editor-fields">
            <div class="adm-field">
              <label for="admName">Nombre</label>
              <input id="admName" maxlength="120" autocomplete="off" placeholder="Ej.: Malenia 1"
                value="${esc(e.name)}" aria-describedby="admNameError" />
              <p class="adm-error" id="admNameError" hidden></p>
            </div>

            <fieldset class="adm-fieldset">
              <legend>Prenda</legend>
              <div class="adm-seg">
                ${PRODUCTS.map(
                  (p) => `
                  <label><input type="radio" name="product" value="${esc(p.id)}" ${p.id === e.productId ? "checked" : ""} />
                  <span>${esc(p.type)}</span></label>`,
                ).join("")}
              </div>
            </fieldset>

            ${
              product.type === "Remera"
                ? `
            <fieldset class="adm-fieldset">
              <legend>Tela</legend>
              <div class="adm-seg">
                ${MATERIALS.map(
                  (m) => `
                  <label><input type="radio" name="material" value="${esc(m.id)}" ${m.id === e.materialId ? "checked" : ""} />
                  <span>${esc(m.label)}</span></label>`,
                ).join("")}
              </div>
            </fieldset>`
                : ""
            }

            <fieldset class="adm-fieldset">
              <legend>Color de la prenda</legend>
              <div class="adm-chips">
                ${(product.colors || [])
                  .map(
                    (c) => `
                  <label class="adm-chip"><input type="radio" name="color" value="${esc(c)}" ${c === e.color ? "checked" : ""} />
                  <span><i style="--sw:${COLOR_SWATCH[c] || "#777"}" aria-hidden="true"></i>${esc(c)}</span></label>`,
                  )
                  .join("")}
              </div>
            </fieldset>

            <fieldset class="adm-fieldset" aria-describedby="admSizesError">
              <legend>Talles que se ofrecen</legend>
              ${
                options.length > 1
                  ? `
              <div class="adm-chips">
                ${options
                  .map(
                    (s) => `
                  <label class="adm-chip adm-chip-size"><input type="checkbox" name="size" value="${esc(s)}" ${e.sizes.has(s) ? "checked" : ""} />
                  <span>${icon("check")}${esc(s)}</span></label>`,
                  )
                  .join("")}
              </div>
              <div class="adm-chip-tools">
                <button type="button" class="adm-linkbtn" data-action="sizes-all">Marcar todos</button>
              </div>
              <p class="adm-error" id="admSizesError" hidden></p>`
                  : `<p class="adm-hint">Talle único.</p>`
              }
            </fieldset>

            <div class="adm-field">
              <label for="admPrice">Recargo por este diseño <span class="adm-optional">(opcional)</span></label>
              <div class="adm-money">
                <span aria-hidden="true">$</span>
                <input id="admPrice" inputmode="numeric" autocomplete="off" placeholder="0"
                  value="${formatAmount(e.price)}" aria-describedby="admPriceHint admPriceError" />
              </div>
              <p class="adm-hint" id="admPriceHint">Se suma al precio de la prenda. Dejalo vacío si cuesta lo mismo.</p>
              <p class="adm-error" id="admPriceError" hidden></p>
            </div>

            <div class="adm-total" id="admTotal" aria-live="polite"></div>
          </div>
        </div>
      </div>

      <footer class="adm-dialog-foot" id="admEditorFoot"></footer>
    </form>
  `;

  renderEditorFoot();
  updateEditorTotal();
  showEditorErrors();

  const body = dialog.querySelector(".adm-dialog-body");
  if (body) body.scrollTop = scrollTop;
  if (focusSelector) dialog.querySelector(focusSelector)?.focus({ preventScroll: true });
}

function renderEditorFoot() {
  const foot = document.getElementById("admEditorFoot");
  if (!foot || !editor) return;
  if (editor.confirmClose) {
    foot.innerHTML = `
      <p class="adm-foot-msg">¿Cerrar sin guardar? Se pierden los cambios de este diseño.</p>
      <span class="adm-spacer"></span>
      <button type="button" class="adm-btn" data-action="editor-keep">Seguir editando</button>
      <button type="button" class="adm-btn adm-btn-danger" data-action="editor-discard">Cerrar sin guardar</button>
    `;
    foot.querySelector('[data-action="editor-keep"]')?.focus();
    return;
  }
  const canDelete = editor.id && draft.designs.length > 1;
  foot.innerHTML = `
    ${canDelete ? `<button type="button" class="adm-btn adm-btn-quiet" data-action="editor-delete">${icon("trash")}Quitar diseño</button>` : ""}
    <span class="adm-spacer"></span>
    <button type="button" class="adm-btn" data-action="editor-close">Cancelar</button>
    <button type="submit" class="adm-btn adm-btn-primary" ${editor.uploading ? "disabled" : ""}>
      ${editor.uploading ? `<span class="adm-spinner" aria-hidden="true"></span>Subiendo imagen…` : editor.id ? "Guardar cambios" : "Agregar diseño"}
    </button>
  `;
}

function updateEditorTotal() {
  const box = document.getElementById("admTotal");
  if (!box || !editor) return;
  const product = productById(editor.productId);
  const prenda = prendaPrice(editor.productId, editor.materialId);
  box.innerHTML = `
    <span>El cliente paga</span>
    <strong>${money(prenda + editor.price)}</strong>
    <small>${esc(product?.type || "Prenda")} ${money(prenda)}${editor.price ? ` + diseño ${money(editor.price)}` : ""}</small>
  `;
}

function editorErrors(e) {
  const options = sizeOptions(e.productId, e.materialId);
  const url = e.imageUrl.trim();
  let image = "";
  if (!e.uploading) {
    if (!url) image = "Subí la imagen del diseño.";
    else if (!/^https?:\/\//i.test(url)) image = "El link tiene que empezar con https://";
  }
  return {
    name: e.name.trim() ? "" : "Escribí el nombre del diseño.",
    image,
    sizes: options.length > 1 && !options.some((s) => e.sizes.has(s)) ? "Elegí al menos un talle." : "",
    price: e.price > PRICE_LIMIT ? "El máximo es $1.000.000." : "",
  };
}

function setMessage(boxId, message, inputId) {
  const box = document.getElementById(boxId);
  if (box) {
    box.textContent = message;
    box.hidden = !message;
  }
  if (inputId) document.getElementById(inputId)?.setAttribute("aria-invalid", message ? "true" : "false");
}

function showEditorErrors() {
  if (!editor) return;
  const errors = editor.tried ? editorErrors(editor) : { name: "", image: "", sizes: "", price: editorErrors(editor).price };
  setMessage("admNameError", errors.name, "admName");
  setMessage("admSizesError", errors.sizes);
  setMessage("admPriceError", errors.price, "admPrice");
  const imageMessage = editor.imageError || errors.image;
  setMessage("admImageError", imageMessage);
  document.querySelector("#admEditor .adm-drop")?.classList.toggle("is-invalid", Boolean(imageMessage));
}

async function handleFile(file) {
  if (!file || !editor) return;
  const current = editor;
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    current.imageError = "Ese archivo no es una imagen JPG, PNG o WEBP.";
    showEditorErrors();
    return;
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    current.imageError = `La imagen pesa más de ${MAX_IMAGE_MB} MB. Probá con una más liviana.`;
    showEditorErrors();
    return;
  }

  current.preview = URL.createObjectURL(file);
  current.uploading = true;
  current.imageError = "";
  current.touched = true;
  renderEditor();

  try {
    const result = await api.uploadDesignToCloudinary(file);
    if (editor !== current) return;
    current.imageUrl = result.url;
  } catch {
    if (editor !== current) return;
    current.imageError = "No se pudo subir la imagen. Revisá tu conexión y probá de nuevo.";
  } finally {
    URL.revokeObjectURL(current.preview);
    current.preview = "";
    current.uploading = false;
    if (editor === current) renderEditor();
  }
}

function uniqueId(name) {
  const slug =
    plainText(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "diseno";
  const taken = new Set(draft.designs.map((d) => d.id));
  if (!taken.has(slug)) return slug;
  for (let n = 2; ; n += 1) {
    if (!taken.has(`${slug}-${n}`)) return `${slug}-${n}`;
  }
}

function saveEditor() {
  const e = editor;
  if (!e || e.uploading) return;
  if (e.id && !e.touched) {
    closeEditor();
    return;
  }

  e.tried = true;
  const errors = editorErrors(e);
  showEditorErrors();
  const firstInvalid = errors.name
    ? "#admName"
    : errors.image
      ? "#admFile"
      : errors.sizes
        ? 'input[name="size"]'
        : errors.price
          ? "#admPrice"
          : "";
  if (firstInvalid) {
    document.querySelector(`#admEditor ${firstInvalid}`)?.focus();
    return;
  }

  const product = productById(e.productId);
  const options = sizeOptions(e.productId, e.materialId);
  const chosen = options.filter((s) => e.sizes.has(s));
  // Si se ofrecen todos los talles se guarda la lista vacía, como hacía la tienda
  const allowedSizes =
    options.length <= 1 || chosen.length === options.length
      ? []
      : chosen.map((s) => (product.type === "Remera" ? Number(s) : s));

  const design = normalizeDesign({
    id: e.id || uniqueId(e.name),
    name: e.name.trim(),
    price: e.price,
    productId: e.productId,
    allowedSizes,
    imageUrl: e.imageUrl.trim(),
    fixedColor: e.color,
    fixedSize: "",
    materialId: product.type === "Remera" ? e.materialId : "",
  });

  if (e.id) {
    const index = draft.designs.findIndex((d) => d.id === e.id);
    if (index >= 0) draft.designs[index] = design;
  } else {
    draft.designs.unshift(design);
    query = "";
  }

  editorReturn = `[data-edit="${CSS.escape(design.id)}"]`;
  closeEditor();
  if (tab === "disenos") renderDesignsTab();
  afterChange();
  document.querySelector(editorReturn)?.focus();
  toast(
    e.id
      ? `Guardaste «${design.name}». Cuando publiques, aparece en la tienda.`
      : `Agregaste «${design.name}» al principio del catálogo. Cuando publiques, aparece en la tienda.`,
  );
}

function requestCloseEditor() {
  if (!editor) return;
  if (editor.touched) {
    editor.confirmClose = true;
    renderEditorFoot();
    return;
  }
  closeEditor();
}

function closeEditor() {
  editor = null;
  const dialog = document.getElementById("admEditor");
  if (dialog?.open) dialog.close();
  document.querySelector(editorReturn)?.focus();
}

function deleteDesign() {
  if (!editor?.id || draft.designs.length <= 1) return;
  const index = draft.designs.findIndex((d) => d.id === editor.id);
  if (index < 0) return;
  const [removed] = draft.designs.splice(index, 1);
  editorReturn = `[data-action="add"]`;
  closeEditor();
  renderGrid();
  afterChange();
  toast(`Quitaste «${removed.name}».`, {
    action: {
      label: "Deshacer",
      run: () => {
        if (draft.designs.some((d) => d.id === removed.id)) return;
        draft.designs.splice(Math.min(index, draft.designs.length), 0, removed);
        renderGrid();
        afterChange();
      },
    },
  });
}

/* ===== Precios ===== */
function renderPricesTab() {
  const remera = productByType("Remera");
  const main = document.getElementById("admMain");
  main.innerHTML = `
    <div class="adm-head">
      <div>
        <h1 class="adm-h1">Precios</h1>
        <p class="adm-sub">Los nuevos precios se ven en la tienda cuando publicás los cambios.</p>
      </div>
    </div>

    <section class="adm-card" aria-labelledby="admPricesPrendas">
      <h2 class="adm-h2" id="admPricesPrendas">Prendas</h2>
      <p class="adm-card-sub">Lo que paga el cliente por la prenda con un diseño del catálogo. Si el diseño tiene recargo, se suma.</p>
      <div class="adm-rows">
        ${moneyRow("pb-remeraPeinado", remera?.type || "Remera", materialById("peinado").label)}
        ${moneyRow("pb-remeraAlgodon100", remera?.type || "Remera", materialById("algodon100").label)}
        ${moneyRow("pb-buzo", productByType("Buzo")?.type || "Buzo")}
        ${moneyRow("pb-gorra", productByType("Gorra")?.type || "Gorra")}
      </div>
    </section>

    <section class="adm-card" aria-labelledby="admPricesStamps">
      <h2 class="adm-h2" id="admPricesStamps">Estampa con imagen del cliente</h2>
      <p class="adm-card-sub">Se suma al precio de la prenda cuando el cliente sube su propia imagen desde «Personalizar». Dejalo en $0 si no cobrás extra.</p>
      <div class="adm-rows">
        ${moneyRow("st-chico", "Estampa chica")}
        ${moneyRow("st-mediano", "Estampa mediana")}
        ${moneyRow("st-grande", "Estampa grande")}
        ${moneyRow("st-gorra", "Estampa en gorra")}
      </div>
    </section>
  `;
}

/* ===== Cobro y envío ===== */
function hasBankDraft() {
  const bank = draft.business.bank;
  return Boolean(String(bank.alias || "").trim() || String(bank.cvuCbu || "").trim());
}

function whatsappTestLink() {
  const number = api.normalizeWhatsappNumber(draft.business.whatsappNumber);
  return number ? `https://wa.me/${number}` : "";
}

function renderBillingTab() {
  const main = document.getElementById("admMain");
  const testLink = whatsappTestLink();
  main.innerHTML = `
    <div class="adm-head">
      <div>
        <h1 class="adm-h1">Cobro y envío</h1>
        <p class="adm-sub">Lo que ve el cliente cuando confirma su pedido.</p>
      </div>
    </div>

    <section class="adm-card" aria-labelledby="admBillingBank">
      <h2 class="adm-h2" id="admBillingBank">Datos para transferencias</h2>
      <p class="adm-card-sub">Aparecen al confirmar el pedido y en el mensaje que te manda el cliente por WhatsApp.</p>
      <p class="adm-note" id="admBankNote" ${hasBankDraft() ? "hidden" : ""}>
        ${icon("info")}<span>Todavía no cargaste estos datos. Mientras tanto, la tienda le indica al cliente que te los pida por WhatsApp.</span>
      </p>
      <div class="adm-fields-2">
        ${textField("bk-alias", "Alias")}
        ${textField("bk-cvuCbu", "CBU o CVU", { inputmode: "numeric", hint: "22 números, sin espacios." })}
        ${textField("bk-holder", "Titular de la cuenta", { autocomplete: "name" })}
        ${textField("bk-cuit", "CUIT", { inputmode: "numeric", placeholder: "20-12345678-9" })}
      </div>
    </section>

    <section class="adm-card" aria-labelledby="admBillingWa">
      <h2 class="adm-h2" id="admBillingWa">WhatsApp de la tienda</h2>
      <p class="adm-card-sub">A este número llegan los pedidos de los clientes.</p>
      <div class="adm-inline">
        ${textField("wa-number", "Número con código de área", { inputmode: "tel", hint: "Sin el 0 ni el 15. Ej.: 3442 409755" })}
        <a class="adm-btn" id="admWaTest" href="${esc(testLink || "#")}" target="_blank" rel="noopener" ${testLink ? "" : 'aria-disabled="true"'}>
          ${icon("external")}Probar
        </a>
      </div>
    </section>

    <section class="adm-card" aria-labelledby="admBillingShip">
      <h2 class="adm-h2" id="admBillingShip">Entrega</h2>
      <p class="adm-card-sub">Las dos opciones que elige el cliente al hacer el pedido.</p>
      <div class="adm-fields-2">
        ${textField("sh-pickup", "Opción para retirar")}
        ${textField("sh-delivery", "Opción con envío")}
      </div>
      <div class="adm-rows adm-rows-spaced">
        ${moneyRow("sh-rate", "Costo del envío a domicilio", "Con $0, el envío no suma nada al total.")}
      </div>
    </section>
  `;
}

function handleFieldInput(input) {
  const field = FIELD[input.dataset.field];
  if (!field) return;
  if (field.kind === "money") {
    const digits = onlyDigits(input.value).replace(/^0+(?=\d)/, "").slice(0, 7);
    const amount = digits ? Number(digits) : 0;
    setFieldValue(field, amount);
    input.value = digits ? amount.toLocaleString("es-AR") : "";
  } else if (field.kind === "phone") {
    setFieldValue(field, onlyDigits(input.value));
    const link = document.getElementById("admWaTest");
    const href = whatsappTestLink();
    if (link) {
      link.href = href || "#";
      link.toggleAttribute("aria-disabled", !href);
    }
  } else {
    setFieldValue(field, input.value);
  }
  if (field.id.startsWith("bk-")) {
    const note = document.getElementById("admBankNote");
    if (note) note.hidden = hasBankDraft();
  }
  if (shownErrors.has(field.id)) showFieldError(field.id);
  afterChange();
}

/* ===== Publicar ===== */
function setPublishBusy(busy) {
  const button = document.getElementById("admPublishBtn");
  const discard = document.getElementById("admDiscardBtn");
  if (!button || !discard) return;
  button.disabled = busy;
  discard.disabled = busy;
  button.innerHTML = busy ? `<span class="adm-spinner" aria-hidden="true"></span>Publicando…` : "Publicar cambios";
}

async function publish() {
  if (publishing) return;
  const errors = allErrors();
  if (errors.length) {
    publishTried = true;
    for (const field of errors) shownErrors.add(field.id);
    const first = errors[0];
    if (tab !== first.tab) switchTab(first.tab);
    else for (const field of FIELDS) showFieldError(field.id);
    refreshChrome();
    document.getElementById(first.id)?.focus();
    toast("Revisá los datos marcados en rojo antes de publicar.", { tone: "error" });
    return;
  }

  const key = readKey();
  if (!key) {
    renderLogin({ error: "Tu sesión se cerró. Entrá de nuevo: tus cambios siguen guardados." });
    return;
  }

  publishing = true;
  setPublishBusy(true);
  const body = payload();
  const token = mountToken;
  const res = await postStore(key, body);
  publishing = false;
  if (token !== mountToken || !document.getElementById("adm")) return;
  setPublishBusy(false);

  if (res.status === 200) {
    publishedAt = typeof res.data?.updatedAt === "number" ? res.data.updatedAt : Date.now();
    api.setPublishedStore({ ...clone(body), updatedAt: publishedAt });
    base = { designs: body.designs.map(normalizeDesign), pricing: clone(body.pricing), business: clone(body.business) };
    draft = clone(base);
    publishTried = false;
    shownErrors.clear();
    saveDraft();
    renderTab();
    refreshChrome();
    toast("Listo, los cambios ya se ven en la tienda.");
    return;
  }
  if (res.status === 401) {
    clearKey();
    renderLogin({ error: "Tu sesión venció. Entrá de nuevo: tus cambios siguen guardados en este dispositivo." });
    return;
  }
  toast(
    res.status === 400
      ? "La tienda no aceptó algunos datos. Revisá los diseños y los precios."
      : "No se pudo publicar. Revisá tu conexión y probá de nuevo: tus cambios siguen guardados.",
    { tone: "error" },
  );
}

async function discardChanges() {
  const ok = await confirmBox({
    title: "¿Descartar los cambios?",
    text: "Vas a volver a lo que hoy ven los clientes. Esto no se puede deshacer.",
    confirm: "Descartar cambios",
    danger: true,
  });
  if (!ok) return;
  draft = clone(base);
  publishTried = false;
  shownErrors.clear();
  saveDraft();
  renderTab();
  refreshChrome();
  toast("Descartaste los cambios.", { tone: "info" });
}

/* ===== Avisos y confirmaciones ===== */
function toast(message, { tone = "ok", action = null } = {}) {
  const box = document.getElementById("admToasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = `adm-toast is-${tone}`;
  el.innerHTML = `
    ${icon(tone === "error" ? "alert" : tone === "info" ? "info" : "check")}
    <span>${esc(message)}</span>
    ${action ? `<button type="button" class="adm-toast-action">${esc(action.label)}</button>` : ""}
    <button type="button" class="adm-toast-close">${icon("x")}<span class="adm-sr">Cerrar aviso</span></button>
  `;
  const dismiss = () => el.remove();
  el.querySelector(".adm-toast-close").addEventListener("click", dismiss);
  if (action) {
    el.querySelector(".adm-toast-action").addEventListener("click", () => {
      action.run();
      dismiss();
    });
  }
  box.append(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(dismiss, action ? 9000 : tone === "error" ? 8000 : 5000);
}

function announce(message) {
  const live = document.getElementById("admLive");
  if (live) live.textContent = message;
}

function confirmBox({ title, text, confirm, cancel = "Cancelar", danger = false }) {
  const dialog = document.getElementById("admConfirm");
  dialog.innerHTML = `
    <form method="dialog" class="adm-confirm">
      <h2 id="admConfirmTitle">${esc(title)}</h2>
      <p>${esc(text)}</p>
      <div class="adm-confirm-actions">
        <button class="adm-btn" value="cancel" autofocus>${esc(cancel)}</button>
        <button class="adm-btn ${danger ? "adm-btn-danger" : "adm-btn-primary"}" value="ok">${esc(confirm)}</button>
      </div>
    </form>
  `;
  return new Promise((resolve) => {
    dialog.returnValue = "";
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
    dialog.showModal();
  });
}

/* ===== Eventos ===== */
function onClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const tabButton = target.closest("[data-tab]");
  if (tabButton) {
    if (tabButton.dataset.tab !== tab) switchTab(tabButton.dataset.tab);
    return;
  }

  const edit = target.closest("[data-edit]");
  if (edit) {
    openEditor(edit.dataset.edit);
    return;
  }

  const move = target.closest("[data-move]");
  if (move) {
    moveDesign(move.dataset.id, Number(move.dataset.move));
    return;
  }

  const link = target.closest("#admWaTest");
  if (link?.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
    return;
  }

  const action = target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "logout") logout();
  else if (action === "add") openEditor(null);
  else if (action === "order") {
    ordering = !ordering;
    query = "";
    renderDesignsTab();
    document.querySelector('[data-action="order"]')?.focus();
  } else if (action === "clear-search") {
    query = "";
    renderDesignsTab();
    document.getElementById("admSearch")?.focus();
  } else if (action === "publish") publish();
  else if (action === "discard") discardChanges();
  else if (action === "editor-close") requestCloseEditor();
  else if (action === "editor-keep") {
    editor.confirmClose = false;
    renderEditorFoot();
  } else if (action === "editor-discard") closeEditor();
  else if (action === "editor-delete") deleteDesign();
  else if (action === "sizes-all" && editor) {
    for (const s of sizeOptions(editor.productId, editor.materialId)) editor.sizes.add(s);
    for (const box of document.querySelectorAll('#admEditor input[name="size"]')) box.checked = true;
    editor.touched = true;
    showEditorErrors();
  }
}

function onInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  if (target.id === "admSearch") {
    query = target.value;
    renderGrid();
    return;
  }
  if (target.dataset.field) {
    handleFieldInput(target);
    return;
  }
  if (!editor) return;

  if (target.id === "admName") {
    editor.name = target.value;
    editor.touched = true;
    if (editor.tried) showEditorErrors();
  } else if (target.id === "admPrice") {
    const digits = onlyDigits(target.value).replace(/^0+(?=\d)/, "").slice(0, 7);
    editor.price = digits ? Number(digits) : 0;
    target.value = digits ? editor.price.toLocaleString("es-AR") : "";
    editor.touched = true;
    updateEditorTotal();
    showEditorErrors();
  } else if (target.id === "admImageUrl") {
    editor.imageUrl = target.value.trim();
    editor.imageError = "";
    editor.touched = true;
  }
}

function onChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !editor) return;

  if (target.name === "product") {
    const product = productById(target.value);
    if (!product) return;
    editor.productId = product.id;
    editor.materialId = product.type === "Remera" ? editor.materialId || MATERIALS[0].id : "";
    if (!product.colors.includes(editor.color)) editor.color = product.colors[0] || "";
    editor.sizes = new Set(sizeOptions(product.id, editor.materialId));
    editor.touched = true;
    renderEditor();
  } else if (target.name === "material") {
    editor.materialId = target.value;
    const options = sizeOptions(editor.productId, editor.materialId);
    const kept = options.filter((s) => editor.sizes.has(s));
    editor.sizes = new Set(kept.length ? kept : options);
    editor.touched = true;
    renderEditor();
  } else if (target.name === "color") {
    editor.color = target.value;
    editor.touched = true;
  } else if (target.name === "size") {
    if (target.checked) editor.sizes.add(target.value);
    else editor.sizes.delete(target.value);
    editor.touched = true;
    showEditorErrors();
  } else if (target.id === "admFile") {
    handleFile(target.files?.[0]);
  } else if (target.id === "admImageUrl") {
    editor.showUrl = true;
    renderEditor();
  }
}

function onFocusOut(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.dataset.field) {
    shownErrors.add(target.dataset.field);
    showFieldError(target.dataset.field);
  }
}

function onKeyDown(event) {
  const current = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
  if (!current) return;
  const keys = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last" };
  if (!(event.key in keys)) return;
  event.preventDefault();
  const index = TABS.findIndex((t) => t.id === current.dataset.tab);
  const step = keys[event.key];
  const next =
    step === "first" ? 0 : step === "last" ? TABS.length - 1 : (index + step + TABS.length) % TABS.length;
  switchTab(TABS[next].id);
  document.querySelector(`[data-tab="${TABS[next].id}"]`)?.focus();
}

function onSubmit(event) {
  if (event.target instanceof HTMLFormElement && event.target.id === "admEditorForm") {
    event.preventDefault();
    saveEditor();
  }
}

// Avisa antes de cerrar la pestaña si quedaron cambios sin publicar
window.addEventListener("beforeunload", (event) => {
  if (!document.getElementById("adm") || !draft || !base || changes().count === 0) return;
  event.preventDefault();
  event.returnValue = "";
});
