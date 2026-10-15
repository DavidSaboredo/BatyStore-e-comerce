/*
  BatyStore (MVP)

  Archivo principal de la app.

  Responsabilidades:
  - Configuración del negocio (pago, envío, WhatsApp y datos bancarios)
  - Catálogo y reglas de personalización
  - Estado local (carrito/pedidos) persistido en localStorage
  - Renderizado SPA por hash (#/)
  - Generación de pedido + link de WhatsApp para confirmar pago

  Nota: este MVP no tiene backend; el historial de pedidos vive en el navegador del usuario.
*/

import {
  CONFIG,
  DEFAULT_DESIGNS,
  MATERIALS,
  PERSONALIZATION_PRICING,
  PRODUCTS,
  STORAGE_KEYS,
} from "./app-data.js";
import { mountAdmin } from "./admin.js";

const moneyFormatter = new Intl.NumberFormat(CONFIG.locale, {
  style: "currency",
  currency: CONFIG.currency,
  maximumFractionDigits: 0,
});

function formatMoney(amount) {
  return moneyFormatter.format(Math.round(amount));
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/* ===== Estado en memoria ===== */
const state = {
  cart: [],
  orders: [],
  settings: {},
  published: { designs: null, pricing: null, business: null, updatedAt: null },
};

function readCartFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cart);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function setCart(items) {
  state.cart = Array.isArray(items) ? items : [];
  localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(state.cart));
  updateCartCount();
}

function readOrdersFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.orders);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function setOrders(items) {
  state.orders = Array.isArray(items) ? items : [];
  localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(state.orders));
}

function readSettingsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setSettings(next) {
  state.settings = next && typeof next === "object" ? next : {};
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

function loadState() {
  state.cart = readCartFromStorage();
  state.orders = readOrdersFromStorage();
  state.settings = readSettingsFromStorage();
  updateCartCount();
}

function getCart() {
  return state.cart;
}

function getOrders() {
  return state.orders;
}

function getSettings() {
  return state.settings;
}

function setPublishedStore(next) {
  const designs = Array.isArray(next?.designs) ? next.designs : null;
  const pricing = next?.pricing && typeof next.pricing === "object" ? next.pricing : null;
  const business = next?.business && typeof next.business === "object" ? next.business : null;
  const updatedAt = typeof next?.updatedAt === "number" ? next.updatedAt : null;
  state.published = { designs, pricing, business, updatedAt };
}

function getPublishedStore() {
  return state.published;
}

function getPublishedDesigns() {
  return Array.isArray(state.published?.designs) ? state.published.designs : null;
}

function getPublishedPricing() {
  return state.published?.pricing && typeof state.published.pricing === "object" ? state.published.pricing : null;
}

function makeId(prefix) {
  const part = Math.random().toString(16).slice(2, 10);
  return `${prefix}_${Date.now().toString(16)}_${part}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Pide a Cloudinary una versión liviana (formato/calidad automáticos y ancho máximo)
// en lugar del archivo original, que puede pesar varios MB.
function cloudinaryOptimized(url, width) {
  const src = String(url || "");
  const match = src.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)([^/]+)\/(.+)$/);
  if (!match) return src;
  const isTransform = /^[a-z]{1,3}_[^/,]+(,[a-z]{1,3}_[^/,]+)*$/.test(match[2]);
  if (isTransform) return src;
  return `${match[1]}f_auto,q_auto,c_limit,w_${width}/${match[2]}/${match[3]}`;
}

function guessVideoType(src) {
  const ext = src.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "ogg" || ext === "ogv") return "video/ogg";
  return "";
}

/* ===== Íconos (SVG en línea, heredan el color del texto) ===== */
const ICONS = {
  bag: '<path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/>',
  chat: '<path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5z"/><path d="M9 10.5h6M9 13.5h4"/>',
  truck:
    '<path d="M3 6.5h11v9.5H3z"/><path d="M14 9.5h4l3 3V16h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  store:
    '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5h16"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>',
  zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/><path d="M11 8.5v5M8.5 11h5"/>',
  zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/><path d="M8.5 11h5"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4.5H9"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  upload: '<path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  copy:
    '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  expand: '<path d="M14 4h6v6"/><path d="M10 20H4v-6"/><path d="m20 4-6.5 6.5"/><path d="M4 20l6.5-6.5"/>',
};

function icon(name, cls = "icon") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ""}</svg>`;
}

function scrollBehavior() {
  return prefersReducedMotion() ? "auto" : "smooth";
}

function priceText(amount) {
  return Number(amount) > 0 ? formatMoney(amount) : "Consultar precio";
}

function materialLabelFor(value) {
  const v = String(value || "").trim();
  return MATERIALS.find((m) => m.id === v)?.label || v;
}

// Marca o limpia el error de un campo (texto debajo + aria-invalid en sus controles)
function setFieldError(field, errorEl, message) {
  if (errorEl) {
    errorEl.textContent = message || "";
    errorEl.hidden = !message;
  }
  if (!field) return;
  field.classList.toggle("has-error", Boolean(message));
  field.querySelectorAll("input, textarea, select").forEach((el) => {
    if (el instanceof HTMLInputElement && el.type === "hidden") return;
    if (message) el.setAttribute("aria-invalid", "true");
    else el.removeAttribute("aria-invalid");
  });
}

function focusField(el) {
  if (!(el instanceof HTMLElement)) return;
  el.focus({ preventScroll: true });
  const box = el.closest(".field") || el;
  box.scrollIntoView({ block: "center", behavior: scrollBehavior() });
}

const COLOR_SWATCHES = {
  Negro: "#111114",
  Blanco: "#f5f5f5",
  Gris: "#8a8a8f",
  Azul: "#1f3a8a",
  Rojo: "#c0262d",
  Beige: "#d8c7a3",
};

function sizeOptionsFor(product, materialId) {
  if (product?.type === "Remera") {
    const mat = MATERIALS.find((m) => m.id === materialId) || MATERIALS[0];
    const max = Number(mat?.maxSize) || 6;
    return Array.from({ length: max }, (_, i) => String(i + 1));
  }
  return (product?.sizes || []).map((s) => String(s));
}

function renderSizePills(sizes, selected) {
  const single = sizes.length === 1;
  return sizes
    .map(
      (s) => `
        <label class="pill-option">
          <input type="radio" name="size" value="${escapeHtml(s)}"${s === selected || single ? " checked" : ""} />
          <span>${escapeHtml(s)}</span>
        </label>`,
    )
    .join("");
}

/* ===== Ítems del carrito: textos y miniatura ===== */
function cartItemTitle(item) {
  const c = item?.customization || {};
  if (c.type === "house" && c.designName) return String(c.designName);
  return String(item?.productName || "Producto");
}

function cartItemDetails(item) {
  const c = item?.customization || {};
  const parts = [];
  if (c.type === "house" && item?.productName) parts.push(String(item.productName));
  if (item?.variant?.size) parts.push(`Talle ${item.variant.size}`);
  if (item?.variant?.color) parts.push(String(item.variant.color));
  const material = materialLabelFor(c.material);
  if (material) parts.push(material);
  return parts.join(" · ");
}

function cartItemCustom(item) {
  const c = item?.customization || {};
  const where = c.placement ? ` · ${c.placement}` : "";
  if (c.type === "text") return `Texto “${c.text || ""}”${where}`;
  if (c.type === "upload") return `Tu imagen${c.fileName ? ` (${c.fileName})` : ""}${where}`;
  return "Diseño de la casa";
}

function cartItemThumb(item, width = 200) {
  const c = item?.customization || {};
  const url = c.type === "house" ? c.imageUrl : c.type === "upload" ? c.fileUrl : "";
  if (url) return `<img src="${escapeHtml(cloudinaryOptimized(url, width))}" alt="" loading="lazy" />`;
  if (c.type === "text") return `<span class="thumb-text">${escapeHtml(c.text || "")}</span>`;
  return icon("bag", "icon icon-lg");
}

function renderMiniItems(cart) {
  return cart
    .map((item) => {
      const qty = Number(item?.quantity) || 1;
      return `
        <li class="mini-item">
          <span class="mini-thumb">${cartItemThumb(item, 120)}</span>
          <span class="mini-info">
            <span class="mini-title">${qty > 1 ? `${qty} × ` : ""}${escapeHtml(cartItemTitle(item))}</span>
            <span class="mini-meta">${escapeHtml(cartItemDetails(item))}</span>
          </span>
          <span class="mini-price">${formatMoney(computeItemTotal(item))}</span>
        </li>`;
    })
    .join("");
}

function shippingText(method, cost) {
  if (method !== "delivery") return "Sin cargo";
  return Number(cost) > 0 ? formatMoney(cost) : "A coordinar";
}

function renderCheckoutSteps(current) {
  const steps = ["Carrito", "Tus datos", "Pago"];
  return `
    <ol class="progress" aria-label="Pasos del pedido">
      ${steps
        .map((label, i) => {
          const status = i < current ? "done" : i === current ? "current" : "todo";
          return `
            <li class="progress-step is-${status}"${i === current ? ' aria-current="step"' : ""}>
              <span class="progress-dot">${i < current ? icon("check") : i + 1}</span>
              <span class="progress-label">${label}</span>
            </li>`;
        })
        .join("")}
    </ol>`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    ta.remove();
    return ok;
  }
}

function renderThumbMedia(product) {
  const media = product?.media;
  if (!media || media.kind !== "video" || !media.src) return "";
  const type = guessVideoType(media.src);
  const typeAttr = type ? ` type="${escapeHtml(type)}"` : "";
  return `
    <video
      class="thumb-media"
      autoplay
      muted
      loop
      playsinline
      preload="metadata"
      aria-hidden="true"
    >
      <source src="${escapeHtml(media.src)}#t=0.1"${typeAttr} />
    </video>
  `;
}

function placementPrice(placement) {
  const match = PERSONALIZATION_PRICING.find((p) => p.placement === placement);
  return match ? match.price : 0;
}

function getDesigns() {
  const published = getPublishedDesigns();
  if (Array.isArray(published) && published.length > 0) return published;
  const saved = getSettings()?.designs;
  if (Array.isArray(saved) && saved.length > 0) return saved;
  return DEFAULT_DESIGNS;
}

function findDesign(designId) {
  return getDesigns().find((d) => d && d.id === designId) || null;
}

