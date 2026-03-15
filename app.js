/*
  BatyStore (MVP)

  Archivo principal de la app.

  Responsabilidades:
  - Configuración del negocio (seña, envío, WhatsApp y datos bancarios)
  - Catálogo y reglas de personalización
  - Estado local (carrito/pedidos) persistido en localStorage
  - Renderizado SPA por hash (#/)
  - Generación de pedido + link de WhatsApp para confirmar seña

  Nota: este MVP no tiene backend; el historial de pedidos vive en el navegador del usuario.
*/

/* ===== Configuración del negocio ===== */
const CONFIG = {
  storeName: "BatyStore",
  currency: "ARS",
  locale: "es-AR",
  depositPercent: 0.3,
  depositHoursLimit: 48,
  whatsappNumber: "3442409755",
  adminKey: "batystore-admin",
  bank: {
    alias: "BATYSTORE.ALIAS",
    cvuCbu: "0000000000000000000000",
    holder: "BatyStore",
    cuit: "00-00000000-0",
  },
  shipping: {
    pickupLabel: "Retiro por el local",
    deliveryLabel: "Envío a domicilio",
    deliveryFlatRate: 6000,
  },
  cloudinary: {
    cloudName: "dwael1b2u",
    uploadPreset: "batystore",
    folder: "batystore",
  },
};

/* ===== Catálogo ===== */
const PRODUCTS = [
  {
    id: "remera-basica",
    name: "Remera personalizada",
    type: "Remera",
    basePrice: 18990,
    description: "Algodón, ideal para estampa en frente o espalda.",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Negro", "Blanco", "Gris", "Azul", "Rojo"],
    placements: ["Frente chico", "Frente grande", "Espalda grande"],
    media: { kind: "video", src: "./remera.mp4" },
  },
  {
    id: "buzo-canguro",
    name: "Buzo canguro personalizado",
    type: "Buzo",
    basePrice: 34990,
    description: "Abrigo y estilo. Estampa al frente o espalda.",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Negro", "Gris", "Azul"],
    placements: ["Frente chico", "Frente grande", "Espalda grande"],
    media: { kind: "video", src: "./buzo.mp4" },
  },
  {
    id: "gorra-clasica",
    name: "Gorra personalizada",
    type: "Gorra",
    basePrice: 16990,
    description: "Frente personalizable con texto o diseño.",
    sizes: ["Único"],
    colors: ["Negro", "Blanco", "Beige"],
    placements: ["Frente"],
    media: { kind: "video", src: "./gorra.mp4" },
  },
];

const PERSONALIZATION_PRICING = [
  { placement: "Frente chico", price: 4500 },
  { placement: "Frente grande", price: 6900 },
  { placement: "Espalda grande", price: 7900 },
  { placement: "Frente", price: 4900 },
];

const DEFAULT_DESIGNS = [
  { id: "baty-classic", name: "Baty Classic", price: 2500, productId: "remera-basica", allowedSizes: [1, 2, 3, 4, 5, 6] },
  { id: "baty-street", name: "Baty Street", price: 3200, productId: "remera-basica", allowedSizes: [1, 2, 3, 4, 5, 6] },
  { id: "baty-minimal", name: "Baty Minimal", price: 2000, productId: "remera-basica", allowedSizes: [1, 2, 3, 4, 5, 6] },
];

const MATERIALS = [
  { id: "peinado", label: "Algodón Peinado", maxSize: 6 },
  { id: "algodon100", label: "Algodón 100%", maxSize: 10 },
];

const STAMP_SIZES = [
  { id: "chico", label: "Chico" },
  { id: "mediano", label: "Mediano" },
  { id: "grande", label: "Grande" },
];

const STAMP_LOCATIONS = [
  { id: "delantera", label: "Adelante" },
  { id: "trasera", label: "Atrás" },
  { id: "nuca", label: "Superior trasera (nuca)" },
  { id: "pecho-izq", label: "Pecho (izq)" },
  { id: "pecho-der", label: "Pecho (der)" },
];

/* ===== Persistencia (localStorage) ===== */
const STORAGE_KEYS = {
  cart: "batystore.cart.v1",
  orders: "batystore.orders.v1",
  settings: "batystore.settings.v1",
};

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
  published: { designs: null, pricing: null },
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
  state.published = { designs, pricing };
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

function guessVideoType(src) {
  const ext = src.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "ogg" || ext === "ogv") return "video/ogg";
  return "";
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
      <source src="${escapeHtml(media.src)}"${typeAttr} />
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
    stampSizes: { chico: 4500, mediano: 6900, grande: 7900 },
    hatStamp: 4900,
    designOverrideById: {},
  };
  if (!saved || typeof saved !== "object") return base;

  const out = { ...base };
  if (saved.stampSizes && typeof saved.stampSizes === "object") {
    out.stampSizes = { ...out.stampSizes, ...saved.stampSizes };
  }
  if (typeof saved.hatStamp === "number") out.hatStamp = saved.hatStamp;
  if (saved.designOverrideById && typeof saved.designOverrideById === "object") {
    out.designOverrideById = { ...out.designOverrideById, ...saved.designOverrideById };
  }
  return out;
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
  const shippingCost =
    checkout?.shippingMethod === "delivery" ? CONFIG.shipping.deliveryFlatRate : 0;
  const total = itemsSubtotal + shippingCost;
  const deposit = Math.ceil(total * CONFIG.depositPercent);
  return { itemsSubtotal, shippingCost, total, deposit };
}

function updateCartCount() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const count = getCart().reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  el.textContent = String(count);
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

function render() {
  updateCartCount();
  const { parts, query } = parseRoute();
  const root = document.getElementById("app");
  if (!root) return;

  if (parts.length === 0) {
    root.innerHTML = renderCatalog(query);
    attachCatalogHandlers(query);
    setupThumbVideos(root);
    return;
  }

  if (parts[0] === "producto" && parts[1]) {
    root.innerHTML = renderProduct(parts[1]);
    attachProductHandlers(parts[1]);
    setupThumbVideos(root);
    return;
  }

  if (parts[0] === "diseno" && parts[1]) {
    root.innerHTML = renderDesignOrder(parts[1]);
    attachDesignOrderHandlers(parts[1]);
    setupThumbVideos(root);
    return;
  }

  if (parts[0] === "carrito") {
    root.innerHTML = renderCart();
    attachCartHandlers();
    setupThumbVideos(root);
    return;
  }

  if (parts[0] === "checkout") {
    const orderId = query.get("orderId");
    if (orderId) {
      root.innerHTML = renderOrderConfirmation(orderId);
      attachOrderConfirmationHandlers(orderId);
      setupThumbVideos(root);
      return;
    }
    root.innerHTML = renderCheckout();
    attachCheckoutHandlers();
    setupThumbVideos(root);
    return;
  }

  if (parts[0] === "como-funciona") {
    root.innerHTML = renderHowItWorks();
    setupThumbVideos(root);
    return;
  }

  if (parts[0] === "politicas") {
    root.innerHTML = renderPolicies();
    setupThumbVideos(root);
    return;
  }

  if (parts[0] === "config") {
    root.innerHTML = renderConfig();
    attachConfigHandlers();
    return;
  }

  if (parts[0] === "admin") {
    root.innerHTML = renderAdmin(query);
    attachAdminHandlers(query);
    return;
  }

  root.innerHTML = renderNotFound();
  setupThumbVideos(root);
}

