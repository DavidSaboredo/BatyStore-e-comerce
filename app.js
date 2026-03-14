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
  whatsappNumber: "5490000000000",
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

/* ===== Persistencia (localStorage) ===== */
const STORAGE_KEYS = {
  cart: "batystore.cart.v1",
  orders: "batystore.orders.v1",
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

function loadState() {
  state.cart = readCartFromStorage();
  state.orders = readOrdersFromStorage();
  updateCartCount();
}

function getCart() {
  return state.cart;
}

function getOrders() {
  return state.orders;
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
    root.innerHTML = renderCatalog();
    attachCatalogHandlers();
    setupThumbVideos(root);
    return;
  }

  if (parts[0] === "producto" && parts[1]) {
    root.innerHTML = renderProduct(parts[1]);
    attachProductHandlers(parts[1]);
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

  root.innerHTML = renderNotFound();
  setupThumbVideos(root);
}

function renderCatalog() {
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
}

function findProduct(productId) {
  return PRODUCTS.find((p) => p.id === productId) || null;
}

function renderProduct(productId) {
  const product = findProduct(productId);
  if (!product) return renderNotFound();

  const sizes = product.sizes
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
    .join("");
  const colors = product.colors
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join("");
  const placements = product.placements
    .map(
      (pl) =>
        `<option value="${escapeHtml(pl)}">${escapeHtml(pl)} (+${formatMoney(
          placementPrice(pl),
        )})</option>`,
    )
    .join("");

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
          <div class="field">
            <label for="size">Talle</label>
            <select id="size" name="size" required>${sizes}</select>
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
            <div class="hint">Se valida antes de producir. Si no es apto, te pedimos otro.</div>
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

function attachProductHandlers(productId) {
  const product = findProduct(productId);
  if (!product) return;

  const form = document.getElementById("customForm");
  const placementSelect = document.getElementById("placement");
  const styleSelect = document.getElementById("style");
  const textField = document.getElementById("textField");
  const uploadField = document.getElementById("uploadField");
  const placementLabel = document.getElementById("placementLabel");
  const placementPriceEl = document.getElementById("placementPrice");
  const estimatedTotalEl = document.getElementById("estimatedTotal");
  const depositHint = document.getElementById("depositHint");
  const backBtn = document.getElementById("backToCatalog");

  function refreshPricing() {
    const placement = placementSelect.value;
    const extra = placementPrice(placement);
    const estimated = product.basePrice + extra;
    placementLabel.textContent = placement;
    placementPriceEl.textContent = formatMoney(extra);
    estimatedTotalEl.textContent = formatMoney(estimated);
    depositHint.textContent = `Seña estimada: ${formatMoney(
      Math.ceil(estimated * CONFIG.depositPercent),
    )} (${(CONFIG.depositPercent * 100).toFixed(0)}%).`;
  }

  function refreshCustomizationMode() {
    const mode = styleSelect.value;
    if (mode === "upload") {
      textField.style.display = "none";
      uploadField.style.display = "";
    } else {
      textField.style.display = "";
      uploadField.style.display = "none";
    }
  }

  placementSelect.addEventListener("change", refreshPricing);
  styleSelect.addEventListener("change", refreshCustomizationMode);
  backBtn.addEventListener("click", () => navigate("#/"));

  refreshPricing();
  refreshCustomizationMode();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const size = String(fd.get("size") || "");
    const color = String(fd.get("color") || "");
    const placement = String(fd.get("placement") || "");
    const style = String(fd.get("style") || "");
    const text = String(fd.get("text") || "").trim();
    const notes = String(fd.get("notes") || "").trim();
    const file = fd.get("file");

    const extras = placementPrice(placement);
    const customization =
      style === "upload"
        ? {
            type: "upload",
            placement,
            fileName: file && typeof file === "object" && "name" in file ? file.name : "",
            notes,
          }
        : {
            type: "text",
            placement,
            text,
            notes,
          };

    if (customization.type === "text" && customization.text.length === 0) {
      alert("Escribí el texto para la estampa.");
      return;
    }

    if (customization.type === "upload" && (!customization.fileName || customization.fileName.length === 0)) {
      alert("Elegí un archivo de imagen para subir.");
      return;
    }

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
      const customLabel =
        item.customization?.type === "upload"
          ? `Diseño: ${escapeHtml(item.customization.fileName || "archivo")}`
          : `Texto: “${escapeHtml(item.customization?.text || "")}”`;
      const subLabel = `${escapeHtml(item.variant?.size || "")} • ${escapeHtml(
        item.variant?.color || "",
      )} • ${escapeHtml(item.customization?.placement || "")}`;
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

function buildPaymentMessage(order) {
  const lines = [
    `Hola ${CONFIG.storeName}, hice el pedido #${order.number}.`,
    `Monto de seña: ${formatMoney(order.totals.deposit)}.`,
    "",
    "Datos para transferencia:",
    `Alias: ${CONFIG.bank.alias}`,
    `CVU/CBU: ${CONFIG.bank.cvuCbu}`,
    `Titular: ${CONFIG.bank.holder}`,
    `CUIT: ${CONFIG.bank.cuit}`,
    "",
    `Referencia: Pedido #${order.number} - ${order.checkout.name}`,
    "",
    `Te envío el comprobante cuando transfiera.`,
  ];
  return lines.join("\n");
}

function buildWhatsappLink(message) {
  const number = CONFIG.whatsappNumber.replace(/\D/g, "");
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

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  loadState();
  attachGlobalNotFoundHandler();
  render();
});