function getPricing() {
  const published = getPublishedPricing();
  const saved = published || getSettings()?.pricing;
  const base = {
    productBase: {
      remeraPeinado: PRODUCTS.find((p) => p.id === "remera-basica")?.basePrice ?? 0,
      remeraAlgodon100: PRODUCTS.find((p) => p.id === "remera-basica")?.basePrice ?? 0,
      buzo: PRODUCTS.find((p) => p.id === "buzo-canguro")?.basePrice ?? 0,
      gorra: PRODUCTS.find((p) => p.id === "gorra-clasica")?.basePrice ?? 0,
    },
    stampSizes: { chico: 4500, mediano: 6900, grande: 7900 },
    hatStamp: 4900,
    designOverrideById: {},
    shipping: {
      pickupLabel: CONFIG.shipping.pickupLabel,
      deliveryLabel: CONFIG.shipping.deliveryLabel,
      deliveryFlatRate: CONFIG.shipping.deliveryFlatRate,
    },
  };
  if (!saved || typeof saved !== "object") return base;

  const out = { ...base };
  if (saved.productBase && typeof saved.productBase === "object") {
    out.productBase = { ...out.productBase, ...saved.productBase };
  }
  if (saved.stampSizes && typeof saved.stampSizes === "object") {
    out.stampSizes = { ...out.stampSizes, ...saved.stampSizes };
  }
  if (typeof saved.hatStamp === "number") out.hatStamp = saved.hatStamp;
  if (saved.designOverrideById && typeof saved.designOverrideById === "object") {
    out.designOverrideById = { ...out.designOverrideById, ...saved.designOverrideById };
  }
  if (saved.shipping && typeof saved.shipping === "object") {
    out.shipping = { ...out.shipping, ...saved.shipping };
  }
  return out;
}

function productBasePriceFor(product, materialId) {
  const pricing = getPricing();
  const base = pricing.productBase || {};
  const type = String(product?.type || "");
  if (type === "Remera") {
    if (materialId === "algodon100") return Number(base.remeraAlgodon100) || product.basePrice;
    return Number(base.remeraPeinado) || product.basePrice;
  }
  if (type === "Buzo") return Number(base.buzo) || product.basePrice;
  if (type === "Gorra") return Number(base.gorra) || product.basePrice;
  return product?.basePrice ?? 0;
}

function shippingConfig() {
  const pricing = getPricing();
  const s = pricing.shipping && typeof pricing.shipping === "object" ? pricing.shipping : {};
  return {
    pickupLabel: typeof s.pickupLabel === "string" && s.pickupLabel ? s.pickupLabel : CONFIG.shipping.pickupLabel,
    deliveryLabel:
      typeof s.deliveryLabel === "string" && s.deliveryLabel ? s.deliveryLabel : CONFIG.shipping.deliveryLabel,
    deliveryFlatRate:
      typeof s.deliveryFlatRate === "number" ? s.deliveryFlatRate : Number(CONFIG.shipping.deliveryFlatRate) || 0,
  };
}

// Los valores de ejemplo de app-data.js no se le muestran al cliente
const PLACEHOLDER_BANK = { alias: "BATYSTORE.ALIAS", cvuCbu: "0000000000000000000000", cuit: "00-00000000-0" };

function cleanBankValue(key, value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text !== PLACEHOLDER_BANK[key] ? text : "";
}

// Datos de cobro y contacto: los que cargó el dueño en el panel, o los de app-data.js
function businessInfo() {
  const published = state.published?.business;
  const source = published?.bank && typeof published.bank === "object" ? published.bank : CONFIG.bank || {};
  const bank = {
    alias: cleanBankValue("alias", source.alias),
    cvuCbu: cleanBankValue("cvuCbu", source.cvuCbu),
    holder: cleanBankValue("holder", source.holder),
    cuit: cleanBankValue("cuit", source.cuit),
  };
  return {
    whatsappNumber: (typeof published?.whatsappNumber === "string" && published.whatsappNumber) || CONFIG.whatsappNumber,
    bank,
    hasBank: Boolean(bank.alias || bank.cvuCbu),
  };
}

function isHatProduct(product) {
  return String(product?.type || "") === "Gorra";
}

function stampPriceFor(product, stampSizeId) {
  const pricing = getPricing();
  if (isHatProduct(product)) return pricing.hatStamp;
  return pricing.stampSizes?.[stampSizeId] ?? 0;
}

function designPriceFor(design) {
  if (!design) return 0;
  const pricing = getPricing();
  const override = pricing.designOverrideById?.[design.id];
  return typeof override === "number" ? override : Number(design.price) || 0;
}

function computeItemTotal(item) {
  const base = item.unitPrice ?? 0;
  const extras = item.extrasPrice ?? 0;
  return (base + extras) * item.quantity;
}

function computeCartTotals(cart, checkout) {
  const itemsSubtotal = cart.reduce((sum, item) => sum + computeItemTotal(item), 0);
  const ship = shippingConfig();
  const shippingCost =
    checkout?.shippingMethod === "delivery" ? ship.deliveryFlatRate : 0;
  const total = itemsSubtotal + shippingCost;
  return { itemsSubtotal, shippingCost, total };
}

let lastCartCount = null;

function updateCartCount() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const count = getCart().reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  el.textContent = String(count);
  el.toggleAttribute("data-empty", count === 0);
  // Saltito del contador cuando se suma algo al carrito
  if (lastCartCount !== null && count > lastCartCount) replayClass(el, "is-bumped");
  lastCartCount = count;
  const link = el.closest("a");
  if (link) link.setAttribute("aria-label", count ? `Carrito, ${count} ${count === 1 ? "producto" : "productos"}` : "Carrito vacío");
}

function navigate(hash) {
  window.location.hash = hash;
}

function parseRoute() {
  const hash = window.location.hash || "#/";
  const clean = hash.replace(/^#/, "");
  const [path, queryString] = clean.split("?");
  const parts = path.split("/").filter(Boolean);
  const query = new URLSearchParams(queryString || "");
  return { hash, path, parts, query };
}

/* ===== Videos en miniaturas (catálogo / producto) ===== */
let thumbVideoObserver = null;
let thumbVisibilityHandler = null;

// Vuelve a disparar una animación de CSS sacando y poniendo la clase
function replayClass(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// Las tarjetas y secciones aparecen suavemente al llegar a ellas con el scroll
let revealObserver = null;

function setupReveal(root) {
  if (revealObserver) {
    revealObserver.disconnect();
    revealObserver = null;
  }
  const items = Array.from(root.querySelectorAll(".reveal"));
  const canAnimate = items.length > 0 && "IntersectionObserver" in window && !prefersReducedMotion();
  root.classList.toggle("reveal-on", canAnimate);
  if (!canAnimate) return;

  revealObserver = new IntersectionObserver(
    (entries) => {
      let k = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        // Las que entran juntas aparecen escalonadas
        if (el instanceof HTMLElement) el.style.setProperty("--d", `${Math.min(k, 5) * 80}ms`);
        el.classList.add("is-in");
        revealObserver?.unobserve(el);
        k += 1;
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );
  items.forEach((el) => revealObserver.observe(el));
}

function prefersReducedMotion() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

function setupThumbVideos(container) {
  if (thumbVideoObserver) {
    thumbVideoObserver.disconnect();
    thumbVideoObserver = null;
  }

  if (thumbVisibilityHandler) {
    document.removeEventListener("visibilitychange", thumbVisibilityHandler);
    thumbVisibilityHandler = null;
  }

  const videos = Array.from(container.querySelectorAll(".thumb-media"));
  if (videos.length === 0) return;

  const reducedMotion = prefersReducedMotion();

  thumbVisibilityHandler = () => {
    if (!document.hidden) return;
    for (const v of videos) {
      if (v instanceof HTMLVideoElement) v.pause();
    }
  };
  document.addEventListener("visibilitychange", thumbVisibilityHandler);

  thumbVideoObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target;
        if (!(el instanceof HTMLVideoElement)) continue;

        if (!entry.isIntersecting || reducedMotion) {
          el.pause();
          continue;
        }

        const playPromise = el.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      }
    },
    { root: null, rootMargin: "120px", threshold: 0.2 },
  );

  videos.forEach((v) => thumbVideoObserver.observe(v));
}

let lastRouteKey = null;
let pendingScroll = "";
let lastRemoved = null;