function renderConfig() {
  const cfg = getCloudinaryConfig();
  const cloudName = typeof cfg.cloudName === "string" ? cfg.cloudName : "";
  const uploadPreset = typeof cfg.uploadPreset === "string" ? cfg.uploadPreset : "";
  const folder = typeof cfg.folder === "string" ? cfg.folder : "";
  const adminKey = typeof getSettings()?.adminKey === "string" ? String(getSettings().adminKey) : "";

  return `
    <section class="panel">
      <h1 class="panel-title">Configuración</h1>
      <p class="panel-subtitle">Guardado en este navegador.</p>
      <div class="divider"></div>

      <div class="notice">
        <div class="notice-title">Cloudinary (subida de diseños)</div>
        <p class="notice-text">
          Usá un Upload Preset unsigned. El link del diseño se incluye en el pedido por WhatsApp.
        </p>
      </div>

      <div class="divider"></div>

      <form id="configForm" class="form" autocomplete="off">
        <div class="field">
          <label for="cloudName">Cloud name</label>
          <input id="cloudName" name="cloudName" placeholder="Ej: mi-cloud" value="${escapeHtml(
            cloudName,
          )}" />
        </div>
        <div class="field">
          <label for="uploadPreset">Upload preset (unsigned)</label>
          <input id="uploadPreset" name="uploadPreset" placeholder="Ej: batystore_unsigned" value="${escapeHtml(
            uploadPreset,
          )}" />
        </div>
        <div class="field full">
          <label for="folder">Folder (opcional)</label>
          <input id="folder" name="folder" placeholder="Ej: batystore" value="${escapeHtml(folder)}" />
        </div>

        <div class="divider"></div>

        <div class="notice">
          <div class="notice-title">Acceso Admin</div>
          <p class="notice-text">Usá la misma clave que cargaste en Vercel como ADMIN_KEY.</p>
        </div>

        <div class="field full">
          <label for="adminKey">Admin key</label>
          <input id="adminKey" name="adminKey" placeholder="Clave de admin" value="${escapeHtml(adminKey)}" />
        </div>

        <div class="field full">
          <div class="row">
            <button class="btn" type="button" id="goCatalog">Volver</button>
            <button class="btn btn-outline" type="button" id="clearCfg">Borrar</button>
            <button class="btn btn-primary" type="submit">Guardar</button>
          </div>
        </div>
      </form>
    </section>
  `;
}

function attachConfigHandlers() {
  const form = document.getElementById("configForm");
  const goCatalog = document.getElementById("goCatalog");
  const clearBtn = document.getElementById("clearCfg");
  if (goCatalog) goCatalog.addEventListener("click", () => navigate("#/"));

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const next = { ...getSettings() };
      delete next.cloudinary;
      delete next.adminKey;
      setSettings(next);
      render();
    });
  }

  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const cloudName = String(fd.get("cloudName") || "").trim();
    const uploadPreset = String(fd.get("uploadPreset") || "").trim();
    const folder = String(fd.get("folder") || "").trim();
    const adminKey = String(fd.get("adminKey") || "").trim();

    const next = { ...getSettings() };
    const current = next.cloudinary && typeof next.cloudinary === "object" ? { ...next.cloudinary } : {};
    if (cloudName) current.cloudName = cloudName;
    else delete current.cloudName;
    if (uploadPreset) current.uploadPreset = uploadPreset;
    else delete current.uploadPreset;
    if (typeof folder === "string") current.folder = folder;
    next.cloudinary = current;
    if (adminKey) next.adminKey = adminKey;
    else delete next.adminKey;
    setSettings(next);
    navigate("#/");
  });
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

function getAdminKey() {
  const saved = getSettings()?.adminKey;
  if (typeof saved === "string" && saved.trim()) return saved.trim();
  const cfgKey = typeof CONFIG.adminKey === "string" ? CONFIG.adminKey.trim() : "";
  if (cfgKey) return cfgKey;
  return "batystore-admin";
}

function renderAdmin(query) {
  const key = query?.get("key") || "";
  if (key !== getAdminKey()) {
    return `
      <section class="panel">
        <h1 class="panel-title">Acceso</h1>
        <p class="panel-subtitle">Ingresá la clave para administrar.</p>
        <div class="divider"></div>
        <form id="adminLoginForm" class="form" autocomplete="off">
          <div class="field full">
            <label for="adminKey">Clave</label>
            <input id="adminKey" name="adminKey" placeholder="Clave de admin" />
          </div>
          <div class="field full">
            <div class="row">
              <button class="btn" type="button" id="goCatalog">Volver</button>
              <button class="btn btn-primary" type="submit">Entrar</button>
            </div>
          </div>
        </form>
      </section>
    `;
  }

  const designs = getDesigns();
  const designsJson = escapeHtml(JSON.stringify(designs, null, 2));
  const pricing = getPricing();
  const chico = Number(pricing.stampSizes?.chico) || 0;
  const mediano = Number(pricing.stampSizes?.mediano) || 0;
  const grande = Number(pricing.stampSizes?.grande) || 0;
  const hatStamp = Number(pricing.hatStamp) || 0;

  return `
    <section class="panel">
      <h1 class="panel-title">Admin</h1>
      <p class="panel-subtitle">Cambios guardados en este navegador.</p>
      <div class="divider"></div>

      <form id="adminForm" class="form" autocomplete="off">
        <div class="field full">
          <label>Nuevo diseño (rápido)</label>
          <div class="row" style="justify-content:flex-start;flex-wrap:wrap">
            <input id="newDesignId" placeholder="id (ej: baty-01)" />
            <input id="newDesignName" placeholder="Nombre" />
            <input id="newDesignPrice" placeholder="Precio" inputmode="numeric" />
          </div>
          <div class="row" style="justify-content:flex-start;flex-wrap:wrap;margin-top:10px">
            <select id="newDesignProduct">
              ${PRODUCTS.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("")}
            </select>
            <input id="newDesignSizes" placeholder="Talles permitidos (ej: 1,2,3,4)" />
          </div>
          <div class="row" style="justify-content:flex-start;flex-wrap:wrap;margin-top:10px">
            <input id="newDesignImageUrl" placeholder="URL de imagen (opcional)" style="flex:1;min-width:260px" />
            <input id="newDesignFile" type="file" accept="image/*" />
            <button class="btn btn-outline" type="button" id="addDesignToJson">Agregar al JSON</button>
          </div>
          <div class="hint">El archivo se sube a Cloudinary y se pega la URL.</div>
        </div>

        <div class="field full">
          <label for="designsJson">Diseños de la casa (JSON)</label>
          <textarea id="designsJson" name="designsJson" rows="10" class="mono">${designsJson}</textarea>
          <div class="hint">
            Formato: [{"id":"baty-01","name":"Baty 01","price":2500,"productId":"remera-basica","allowedSizes":[1,2,3],"imageUrl":"https://..."}]
          </div>
        </div>

        <div class="field full">
          <label>Eliminar diseño</label>
          <div class="row" style="justify-content:flex-start;flex-wrap:wrap">
            <input id="deleteDesignId" placeholder="id a eliminar" />
            <button class="btn btn-danger" type="button" id="deleteDesignBtn">Eliminar</button>
          </div>
        </div>

        <div class="divider"></div>

        <div class="field">
          <label for="priceChico">Estampa chico</label>
          <input id="priceChico" name="priceChico" inputmode="numeric" value="${escapeHtml(chico)}" />
        </div>
        <div class="field">
          <label for="priceMediano">Estampa mediano</label>
          <input id="priceMediano" name="priceMediano" inputmode="numeric" value="${escapeHtml(mediano)}" />
        </div>
        <div class="field">
          <label for="priceGrande">Estampa grande</label>
          <input id="priceGrande" name="priceGrande" inputmode="numeric" value="${escapeHtml(grande)}" />
        </div>
        <div class="field">
          <label for="priceHat">Gorra (estampa)</label>
          <input id="priceHat" name="priceHat" inputmode="numeric" value="${escapeHtml(hatStamp)}" />
        </div>

        <div class="field full">
          <div class="row">
            <button class="btn" type="button" id="adminBack">Volver</button>
            <button class="btn btn-outline" type="button" id="adminReset">Restaurar</button>
            <button class="btn btn-primary" type="submit">Guardar</button>
          </div>
        </div>

        <div class="divider"></div>
        <div class="notice">
          <div class="notice-title">Publicación</div>
          <p class="notice-text">
            Para que lo vean todos los clientes en Vercel, la app publica en /api/store.
          </p>
        </div>
      </form>
    </section>
  `;
}

