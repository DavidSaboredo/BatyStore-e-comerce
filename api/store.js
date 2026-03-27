const DEFAULT_STORE_KEY = "batystore:store:v1";
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_DESIGNS = 200;

const PRICE_LIMIT = 1_000_000;

function toPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asTrimmedString(value, maxLen = 120) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function asPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0 || num > PRICE_LIMIT) return null;
  return Math.round(num);
}

function sanitizeAllowedSizes(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value.slice(0, 20)) {
    if (typeof item === "number" && Number.isFinite(item)) {
      out.push(Math.round(item));
      continue;
    }
    if (typeof item === "string") {
      const trimmed = item.trim().slice(0, 16);
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

function sanitizeDesign(raw) {
  const obj = toPlainObject(raw);
  if (!obj) return null;

  const id = asTrimmedString(obj.id, 80);
  const name = asTrimmedString(obj.name, 120);
  const productId = asTrimmedString(obj.productId, 80);
  const imageUrl = asTrimmedString(obj.imageUrl, 2048);
  const fixedColor = asTrimmedString(obj.fixedColor, 50);
  const fixedSize = asTrimmedString(obj.fixedSize, 30);
  const materialId = asTrimmedString(obj.materialId, 60);
  const price = asPrice(obj.price);
  const allowedSizes = sanitizeAllowedSizes(obj.allowedSizes);

  if (!id || !name || !productId || price === null) return null;

  return {
    id,
    name,
    price,
    productId,
    allowedSizes,
    imageUrl,
    fixedColor,
    fixedSize,
    materialId,
  };
}

function sanitizeDesigns(rawDesigns) {
  if (!Array.isArray(rawDesigns)) return null;
  if (rawDesigns.length === 0 || rawDesigns.length > MAX_DESIGNS) return null;

  const out = [];
  const ids = new Set();
  for (const raw of rawDesigns) {
    const design = sanitizeDesign(raw);
    if (!design) return null;
    if (ids.has(design.id)) return null;
    ids.add(design.id);
    out.push(design);
  }

  return out;
}

function sanitizePricing(rawPricing) {
  const obj = toPlainObject(rawPricing);
  if (!obj) return null;

  const productBaseRaw = toPlainObject(obj.productBase);
  const stampSizesRaw = toPlainObject(obj.stampSizes);
  const shippingRaw = toPlainObject(obj.shipping);

  if (!productBaseRaw || !stampSizesRaw || !shippingRaw) return null;

  const productBase = {
    remeraPeinado: asPrice(productBaseRaw.remeraPeinado),
    remeraAlgodon100: asPrice(productBaseRaw.remeraAlgodon100),
    buzo: asPrice(productBaseRaw.buzo),
    gorra: asPrice(productBaseRaw.gorra),
  };
  if (Object.values(productBase).some((v) => v === null)) return null;

  const stampSizes = {
    chico: asPrice(stampSizesRaw.chico),
    mediano: asPrice(stampSizesRaw.mediano),
    grande: asPrice(stampSizesRaw.grande),
  };
  if (Object.values(stampSizes).some((v) => v === null)) return null;

  const hatStamp = asPrice(obj.hatStamp);
  if (hatStamp === null) return null;

  const deliveryFlatRate = asPrice(shippingRaw.deliveryFlatRate);
  if (deliveryFlatRate === null) return null;

  const shipping = {
    pickupLabel: asTrimmedString(shippingRaw.pickupLabel, 80),
    deliveryLabel: asTrimmedString(shippingRaw.deliveryLabel, 80),
    deliveryFlatRate,
  };
  if (!shipping.pickupLabel || !shipping.deliveryLabel) return null;

  return {
    productBase,
    stampSizes,
    hatStamp,
    shipping,
  };
}

function sanitizeStorePayload(rawPayload) {
  const obj = toPlainObject(rawPayload);
  if (!obj) return { ok: false, error: "Payload inválido" };

  const designs = sanitizeDesigns(obj.designs);
  if (!designs) return { ok: false, error: "Diseños inválidos" };

  const pricing = sanitizePricing(obj.pricing);
  if (!pricing) return { ok: false, error: "Pricing inválido" };

  return { ok: true, value: { designs, pricing } };
}

function getEnv(name) {
  return process.env[name] ? String(process.env[name]) : "";
}

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        return;
      }
      data += chunk;
    });
    req.on("error", reject);
    req.on("end", () => resolve(data));
  });
}