function setActiveNav(key) {
  document.querySelectorAll("[data-nav]").forEach((el) => {
    const on = Boolean(key) && el.getAttribute("data-nav") === key;
    el.classList.toggle("is-active", on);
    if (on) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
}

function render() {
  updateCartCount();
  const { hash, parts, query } = parseRoute();
  const root = document.getElementById("app");
  if (!root) return;

  // El panel reemplaza a la vieja pantalla de configuración
  const isAdmin = parts[0] === "admin" || parts[0] === "config";
  document.body.classList.toggle("is-admin", isAdmin);
  if (isAdmin) {
    document.title = `Panel · ${CONFIG.storeName}`;
    if (parts[0] === "config") history.replaceState(null, "", "#/admin");
    mountAdmin(root, adminApi);
    return;
  }

  // Volver arriba solo al cambiar de pantalla (no al sumar cantidades en el carrito)
  const routeChanged = hash !== lastRouteKey;
  lastRouteKey = hash;
  if (routeChanged) lastRemoved = null;

  let title = "";
  let nav = "";

  if (parts.length === 0) {
    root.innerHTML = renderCatalog();
    attachCatalogHandlers();
    nav = "disenos";
  } else if (parts[0] === "producto" && parts[1]) {
    root.innerHTML = renderProduct(parts[1]);
    attachProductHandlers(parts[1]);
    title = findProduct(parts[1])?.name || "";
  } else if (parts[0] === "diseno" && parts[1]) {
    root.innerHTML = renderDesignOrder(parts[1]);
    attachDesignOrderHandlers(parts[1]);
    title = findDesign(parts[1])?.name || "";
    nav = "disenos";
  } else if (parts[0] === "carrito") {
    root.innerHTML = renderCart();
    attachCartHandlers();
    title = "Tu carrito";
    nav = "carrito";
  } else if (parts[0] === "checkout") {
    const orderId = query.get("orderId");
    if (orderId) {
      root.innerHTML = renderOrderConfirmation(orderId);
      attachOrderConfirmationHandlers(orderId);
      title = "Pedido generado";
    } else {
      root.innerHTML = renderCheckout();
      attachCheckoutHandlers();
      title = "Completá tu pedido";
    }
  } else if (parts[0] === "como-funciona") {
    root.innerHTML = renderHowItWorks();
    title = "Cómo funciona";
    nav = "como-funciona";
  } else if (parts[0] === "politicas") {
    root.innerHTML = renderPolicies();
    title = "Políticas";
  } else {
    root.innerHTML = renderNotFound();
    title = "Página no encontrada";
  }

  setupThumbVideos(root);
  setupReveal(root);
  if (routeChanged) replayClass(root, "is-entering");
  setActiveNav(nav);
  document.title = title
    ? `${title} · ${CONFIG.storeName}`
    : `${CONFIG.storeName} · Remeras geek estampadas a pedido`;

  if (pendingScroll && parts.length === 0) {
    const target = document.getElementById(pendingScroll);
    pendingScroll = "";
    if (target) {
      target.scrollIntoView({ block: "start", behavior: "auto" });
      return;
    }
  }
  pendingScroll = "";
  if (routeChanged) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function getCloudinaryConfig() {
  const base = CONFIG.cloudinary && typeof CONFIG.cloudinary === "object" ? CONFIG.cloudinary : {};
  const saved = getSettings()?.cloudinary;
  const cfg = { ...base };

  if (saved && typeof saved === "object") {
    const cloudName = typeof saved.cloudName === "string" ? saved.cloudName.trim() : "";
    const uploadPreset = typeof saved.uploadPreset === "string" ? saved.uploadPreset.trim() : "";
    if (cloudName) cfg.cloudName = cloudName;
    if (uploadPreset) cfg.uploadPreset = uploadPreset;
    if (typeof saved.folder === "string") cfg.folder = saved.folder.trim();
  }

  return cfg;
}

// Serie de un diseño: el nombre sin el número final ("MIKU 3" → "MIKU")
function designSeries(name) {
  const text = String(name || "").trim();
  return text.replace(/[\s\d]+$/, "").trim() || text;
}

function designPrice(design) {
  const product = findProduct(design?.productId || "remera-basica");
  const base = product ? productBasePriceFor(product, design?.materialId || "peinado") : 0;
  return base + designPriceFor(design);
}

function productFromPrice(product) {
  if (product.type === "Remera") {
    return Math.min(...MATERIALS.map((m) => productBasePriceFor(product, m.id)));
  }
  return productBasePriceFor(product, "");
}

function designCountText(n) {
  return `${n} ${n === 1 ? "diseño" : "diseños"}`;
}

function renderCatalog() {
  const designs = getDesigns().filter((d) => d && d.id);
  const series = [...new Set(designs.map((d) => designSeries(d.name)))];

  const chipsHtml =
    series.length > 1
      ? `
        <div class="chips" role="group" aria-label="Filtrar diseños por serie">
          <button class="chip-btn" type="button" data-series="" aria-pressed="true">Todos</button>
          ${series
            .map(
              (s) =>
                `<button class="chip-btn" type="button" data-series="${escapeHtml(s)}" aria-pressed="false">${escapeHtml(s)}</button>`,
            )
            .join("")}
        </div>`
      : "";

  const designsHtml = designs
    .map((d) => {
      const img = typeof d.imageUrl === "string" ? d.imageUrl.trim() : "";
      const media = img
        ? `<img src="${escapeHtml(cloudinaryOptimized(img, 900))}" srcset="${escapeHtml(cloudinaryOptimized(img, 500))} 500w, ${escapeHtml(cloudinaryOptimized(img, 900))} 900w" sizes="(max-width: 560px) 92vw, (max-width: 1024px) 46vw, 360px" alt="" loading="lazy" decoding="async" />`
        : `<span class="media-empty">${icon("bag", "icon icon-lg")}</span>`;
      return `
        <a class="design-card reveal" href="#/diseno/${encodeURIComponent(d.id)}" data-series="${escapeHtml(designSeries(d.name))}">
          <span class="design-card-media">${media}</span>
          <span class="design-card-body">
            <span class="design-card-name">${escapeHtml(d.name)}</span>
            <span class="design-card-price">${priceText(designPrice(d))}</span>
          </span>
        </a>`;
    })
    .join("");

  const productsHtml = PRODUCTS.map((p) => {
    const from = productFromPrice(p);
    return `
      <a class="product-card reveal" href="#/producto/${encodeURIComponent(p.id)}">
        <span class="product-card-media">${renderThumbMedia(p)}</span>
        <span class="product-card-body">
          <span class="product-card-name">${escapeHtml(p.name)}</span>
          <span class="product-card-desc">${escapeHtml(p.description)}</span>
          <span class="product-card-foot">
            <span class="product-card-price">${from > 0 ? `Desde ${formatMoney(from)}` : "Consultar precio"}</span>
            <span class="product-card-cta">Personalizar ${icon("arrowRight")}</span>
          </span>
        </span>
      </a>`;
  }).join("");

  return `
    <section class="hero">
      <div class="hero-copy">
        <h1 class="hero-title">Remeras geek <span class="hero-accent">estampadas a pedido</span></h1>
        <p class="hero-lead">Elegí un diseño de la casa o personalizá tu remera, buzo o gorra con texto o tu propia imagen.</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="#/" data-scroll="disenos">Ver diseños ${icon("arrowRight")}</a>
          <a class="btn btn-ghost btn-lg" href="#/producto/remera-basica">Personalizar la mía</a>
        </div>
        <ul class="hero-facts">
          <li>${icon("card")}Pago por transferencia</li>
          <li>${icon("chat")}Pedido por WhatsApp</li>
          <li>${icon("truck")}Retiro o envío a domicilio</li>
        </ul>
      </div>
      <div class="hero-art">
        <img src="./imgAkira/akira7.jpeg" width="1330" height="1600" alt="Remera de Akira junto a la moto de Kaneda" fetchpriority="high" decoding="async" />
        <div class="hero-note">
          <p class="hero-note-title">Pago total</p>
          <p class="hero-note-text">Confirmás tu pedido abonando el total por transferencia. Te mostramos el CVU/CBU al finalizar y podés enviar el mensaje por WhatsApp.</p>
        </div>
      </div>
    </section>

    ${renderTicker()}

    <section class="section" id="disenos" aria-labelledby="disenosTitle">
      <div class="section-head reveal">
        <div>
          <h2 class="section-title" id="disenosTitle">Diseños de la casa</h2>
          <p class="section-sub">Elegí un diseño y pasá directo al pedido.</p>
        </div>
        ${designs.length ? `<p class="section-count" id="designCount" aria-live="polite">${designCountText(designs.length)}</p>` : ""}
      </div>
      ${
        designs.length
          ? `${chipsHtml}<div class="design-grid">${designsHtml}</div>`
          : `<div class="empty empty-inline">
               <span class="empty-icon">${icon("bag", "icon icon-lg")}</span>
               <h3 class="empty-title">Próximamente</h3>
               <p class="empty-text">Todavía no hay diseños publicados.</p>
             </div>`
      }
    </section>

    <section class="section" id="personalizar" aria-labelledby="personalizarTitle">
      <div class="section-head reveal">
        <div>
          <h2 class="section-title" id="personalizarTitle">Personalizá tu prenda</h2>
          <p class="section-sub">Elegí la prenda y sumale tu texto o tu imagen.</p>
        </div>
      </div>
      <div class="product-grid">${productsHtml}</div>
    </section>

    <section class="section how-strip" aria-labelledby="comoTitle">
      <h2 class="section-title reveal" id="comoTitle">Cómo comprar</h2>
      <ol class="steps">
        <li class="step reveal">
          <span class="step-num">1</span>
          <div><h3 class="step-title">Elegí</h3><p class="step-text">Un diseño de la casa o la prenda que querés personalizar.</p></div>
        </li>
        <li class="step reveal">
          <span class="step-num">2</span>
          <div><h3 class="step-title">Generá el pedido</h3><p class="step-text">Completás tus datos y te mostramos el total.</p></div>
        </li>
        <li class="step reveal">
          <span class="step-num">3</span>
          <div><h3 class="step-title">Pagá y listo</h3><p class="step-text">Transferís, nos mandás el comprobante por WhatsApp y pasamos a producción.</p></div>
        </li>
      </ol>
      <a class="link-arrow" href="#/como-funciona">Ver cómo funciona ${icon("arrowRight")}</a>
    </section>
  `;
}

// Cinta que corre entre la portada y los diseños (decorativa)
function renderTicker() {
  const words = ["Remeras", "Buzos", "Gorras", "Estampado a pedido", "Diseños de la casa", "Tu texto o tu imagen"];
  const star = `<svg class="ticker-star" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" fill="currentColor"/></svg>`;
  const run = words.map((w) => `<span class="ticker-item">${w}${star}</span>`).join("");
  return `
    <div class="ticker" aria-hidden="true">
      <div class="ticker-band"><div class="ticker-track">${run}${run}${run}</div></div>
    </div>`;
}

function attachCatalogHandlers() {
  const chips = Array.from(document.querySelectorAll(".chip-btn[data-series]"));
  const cards = Array.from(document.querySelectorAll(".design-card[data-series]"));
  const countEl = document.getElementById("designCount");

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const series = chip.getAttribute("data-series") || "";
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      let visible = 0;
      cards.forEach((card) => {
        const show = !series || card.getAttribute("data-series") === series;
        card.hidden = !show;
        if (!show) return;
        // Las que quedan entran de a una, como recién estampadas
        revealObserver?.unobserve(card);
        card.classList.add("is-in");
        card.style.setProperty("--d", `${Math.min(visible, 8) * 50}ms`);
        replayClass(card, "is-popped");
        visible += 1;
      });
      if (countEl) countEl.textContent = designCountText(visible);
    });
  });
}

function findProduct(productId) {
  return PRODUCTS.find((p) => p.id === productId) || null;
}

// Talles que se ofrecen para un diseño. Si el diseño no los limita, la remera usa
// la numeración de su tela (1 a N), igual que en la página de producto.
function designSizesFor(design, product) {
  const fixedSize = typeof design?.fixedSize === "string" ? design.fixedSize.trim() : "";
  if (fixedSize) return [fixedSize];
  if (Array.isArray(design?.allowedSizes) && design.allowedSizes.length > 0) {
    return design.allowedSizes.map((s) => String(s));
  }
  if (product?.type === "Remera") {
    const material = MATERIALS.find((m) => m.id === design?.materialId) || MATERIALS[0];
    const max = Number(material?.maxSize) || 0;
    if (max > 0) return Array.from({ length: max }, (_, i) => String(i + 1));
  }
  return (product?.sizes || []).map((s) => String(s));
}

function designContext(designId) {
  const design = findDesign(designId);
  if (!design) return null;
  const productId = typeof design.productId === "string" && design.productId ? design.productId : "remera-basica";
  const product = findProduct(productId);
  if (!product) return null;

  const fixedColor = typeof design.fixedColor === "string" ? design.fixedColor.trim() : "";
  const materialId = typeof design.materialId === "string" ? design.materialId.trim() : "";
  const fallbackColor = Array.isArray(product.colors) && product.colors.length > 0 ? String(product.colors[0]) : "";
  return {
    design,
    product,
    name: String(design.name || "Diseño"),
    fixedSize: typeof design.fixedSize === "string" ? design.fixedSize.trim() : "",
    materialId,
    color: fixedColor || fallbackColor,
    sizes: designSizesFor(design, product),
    image: typeof design.imageUrl === "string" ? design.imageUrl.trim() : "",
    price: productBasePriceFor(product, materialId || "peinado") + designPriceFor(design),
  };
}