function attachAdminHandlers(query) {
  const goCatalog = document.getElementById("goCatalog");
  if (goCatalog) goCatalog.addEventListener("click", () => navigate("#/"));

  const key = query?.get("key") || "";
  if (key !== getAdminKey()) {
    const loginForm = document.getElementById("adminLoginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(loginForm);
        const entered = String(fd.get("adminKey") || "").trim();
        if (!entered) return;
        navigate(`#/admin?key=${encodeURIComponent(entered)}`);
      });
    }
    return;
  }

  const designsJsonEl = document.getElementById("designsJson");
  const newDesignFile = document.getElementById("newDesignFile");
  const newDesignImageUrl = document.getElementById("newDesignImageUrl");
  const addDesignToJson = document.getElementById("addDesignToJson");
  const deleteDesignBtn = document.getElementById("deleteDesignBtn");
  const deleteDesignId = document.getElementById("deleteDesignId");

  if (newDesignFile instanceof HTMLInputElement) {
    newDesignFile.addEventListener("change", async () => {
      const file = newDesignFile.files && newDesignFile.files[0] ? newDesignFile.files[0] : null;
      if (!file) return;
      try {
        const uploaded = await uploadDesignToCloudinary(file);
        if (newDesignImageUrl instanceof HTMLInputElement) {
          newDesignImageUrl.value = uploaded.url;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No se pudo subir la imagen.";
        alert(msg);
      } finally {
        newDesignFile.value = "";
      }
    });
  }

  if (addDesignToJson) {
    addDesignToJson.addEventListener("click", () => {
      if (!(designsJsonEl instanceof HTMLTextAreaElement)) return;

      const id = String(document.getElementById("newDesignId")?.value || "").trim();
      const name = String(document.getElementById("newDesignName")?.value || "").trim();
      const price = clampNumber(document.getElementById("newDesignPrice")?.value, 0, 1_000_000);
      const productId = String(document.getElementById("newDesignProduct")?.value || "").trim();
      const sizesRaw = String(document.getElementById("newDesignSizes")?.value || "").trim();
      const imageUrl = String(document.getElementById("newDesignImageUrl")?.value || "").trim();

      if (!id || !name) {
        alert("Completá id y nombre del diseño.");
        return;
      }

      const allowedSizes = sizesRaw
        ? sizesRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => {
              const n = Number(s);
              return Number.isFinite(n) && String(n) === s ? n : s;
            })
        : [];

      let list = [];
      try {
        const raw = designsJsonEl.value.trim();
        list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [];
      }

      list.push({
        id,
        name,
        price,
        productId: productId || "remera-basica",
        allowedSizes,
        imageUrl,
      });

      designsJsonEl.value = JSON.stringify(list, null, 2);
    });
  }

  if (deleteDesignBtn) {
    deleteDesignBtn.addEventListener("click", () => {
      if (!(designsJsonEl instanceof HTMLTextAreaElement)) return;
      const id = String(deleteDesignId?.value || "").trim();
      if (!id) return;

      let list = [];
      try {
        const raw = designsJsonEl.value.trim();
        list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [];
      }

      const next = list.filter((d) => String(d?.id || "") !== id);
      designsJsonEl.value = JSON.stringify(next, null, 2);
      if (deleteDesignId && "value" in deleteDesignId) deleteDesignId.value = "";
    });
  }

  const form = document.getElementById("adminForm");
  const backBtn = document.getElementById("adminBack");
  const resetBtn = document.getElementById("adminReset");

  if (backBtn) backBtn.addEventListener("click", () => navigate("#/"));

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const next = { ...getSettings() };
      delete next.designs;
      delete next.pricing;
      setSettings(next);
      render();
    });
  }

  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);

    let designs = [];
    try {
      const raw = String(fd.get("designsJson") || "").trim();
      designs = JSON.parse(raw);
      if (!Array.isArray(designs)) throw new Error("JSON inválido");
      designs = designs
        .map((d) => {
          if (!d || typeof d !== "object") return null;
          const id = String(d.id || "").trim();
          const name = String(d.name || "").trim();
          const price = Number(d.price) || 0;
          if (!id || !name) return null;
          const productId = typeof d.productId === "string" ? d.productId.trim() : "";
          const imageUrl = typeof d.imageUrl === "string" ? d.imageUrl.trim() : "";
          const allowedSizes = Array.isArray(d.allowedSizes)
            ? d.allowedSizes.filter((s) => s !== null && s !== undefined && String(s).trim().length > 0)
            : [];
          return { id, name, price, productId, allowedSizes, imageUrl };
        })
        .filter(Boolean);
      if (designs.length === 0) throw new Error("Cargá al menos 1 diseño");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo leer el JSON";
      alert(msg);
      return;
    }

    const priceChico = clampNumber(fd.get("priceChico"), 0, 1_000_000);
    const priceMediano = clampNumber(fd.get("priceMediano"), 0, 1_000_000);
    const priceGrande = clampNumber(fd.get("priceGrande"), 0, 1_000_000);
    const priceHat = clampNumber(fd.get("priceHat"), 0, 1_000_000);

    const next = { ...getSettings() };
    next.designs = designs;
    next.pricing = {
      stampSizes: { chico: priceChico, mediano: priceMediano, grande: priceGrande },
      hatStamp: priceHat,
    };
    setSettings(next);

    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-admin-key": key,
        },
        body: JSON.stringify({ designs, pricing: next.pricing }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error ? String(data.error) : "No se pudo publicar.";
        alert(msg);
        return;
      }
      await loadPublishedStore();
    } catch {
      alert("No se pudo publicar. Revisá Vercel KV y las variables de entorno.");
      return;
    }

    navigate("#/");
  });
}

