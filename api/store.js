const DEFAULT_ADMIN_KEY = "batygstore19931";
const DEFAULT_STORE_KEY = "batystore:store:v1";

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
  return await new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
  });
}

function getUpstashConfig() {
  const url =
    getEnv("KV_REST_API_URL") ||
    getEnv("UPSTASH_REDIS_REST_URL") ||
    getEnv("UPSTASH_REDIS_REST_URL");
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
  const adminKey = getEnv("ADMIN_KEY") || DEFAULT_ADMIN_KEY;
  const { url, token } = getUpstashConfig();
  const kvConfigured = Boolean(url && token);

  if (req.method === "GET") {
    try {
      const stored = await upstashGet(storeKey);
      json(res, 200, {
        designs: Array.isArray(stored?.designs) ? stored.designs : [],
        pricing: stored?.pricing && typeof stored.pricing === "object" ? stored.pricing : null,
        updatedAt: typeof stored?.updatedAt === "number" ? stored.updatedAt : null,
        meta: { kvConfigured },
      });
    } catch {
      json(res, 200, { designs: [], pricing: null, updatedAt: null, meta: { kvConfigured } });
    }
    return;
  }

  if (req.method === "POST") {
    const provided = String(req.headers["x-admin-key"] || "");
    if (!adminKey || provided !== adminKey) {
      json(res, 401, { error: "Unauthorized" });
      return;
    }

    let payload = {};
    try {
      const raw = await readBody(req);
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      json(res, 400, { error: "Invalid JSON" });
      return;
    }

    const designs = Array.isArray(payload.designs) ? payload.designs : [];
    const pricing = payload.pricing && typeof payload.pricing === "object" ? payload.pricing : null;

    const clean = {
      designs,
      pricing,
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