function renderDesignOrder(designId) {
  const ctx = designContext(designId);
  if (!ctx) return renderNotFound();
  const { product, name, fixedSize, materialId, color, sizes, image, price } = ctx;

  const ship = shippingConfig();
  const meta = [product.name, materialLabelFor(materialId), color].filter(Boolean).join(" · ");
  const sizeHelp = buildWhatsappLink(`Hola ${CONFIG.storeName}, tengo una duda con el talle del diseño ${name}.`);

  const media = image
    ? `<button class="design-preview-btn" type="button" id="designPreviewBtn" aria-label="Ver ${escapeHtml(name)} en grande">
         <span class="design-hero-frame">
           <img class="design-hero-img" src="${escapeHtml(cloudinaryOptimized(image, 1400))}" srcset="${escapeHtml(cloudinaryOptimized(image, 800))} 800w, ${escapeHtml(cloudinaryOptimized(image, 1400))} 1400w" sizes="(max-width: 900px) 100vw, 680px" alt="${escapeHtml(name)}" decoding="async" />
         </span>
         <span class="zoom-hint">${icon("expand")}<span class="hint-touch">Tocá para ver en grande</span><span class="hint-mouse">Pasá el mouse para ver el detalle · clic para ampliar</span></span>
       </button>`
    : `<div class="design-hero-img media-empty" aria-hidden="true">${icon("bag", "icon icon-xl")}</div>`;

  return `
    <nav class="crumbs" aria-label="Estás en">
      <a href="#/">Inicio</a><span aria-hidden="true">/</span>
      <a href="#/" data-scroll="disenos">Diseños</a><span aria-hidden="true">/</span>
      <span aria-current="page">${escapeHtml(name)}</span>
    </nav>

    <div class="pdp pdp-design">
      <div class="pdp-media" id="designMediaAnchor">${media}</div>

      <div class="pdp-info">
        <h1 class="pdp-title">${escapeHtml(name)}</h1>
        <p class="pdp-meta">${escapeHtml(meta)}</p>
        <p class="pdp-price">${priceText(price)}</p>

        <form id="designOrderForm" class="form" novalidate>
          <fieldset class="field" id="sizeField" aria-describedby="sizeError">
            <legend class="label">Talle</legend>
            <div class="pill-options">${renderSizePills(sizes, fixedSize)}</div>
            <p class="field-error" id="sizeError" hidden></p>
            <a class="help-link" href="${escapeHtml(sizeHelp)}" target="_blank" rel="noopener">${icon("chat")}¿Dudas con el talle? Consultanos</a>
          </fieldset>

          <div class="field">
            <label class="label" for="notes">Notas <span class="optional">(opcional)</span></label>
            <textarea id="notes" name="notes" rows="3" placeholder="Algo que tengamos que saber del pedido"></textarea>
          </div>

          <button class="btn btn-primary btn-lg btn-block" type="submit">
            ${icon("bag")}Agregar al carrito${price > 0 ? ` · ${formatMoney(price)}` : ""}
          </button>
        </form>

        <ul class="facts">
          <li>${icon("card")}<span>Pagás el total por transferencia.</span></li>
          <li>${icon("truck")}<span>${escapeHtml(ship.pickupLabel)} o ${escapeHtml(ship.deliveryLabel.toLowerCase())}.</span></li>
          <li>${icon("check")}<span>Con el pago confirmado pasamos a producción.</span></li>
        </ul>
      </div>
    </div>
  `;
}

// Lupa en computadora: al pasar el mouse la remera se agranda donde está el puntero.
// La primera vez carga una versión más grande de la imagen para que se vea nítida.
function attachDesignMagnifier(btn, imageUrl) {
  const img = btn.querySelector(".design-hero-img");
  const fine = typeof window.matchMedia === "function" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!(img instanceof HTMLImageElement) || !fine) return;

  let hiLoaded = false;
  const loadHi = () => {
    if (hiLoaded) return;
    hiLoaded = true;
    const url = typeof imageUrl === "string" ? imageUrl.trim() : "";
    const hi = cloudinaryOptimized(url, 2200);
    if (!url || hi === img.currentSrc) return;
    const pre = new Image();
    pre.onload = () => {
      img.removeAttribute("srcset");
      img.src = hi;
    };
    pre.src = hi;
  };

  btn.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    loadHi();
    btn.classList.add("is-magnified");
  });
  btn.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    img.style.transformOrigin = `${x}% ${y}%`;
  });
  btn.addEventListener("pointerleave", () => btn.classList.remove("is-magnified"));
}