function renderCatalog(query) {
  const itemsHtml = PRODUCTS.map((p) => {
    return `
      <article class="card">
        <div class="thumb" data-label="${escapeHtml(p.type)}">
          ${renderThumbMedia(p)}
        </div>
        <div class="row">
          <div class="pill">Personalizable</div>
          <div class="price">${formatMoney(p.basePrice)}</div>
        </div>
        <h3 class="card-title">${escapeHtml(p.name)}</h3>
        <p class="card-meta">${escapeHtml(p.description)}</p>
        <div class="row">
          <button class="btn btn-outline" data-view="${escapeHtml(p.id)}">Ver</button>
          <button class="btn btn-primary" data-customize="${escapeHtml(p.id)}">Personalizar</button>
        </div>
      </article>
    `;
  }).join("");

  const designs = getDesigns();
  const designsHtml = designs
    .map((d) => {
      const img = typeof d?.imageUrl === "string" ? d.imageUrl.trim() : "";
      const media = img
        ? `<img class="design-card-img" src="${escapeHtml(img)}" alt="${escapeHtml(d.name)}" loading="lazy" />`
        : `<div class="design-card-img placeholder"></div>`;
      const price = designPriceFor(d);
      return `
        <button class="design-card" type="button" data-design-order="${escapeHtml(d.id)}">
          ${media}
          <div class="design-card-name">${escapeHtml(d.name)}</div>
          <div class="design-card-price">${price ? `+${formatMoney(price)}` : ""}</div>
        </button>
      `;
    })
    .join("");

  return `
    <div class="stack">
      <section class="hero">
        <div class="hero-left">
          <h1 class="hero-title">BatyStore</h1>
          <p class="hero-subtitle">
            Remeras, buzos y gorras con estampas personalizadas. Elegís, configurás y confirmás con seña.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#/como-funciona">Cómo funciona</a>
            <a class="btn btn-outline" href="#/carrito">Ver carrito</a>
          </div>
        </div>
        <div class="hero-right">
          <div class="notice">
            <div class="notice-title">Pago por seña</div>
            <p class="notice-text">
              Confirmás tu pedido abonando una seña del ${(CONFIG.depositPercent * 100).toFixed(0)}%.
              Te mostramos el CVU/CBU al finalizar y podés enviar el mensaje por WhatsApp.
            </p>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="row">
          <h2 class="panel-title" style="margin:0">Diseños de la casa</h2>
        </div>
        <p class="panel-subtitle">Elegí un diseño y pasá directo al pedido.</p>
        ${
          designs.length > 0
            ? `<div class="design-carousel" id="homeDesignCarousel">${designsHtml}</div>`
            : `<div class="notice"><div class="notice-title">Próximamente</div><p class="notice-text">Todavía no hay diseños publicados.</p></div>`
        }
      </section>

      <section class="grid">
        ${itemsHtml}
      </section>
    </div>
  `;
}

function attachCatalogHandlers() {
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-view");
      navigate(`#/producto/${id}`);
    });
  });
  document.querySelectorAll("[data-customize]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-customize");
      navigate(`#/producto/${id}`);
    });
  });

  document.querySelectorAll("[data-design-order]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-design-order");
      navigate(`#/diseno/${id}`);
    });
  });
}

function findProduct(productId) {
  return PRODUCTS.find((p) => p.id === productId) || null;
}

function renderDesignOrder(designId) {
  const design = findDesign(designId);
  if (!design) return renderNotFound();

  const productId = typeof design.productId === "string" && design.productId ? design.productId : "remera-basica";
  const product = findProduct(productId);
  if (!product) return renderNotFound();

  const allowed =
    Array.isArray(design.allowedSizes) && design.allowedSizes.length > 0
      ? design.allowedSizes.map((s) => String(s))
      : (product.sizes || []).map((s) => String(s));

  const sizeOptions = allowed
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
    .join("");

  const colors = (product.colors || [])
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join("");

  const img = typeof design.imageUrl === "string" ? design.imageUrl.trim() : "";
  const media = img
    ? `<img class="design-hero-img" src="${escapeHtml(img)}" alt="${escapeHtml(design.name)}" />`
    : `<div class="design-hero-img placeholder"></div>`;

  const extra = designPriceFor(design);
  const estimated = product.basePrice + extra;

  return `
    <div class="two-col">
      <section class="panel">
        <div class="row">
          <button class="btn" type="button" id="backToCatalog">Volver</button>
          <div class="pill">Diseño de la casa</div>
        </div>
        <div class="design-hero">
          ${media}
          <div style="min-width:0">
            <h1 class="panel-title" style="margin:0">${escapeHtml(design.name)}</h1>
            <p class="panel-subtitle">Producto: ${escapeHtml(product.name)}</p>
          </div>
        </div>

        <div class="divider"></div>

        <form id="designOrderForm" class="form" autocomplete="off">
          <input type="hidden" name="designId" value="${escapeHtml(design.id)}" />
          <input type="hidden" name="productId" value="${escapeHtml(product.id)}" />

          <div class="field">
            <label for="size">Talle (según el diseñador)</label>
            <select id="size" name="size" required>${sizeOptions}</select>
          </div>

          <div class="field">
            <label for="color">Color</label>
            <select id="color" name="color" required>${colors}</select>
          </div>

          <div class="field full">
            <label for="notes">Notas</label>
            <textarea id="notes" name="notes" placeholder="Detalles extra..."></textarea>
          </div>

          <div class="field full">
            <div class="row">
              <button class="btn btn-primary" type="submit">Agregar al carrito</button>
              <a class="btn btn-outline" href="#/carrito">Ver carrito</a>
            </div>
          </div>
        </form>
      </section>

      <aside class="panel">
        <h2 class="panel-title">Resumen</h2>
        <p class="panel-subtitle">Incluye el precio del diseño.</p>
        <div class="divider"></div>

        <div class="line">
          <div class="line-title">Producto</div>
          <div class="mono">${formatMoney(product.basePrice)}</div>
        </div>
        <div class="line">
          <div class="line-title">Diseño</div>
          <div class="mono">${extra ? `+${formatMoney(extra)}` : formatMoney(0)}</div>
        </div>
        <div class="line">
          <div>
            <div class="line-title">Total estimado</div>
            <div class="line-sub">Sin envío</div>
          </div>
          <div class="mono">${formatMoney(estimated)}</div>
        </div>

        <div class="notice" style="margin-top:12px">
          <div class="notice-title">Seña para confirmar</div>
          <p class="notice-text">
            ${formatMoney(Math.ceil(estimated * CONFIG.depositPercent))} (${(CONFIG.depositPercent * 100).toFixed(
              0,
            )}%).
          </p>
        </div>
      </aside>
    </div>
  `;
}