function getUpstashConfig() {
  const url = getEnv("KV_REST_API_URL") || getEnv("UPSTASH_REDIS_REST_URL");
  const token = getEnv("KV_REST_API_TOKEN") || getEnv("UPSTASH_REDIS_REST_TOKEN");
  return { url, token };
}

async function upstashGet(key) {
  const { url, token } = getUpstashConfig();
  if (!url || !token) return null;

  const res = await fetch(`${url.replace(/\/$/, "")}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Upstash GET failed");
  if (!data || data.result === null || typeof data.result === "undefined") return null;
  try {
    return JSON.parse(String(data.result));
  } catch {
    return null;
  }
}

async function upstashSet(key, value) {
  const { url, token } = getUpstashConfig();
  if (!url || !token) throw new Error("Missing KV env");

  const body = JSON.stringify(value);
  const res = await fetch(`${url.replace(/\/$/, "")}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain; charset=utf-8" },
    body,
  });
  if (!res.ok) throw new Error("Upstash SET failed");
}

module.exports = async (req, res) => {
  const storeKey = getEnv("BATYSTORE_STORE_KEY") || DEFAULT_STORE_KEY;
  const adminKey = getEnv("ADMIN_KEY").trim();
  const { url, token } = getUpstashConfig();
  const kvConfigured = Boolean(url && token);
  const meta = {
    kvConfigured,
    env: {
      hasKV_REST_API_URL: Boolean(getEnv("KV_REST_API_URL")),
      hasKV_REST_API_TOKEN: Boolean(getEnv("KV_REST_API_TOKEN")),
      hasUPSTASH_REDIS_REST_URL: Boolean(getEnv("UPSTASH_REDIS_REST_URL")),
      hasUPSTASH_REDIS_REST_TOKEN: Boolean(getEnv("UPSTASH_REDIS_REST_TOKEN")),
      hasADMIN_KEY: Boolean(getEnv("ADMIN_KEY")),
    },
    storeKey,
  };

  if (req.method === "GET") {
    try {
      const stored = await upstashGet(storeKey);
      const clean = sanitizeStorePayload(stored);
      json(res, 200, {
        designs: clean.ok ? clean.value.designs : [],
        pricing: clean.ok ? clean.value.pricing : null,
        updatedAt: typeof stored?.updatedAt === "number" ? stored.updatedAt : null,
        meta,
      });
    } catch {
      json(res, 200, { designs: [], pricing: null, updatedAt: null, meta });
    }
    return;
  }

  if (req.method === "POST") {
    if (!adminKey) {
      json(res, 500, { error: "ADMIN_KEY not configured" });
      return;
    }

    const provided = String(req.headers["x-admin-key"] || "");
    if (provided !== adminKey) {
      json(res, 401, { error: "Unauthorized" });
      return;
    }

    let payload = {};
    try {
      const raw = await readBody(req);
      payload = raw ? JSON.parse(raw) : {};
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid JSON";
      if (msg === "Payload too large") {
        json(res, 413, { error: "Payload too large" });
        return;
      }
      json(res, 400, { error: "Invalid JSON" });
      return;
    }

    const sanitized = sanitizeStorePayload(payload);
    if (!sanitized.ok) {
      json(res, 400, { error: sanitized.error });
      return;
    }

    const clean = {
      designs: sanitized.value.designs,
      pricing: sanitized.value.pricing,
      updatedAt: Date.now(),
    };

    try {
      if (!kvConfigured) {
        json(res, 500, { error: "KV not configured" });
        return;
      }
      await upstashSet(storeKey, clean);
      json(res, 200, { ok: true });
    } catch {
      json(res, 500, { error: "Store write failed" });
    }
    return;
  }

  json(res, 405, { error: "Method not allowed" });
};