function attachDesignOrderHandlers(designId) {
  const ctx = designContext(designId);
  if (!ctx) return;
  const { design, product, materialId, color, sizes } = ctx;

  const previewBtn = document.getElementById("designPreviewBtn");
  if (previewBtn) attachDesignMagnifier(previewBtn, design.imageUrl);
  if (previewBtn) {
    previewBtn.addEventListener("click", () => {
      const url = typeof design.imageUrl === "string" ? design.imageUrl.trim() : "";
      if (!url) return;

      const existing = document.getElementById("designPreviewModal");
      if (existing) existing.remove();

      const modal = document.createElement("div");
      modal.id = "designPreviewModal";
      modal.className = "design-preview-modal";

      const title = String(design.name || "Diseño");
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const onKeyDown = (ev) => {
        if (ev.key === "Escape") {
          close();
          return;
        }
        // Mantener el foco dentro de la vista ampliada
        if (ev.key !== "Tab") return;
        const items = Array.from(modal.querySelectorAll("button"));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first.focus();
        }
      };

      const close = () => {
        document.removeEventListener("keydown", onKeyDown);
        document.body.style.overflow = prevOverflow;
        modal.remove();
        if (previewBtn instanceof HTMLElement) previewBtn.focus();
      };

      modal.innerHTML = `
        <div class="design-preview-backdrop" data-close-modal></div>
        <div class="design-preview-dialog" role="dialog" aria-modal="true" aria-label="Vista previa del diseño">
          <div class="design-preview-topbar">
            <div class="design-preview-title">${escapeHtml(title)}</div>
            <div class="design-preview-tools">
              <button class="icon-btn design-preview-zoomout" type="button" aria-label="Alejar">${icon("zoomOut")}</button>
              <button class="icon-btn design-preview-zoomin" type="button" aria-label="Acercar">${icon("zoomIn")}</button>
              <button class="icon-btn design-preview-reset" type="button" aria-label="Volver al tamaño original">${icon("reset")}</button>
              <button class="icon-btn design-preview-close" type="button" data-close-modal aria-label="Cerrar">${icon("close")}</button>
            </div>
          </div>
          <div class="design-preview-stage">
            <img class="design-preview-img" src="${escapeHtml(cloudinaryOptimized(url, 2200))}" alt="${escapeHtml(title)}" draggable="false" />
          </div>
        </div>
      `;

      modal.addEventListener("click", (ev) => {
        const t = ev.target instanceof Element ? ev.target : null;
        if (t && t.closest("[data-close-modal]")) close();
      });

      const stage = modal.querySelector(".design-preview-stage");
      const imgEl = modal.querySelector(".design-preview-img");
      const zoomInBtn = modal.querySelector(".design-preview-zoomin");
      const zoomOutBtn = modal.querySelector(".design-preview-zoomout");
      const resetBtn = modal.querySelector(".design-preview-reset");

      let scale = 1;
      let offsetX = 0;
      let offsetY = 0;
      const minScale = 1;
      const maxScale = 5;

      function clamp(n, a, b) {
        return Math.min(b, Math.max(a, n));
      }

      function applyTransform() {
        if (!(imgEl instanceof HTMLElement)) return;
        imgEl.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
      }

      function resetView() {
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        applyTransform();
      }

      function zoomAt(nextScale, cx, cy) {
        if (!(stage instanceof HTMLElement)) return;
        if (!(imgEl instanceof HTMLElement)) return;

        const rect = stage.getBoundingClientRect();
        const x = cx - rect.left - rect.width / 2 - offsetX;
        const y = cy - rect.top - rect.height / 2 - offsetY;

        const newScale = clamp(nextScale, minScale, maxScale);
        const k = newScale / scale;
        offsetX -= x * (k - 1);
        offsetY -= y * (k - 1);
        scale = newScale;
        applyTransform();
      }

      if (stage instanceof HTMLElement && imgEl instanceof HTMLElement) {
        stage.addEventListener(
          "wheel",
          (ev) => {
            ev.preventDefault();
            const delta = ev.deltaY || 0;
            const step = delta > 0 ? 0.9 : 1.1;
            zoomAt(scale * step, ev.clientX, ev.clientY);
          },
          { passive: false },
        );

        const pointers = new Map();
        let isPanning = false;
        let panPointerId = null;
        let panStartX = 0;
        let panStartY = 0;
        let panBaseX = 0;
        let panBaseY = 0;

        let pinchActive = false;
        let pinchStartDist = 0;
        let pinchStartScale = 1;
        let pinchStartOffsetX = 0;
        let pinchStartOffsetY = 0;
        let pinchStartMidX = 0;
        let pinchStartMidY = 0;

        function distance(a, b) {
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          return Math.hypot(dx, dy);
        }

        function midpoint(a, b) {
          return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        }

        function beginPan(ev) {
          isPanning = true;
          panPointerId = ev.pointerId;
          panStartX = ev.clientX;
          panStartY = ev.clientY;
          panBaseX = offsetX;
          panBaseY = offsetY;
          stage.classList.add("is-panning");
        }

        function endPan() {
          isPanning = false;
          panPointerId = null;
          stage.classList.remove("is-panning");
        }

        function beginPinch() {
          if (pointers.size < 2) return;
          const [a, b] = Array.from(pointers.values()).slice(0, 2);
          pinchActive = true;
          pinchStartDist = distance(a, b) || 1;
          pinchStartScale = scale;
          pinchStartOffsetX = offsetX;
          pinchStartOffsetY = offsetY;
          const mid = midpoint(a, b);
          pinchStartMidX = mid.x;
          pinchStartMidY = mid.y;
          endPan();
        }

        function updatePinch() {
          if (!pinchActive) return;
          if (pointers.size < 2) return;
          const [a, b] = Array.from(pointers.values()).slice(0, 2);
          const dist = distance(a, b) || 1;
          const mid = midpoint(a, b);
          const nextScale = clamp(pinchStartScale * (dist / pinchStartDist), minScale, maxScale);

          scale = pinchStartScale;
          offsetX = pinchStartOffsetX + (mid.x - pinchStartMidX);
          offsetY = pinchStartOffsetY + (mid.y - pinchStartMidY);
          applyTransform();
          zoomAt(nextScale, mid.x, mid.y);
        }

        stage.addEventListener("pointerdown", (ev) => {
          if (ev.button !== 0) return;
          pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
          stage.setPointerCapture(ev.pointerId);

          if (pointers.size === 1) {
            beginPan(ev);
          } else if (pointers.size === 2) {
            beginPinch();
            updatePinch();
          }
        });

        stage.addEventListener("pointermove", (ev) => {
          if (!pointers.has(ev.pointerId)) return;
          pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

          if (pointers.size >= 2) {
            updatePinch();
            return;
          }

          if (!isPanning) return;
          if (panPointerId !== ev.pointerId) return;
          const dx = ev.clientX - panStartX;
          const dy = ev.clientY - panStartY;
          offsetX = panBaseX + dx;
          offsetY = panBaseY + dy;
          applyTransform();
        });

        const onPointerEnd = (ev) => {
          pointers.delete(ev.pointerId);
          try {
            stage.releasePointerCapture(ev.pointerId);
          } catch {}

          if (pointers.size < 2) pinchActive = false;

          if (pointers.size === 1) {
            const remainingId = Array.from(pointers.keys())[0];
            if (remainingId !== panPointerId) {
              const pos = pointers.get(remainingId);
              if (pos) {
                beginPan({ pointerId: remainingId, clientX: pos.x, clientY: pos.y, button: 0 });
              }
            }
          } else if (pointers.size === 0) {
            endPan();
          }
        };

        stage.addEventListener("pointerup", onPointerEnd);
        stage.addEventListener("pointercancel", onPointerEnd);

        stage.addEventListener("dblclick", () => resetView());
      }

      if (zoomInBtn instanceof HTMLElement) {
        zoomInBtn.addEventListener("click", () => {
          if (!(stage instanceof HTMLElement)) return;
          const rect = stage.getBoundingClientRect();
          zoomAt(scale * 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
        });
      }
      if (zoomOutBtn instanceof HTMLElement) {
        zoomOutBtn.addEventListener("click", () => {
          if (!(stage instanceof HTMLElement)) return;
          const rect = stage.getBoundingClientRect();
          zoomAt(scale / 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
        });
      }
      if (resetBtn instanceof HTMLElement) resetBtn.addEventListener("click", resetView);

      document.addEventListener("keydown", onKeyDown);
      document.body.appendChild(modal);

      const closeBtn = modal.querySelector(".design-preview-close");
      if (closeBtn instanceof HTMLElement) closeBtn.focus();
    });
  }

  const form = document.getElementById("designOrderForm");
  if (!(form instanceof HTMLFormElement)) return;
  const sizeField = document.getElementById("sizeField");
  const sizeError = document.getElementById("sizeError");

  form.addEventListener("change", (ev) => {
    if (ev.target instanceof HTMLInputElement && ev.target.name === "size") setFieldError(sizeField, sizeError, "");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const size = String(fd.get("size") || "").trim();
    const notes = String(fd.get("notes") || "").trim();

    if (!sizes.includes(size)) {
      setFieldError(sizeField, sizeError, "Elegí un talle para seguir.");
      focusField(sizeField?.querySelector("input"));
      return;
    }

    const cart = getCart();
    cart.push({
      id: makeId("item"),
      productId: product.id,
      productName: product.name,
      variant: { size, color },
      customization: {
        type: "house",
        designId: String(design.id),
        designName: String(design.name || ""),
        designPrice: designPriceFor(design),
        imageUrl: typeof design.imageUrl === "string" ? design.imageUrl.trim() : "",
        material: materialLabelFor(materialId),
        notes,
      },
      quantity: 1,
      unitPrice: productBasePriceFor(product, materialId || "peinado"),
      extrasPrice: designPriceFor(design),
      createdAt: Date.now(),
    });
    setCart(cart);
    navigate("#/carrito");
  });
}

function renderProduct(productId) {
  const product = findProduct(productId);
  if (!product) return renderNotFound();

  const isRemera = product.type === "Remera";
  const firstMaterial = isRemera ? MATERIALS[0]?.id || "peinado" : "";
  const base = productBasePriceFor(product, firstMaterial);
  const placements = Array.isArray(product.placements) ? product.placements : [];
  const firstPlacement = placements[0] || "";
  const extra = placementPrice(firstPlacement);
  const colors = Array.isArray(product.colors) ? product.colors.map(String) : [];

  const materialHtml = isRemera
    ? `
      <fieldset class="field">
        <legend class="label">Tela</legend>
        <div class="option-cards">
          ${MATERIALS.map(
            (m, i) => `
              <label class="option-card">
                <input type="radio" name="material" value="${escapeHtml(m.id)}"${i === 0 ? " checked" : ""} />
                <span class="option-card-body">
                  <span class="option-card-title">${escapeHtml(m.label)}</span>
                  <span class="option-card-meta">${formatMoney(productBasePriceFor(product, m.id))} · Talles 1 a ${escapeHtml(m.maxSize)}</span>
                </span>
              </label>`,
          ).join("")}
        </div>
      </fieldset>`
    : "";

  const colorHtml = colors.length
    ? `
      <fieldset class="field">
        <legend class="label">Color <span class="label-value" id="colorValue">${escapeHtml(colors[0])}</span></legend>
        <div class="swatches">
          ${colors
            .map(
              (c, i) => `
                <label class="swatch" title="${escapeHtml(c)}">
                  <input type="radio" name="color" value="${escapeHtml(c)}"${i === 0 ? " checked" : ""} />
                  <span class="swatch-dot" style="--swatch:${COLOR_SWATCHES[c] || "#777"}"></span>
                  <span class="sr-only">${escapeHtml(c)}</span>
                </label>`,
            )
            .join("")}
        </div>
      </fieldset>`
    : "";

  const placementHtml = placements
    .map(
      (p, i) => `
        <label class="option-card">
          <input type="radio" name="placement" value="${escapeHtml(p)}"${i === 0 ? " checked" : ""} />
          <span class="option-card-body">
            <span class="option-card-title">${escapeHtml(p)}</span>
            <span class="option-card-meta">${placementPrice(p) > 0 ? `+${formatMoney(placementPrice(p))}` : "Sin cargo"}</span>
          </span>
        </label>`,
    )
    .join("");

  return `
    <nav class="crumbs" aria-label="Estás en">
      <a href="#/">Inicio</a><span aria-hidden="true">/</span>
      <a href="#/" data-scroll="personalizar">Personalizar</a><span aria-hidden="true">/</span>
      <span aria-current="page">${escapeHtml(product.name)}</span>
    </nav>

    <div class="pdp">
      <div class="pdp-media" id="productMediaAnchor">
        <div class="product-media">${renderThumbMedia(product)}</div>
      </div>

      <div class="pdp-info">
        <h1 class="pdp-title">${escapeHtml(product.name)}</h1>
        <p class="pdp-desc">${escapeHtml(product.description)}</p>
        <div class="price-box">
          <p class="pdp-price" id="estimatedTotal">${formatMoney(base + extra)}</p>
          <dl class="price-breakdown">
            <div><dt>Prenda</dt><dd id="basePriceSummary">${formatMoney(base)}</dd></div>
            <div><dt>Estampa <span id="placementLabel">${escapeHtml(firstPlacement)}</span></dt><dd id="placementPrice">${formatMoney(extra)}</dd></div>
          </dl>
        </div>

        <form id="customForm" class="form" novalidate>
          ${materialHtml}

          <fieldset class="field" id="sizeField" aria-describedby="sizeError">
            <legend class="label">Talle</legend>
            <div class="pill-options" id="sizeOptions">${renderSizePills(sizeOptionsFor(product, firstMaterial), "")}</div>
            <p class="field-error" id="sizeError" hidden></p>
          </fieldset>

          ${colorHtml}

          <fieldset class="field">
            <legend class="label">Ubicación de la estampa</legend>
            <div class="option-cards">${placementHtml}</div>
          </fieldset>

          <fieldset class="field">
            <legend class="label">Qué estampamos</legend>
            <div class="segmented">
              <label><input type="radio" name="style" value="text" checked /><span>Texto</span></label>
              <label><input type="radio" name="style" value="upload" /><span>Mi imagen</span></label>
            </div>
          </fieldset>

          <div class="field" id="textField">
            <label class="label" for="text">Tu texto</label>
            <input id="text" name="text" type="text" maxlength="24" autocomplete="off" placeholder="Ej.: tu nombre o una frase" aria-describedby="textHelp textError" />
            <div class="field-foot">
              <span class="hint" id="textHelp">Hasta 24 caracteres.</span>
              <span class="counter" id="textCount" aria-hidden="true">0/24</span>
            </div>
            <p class="field-error" id="textError" hidden></p>
          </div>

          <div class="field" id="uploadField" hidden>
            <span class="label" id="fileLabel">Tu imagen</span>
            <input class="sr-only file-input" id="file" name="file" type="file" accept="image/*" aria-labelledby="fileLabel" aria-describedby="fileName fileError" />
            <label class="dropzone" for="file">
              ${icon("upload", "icon icon-lg")}
              <span class="dropzone-title" id="fileName">Elegí una imagen</span>
              <span class="dropzone-hint">PNG o JPG en buena calidad. La revisamos antes de producir.</span>
            </label>
            <p class="field-error" id="fileError" hidden></p>
          </div>

          <div class="field">
            <label class="label" for="notes">Notas <span class="optional">(opcional)</span></label>
            <textarea id="notes" name="notes" rows="3" placeholder="Tipografía, tamaño, colores o lo que quieras aclarar"></textarea>
          </div>

          <p class="form-error" id="formError" role="alert" hidden></p>

          <button class="btn btn-primary btn-lg btn-block" type="submit" id="customSubmit">
            ${icon("bag")}<span class="btn-label">Agregar al carrito · <span id="submitPrice">${formatMoney(base + extra)}</span></span>
          </button>
        </form>
      </div>
    </div>
  `;
}

async function uploadDesignToCloudinary(file) {
  const cfg = getCloudinaryConfig();
  const cloudName = String(cfg.cloudName || "").trim();
  const uploadPreset = String(cfg.uploadPreset || "").trim();
  const folder = String(cfg.folder || "").trim();

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary no está configurado.");
  }

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", uploadPreset);
  if (folder) body.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data || !data.secure_url) {
    const msg = data?.error?.message ? String(data.error.message) : "No se pudo subir la imagen.";
    throw new Error(msg);
  }

  return {
    url: String(data.secure_url),
    publicId: String(data.public_id || ""),
    fileName: String(data.original_filename || file.name || ""),
  };
}