function attachDesignOrderHandlers(designId) {
  const design = findDesign(designId);
  if (!design) return;

  const productId = typeof design.productId === "string" && design.productId ? design.productId : "remera-basica";
  const product = findProduct(productId);
  if (!product) return;

  const backBtn = document.getElementById("backToCatalog");
  if (backBtn) backBtn.addEventListener("click", () => navigate("#/"));

  const form = document.getElementById("designOrderForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const size = String(fd.get("size") || "").trim();
    const color = String(fd.get("color") || "").trim();
    const notes = String(fd.get("notes") || "").trim();

    const allowed =
      Array.isArray(design.allowedSizes) && design.allowedSizes.length > 0
        ? design.allowedSizes.map((s) => String(s))
        : (product.sizes || []).map((s) => String(s));
    if (!allowed.includes(size)) {
      alert("El talle seleccionado no está disponible para este diseño.");
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
        notes,
      },
      quantity: 1,
      unitPrice: product.basePrice,
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

  const sizes = (product.sizes || [])
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
    .join("");
  const colors = (product.colors || [])
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join("");
  const placements = (product.placements || [])
    .map(
      (pl) =>
        `<option value="${escapeHtml(pl)}">${escapeHtml(pl)} (+${formatMoney(placementPrice(pl))})</option>`,
    )
    .join("");

  const isRemera = product.type === "Remera";
  const materialOptions = MATERIALS.map(
    (m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)}</option>`,
  ).join("");

  const defaultMaterial = MATERIALS[0];
  const defaultMax = defaultMaterial?.maxSize ?? 6;
  const numericSizes = Array.from({ length: defaultMax }, (_, i) => {
    const v = String(i + 1);
    return `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`;
  }).join("");

  return `
    <div class="two-col">
      <section class="panel">
        <div class="row">
          <div class="pill">Personalizable</div>
          <div class="price">${formatMoney(product.basePrice)}</div>
        </div>
        <div class="thumb" data-label="${escapeHtml(product.type)}">
          ${renderThumbMedia(product)}
        </div>
        <h1 class="panel-title">${escapeHtml(product.name)}</h1>
        <p class="panel-subtitle">${escapeHtml(product.description)}</p>

        <div class="divider"></div>

        <form id="customForm" class="form" autocomplete="off">
          ${
            isRemera
              ? `
          <div class="field">
            <label for="material">Material</label>
            <select id="material" name="material" required>${materialOptions}</select>
          </div>
          `
              : ""
          }

          <div class="field">
            <label for="size">Talle</label>
            <select id="size" name="size" required>${isRemera ? numericSizes : sizes}</select>
          </div>

          <div class="field">
            <label for="color">Color</label>
            <select id="color" name="color" required>${colors}</select>
          </div>

          <div class="field">
            <label for="placement">Ubicación de la estampa</label>
            <select id="placement" name="placement" required>${placements}</select>
          </div>

          <div class="field">
            <label for="style">Tipo</label>
            <select id="style" name="style" required>
              <option value="text">Texto</option>
              <option value="upload">Subir diseño</option>
            </select>
          </div>

          <div class="field full" id="textField">
            <label for="text">Texto</label>
            <input id="text" name="text" placeholder="Ej: BATY" maxlength="24" />
            <div class="hint">Máximo 24 caracteres. La vista previa es referencial.</div>
          </div>

          <div class="field full" id="uploadField" style="display:none">
            <label for="file">Archivo</label>
            <input id="file" name="file" type="file" accept="image/*" />
            <div class="hint">Se sube automáticamente y se envía el link en el pedido.</div>
          </div>

          <div class="field full">
            <label for="notes">Notas</label>
            <textarea id="notes" name="notes" placeholder="Contanos cualquier detalle..."></textarea>
          </div>

          <div class="field full">
            <div class="row">
              <button class="btn" type="button" id="backToCatalog">Volver</button>
              <button class="btn btn-primary" type="submit">Agregar al carrito</button>
            </div>
          </div>
        </form>
      </section>

      <aside class="panel">
        <h2 class="panel-title">Resumen</h2>
        <p class="panel-subtitle">Calculamos el total con la personalización elegida.</p>
        <div class="divider"></div>

        <div class="line">
          <div>
            <div class="line-title">Producto</div>
            <div class="line-sub">${escapeHtml(product.type)}</div>
          </div>
          <div class="mono">${formatMoney(product.basePrice)}</div>
        </div>
        <div class="line">
          <div>
            <div class="line-title">Personalización</div>
            <div class="line-sub" id="placementLabel">—</div>
          </div>
          <div class="mono" id="placementPrice">${formatMoney(0)}</div>
        </div>
        <div class="line">
          <div>
            <div class="line-title">Total estimado</div>
            <div class="line-sub">Sin envío</div>
          </div>
          <div class="mono" id="estimatedTotal">${formatMoney(product.basePrice)}</div>
        </div>

        <div class="notice" style="margin-top:12px">
          <div class="notice-title">Seña para confirmar</div>
          <p class="notice-text" id="depositHint">—</p>
        </div>
      </aside>
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
  const materialSelect = document.getElementById("material");
  const sizeSelect = document.getElementById("size");
  const colorSelect = document.getElementById("color");
  const placementSelect = document.getElementById("placement");
  const styleSelect = document.getElementById("style");
  const textField = document.getElementById("textField");
  const uploadField = document.getElementById("uploadField");
  const placementLabel = document.getElementById("placementLabel");
  const placementPriceEl = document.getElementById("placementPrice");
  const estimatedTotalEl = document.getElementById("estimatedTotal");
  const depositHint = document.getElementById("depositHint");
  const backBtn = document.getElementById("backToCatalog");

  const isRemera = product.type === "Remera";

  function refreshNumericSizes() {
    if (!isRemera) return;
    if (!(materialSelect instanceof HTMLSelectElement)) return;
    if (!(sizeSelect instanceof HTMLSelectElement)) return;

    const materialId = String(materialSelect.value || "").trim();
    const mat = MATERIALS.find((m) => m.id === materialId) || MATERIALS[0];
    const max = mat?.maxSize ?? 6;
    const previous = Number(sizeSelect.value);

    sizeSelect.innerHTML = Array.from({ length: max }, (_, i) => {
      const v = String(i + 1);
      return `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`;
    }).join("");

    if (Number.isFinite(previous) && previous >= 1 && previous <= max) {
      sizeSelect.value = String(previous);
    }
  }

  function refreshPricing() {
    const placement = placementSelect.value;
    const extra = placementPrice(placement);
    const estimated = product.basePrice + extra;
    if (placementLabel) placementLabel.textContent = placement;
    if (placementPriceEl) placementPriceEl.textContent = formatMoney(extra);
    if (estimatedTotalEl) estimatedTotalEl.textContent = formatMoney(estimated);
    if (depositHint) {
      depositHint.textContent = `Seña estimada: ${formatMoney(
        Math.ceil(estimated * CONFIG.depositPercent),
      )} (${(CONFIG.depositPercent * 100).toFixed(0)}%).`;
    }
  }

  function refreshCustomizationMode() {
    const mode = String(styleSelect?.value || "text");
    if (mode === "upload") {
      if (textField) textField.style.display = "none";
      if (uploadField) uploadField.style.display = "";
    } else {
      if (textField) textField.style.display = "";
      if (uploadField) uploadField.style.display = "none";
    }
  }

  if (placementSelect) placementSelect.addEventListener("change", refreshPricing);
  if (styleSelect) styleSelect.addEventListener("change", refreshCustomizationMode);
  if (materialSelect) {
    materialSelect.addEventListener("change", () => {
      refreshNumericSizes();
    });
  }
  if (backBtn) backBtn.addEventListener("click", () => navigate("#/"));

  refreshNumericSizes();
  refreshCustomizationMode();
  refreshPricing();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const submitLabel = submitBtn ? submitBtn.textContent : "";

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Procesando...";
      }

      const fd = new FormData(form);
      const material = String(fd.get("material") || "").trim();
      const size = String(fd.get("size") || "").trim();
      const color = String(fd.get("color") || "").trim();
      const placement = String(fd.get("placement") || "").trim();
      const style = String(fd.get("style") || "text").trim();
      const text = String(fd.get("text") || "").trim();
      const notes = String(fd.get("notes") || "").trim();
      const file = fd.get("file");

      if (isRemera && !material) {
        alert("Elegí el material.");
        return;
      }

      const extras = placementPrice(placement);

      if (style === "upload") {
        if (!(file instanceof File) || !file.name) {
          alert("Elegí un archivo de imagen para subir.");
          return;
        }

        if (submitBtn) submitBtn.textContent = "Subiendo diseño...";

        const uploaded = await uploadDesignToCloudinary(file);
        const customization = {
          type: "upload",
          placement,
          material: isRemera ? material : "",
          fileName: uploaded.fileName || file.name,
          fileUrl: uploaded.url,
          filePublicId: uploaded.publicId,
          notes,
        };

        const cart = getCart();
        cart.push({
          id: makeId("item"),
          productId: product.id,
          productName: product.name,
          variant: { size, color },
          customization,
          quantity: 1,
          unitPrice: product.basePrice,
          extrasPrice: extras,
          createdAt: Date.now(),
        });
        setCart(cart);
        navigate("#/carrito");
        return;
      }

      if (!text) {
        alert("Escribí el texto para la estampa.");
        return;
      }

      const customization = {
        type: "text",
        placement,
        text,
        material: isRemera ? material : "",
        notes,
      };

      const cart = getCart();
      cart.push({
        id: makeId("item"),
        productId: product.id,
        productName: product.name,
        variant: { size, color },
        customization,
        quantity: 1,
        unitPrice: product.basePrice,
        extrasPrice: extras,
        createdAt: Date.now(),
      });
      setCart(cart);
      navigate("#/carrito");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo procesar la acción.";
      alert(msg);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      }
    }
  });
}

function renderCart() {
  const cart = getCart();
  if (cart.length === 0) {
    return `
      <section class="panel">
        <h1 class="panel-title">Carrito</h1>
        <p class="panel-subtitle">Todavía no agregaste productos.</p>
        <div class="row">
          <button class="btn btn-primary" id="goCatalog">Ir al catálogo</button>
        </div>
      </section>
    `;
  }

  const lines = cart
    .map((item) => {
      const sizeLabel = escapeHtml(item.variant?.size || "");
      const colorLabel = escapeHtml(item.variant?.color || "");
      const placementLabel = escapeHtml(item.customization?.placement || "");
      const materialRaw = String(item.customization?.material || "").trim();
      const materialLabel = materialRaw ? ` • ${escapeHtml(materialRaw)}` : "";

      const kind = String(item.customization?.type || "");

      let subLabel = `${sizeLabel} • ${colorLabel}`;
      let customLabel = "";

      if (kind === "house") {
        const name = escapeHtml(item.customization?.designName || "Diseño de la casa");
        const url = String(item.customization?.imageUrl || "").trim();
        customLabel = url
          ? `Diseño: <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${name}</a>`
          : `Diseño: ${name}`;
        subLabel = `${subLabel} • Diseño de la casa`;
      } else if (kind === "upload") {
        const fileUrl = String(item.customization?.fileUrl || "").trim();
        const fileName = escapeHtml(item.customization?.fileName || "archivo");
        customLabel = fileUrl
          ? `Diseño: <a href="${escapeHtml(fileUrl)}" target="_blank" rel="noreferrer">${fileName}</a>`
          : `Diseño: ${fileName}`;
        if (placementLabel) subLabel = `${subLabel}${materialLabel} • ${placementLabel}`;
        else subLabel = `${subLabel}${materialLabel}`;
      } else {
        const text = escapeHtml(item.customization?.text || "");
        customLabel = `Texto: “${text}”`;
        if (placementLabel) subLabel = `${subLabel}${materialLabel} • ${placementLabel}`;
        else subLabel = `${subLabel}${materialLabel}`;
      }

      return `
        <div class="line">
          <div style="min-width:0">
            <div class="line-title">${escapeHtml(item.productName)}</div>
            <div class="line-sub">${subLabel}</div>
            <div class="line-sub">${customLabel}</div>
            ${
              item.customization?.notes
                ? `<div class="line-sub">Notas: ${escapeHtml(item.customization.notes)}</div>`
                : ""
            }
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">
            <div class="mono">${formatMoney(computeItemTotal(item))}</div>
            <div class="row" style="justify-content:flex-end">
              <button class="btn" data-dec="${escapeHtml(item.id)}">-</button>
              <div class="mono">${escapeHtml(item.quantity)}</div>
              <button class="btn" data-inc="${escapeHtml(item.id)}">+</button>
              <button class="btn btn-danger" data-rm="${escapeHtml(item.id)}">Quitar</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  const totals = computeCartTotals(cart, { shippingMethod: "pickup" });

  return `
    <div class="two-col">
      <section class="panel">
        <h1 class="panel-title">Carrito</h1>
        <p class="panel-subtitle">Revisá tu pedido antes de continuar.</p>
        <div class="divider"></div>
        ${lines}
        <div class="divider"></div>
        <div class="row">
          <button class="btn" id="goCatalog">Seguir comprando</button>
          <button class="btn btn-primary" id="goCheckout">Ir al checkout</button>
        </div>
      </section>

      <aside class="panel">
        <h2 class="panel-title">Totales</h2>
        <p class="panel-subtitle">El envío se calcula en el checkout.</p>
        <div class="divider"></div>
        <div class="line">
          <div class="line-title">Subtotal</div>
          <div class="mono">${formatMoney(totals.itemsSubtotal)}</div>
        </div>
        <div class="notice" style="margin-top:12px">
          <div class="notice-title">Seña</div>
          <p class="notice-text">
            Al confirmar, abonás una seña del ${(CONFIG.depositPercent * 100).toFixed(0)}%.
          </p>
        </div>
      </aside>
    </div>
  `;
}

function attachCartHandlers() {
  const cart = getCart();

  const goCatalog = document.getElementById("goCatalog");
  const goCheckout = document.getElementById("goCheckout");
  if (goCatalog) goCatalog.addEventListener("click", () => navigate("#/"));
  if (goCheckout) goCheckout.addEventListener("click", () => navigate("#/checkout"));

  function updateQty(itemId, delta) {
    const next = getCart()
      .map((item) => {
        if (item.id !== itemId) return item;
        const qty = clampNumber(item.quantity + delta, 1, 99);
        return { ...item, quantity: qty };
      });
    setCart(next);
    render();
  }

  function removeItem(itemId) {
    const next = getCart().filter((i) => i.id !== itemId);
    setCart(next);
    render();
  }

  document.querySelectorAll("[data-inc]").forEach((btn) => {
    btn.addEventListener("click", (e) => updateQty(e.currentTarget.getAttribute("data-inc"), 1));
  });
  document.querySelectorAll("[data-dec]").forEach((btn) => {
    btn.addEventListener("click", (e) => updateQty(e.currentTarget.getAttribute("data-dec"), -1));
  });
  document.querySelectorAll("[data-rm]").forEach((btn) => {
    btn.addEventListener("click", (e) => removeItem(e.currentTarget.getAttribute("data-rm")));
  });
}

function renderCheckout() {
  const cart = getCart();
  if (cart.length === 0) {
    return `
      <section class="panel">
        <h1 class="panel-title">Checkout</h1>
        <p class="panel-subtitle">Tu carrito está vacío.</p>
        <div class="row">
          <button class="btn btn-primary" id="goCatalog">Ir al catálogo</button>
        </div>
      </section>
    `;
  }

  const previewTotals = computeCartTotals(cart, { shippingMethod: "pickup" });

  return `
    <div class="two-col">
      <section class="panel">
        <h1 class="panel-title">Checkout</h1>
        <p class="panel-subtitle">Completá tus datos para generar el pedido.</p>
        <div class="divider"></div>

        <form id="checkoutForm" class="form" autocomplete="on">
          <div class="field">
            <label for="name">Nombre y apellido</label>
            <input id="name" name="name" required placeholder="Ej: Camila Pérez" />
          </div>
          <div class="field">
            <label for="whatsapp">WhatsApp</label>
            <input id="whatsapp" name="whatsapp" required placeholder="Ej: 11 2345 6789" />
          </div>

          <div class="field">
            <label for="email">Email (opcional)</label>
            <input id="email" name="email" type="email" placeholder="Ej: hola@correo.com" />
          </div>
          <div class="field">
            <label for="city">Ciudad</label>
            <input id="city" name="city" required placeholder="Ej: CABA" />
          </div>

          <div class="field full">
            <label for="shippingMethod">Entrega</label>
            <select id="shippingMethod" name="shippingMethod" required>
              <option value="pickup">${escapeHtml(CONFIG.shipping.pickupLabel)}</option>
              <option value="delivery">${escapeHtml(CONFIG.shipping.deliveryLabel)} (+${formatMoney(
                CONFIG.shipping.deliveryFlatRate,
              )})</option>
            </select>
          </div>

          <div class="field full" id="addressField" style="display:none">
            <label for="address">Dirección</label>
            <textarea id="address" name="address" placeholder="Calle, número, piso, entre calles..."></textarea>
          </div>

          <div class="field full">
            <label for="notes">Notas para el pedido</label>
            <textarea id="notes" name="notes" placeholder="Horario para retirar/recibir, aclaraciones..."></textarea>
          </div>

          <div class="field full">
            <div class="row">
              <button class="btn" type="button" id="backToCart">Volver al carrito</button>
              <button class="btn btn-primary" type="submit">Generar pedido</button>
            </div>
          </div>
        </form>
      </section>

      <aside class="panel">
        <h2 class="panel-title">Resumen</h2>
        <p class="panel-subtitle">Calculamos el total y la seña.</p>
        <div class="divider"></div>
        <div id="totalsBox">
          <div class="line">
            <div class="line-title">Subtotal</div>
            <div class="mono" id="subtotalVal">${formatMoney(previewTotals.itemsSubtotal)}</div>
          </div>
          <div class="line">
            <div class="line-title">Envío</div>
            <div class="mono" id="shippingVal">${formatMoney(0)}</div>
          </div>
          <div class="line">
            <div>
              <div class="line-title">Total</div>
              <div class="line-sub">Precios en ARS</div>
            </div>
            <div class="mono" id="totalVal">${formatMoney(previewTotals.total)}</div>
          </div>
          <div class="notice" style="margin-top:12px">
            <div class="notice-title">Seña</div>
            <p class="notice-text" id="depositVal">—</p>
          </div>
        </div>
      </aside>
    </div>
  `;
}

function attachCheckoutHandlers() {
  const cart = getCart();
  const goCatalog = document.getElementById("goCatalog");
  if (goCatalog) goCatalog.addEventListener("click", () => navigate("#/"));
  if (cart.length === 0) return;

  const form = document.getElementById("checkoutForm");
  const shippingMethod = document.getElementById("shippingMethod");
  const addressField = document.getElementById("addressField");
  const address = document.getElementById("address");
  const subtotalVal = document.getElementById("subtotalVal");
  const shippingVal = document.getElementById("shippingVal");
  const totalVal = document.getElementById("totalVal");
  const depositVal = document.getElementById("depositVal");
  const backToCart = document.getElementById("backToCart");

  function refreshTotals() {
    const method = shippingMethod.value;
    const totals = computeCartTotals(cart, { shippingMethod: method });
    subtotalVal.textContent = formatMoney(totals.itemsSubtotal);
    shippingVal.textContent = formatMoney(totals.shippingCost);
    totalVal.textContent = formatMoney(totals.total);
    depositVal.textContent = `${formatMoney(totals.deposit)} (${(CONFIG.depositPercent * 100).toFixed(
      0,
    )}%)`;
  }

  function refreshAddress() {
    const method = shippingMethod.value;
    if (method === "delivery") {
      addressField.style.display = "";
      address.required = true;
    } else {
      addressField.style.display = "none";
      address.required = false;
      address.value = "";
    }
  }

  backToCart.addEventListener("click", () => navigate("#/carrito"));
  shippingMethod.addEventListener("change", () => {
    refreshAddress();
    refreshTotals();
  });

  refreshAddress();
  refreshTotals();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const checkout = {
      name: String(fd.get("name") || "").trim(),
      whatsapp: String(fd.get("whatsapp") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      city: String(fd.get("city") || "").trim(),
      shippingMethod: String(fd.get("shippingMethod") || "pickup"),
      address: String(fd.get("address") || "").trim(),
      notes: String(fd.get("notes") || "").trim(),
    };

    if (!checkout.name || !checkout.whatsapp || !checkout.city) {
      alert("Completá nombre, WhatsApp y ciudad.");
      return;
    }

    if (checkout.shippingMethod === "delivery" && !checkout.address) {
      alert("Completá la dirección para el envío.");
      return;
    }

    const totals = computeCartTotals(cart, checkout);
    const orderNumber = String(Date.now()).slice(-6);
    const orderId = makeId("order");
    const order = {
      id: orderId,
      number: orderNumber,
      status: "Esperando seña",
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
    const designName = String(item?.customization?.designName || "-");
    const imageUrl = String(item?.customization?.imageUrl || "").trim();
    const img = imageUrl ? ` | Imagen: ${imageUrl}` : "";
    return `- ${qty}x ${name} (Diseño: ${designName} | Talle: ${talle}${color}${img}${notes})`;
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
  const shippingLabel =
    order?.checkout?.shippingMethod === "delivery"
      ? CONFIG.shipping.deliveryLabel
      : CONFIG.shipping.pickupLabel;

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
    `Total: ${formatMoney(order.totals.total)}`,
    `Seña (${(CONFIG.depositPercent * 100).toFixed(0)}%): ${formatMoney(order.totals.deposit)}`,
    "",
    "Datos para transferencia:",
    `Alias: ${CONFIG.bank.alias}`,
    `CVU/CBU: ${CONFIG.bank.cvuCbu}`,
    `Titular: ${CONFIG.bank.holder}`,
    `CUIT: ${CONFIG.bank.cuit}`,
    "",
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
  const number = normalizeWhatsappNumber(CONFIG.whatsappNumber);
  const text = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${text}`;
}

function renderOrderConfirmation(orderId) {
  const orders = getOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    return `
      <section class="panel">
        <h1 class="panel-title">Pedido</h1>
        <p class="panel-subtitle">No encontramos el pedido.</p>
        <div class="row">
          <button class="btn btn-primary" id="goCatalog">Ir al catálogo</button>
        </div>
      </section>
    `;
  }

  const message = buildPaymentMessage(order);
  const wa = buildWhatsappLink(message);

  return `
    <div class="two-col">
      <section class="panel">
        <h1 class="panel-title">Pedido #${escapeHtml(order.number)}</h1>
        <p class="panel-subtitle">
          Estado: <span class="pill">${escapeHtml(order.status)}</span>
        </p>
        <div class="divider"></div>

        <div class="notice">
          <div class="notice-title">Para confirmar tu pedido</div>
          <p class="notice-text">
            Aboná la seña de <strong>${formatMoney(order.totals.deposit)}</strong> por transferencia.
            Tenés ${escapeHtml(CONFIG.depositHoursLimit)} hs para pagar la seña.
          </p>
        </div>

        <div class="divider"></div>

        <div class="panel">
          <h2 class="panel-title" style="margin-top:0">Datos de transferencia</h2>
          <div class="line">
            <div class="line-title">Alias</div>
            <div class="mono">${escapeHtml(CONFIG.bank.alias)}</div>
          </div>
          <div class="line">
            <div class="line-title">CVU/CBU</div>
            <div class="mono">${escapeHtml(CONFIG.bank.cvuCbu)}</div>
          </div>
          <div class="line">
            <div class="line-title">Titular</div>
            <div class="mono">${escapeHtml(CONFIG.bank.holder)}</div>
          </div>
          <div class="line">
            <div class="line-title">CUIT</div>
            <div class="mono">${escapeHtml(CONFIG.bank.cuit)}</div>
          </div>
          <div class="line">
            <div>
              <div class="line-title">Referencia</div>
              <div class="line-sub">Usá esta referencia para identificar el pago.</div>
            </div>
            <div class="mono">Pedido #${escapeHtml(order.number)} - ${escapeHtml(order.checkout.name)}</div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="row">
          <a class="btn btn-primary" href="${escapeHtml(wa)}" target="_blank" rel="noreferrer">
            Enviar por WhatsApp
          </a>
          <button class="btn btn-outline" id="copyMsg">Copiar mensaje</button>
          <button class="btn" id="goCatalog">Volver al catálogo</button>
        </div>

        <textarea id="paymentMsg" class="mono" style="margin-top:12px" readonly>${escapeHtml(
          message,
        )}</textarea>
      </section>

      <aside class="panel">
        <h2 class="panel-title">Resumen de compra</h2>
        <p class="panel-subtitle">Guardamos tu pedido y esperamos la seña.</p>
        <div class="divider"></div>
        <div class="line">
          <div class="line-title">Subtotal</div>
          <div class="mono">${formatMoney(order.totals.itemsSubtotal)}</div>
        </div>
        <div class="line">
          <div class="line-title">Envío</div>
          <div class="mono">${formatMoney(order.totals.shippingCost)}</div>
        </div>
        <div class="line">
          <div>
            <div class="line-title">Total</div>
            <div class="line-sub">Precios en ARS</div>
          </div>
          <div class="mono">${formatMoney(order.totals.total)}</div>
        </div>
        <div class="notice" style="margin-top:12px">
          <div class="notice-title">Importante</div>
          <p class="notice-text">
            La personalización con archivo se valida antes de producir. Si hace falta, te pedimos una versión mejor.
          </p>
        </div>
      </aside>
    </div>
  `;
}

function attachOrderConfirmationHandlers() {
  const goCatalog = document.getElementById("goCatalog");
  const copyBtn = document.getElementById("copyMsg");
  const msgEl = document.getElementById("paymentMsg");

  if (goCatalog) goCatalog.addEventListener("click", () => navigate("#/"));

  if (copyBtn && msgEl) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(msgEl.value);
        copyBtn.textContent = "Copiado";
        setTimeout(() => {
          copyBtn.textContent = "Copiar mensaje";
        }, 1200);
      } catch {
        msgEl.focus();
        msgEl.select();
        alert("No se pudo copiar automáticamente. Copialo manualmente.");
      }
    });
  }
}