function attachProductHandlers(productId) {
  const product = findProduct(productId);
  if (!product) return;
  const form = document.getElementById("customForm");
  if (!(form instanceof HTMLFormElement)) return;

  const isRemera = product.type === "Remera";
  const byId = (id) => document.getElementById(id);
  const sizeOptions = byId("sizeOptions");
  const sizeField = byId("sizeField");
  const sizeError = byId("sizeError");
  const textField = byId("textField");
  const textInput = byId("text");
  const textCount = byId("textCount");
  const textError = byId("textError");
  const uploadField = byId("uploadField");
  const fileInput = byId("file");
  const fileName = byId("fileName");
  const fileError = byId("fileError");
  const formError = byId("formError");
  const submitBtn = byId("customSubmit");
  const dropzone = form.querySelector(".dropzone");

  const checked = (name) => {
    const el = form.querySelector(`input[name="${name}"]:checked`);
    return el instanceof HTMLInputElement ? el.value : "";
  };
  const currentMaterial = () => (isRemera ? checked("material") || MATERIALS[0]?.id || "peinado" : "");
  const setText = (id, text) => {
    const el = byId(id);
    if (el) el.textContent = text;
  };

  function refreshSizes() {
    if (!isRemera || !sizeOptions) return;
    const previous = checked("size");
    const sizes = sizeOptionsFor(product, currentMaterial());
    sizeOptions.innerHTML = renderSizePills(sizes, sizes.includes(previous) ? previous : "");
  }

  function refreshPricing() {
    const base = productBasePriceFor(product, currentMaterial());
    const placement = checked("placement");
    const extra = placementPrice(placement);
    setText("basePriceSummary", formatMoney(base));
    setText("placementLabel", placement);
    setText("placementPrice", formatMoney(extra));
    setText("estimatedTotal", formatMoney(base + extra));
    setText("submitPrice", formatMoney(base + extra));
  }

  function refreshMode() {
    const upload = checked("style") === "upload";
    if (textField) textField.hidden = upload;
    if (uploadField) uploadField.hidden = !upload;
    if (formError) formError.hidden = true;
  }

  function showFile() {
    const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : null;
    if (fileName) fileName.textContent = file ? file.name : "Elegí una imagen";
    dropzone?.classList.toggle("has-file", Boolean(file));
    if (file) setFieldError(uploadField, fileError, "");
  }

  form.addEventListener("change", (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.name === "material") {
      refreshSizes();
      refreshPricing();
    } else if (t.name === "placement") refreshPricing();
    else if (t.name === "style") refreshMode();
    else if (t.name === "color") setText("colorValue", t.value);
    else if (t.name === "size") setFieldError(sizeField, sizeError, "");
    else if (t.name === "file") showFile();
  });

  if (textInput instanceof HTMLInputElement) {
    textInput.addEventListener("input", () => {
      if (textCount) textCount.textContent = `${textInput.value.length}/24`;
      if (textInput.value.trim()) setFieldError(textField, textError, "");
    });
  }

  // Arrastrar y soltar la imagen sobre el recuadro
  if (dropzone && fileInput instanceof HTMLInputElement) {
    const stop = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    ["dragenter", "dragover"].forEach((type) =>
      dropzone.addEventListener(type, (ev) => {
        stop(ev);
        dropzone.classList.add("is-dragover");
      }),
    );
    ["dragleave", "drop"].forEach((type) =>
      dropzone.addEventListener(type, (ev) => {
        stop(ev);
        dropzone.classList.remove("is-dragover");
      }),
    );
    dropzone.addEventListener("drop", (ev) => {
      const files = ev.dataTransfer?.files;
      if (!files || !files.length) return;
      if (!String(files[0].type || "").startsWith("image/")) {
        setFieldError(uploadField, fileError, "Ese archivo no es una imagen. Probá con PNG o JPG.");
        return;
      }
      fileInput.files = files;
      showFile();
    });
  }

  refreshSizes();
  refreshMode();
  refreshPricing();

  const submitLabel = submitBtn ? submitBtn.innerHTML : "";
  let busy = false;

  function setBusy(on, label) {
    if (!(submitBtn instanceof HTMLButtonElement)) return;
    submitBtn.disabled = on;
    submitBtn.setAttribute("aria-busy", String(on));
    submitBtn.innerHTML = on ? `<span class="spinner" aria-hidden="true"></span><span class="btn-label">${label}</span>` : submitLabel;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    if (formError) formError.hidden = true;

    const fd = new FormData(form);
    const material = isRemera ? String(fd.get("material") || "").trim() : "";
    const size = String(fd.get("size") || "").trim();
    const color = String(fd.get("color") || "").trim();
    const placement = String(fd.get("placement") || "").trim();
    const style = String(fd.get("style") || "text").trim();
    const text = String(fd.get("text") || "").trim();
    const notes = String(fd.get("notes") || "").trim();
    const file = fd.get("file");

    const invalid = [];
    if (!sizeOptionsFor(product, material).includes(size)) {
      setFieldError(sizeField, sizeError, "Elegí un talle.");
      invalid.push(sizeField?.querySelector("input"));
    } else setFieldError(sizeField, sizeError, "");

    if (style === "upload") {
      if (!(file instanceof File) || !file.name) {
        setFieldError(uploadField, fileError, "Elegí la imagen que querés estampar.");
        invalid.push(fileInput);
      } else if (file.type && !file.type.startsWith("image/")) {
        setFieldError(uploadField, fileError, "Ese archivo no es una imagen. Probá con PNG o JPG.");
        invalid.push(fileInput);
      }
    } else if (!text) {
      setFieldError(textField, textError, "Escribí el texto que querés estampar.");
      invalid.push(textInput);
    }

    if (invalid.length) {
      focusField(invalid[0]);
      return;
    }

    const base = productBasePriceFor(product, material);
    const extras = placementPrice(placement);
    const materialLabel = isRemera ? materialLabelFor(material) : "";

    busy = true;
    setBusy(true, style === "upload" ? "Subiendo imagen..." : "Procesando...");
    try {
      let customization;
      if (style === "upload") {
        const uploaded = await uploadDesignToCloudinary(file);
        customization = {
          type: "upload",
          placement,
          material: materialLabel,
          fileName: uploaded.fileName || file.name,
          fileUrl: uploaded.url,
          filePublicId: uploaded.publicId,
          notes,
        };
      } else {
        customization = { type: "text", placement, text, material: materialLabel, notes };
      }

      const cart = getCart();
      cart.push({
        id: makeId("item"),
        productId: product.id,
        productName: product.name,
        variant: { size, color },
        customization,
        quantity: 1,
        unitPrice: base,
        extrasPrice: extras,
        createdAt: Date.now(),
      });
      setCart(cart);
      navigate("#/carrito");
    } catch {
      if (formError) {
        formError.textContent =
          style === "upload"
            ? "No pudimos subir tu imagen. Probá de nuevo en un rato o mandánosla por WhatsApp."
            : "No pudimos agregar el producto. Probá de nuevo.";
        formError.hidden = false;
      }
    } finally {
      busy = false;
      setBusy(false);
    }
  });
}

function renderUndoNotice() {
  if (!lastRemoved) return "";
  return `
    <div class="notice" role="status">
      <span>Quitaste <strong>${escapeHtml(cartItemTitle(lastRemoved.item))}</strong> del carrito.</span>
      <button class="link-btn" type="button" id="undoRemove">Deshacer</button>
    </div>`;
}

function renderCart() {
  const cart = getCart();

  if (cart.length === 0) {
    return `
      ${renderUndoNotice()}
      <section class="empty">
        <span class="empty-icon">${icon("bag", "icon icon-xl")}</span>
        <h1 class="empty-title">Tu carrito está vacío</h1>
        <p class="empty-text">Elegí un diseño de la casa o personalizá tu prenda.</p>
        <div class="empty-actions">
          <a class="btn btn-primary" href="#/" data-scroll="disenos">Ver diseños</a>
          <a class="btn btn-ghost" href="#/producto/remera-basica">Personalizar</a>
        </div>
      </section>
    `;
  }

  const count = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totals = computeCartTotals(cart, { shippingMethod: "pickup" });

  const itemsHtml = cart
    .map((item) => {
      const id = escapeHtml(item.id);
      const qty = Number(item.quantity) || 1;
      const title = cartItemTitle(item);
      const unit = (Number(item.unitPrice) || 0) + (Number(item.extrasPrice) || 0);
      const notes = String(item?.customization?.notes || "").trim();
      return `
        <article class="cart-item">
          <div class="cart-thumb">${cartItemThumb(item)}</div>
          <div class="cart-info">
            <h2 class="cart-title">${escapeHtml(title)}</h2>
            <p class="cart-meta">${escapeHtml(cartItemDetails(item))}</p>
            <p class="cart-custom">${escapeHtml(cartItemCustom(item))}</p>
            ${notes ? `<p class="cart-notes">Notas: ${escapeHtml(notes)}</p>` : ""}
            <div class="cart-controls">
              <div class="qty" role="group" aria-label="Cantidad de ${escapeHtml(title)}">
                <button class="qty-btn" type="button" data-dec="${id}" aria-label="Restar uno"${qty <= 1 ? " disabled" : ""}>${icon("minus")}</button>
                <output class="qty-value" aria-live="polite">${qty}</output>
                <button class="qty-btn" type="button" data-inc="${id}" aria-label="Sumar uno"${qty >= 99 ? " disabled" : ""}>${icon("plus")}</button>
              </div>
              <button class="link-btn link-btn-muted" type="button" data-rm="${id}">Quitar</button>
            </div>
          </div>
          <p class="cart-line-total">
            ${formatMoney(computeItemTotal(item))}
            ${qty > 1 ? `<span class="cart-unit">${formatMoney(unit)} c/u</span>` : ""}
          </p>
        </article>`;
    })
    .join("");

  return `
    <div class="page-head">
      <h1 class="page-title">Tu carrito</h1>
      <p class="page-sub">${count} ${count === 1 ? "producto" : "productos"}</p>
    </div>
    ${renderUndoNotice()}
    <div class="checkout-layout">
      <section class="cart-list" aria-label="Productos del carrito">${itemsHtml}</section>
      <aside class="summary" aria-label="Resumen">
        <h2 class="summary-title">Resumen</h2>
        <dl class="totals">
          <div><dt>Subtotal</dt><dd>${formatMoney(totals.itemsSubtotal)}</dd></div>
          <div><dt>Envío</dt><dd class="muted">Se elige en el siguiente paso</dd></div>
          <div class="totals-total"><dt>Total</dt><dd>${formatMoney(totals.itemsSubtotal)}</dd></div>
        </dl>
        <button class="btn btn-primary btn-lg btn-block" type="button" id="goCheckout">Continuar con el pedido ${icon("arrowRight")}</button>
        <button class="btn btn-ghost btn-block" type="button" id="goCatalog">Seguir comprando</button>
        <p class="summary-note">${icon("card")}<span>Al generar el pedido te mostramos los datos para transferir.</span></p>
      </aside>
    </div>
  `;
}

function attachCartHandlers() {
  const root = document.getElementById("app");
  if (!root) return;

  document.getElementById("goCheckout")?.addEventListener("click", () => navigate("#/checkout"));

  document.getElementById("undoRemove")?.addEventListener("click", () => {
    if (!lastRemoved) return;
    const cart = getCart();
    cart.splice(Math.min(lastRemoved.index, cart.length), 0, lastRemoved.item);
    const restoredId = lastRemoved.item.id;
    lastRemoved = null;
    setCart(cart);
    render();
    const again = document.querySelector(`[data-rm="${CSS.escape(String(restoredId))}"]`);
    if (again instanceof HTMLElement) again.focus();
  });

  root.querySelectorAll("[data-inc], [data-dec], [data-rm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inc = btn.getAttribute("data-inc");
      const dec = btn.getAttribute("data-dec");
      const rm = btn.getAttribute("data-rm");
      const id = inc || dec || rm;
      const cart = getCart();
      const index = cart.findIndex((item) => item.id === id);
      if (index < 0) return;

      let focusTargets;
      if (rm) {
        lastRemoved = { item: cart[index], index };
        cart.splice(index, 1);
        focusTargets = ["#undoRemove"];
      } else {
        const item = cart[index];
        item.quantity = clampNumber((Number(item.quantity) || 1) + (inc ? 1 : -1), 1, 99);
        const key = CSS.escape(String(id));
        focusTargets = inc ? [`[data-inc="${key}"]`, `[data-dec="${key}"]`] : [`[data-dec="${key}"]`, `[data-inc="${key}"]`];
      }

      setCart(cart);
      render();

      // Mantener el foco en el control que se usó (el carrito se vuelve a dibujar)
      for (const sel of focusTargets) {
        const el = document.querySelector(sel);
        if (el instanceof HTMLButtonElement && !el.disabled) {
          el.focus();
          break;
        }
      }
    });
  });
}

function renderCheckout() {
  const cart = getCart();
  if (cart.length === 0) return renderCart();

  const ship = shippingConfig();
  const totals = computeCartTotals(cart, { shippingMethod: "pickup" });
  const deliveryPrice = ship.deliveryFlatRate > 0 ? `+${formatMoney(ship.deliveryFlatRate)}` : "A coordinar";

  const field = (id, label, attrs, extra = "") => `
    <div class="field">
      <label class="label" for="${id}">${label}</label>
      <input id="${id}" name="${id}" ${attrs} aria-describedby="${id}Error" />
      ${extra}
      <p class="field-error" id="${id}Error" hidden></p>
    </div>`;

  return `
    ${renderCheckoutSteps(1)}
    <div class="page-head">
      <h1 class="page-title">Completá tu pedido</h1>
      <p class="page-sub">Con estos datos armamos el pedido y te contactamos por WhatsApp.</p>
    </div>

    <div class="checkout-layout">
      <form id="checkoutForm" class="form checkout-form" novalidate>
        <section class="form-section">
          <h2 class="form-section-title">Tus datos</h2>
          <div class="field-grid">
            ${field("name", "Nombre y apellido", 'type="text" autocomplete="name" required')}
            ${field(
              "whatsapp",
              "WhatsApp",
              'type="tel" inputmode="tel" autocomplete="tel" placeholder="Ej.: 3442 123456" required',
              '<p class="hint">Te escribimos a este número para confirmar.</p>',
            )}
            ${field("email", 'Email <span class="optional">(opcional)</span>', 'type="email" inputmode="email" autocomplete="email"')}
            ${field("city", "Ciudad", 'type="text" autocomplete="address-level2" required')}
          </div>
        </section>

        <fieldset class="form-section">
          <legend class="form-section-title">Entrega</legend>
          <div class="option-cards option-cards-wide">
            <label class="option-card">
              <input type="radio" name="shippingMethod" value="pickup" checked />
              <span class="option-card-body">
                ${icon("store")}
                <span class="option-card-title">${escapeHtml(ship.pickupLabel)}</span>
                <span class="option-card-meta">Sin cargo</span>
              </span>
            </label>
            <label class="option-card">
              <input type="radio" name="shippingMethod" value="delivery" />
              <span class="option-card-body">
                ${icon("truck")}
                <span class="option-card-title">${escapeHtml(ship.deliveryLabel)}</span>
                <span class="option-card-meta">${deliveryPrice}</span>
              </span>
            </label>
          </div>
          <div id="addressField" hidden>
            ${field("address", "Dirección de entrega", 'type="text" autocomplete="street-address" placeholder="Calle, número, piso y depto."')}
          </div>
        </fieldset>

        <section class="form-section">
          <h2 class="form-section-title">Notas</h2>
          <div class="field">
            <label class="label" for="notes">¿Algo más que tengamos que saber? <span class="optional">(opcional)</span></label>
            <textarea id="notes" name="notes" rows="3" placeholder="Horarios para el retiro, referencias de la dirección…"></textarea>
          </div>
        </section>
      </form>

      <aside class="summary" aria-label="Tu pedido">
        <h2 class="summary-title">Tu pedido</h2>
        <ul class="mini-list">${renderMiniItems(cart)}</ul>
        <dl class="totals">
          <div><dt>Subtotal</dt><dd id="subtotalVal">${formatMoney(totals.itemsSubtotal)}</dd></div>
          <div><dt>Envío</dt><dd id="shippingVal">Sin cargo</dd></div>
          <div class="totals-total"><dt>Total</dt><dd id="totalVal">${formatMoney(totals.total)}</dd></div>
        </dl>
        <button class="btn btn-primary btn-lg btn-block" type="submit" form="checkoutForm">Generar pedido ${icon("arrowRight")}</button>
        <button class="btn btn-ghost btn-block" type="button" id="backToCart">${icon("arrowLeft")}Volver al carrito</button>
        <p class="summary-note">${icon("card")}<span>Después te mostramos los datos para transferir.</span></p>
      </aside>
    </div>
  `;
}

function attachCheckoutHandlers() {
  document.getElementById("backToCart")?.addEventListener("click", () => navigate("#/carrito"));
  const form = document.getElementById("checkoutForm");
  if (!(form instanceof HTMLFormElement)) return;

  const addressField = document.getElementById("addressField");
  const FIELDS = ["name", "whatsapp", "email", "city", "address"];

  const method = () => {
    const el = form.querySelector('input[name="shippingMethod"]:checked');
    return el instanceof HTMLInputElement ? el.value : "pickup";
  };
  const valueOf = (id) => {
    const el = document.getElementById(id);
    return el instanceof HTMLInputElement ? el.value.trim() : "";
  };

  function errorFor(id) {
    const value = valueOf(id);
    if (id === "name" && !value) return "Escribí tu nombre.";
    if (id === "whatsapp") {
      if (!value) return "Necesitamos tu WhatsApp para confirmar el pedido.";
      if (value.replace(/\D/g, "").length < 8) return "Revisá el número: tiene que tener al menos 8 dígitos.";
    }
    if (id === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Revisá el email.";
    if (id === "city" && !value) return "Escribí tu ciudad.";
    if (id === "address" && method() === "delivery" && !value) return "Escribí la dirección de entrega.";
    return "";
  }

  function showError(id, message) {
    const input = document.getElementById(id);
    setFieldError(input?.closest(".field"), document.getElementById(`${id}Error`), message);
  }

  function refresh() {
    const m = method();
    if (addressField) addressField.hidden = m !== "delivery";
    if (m !== "delivery") showError("address", "");
    const totals = computeCartTotals(getCart(), { shippingMethod: m });
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set("subtotalVal", formatMoney(totals.itemsSubtotal));
    set("shippingVal", shippingText(m, totals.shippingCost));
    set("totalVal", formatMoney(totals.total));
  }

  form.addEventListener("change", (ev) => {
    if (ev.target instanceof HTMLInputElement && ev.target.name === "shippingMethod") refresh();
  });

  // Si un campo ya marcó error, se revisa de nuevo mientras se corrige
  form.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t instanceof HTMLInputElement && t.getAttribute("aria-invalid") === "true") showError(t.id, errorFor(t.id));
  });

  refresh();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let firstInvalid = "";
    for (const id of FIELDS) {
      const message = errorFor(id);
      showError(id, message);
      if (message && !firstInvalid) firstInvalid = id;
    }
    if (firstInvalid) {
      focusField(document.getElementById(firstInvalid));
      return;
    }

    const cart = getCart();
    if (cart.length === 0) {
      navigate("#/carrito");
      return;
    }

    const shippingMethod = method();
    const notesEl = document.getElementById("notes");
    const checkout = {
      name: valueOf("name"),
      whatsapp: valueOf("whatsapp"),
      email: valueOf("email"),
      city: valueOf("city"),
      shippingMethod,
      address: shippingMethod === "delivery" ? valueOf("address") : "",
      notes: notesEl instanceof HTMLTextAreaElement ? notesEl.value.trim() : "",
    };

    const totals = computeCartTotals(cart, checkout);
    const orderId = makeId("order");
    const order = {
      id: orderId,
      number: String(Date.now()).slice(-6),
      status: "Pendiente de pago",
      createdAt: Date.now(),
      cart,
      checkout,
      totals,
      store: {
        name: CONFIG.storeName,
        locale: CONFIG.locale,
        currency: CONFIG.currency,
      },
    };

    const orders = getOrders();
    orders.unshift(order);
    setOrders(orders);
    setCart([]);
    navigate(`#/checkout?orderId=${encodeURIComponent(orderId)}`);
  });
}

function formatCartItemForMessage(item) {
  const qty = Number(item?.quantity) || 1;
  const name = String(item?.productName || item?.productId || "Producto");

  const kind = String(item?.customization?.type || "");
  const talle = String(item?.variant?.size || "-");
  const color = item?.variant?.color ? ` | Color: ${item.variant.color}` : "";
  const notes = item?.customization?.notes ? ` | Notas: ${item.customization.notes}` : "";
  const material = String(item?.customization?.material || "").trim();
  const materialPart = material ? ` | Material: ${material}` : "";

  if (kind === "house") {
    const designId = String(item?.customization?.designId || "").trim();
    const designName = String(item?.customization?.designName || "-");
    const idPart = designId ? ` | ID: ${designId}` : "";
    return `- ${qty}x ${name} (Diseño: ${designName}${idPart} | Talle: ${talle}${color}${materialPart}${notes})`;
  }

  const placement = String(item?.customization?.placement || "-");
  if (kind === "upload") {
    const fileUrl = String(item?.customization?.fileUrl || "").trim();
    const fileName = String(item?.customization?.fileName || "-");
    const design = fileUrl ? fileUrl : fileName;
    return `- ${qty}x ${name} (Diseño: ${design} | Talle: ${talle}${materialPart} | Ubicación: ${placement}${color}${notes})`;
  }

  const text = String(item?.customization?.text || "-");
  return `- ${qty}x ${name} (Texto: ${text} | Talle: ${talle}${materialPart} | Ubicación: ${placement}${color}${notes})`;
}

function buildPaymentMessage(order) {
  const ship = shippingConfig();
  const shippingLabel =
    order?.checkout?.shippingMethod === "delivery" ? ship.deliveryLabel : ship.pickupLabel;

  const lines = [
    `Hola ${CONFIG.storeName}, hice el pedido #${order.number}.`,
    "",
    "Datos del pedido:",
    `Nombre: ${order.checkout.name}`,
    `WhatsApp: ${order.checkout.whatsapp}`,
    `Ciudad: ${order.checkout.city}`,
    `Entrega: ${shippingLabel}`,
  ];

  if (order?.checkout?.shippingMethod === "delivery" && order?.checkout?.address) {
    lines.push(`Dirección: ${order.checkout.address}`);
  }

  if (order?.checkout?.notes) {
    lines.push(`Notas (checkout): ${order.checkout.notes}`);
  }

  lines.push("", "Items:");
  for (const item of order.cart || []) {
    lines.push(formatCartItemForMessage(item));
  }

  lines.push(
    "",
    `Subtotal: ${formatMoney(order.totals.itemsSubtotal)}`,
    `Envío: ${formatMoney(order.totals.shippingCost)}`,
    `Total a pagar: ${formatMoney(order.totals.total)}`,
    "",
  );

  const { bank, hasBank } = businessInfo();
  if (hasBank) {
    lines.push("Datos para transferencia:");
    if (bank.alias) lines.push(`Alias: ${bank.alias}`);
    if (bank.cvuCbu) lines.push(`CVU/CBU: ${bank.cvuCbu}`);
    if (bank.holder) lines.push(`Titular: ${bank.holder}`);
    if (bank.cuit) lines.push(`CUIT: ${bank.cuit}`);
    lines.push("");
  } else {
    lines.push("¿Me pasás los datos para transferir?", "");
  }

  lines.push(
    `Referencia: Pedido #${order.number} - ${order.checkout.name}`,
    "",
    "Te envío el comprobante cuando transfiera.",
  );

  return lines.join("\n");
}