function renderHowItWorks() {
  return `
    <section class="panel">
      <h1 class="panel-title">Cómo funciona</h1>
      <p class="panel-subtitle">Simple: elegís, personalizás y confirmás con seña.</p>
      <div class="divider"></div>
      <div class="stack">
        <div class="notice">
          <div class="notice-title">1) Elegí tu producto</div>
          <p class="notice-text">Remera, buzo o gorra. Elegí talle y color.</p>
        </div>
        <div class="notice">
          <div class="notice-title">2) Personalizalo</div>
          <p class="notice-text">Podés elegir texto o subir tu diseño. La vista previa es referencial.</p>
        </div>
        <div class="notice">
          <div class="notice-title">3) Generá el pedido</div>
          <p class="notice-text">En el checkout te mostramos el total, la seña y los datos para transferir.</p>
        </div>
        <div class="notice">
          <div class="notice-title">4) Pagá la seña</div>
          <p class="notice-text">Con la seña confirmás y pasamos a producción.</p>
        </div>
      </div>
    </section>
  `;
}

function renderPolicies() {
  return `
    <section class="panel">
      <h1 class="panel-title">Políticas</h1>
      <p class="panel-subtitle">Versión MVP. Ajustamos estos textos según tu operación.</p>
      <div class="divider"></div>
      <div class="stack">
        <div class="notice">
          <div class="notice-title">Personalización</div>
          <p class="notice-text">Los productos personalizados se validan antes de producir.</p>
        </div>
        <div class="notice">
          <div class="notice-title">Seña</div>
          <p class="notice-text">
            La seña confirma el pedido. Si no se abona dentro del plazo, el pedido puede cancelarse.
          </p>
        </div>
      </div>
    </section>
  `;
}

function renderNotFound() {
  return `
    <section class="panel">
      <h1 class="panel-title">No encontrado</h1>
      <p class="panel-subtitle">Esa página no existe.</p>
      <div class="row">
        <button class="btn btn-primary" id="goCatalog">Ir al catálogo</button>
      </div>
    </section>
  `;
}

function attachGlobalNotFoundHandler() {
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.id === "goCatalog") navigate("#/");
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

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  loadState();
  attachGlobalNotFoundHandler();
  loadPublishedStore().finally(() => {
    render();
  });
});