function normalizeWhatsappNumber(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `549${digits.slice(1)}`;
  if (digits.length === 10) return `549${digits}`;
  return digits;
}

function buildWhatsappLink(message) {
  const number = normalizeWhatsappNumber(businessInfo().whatsappNumber);
  const text = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${text}`;
}

function renderOrderConfirmation(orderId) {
  const order = getOrders().find((o) => o && o.id === orderId);
  if (!order) {
    return `
      <section class="empty">
        <span class="empty-icon">${icon("bag", "icon icon-xl")}</span>
        <h1 class="empty-title">No encontramos ese pedido</h1>
        <p class="empty-text">Puede que se haya generado en otro celular o navegador. Si ya nos lo mandaste por WhatsApp, lo tenemos.</p>
        <div class="empty-actions">
          <button class="btn btn-primary" type="button" id="goCatalog">Volver a la tienda</button>
        </div>
      </section>
    `;
  }

  const cart = Array.isArray(order.cart) ? order.cart : [];
  const totals = order.totals || { itemsSubtotal: 0, shippingCost: 0, total: 0 };
  const message = buildPaymentMessage(order);
  const { bank, hasBank } = businessInfo();
  const reference = `Pedido #${order.number} - ${order.checkout?.name || ""}`;
  const hasUpload = cart.some((item) => item?.customization?.type === "upload");

  const copyRow = (label, value) => `
    <div class="copy-row">
      <dt>${label}</dt>
      <dd>
        <span class="copy-value">${escapeHtml(value)}</span>
        <button class="icon-btn icon-btn-sm" type="button" data-copy="${escapeHtml(value)}" aria-label="Copiar ${label}">${icon("copy")}</button>
      </dd>
    </div>`;

  const bankHtml = hasBank
    ? `<dl class="bank">
         ${[
           ["Alias", bank.alias],
           ["CVU/CBU", bank.cvuCbu],
           ["Titular", bank.holder],
           ["CUIT", bank.cuit],
         ]
           .filter(([, v]) => v)
           .map(([label, v]) => copyRow(label, v))
           .join("")}
         ${copyRow("Referencia", reference)}
       </dl>`
    : `<p class="confirm-step-text">Escribinos por WhatsApp y te pasamos el alias para transferir.</p>`;

  return `
    ${renderCheckoutSteps(2)}
    <header class="confirm-head">
      <span class="confirm-icon">${icon("check", "icon icon-lg")}</span>
      <div>
        <h1 class="page-title">Pedido #${escapeHtml(order.number)} generado</h1>
        <p class="page-sub">Faltan dos pasos para confirmarlo.</p>
      </div>
    </header>

    <div class="checkout-layout">
      <div class="confirm-steps">
        <section class="confirm-step">
          <span class="step-num">1</span>
          <div class="confirm-step-body">
            <h2 class="confirm-step-title">Envianos el pedido por WhatsApp</h2>
            <p class="confirm-step-text">Se abre el chat con el detalle del pedido ya escrito. Solo tenés que enviarlo.</p>
            <a class="btn btn-wa btn-lg" href="${escapeHtml(buildWhatsappLink(message))}" target="_blank" rel="noopener">${icon("chat")}Enviar por WhatsApp</a>
            <details class="msg-details">
              <summary>Ver o copiar el mensaje</summary>
              <label class="sr-only" for="paymentMsg">Mensaje del pedido</label>
              <textarea id="paymentMsg" class="msg-box" rows="10" readonly>${escapeHtml(message)}</textarea>
              <button class="btn btn-ghost btn-sm" type="button" id="copyMsg">${icon("copy")}<span>Copiar mensaje</span></button>
            </details>
          </div>
        </section>

        <section class="confirm-step">
          <span class="step-num">2</span>
          <div class="confirm-step-body">
            <h2 class="confirm-step-title">Transferí ${formatMoney(totals.total)}</h2>
            ${bankHtml}
            <p class="confirm-step-text">Cuando transfieras, mandanos el comprobante por WhatsApp.</p>
          </div>
        </section>
      </div>

      <aside class="summary" aria-label="Detalle del pedido">
        <div class="summary-head">
          <h2 class="summary-title">Pedido #${escapeHtml(order.number)}</h2>
          <span class="status-pill">${escapeHtml(order.status || "Pendiente de pago")}</span>
        </div>
        <ul class="mini-list">${renderMiniItems(cart)}</ul>
        <dl class="totals">
          <div><dt>Subtotal</dt><dd>${formatMoney(totals.itemsSubtotal)}</dd></div>
          <div><dt>Envío</dt><dd>${shippingText(order.checkout?.shippingMethod, totals.shippingCost)}</dd></div>
          <div class="totals-total"><dt>Total</dt><dd>${formatMoney(totals.total)}</dd></div>
        </dl>
        ${
          hasUpload
            ? `<p class="summary-note note-warn"><span><strong>Importante:</strong> La personalización con archivo se valida antes de producir. Si hace falta, te pedimos una versión mejor.</span></p>`
            : ""
        }
        <button class="btn btn-ghost btn-block" type="button" id="goCatalog">Volver a la tienda</button>
      </aside>
    </div>
    <p class="sr-only" id="copyStatus" aria-live="polite"></p>
  `;
}

function attachOrderConfirmationHandlers() {
  const status = document.getElementById("copyStatus");
  const announce = (text) => {
    if (status) status.textContent = text;
  };

  const copyMsg = document.getElementById("copyMsg");
  const msg = document.getElementById("paymentMsg");
  if (copyMsg && msg instanceof HTMLTextAreaElement) {
    copyMsg.addEventListener("click", async () => {
      const ok = await copyText(msg.value);
      const label = copyMsg.querySelector("span");
      if (label) label.textContent = ok ? "Copiado" : "No se pudo copiar";
      announce(ok ? "Mensaje copiado" : "No se pudo copiar el mensaje");
      setTimeout(() => {
        if (label) label.textContent = "Copiar mensaje";
      }, 2000);
    });
  }

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    const original = btn.getAttribute("aria-label") || "Copiar";
    btn.addEventListener("click", async () => {
      const ok = await copyText(btn.getAttribute("data-copy") || "");
      if (!ok) {
        announce("No se pudo copiar");
        return;
      }
      btn.classList.add("is-copied");
      btn.innerHTML = icon("check");
      btn.setAttribute("aria-label", "Copiado");
      announce(`${original.replace(/^Copiar /, "")} copiado`);
      setTimeout(() => {
        btn.classList.remove("is-copied");
        btn.innerHTML = icon("copy");
        btn.setAttribute("aria-label", original);
      }, 1800);
    });
  });
}

function renderHowItWorks() {
  const steps = [
    ["Elegí tu producto", "Remera, buzo o gorra. Elegí talle y color."],
    [
      "Diseños de la casa (rápido)",
      "En “Diseños de la casa” elegís un diseño ya listo, seleccionás el talle disponible y lo agregás al carrito.",
    ],
    ["Personalizalo", "Podés elegir texto o subir tu diseño."],
    ["Generá el pedido", "En el checkout te mostramos el total y los datos para transferir."],
    ["Pagá el total", "Con el pago confirmás y pasamos a producción."],
  ];

  return `
    <div class="page-head">
      <h1 class="page-title">Cómo funciona</h1>
      <p class="page-sub">Simple: elegís, personalizás y confirmás con pago total.</p>
    </div>
    <ol class="timeline">
      ${steps
        .map(
          ([title, text], i) => `
            <li class="timeline-item">
              <span class="step-num">${i + 1}</span>
              <div>
                <h2 class="timeline-title">${title}</h2>
                <p class="timeline-text">${text}</p>
              </div>
            </li>`,
        )
        .join("")}
    </ol>
    <div class="cta-row">
      <a class="btn btn-primary btn-lg" href="#/" data-scroll="disenos">Ver diseños ${icon("arrowRight")}</a>
      <a class="btn btn-ghost btn-lg" href="#/producto/remera-basica">Personalizar la mía</a>
    </div>
  `;
}

function renderPolicies() {
  const help = buildWhatsappLink(`Hola ${CONFIG.storeName}, tengo una consulta.`);
  return `
    <article class="prose-page">
      <div class="page-head">
        <h1 class="page-title">Políticas</h1>
        <p class="page-sub">Cómo trabajamos los pedidos personalizados.</p>
      </div>
      <section class="prose-block">
        <h2>Personalización</h2>
        <p>Los productos personalizados se validan antes de producir.</p>
      </section>
      <section class="prose-block">
        <h2>Pago</h2>
        <p>El pago confirma el pedido. Si hace falta, coordinamos el envío o la entrega por WhatsApp.</p>
      </section>
      <p class="prose-contact">¿Te quedó alguna duda? <a href="${escapeHtml(help)}" target="_blank" rel="noopener">Escribinos por WhatsApp</a>.</p>
    </article>
  `;
}

function renderNotFound() {
  return `
    <section class="empty">
      <span class="empty-icon">${icon("bag", "icon icon-xl")}</span>
      <h1 class="empty-title">Esta página no existe</h1>
      <p class="empty-text">Puede que el link esté incompleto o que el producto ya no esté publicado.</p>
      <div class="empty-actions">
        <button class="btn btn-primary" type="button" id="goCatalog">Ir a la tienda</button>
      </div>
    </section>
  `;
}

// Clicks globales: volver a la tienda y saltar a una sección del inicio
function attachGlobalHandlers() {
  document.addEventListener("click", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;

    if (t.closest(".skip-link")) {
      e.preventDefault();
      document.getElementById("app")?.focus();
      return;
    }

    if (t.closest("#goCatalog")) {
      navigate("#/");
      return;
    }

    const link = t.closest("[data-scroll]");
    if (!link) return;
    e.preventDefault();
    const id = link.getAttribute("data-scroll") || "";
    const onHome = parseRoute().parts.length === 0 && !document.body.classList.contains("is-admin");
    const target = onHome ? document.getElementById(id) : null;
    if (target) {
      target.scrollIntoView({ block: "start", behavior: scrollBehavior() });
      return;
    }
    pendingScroll = id;
    if (onHome) render();
    else navigate("#/");
  });
}

async function loadPublishedStore() {
  try {
    const res = await fetch("/api/store", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") return;
    setPublishedStore(data);
  } catch {}
}

// Lo que el panel necesita de la tienda
const adminApi = {
  formatMoney,
  escapeHtml,
  cloudinaryOptimized,
  uploadDesignToCloudinary,
  getDesigns,
  getPricing,
  productBasePriceFor,
  businessInfo,
  getPublishedStore,
  setPublishedStore,
  normalizeWhatsappNumber,
};

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  loadState();
  attachGlobalHandlers();
  loadPublishedStore().finally(() => {
    render();
  });
});
