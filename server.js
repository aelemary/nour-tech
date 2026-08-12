const http = require("http");
const { parse } = require("url");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const PORT = process.env.PORT || 3000;
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12;

const envPath = path.join(ROOT_DIR, ".env");
if (fsSync.existsSync(envPath)) {
  const envRaw = fsSync.readFileSync(envPath, "utf8");
  envRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const eqIndex = line.indexOf("=");
      if (eqIndex === -1) return;
      const key = line.slice(0, eqIndex).trim();
      const value = line.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "";
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables.");
  process.exit(1);
}
const SUPABASE_REST_URL = `${SUPABASE_URL}/rest/v1`;
const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL || "";
const OLD_SUPABASE_KEY = process.env.OLD_SUPABASE_SERVICE_KEY || "";
const OLD_SUPABASE_REST_URL = OLD_SUPABASE_URL ? `${OLD_SUPABASE_URL}/rest/v1` : "";
const SESSION_SECRET = process.env.SESSION_SECRET || SUPABASE_KEY;
const ICECAT_API_URL = process.env.ICECAT_API_URL || "https://live.icecat.biz/api";
const ICECAT_API_TOKEN = process.env.ICECAT_API_TOKEN || process.env.OPEN_ICECAT_API_TOKEN || "";
const ICECAT_CONTENT_TOKEN = process.env.ICECAT_CONTENT_TOKEN || "";
const ICECAT_SHOPNAME =
  process.env.ICECAT_SHOPNAME || process.env.ICECAT_USERNAME || "openIcecat-live";
const ICECAT_LANG = process.env.ICECAT_LANG || "EN";
const ICECAT_CONTENT_QUERY = process.env.ICECAT_CONTENT_QUERY ?? "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const ORDER_EMAIL_FROM = process.env.ORDER_EMAIL_FROM || "Nour Tech <orders@nourtecheg.com>";
const ORDER_EMAIL_REPLY_TO = process.env.ORDER_EMAIL_REPLY_TO || "nourelemary28@gmail.com";
const SITE_URL = "https://nourtecheg.com";

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_.-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function sendJSON(res, status, payload, extraHeaders = {}, req = null) {
  const origin = req?.headers?.origin;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extraHeaders,
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, contentType = "text/plain") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
  });
  res.end(text);
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function serveSitemap(res) {
  const pages = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/category.html?type=laptop", changefreq: "daily", priority: "0.9" },
    { path: "/category.html?type=gpu", changefreq: "daily", priority: "0.9" },
    { path: "/contact.html", changefreq: "monthly", priority: "0.5" },
  ];
  const products = await sb("products", { params: { select: "id,created_at" } });
  (products || []).forEach((product) => {
    if (!product?.id) return;
    pages.push({
      path: `/laptop.html?id=${encodeURIComponent(product.id)}`,
      lastmod: product.created_at,
      changefreq: "weekly",
      priority: "0.8",
    });
  });
  const entries = pages
    .map((page) => {
      const lastmod = page.lastmod && !Number.isNaN(Date.parse(page.lastmod))
        ? `<lastmod>${new Date(page.lastmod).toISOString().slice(0, 10)}</lastmod>`
        : "";
      return `<url><loc>${escapeXml(`${SITE_URL}${page.path}`)}</loc>${lastmod}<changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>`;
    })
    .join("");
  sendText(res, 200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`, "application/xml; charset=utf-8");
}

function parseCookies(header = "") {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eqIndex = part.indexOf("=");
      if (eqIndex === -1) return acc;
      const key = part.slice(0, eqIndex);
      const value = part.slice(eqIndex + 1);
      try {
        acc[key] = decodeURIComponent(value);
      } catch (error) {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  cookie += `; Path=${options.path || "/"}`;
  if (options.maxAge != null) cookie += `; Max-Age=${options.maxAge}`;
  if (options.httpOnly) cookie += "; HttpOnly";
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
  if (options.secure) cookie += "; Secure";
  return cookie;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function signSession(payload) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${header}.${body}.${signature}`;
}

function parseSessionToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  if (signature !== expected) return null;
  let payload = null;
  try {
    payload = JSON.parse(base64UrlDecode(body));
  } catch (error) {
    return null;
  }
  if (!payload || !payload.exp || Number(payload.exp) * 1000 < Date.now()) {
    return null;
  }
  return payload;
}

function createSession(user) {
  const now = Math.floor(Date.now() / 1000);
  return signSession({
    sub: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName || "",
    iat: now,
    exp: now + Math.floor(SESSION_MAX_AGE_MS / 1000),
  });
}

function destroySession() {
  // Stateless sessions are cleared by expiring the cookie on the client.
}

function destroySessionsForUser() {
  // Stateless sessions cannot be revoked server-side without a backing store.
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatOrderCurrency(value) {
  if (value == null || !Number.isFinite(Number(value))) return "Price on request";
  return `EGP ${new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(Number(value))}`;
}

function formatOrderReference(orderId) {
  return orderId ? `NT-${String(orderId).slice(-8).toUpperCase()}` : "Nour Tech order";
}

function orderConfirmationHtml(order) {
  const orderItems = Array.isArray(order?.items) ? order.items : [];
  const total = orderItems.reduce((sum, item) => {
    const unitPrice = Number(item.unitPrice);
    return Number.isFinite(unitPrice) ? sum + unitPrice * Math.max(1, Number(item.quantity) || 1) : sum;
  }, 0);
  const rows = orderItems
    .map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = item.unitPrice;
      const itemTitle = item.product?.shortName || item.product?.title || "Nour Tech item";
      return `<tr>
        <td style="padding:14px 0;border-bottom:1px solid #dce7ef;color:#163a5c;font-weight:700;line-height:1.45;">${escapeHtml(itemTitle)}</td>
        <td style="padding:14px 0 14px 14px;border-bottom:1px solid #dce7ef;color:#5d738a;text-align:center;white-space:nowrap;">${quantity}</td>
        <td style="padding:14px 0 14px 14px;border-bottom:1px solid #dce7ef;color:#163a5c;font-weight:700;text-align:right;white-space:nowrap;">${escapeHtml(formatOrderCurrency(Number(unitPrice) * quantity))}</td>
      </tr>`;
    })
    .join("");
  const details = [
    ["Delivery address", order.address],
    ["Phone / WhatsApp", order.phone],
    ["Order notes", order.notes],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<p style="margin:0 0 8px;color:#526f89;line-height:1.55;"><strong style="color:#163a5c;">${label}:</strong> ${escapeHtml(value)}</p>`)
    .join("");

  return `<!doctype html>
  <html lang="en"><body style="margin:0;background:#f3f7fb;font-family:Arial,Helvetica,sans-serif;color:#163a5c;">
    <div style="max-width:680px;margin:0 auto;padding:30px 16px;">
      <div style="overflow:hidden;border-radius:20px;background:#ffffff;box-shadow:0 12px 32px rgba(20,58,92,.12);">
        <div style="padding:30px 34px;background:linear-gradient(135deg,#092a46,#155689);color:#ffffff;">
          <div style="font-size:13px;font-weight:800;letter-spacing:1.5px;color:#77d0f2;">NOUR TECH</div>
          <h1 style="margin:12px 0 8px;font-size:27px;line-height:1.2;">We received your order.</h1>
          <p style="margin:0;color:#d7eafa;font-size:15px;line-height:1.6;">Thanks for choosing Nour Tech. Our team is now reviewing your request.</p>
        </div>
        <div style="padding:30px 34px;">
          <div style="padding:16px 18px;border-radius:12px;background:#eaf6fb;margin-bottom:26px;">
            <div style="font-size:12px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#44708c;">Order reference</div>
            <div style="margin-top:4px;font-size:20px;font-weight:800;color:#126fc2;">${formatOrderReference(order.id)}</div>
          </div>
          <p style="margin:0 0 20px;color:#526f89;line-height:1.6;">Hi ${escapeHtml(order.customerName)}, we’ll confirm stock, delivery, and payment details within <strong style="color:#163a5c;">12 working hours</strong>.</p>
          <h2 style="margin:0 0 8px;font-size:18px;color:#163a5c;">Your order</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">
            <thead><tr><th align="left" style="padding:9px 0;color:#6a8095;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Item</th><th style="padding:9px 0 9px 14px;color:#6a8095;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Qty</th><th align="right" style="padding:9px 0 9px 14px;color:#6a8095;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Total</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="display:flex;justify-content:space-between;padding:18px 0 24px;font-size:18px;"><strong>Order total</strong><strong style="color:#126fc2;">${formatOrderCurrency(total)}</strong></div>
          <div style="padding:20px;border-radius:12px;background:#f7f9fb;">${details}</div>
        </div>
        <div style="padding:20px 34px;background:#f7f9fb;border-top:1px solid #dce7ef;color:#60788f;font-size:13px;line-height:1.55;">Need help with your order? Reply to this email or contact Nour Tech at <a href="mailto:${escapeHtml(ORDER_EMAIL_REPLY_TO)}" style="color:#126fc2;">${escapeHtml(ORDER_EMAIL_REPLY_TO)}</a>.</div>
      </div>
    </div>
  </body></html>`;
}

async function sendOrderConfirmationEmail(order) {
  if (!RESEND_API_KEY) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ORDER_EMAIL_FROM,
      to: [order.email],
      reply_to: ORDER_EMAIL_REPLY_TO,
      subject: `Order received — ${formatOrderReference(order.id)}`,
      html: orderConfirmationHtml(order),
    }),
  });
  if (!response.ok) {
    throw new Error(`Confirmation email failed: ${await response.text()}`);
  }
  return true;
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error("Payload too large"));
        req.connection.destroy();
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", (error) => reject(error));
  });
}

async function sb(pathname, { method = "GET", params = {}, headers = {}, body } = {}) {
  const url = new URL(`${SUPABASE_REST_URL}/${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });
  const response = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(text || `Supabase request failed with status ${response.status}`);
    err.status = response.status;
    throw err;
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!text) return null;
  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }
  return text;
}

async function sbOld(pathname, { params = {} } = {}) {
  if (!OLD_SUPABASE_REST_URL || !OLD_SUPABASE_KEY) {
    throw new Error("Old Supabase contact source is not configured.");
  }
  const url = new URL(`${OLD_SUPABASE_REST_URL}/${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.append(key, value);
  });
  const response = await fetch(url, {
    headers: {
      apikey: OLD_SUPABASE_KEY,
      Authorization: `Bearer ${OLD_SUPABASE_KEY}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || `Old Supabase request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function storeImage(finalName, base64Payload, mime) {
  if (!SUPABASE_STORAGE_BUCKET) {
    throw new Error("SUPABASE_STORAGE_BUCKET is not configured.");
  }
  const buffer = Buffer.from(base64Payload, "base64");
  const target = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(
    SUPABASE_STORAGE_BUCKET
  )}/${finalName}`;
  const response = await fetch(target, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": mime || "application/octet-stream",
      "x-upsert": "true",
    },
    body: buffer,
  });
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(text || "Failed to upload image to Supabase Storage");
    err.status = response.status;
    throw err;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${finalName}`;
}

function extractStoragePath(url) {
  if (!SUPABASE_STORAGE_BUCKET || !url) return null;
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}

async function deleteStoredImage(url) {
  if (!SUPABASE_STORAGE_BUCKET) {
    if (url && url.startsWith("/uploads/")) {
      const relative = url.replace(/^\/?uploads\//, "");
      try {
        await fs.unlink(path.join(UPLOAD_DIR, relative));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    return;
  }
  const objectPath = extractStoragePath(url);
  if (!objectPath) return;
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_STORAGE_BUCKET)}/${objectPath}`,
    {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    const err = new Error(text || "Failed to delete image from Supabase Storage");
    err.status = response.status;
    throw err;
  }
}

function mapCompany(record) {
  if (!record) return null;
  return {
    id: record.id,
    name: record.name,
    description: record.description || "",
  };
}

const PRODUCT_TYPE_ALIASES = {
  laptops: "laptop",
  gpus: "gpu",
  cpus: "cpu",
  hdds: "hdd",
  motherboards: "motherboard",
  rams: "ram",
  printers: "printer",
};
const LEGACY_SPEC_KEYS = ["gpu", "cpu", "ram", "storage", "display"];

function normalizeProductType(value = "") {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (!raw) return "";
  return PRODUCT_TYPE_ALIASES[raw] || raw;
}

function normalizeSpecsRaw(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof value === "object") return value;
  return null;
}

function humanizeSpecKey(value = "") {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSpecPrimitive(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function pickIcecatValue(value, depth = 0) {
  if (depth > 4) return "";
  const primitive = normalizeSpecPrimitive(value);
  if (primitive) return primitive;
  if (Array.isArray(value)) {
    const list = value
      .map((item) => pickIcecatValue(item, depth + 1))
      .filter(Boolean)
      .slice(0, 8);
    return list.join(", ");
  }
  if (!value || typeof value !== "object") return "";
  const priorityKeys = [
    "Presentation_Value",
    "PresentationValue",
    "LocalValue",
    "Value",
    "value",
    "DisplayValue",
    "Name",
    "Label",
    "Text",
    "text",
  ];
  for (const key of priorityKeys) {
    if (value[key] !== undefined) {
      const picked = pickIcecatValue(value[key], depth + 1);
      if (picked) return picked;
    }
  }
  for (const nested of Object.values(value)) {
    const picked = pickIcecatValue(nested, depth + 1);
    if (picked) return picked;
  }
  return "";
}

function addFlatSpec(out, key, value) {
  const cleanKey = humanizeSpecKey(key);
  const cleanValue = normalizeSpecPrimitive(value);
  if (!cleanKey || !cleanValue) return;
  if (out[cleanKey]) {
    if (!out[cleanKey].includes(cleanValue)) {
      out[cleanKey] += ` | ${cleanValue}`;
    }
    return;
  }
  out[cleanKey] = cleanValue;
}

function flattenIcecatSpecs(node, out = {}, context = { count: 0 }, trail = [], depth = 0) {
  if (context.count >= 450 || depth > 8 || node == null) return out;
  const primitive = normalizeSpecPrimitive(node);
  if (primitive) {
    addFlatSpec(out, trail.join(" / "), primitive);
    context.count += 1;
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => flattenIcecatSpecs(item, out, context, trail, depth + 1));
    return out;
  }
  if (typeof node !== "object") return out;

  const nameCandidate =
    pickIcecatValue(node.Name) ||
    pickIcecatValue(node.Feature) ||
    pickIcecatValue(node.FeatureName) ||
    pickIcecatValue(node.Label);
  const valueCandidate =
    pickIcecatValue(node.Presentation_Value) ||
    pickIcecatValue(node.PresentationValue) ||
    pickIcecatValue(node.Value) ||
    pickIcecatValue(node.LocalValue) ||
    pickIcecatValue(node.DisplayValue);
  if (nameCandidate && valueCandidate) {
    addFlatSpec(out, nameCandidate, valueCandidate);
    context.count += 1;
  }

  Object.entries(node).forEach(([key, value]) => {
    if (context.count >= 450) return;
    const nextTrail = trail.concat([humanizeSpecKey(key)]);
    flattenIcecatSpecs(value, out, context, nextTrail, depth + 1);
  });
  return out;
}

function parseManualSpecsString(input = "") {
  const raw = String(input || "").trim();
  if (!raw) return {};
  const segments = raw
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const output = {};
  for (const segment of segments) {
    const colonIndex = segment.indexOf(":");
    if (colonIndex === -1) {
      throw new Error(`Invalid manual specs segment "${segment}". Use "Key: Value".`);
    }
    const key = segment.slice(0, colonIndex).trim();
    const value = segment.slice(colonIndex + 1).trim();
    if (!key || !value) {
      throw new Error(`Invalid manual specs segment "${segment}". Use "Key: Value".`);
    }
    output[key] = value;
  }
  return output;
}

async function fetchIcecatSpecs(icecatId, lang = ICECAT_LANG) {
  const normalizedId = String(icecatId || "").trim();
  if (!normalizedId) {
    const error = new Error("Icecat product ID is required.");
    error.status = 400;
    throw error;
  }
  if (!ICECAT_API_TOKEN) {
    const error = new Error("Missing ICECAT_API_TOKEN in environment variables.");
    error.status = 400;
    throw error;
  }

  const url = new URL(ICECAT_API_URL);
  url.searchParams.set("lang", lang || ICECAT_LANG);
  url.searchParams.set("shopname", ICECAT_SHOPNAME);
  url.searchParams.set("username", ICECAT_SHOPNAME);
  url.searchParams.set("icecat_id", normalizedId);
  // Keep `content` present to match Icecat JSON request docs (can be empty).
  url.searchParams.set("content", ICECAT_CONTENT_QUERY);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "api-token": ICECAT_API_TOKEN,
      ...(ICECAT_CONTENT_TOKEN
        ? { "content-token": ICECAT_CONTENT_TOKEN, content_token: ICECAT_CONTENT_TOKEN }
        : {}),
    },
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(
      payload?.msg || text || `Icecat request failed with status ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  if (payload?.msg && String(payload.msg).toLowerCase() !== "ok") {
    const error = new Error(payload.msg);
    error.status = 400;
    throw error;
  }

  const dataRoot = payload?.data || payload || {};
  const data =
    dataRoot?.Product ||
    dataRoot?.product ||
    dataRoot?.Data ||
    dataRoot?.data ||
    dataRoot ||
    {};
  const general =
    data?.GeneralInfo || data?.generalInfo || data?.General || data?.general || {};
  const flattened =
    flattenIcecatSpecs(
      data?.FeaturesGroups ||
        data?.FeatureGroups ||
        data?.featureGroups ||
        data?.Features ||
        data?.features ||
        []
    ) || {};
  const fallbackSpecs = Object.keys(flattened).length
    ? flattened
    : flattenIcecatSpecs(general || data || {}) || {};
  const mapped = {
    id: String(general.IcecatId || normalizedId),
    lang: lang || ICECAT_LANG,
    shopname: ICECAT_SHOPNAME,
    title: pickIcecatValue(data?.Title) || pickIcecatValue(general?.Title) || "",
    brand: pickIcecatValue(general?.Brand) || "",
    category: pickIcecatValue(general?.Category) || "",
    productCode:
      pickIcecatValue(general?.BrandPartCode) || pickIcecatValue(general?.ProductCode) || "",
    summary:
      pickIcecatValue(data?.SummaryDescription) || pickIcecatValue(data?.MarketingText) || "",
    syncedAt: new Date().toISOString(),
    specs: fallbackSpecs,
  };
  if (typeof data === "string" && data.trim()) {
    mapped.raw = data;
  }
  const hasUsefulContent =
    !!mapped.title ||
    !!mapped.brand ||
    !!mapped.category ||
    !!mapped.summary ||
    Object.keys(mapped.specs || {}).length > 0 ||
    !!mapped.raw;
  if (!hasUsefulContent) {
    const error = new Error("Icecat returned no usable specs for this product ID.");
    error.status = 404;
    throw error;
  }
  return mapped;
}

function mergeProductSpecs(baseSpecs, body, options = {}) {
  const parsedBase = normalizeSpecsRaw(baseSpecs);
  const nextBase =
    parsedBase && typeof parsedBase === "object" && !Array.isArray(parsedBase)
      ? { ...parsedBase }
      : {};
  let next = mergeLegacySpecs(nextBase, body);
  const { manualSpecified, manualSpecs, icecatSpecified, icecatSpecs } = options;

  if (manualSpecified) {
    if (manualSpecs && Object.keys(manualSpecs).length) {
      next.manual = manualSpecs;
    } else {
      delete next.manual;
    }
  }

  if (icecatSpecified) {
    if (icecatSpecs && icecatSpecs.id) {
      next.icecat = icecatSpecs;
    } else {
      delete next.icecat;
    }
  }

  if (!next || typeof next !== "object" || Array.isArray(next)) {
    next = {};
  }
  return next;
}

function mergeLegacySpecs(specsRaw, body) {
  const hasLegacyInput = LEGACY_SPEC_KEYS.some((key) => body?.[key] !== undefined);
  if (!hasLegacyInput) return specsRaw;
  const next =
    specsRaw && typeof specsRaw === "object" && !Array.isArray(specsRaw) ? { ...specsRaw } : {};
  LEGACY_SPEC_KEYS.forEach((key) => {
    if (body[key] === undefined) return;
    const value = String(body[key] || "").trim();
    if (!value) {
      delete next[key];
      return;
    }
    next[key] = value;
  });
  return next;
}

function findSpecValue(specsRaw, candidates) {
  if (specsRaw == null) return "";
  if (typeof specsRaw !== "object") return "";
  const directCandidates = new Set(candidates.map((candidate) => candidate.toLowerCase()));
  const queue = [specsRaw];
  while (queue.length) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      current.forEach((item) => queue.push(item));
      continue;
    }
    if (!current || typeof current !== "object") continue;
    for (const [key, value] of Object.entries(current)) {
      const keyLower = key.toLowerCase();
      if (value && typeof value === "object") {
        queue.push(value);
      }
      if (!directCandidates.has(keyLower)) continue;
      if (typeof value === "string" || typeof value === "number") return String(value);
    }
  }
  return "";
}

function extractLegacySpecs(specsRaw) {
  return {
    gpu: findSpecValue(specsRaw, ["gpu", "graphics", "graphics_card", "graphics-card"]),
    cpu: findSpecValue(specsRaw, ["cpu", "processor"]),
    ram: findSpecValue(specsRaw, ["ram", "memory"]),
    storage: findSpecValue(specsRaw, ["storage", "ssd", "hdd"]),
    display: findSpecValue(specsRaw, ["display", "screen", "panel"]),
  };
}

function mapProduct(record, type) {
  if (!record) return null;
  const company = record.brands ? mapCompany(record.brands) : null;
  const normalizedType = normalizeProductType(type || record.type);
  const specsRaw = normalizeSpecsRaw(record.specs_raw);
  const legacySpecs = extractLegacySpecs(specsRaw);
  const product = {
    id: record.id,
    type: normalizedType || type,
    companyId: record.brand_id,
    shortName: record.short_name || "",
    title: record.title,
    price: record.price == null ? null : Number(record.price),
    currency: "EGP",
    description: record.description || "",
    images: Array.isArray(record.images) ? record.images : record.images ? [record.images] : [],
    warranty: record.warranty != null ? Number(record.warranty) : 0,
    specsRaw,
    icecatId:
      specsRaw && typeof specsRaw === "object" && !Array.isArray(specsRaw)
        ? String(specsRaw?.icecat?.id || "")
        : "",
    company,
  };
  product.gpu = legacySpecs.gpu || "";
  product.cpu = legacySpecs.cpu || "";
  product.ram = legacySpecs.ram || "";
  product.storage = legacySpecs.storage || "";
  product.display = legacySpecs.display || "";
  return product;
}

function mapUser(record) {
  if (!record) return null;
  return {
    id: record.id,
    username: record.username,
    fullName: record.full_name || "",
    role: record.admin ? "admin" : "customer",
  };
}

function mapOrder(record, hydratedItems = []) {
  if (!record) return null;
  return {
    id: record.id,
    userId: record.user_id,
    customerName: record.customer_name,
    phone: record.phone || "",
    email: record.email || "",
    address: record.delivery_address,
    status: record.status,
    notes: record.notes || "",
    createdAt: record.created_at,
    items: hydratedItems,
  };
}

function filterProducts(products, filters) {
  const normalizedCategory = normalizeProductType(filters.category || filters.type || "");
  return products.filter((product) => {
    const search = filters.search?.toLowerCase() || "";
    const companyName = product.company?.name || "";
    const specsText = product.specsRaw ? JSON.stringify(product.specsRaw).toLowerCase() : "";
    const matchesSearch =
      !search ||
      product.title.toLowerCase().includes(search) ||
      (product.shortName || "").toLowerCase().includes(search) ||
      (product.description || "").toLowerCase().includes(search) ||
      companyName.toLowerCase().includes(search) ||
      (product.type || "").toLowerCase().includes(search) ||
      (product.gpu || "").toLowerCase().includes(search) ||
      (product.cpu || "").toLowerCase().includes(search) ||
      (product.ram || "").toLowerCase().includes(search) ||
      (product.storage || "").toLowerCase().includes(search) ||
      (product.display || "").toLowerCase().includes(search) ||
      specsText.includes(search);
    const matchesCompany = !filters.companyId || product.companyId === filters.companyId;
    const matchesCategory = !normalizedCategory || product.type === normalizedCategory;
    const matchesIds =
      !filters.ids || (Array.isArray(filters.ids) && filters.ids.includes(product.id));
    return matchesSearch && matchesCompany && matchesCategory && matchesIds;
  });
}

async function handleAuthMe(session, reply) {
  if (!session) {
    reply(200, { authenticated: false });
    return;
  }
  const data = await sb("users", {
    params: { select: "id,username,full_name,admin", id: `eq.${session.userId}` },
  });
  const record = data?.[0];
  if (!record) {
    destroySession(session.token);
    reply(200, { authenticated: false });
    return;
  }
  const user = mapUser(record);
  reply(200, { authenticated: true, user });
}

async function fetchContact() {
  const data = OLD_SUPABASE_REST_URL && OLD_SUPABASE_KEY
    ? await sbOld("contact", { params: { select: "*", id: "eq.1" } })
    : await sb("contact", { params: { select: "*", id: "eq.1" } });
  return data?.[0] || {
    sales_hotline: "01034898787",
    whatsapp: "01034898787",
    support_email: "nourelemary28@gmail.com",
    address: "القاهرة",
    availability: [],
  };
}

async function fetchProducts({ ids = [], category = "", companyId = "" } = {}) {
  const normalizedCategory = normalizeProductType(category);
  const params = {
    select:
      "id,type,brand_id,title,short_name,price,description,images,warranty,specs_raw,created_at,brands(*)",
    order: "title.asc",
  };
  if (ids.length) {
    params.id = `in.(${ids.join(",")})`;
  }
  if (normalizedCategory) {
    params.type = `eq.${normalizedCategory}`;
  }
  if (companyId) {
    params.brand_id = `eq.${companyId}`;
  }
  const records = await sb("products", { params });
  return (records || []).map((record) => mapProduct(record, record.type)).filter(Boolean);
}

async function hydrateOrders(records = []) {
  const orderItems = records.flatMap((order) =>
    Array.isArray(order.order_items) ? order.order_items : []
  );
  const productIds = Array.from(
    new Set(orderItems.map((item) => item.product_id).filter(Boolean))
  );
  const products = productIds.length ? await fetchProducts({ ids: productIds }) : [];
  const productMap = new Map(products.map((product) => [product.id, product]));
  return records.map((order) => {
    const items = (order.order_items || []).map((item) => ({
      productId: item.product_id,
      quantity: item.quantity || 1,
      unitPrice:
        item.unit_price == null ? productMap.get(item.product_id)?.price ?? null : Number(item.unit_price),
      product: productMap.get(item.product_id) || null,
    }));
    return mapOrder(order, items);
  });
}

function requireAuth(req, res, session, { admin = false } = {}) {
  if (!session) {
    sendJSON(res, 401, { error: "Unauthorized" }, {}, req);
    return false;
  }
  if (admin && session.role !== "admin") {
    sendJSON(res, 403, { error: "Forbidden" }, {}, req);
    return false;
  }
  return true;
}

async function handleApi(req, res, pathname, searchParams) {
  const method = req.method;
  const segments = pathname.split("/").filter(Boolean);
  const resource = segments[1] || "";
  const slug = segments[2] || "";
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionId = cookies.sessionId;
  const sessionPayload = parseSessionToken(sessionId);
  const session = sessionPayload
    ? {
        userId: sessionPayload.sub,
        username: sessionPayload.username,
        role: sessionPayload.role,
        fullName: sessionPayload.fullName,
        token: sessionId,
      }
    : null;

  const reply = (status, payload, headers = {}) => sendJSON(res, status, payload, headers, req);

  try {
    if (method === "OPTIONS") {
      reply(204, {});
      return;
    }
    switch (resource) {
      case "auth": {
        const action = slug || "";
        if (action === "signup" && method === "POST") {
          const body = await parseBody(req);
          if (!body || !body.username || !body.password) {
            reply(400, { error: "Missing username or password" });
            return;
          }
          const username = String(body.username).trim().toLowerCase();
          const existing = await sb("users", {
            params: { select: "id", username: `eq.${username}` },
          });
          if (existing.length) {
            reply(409, { error: "Username already exists" });
            return;
          }
          const payload = {
            username,
            is_registered: true,
            admin: false,
            hashed_password: hashPassword(body.password),
            full_name: body.fullName || "",
          };
          const created = await sb("users", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: payload,
          });
          const record = created?.[0];
          const user = mapUser(record);
          const token = createSession(user);
          const cookie = serializeCookie("sessionId", token, {
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
          });
          reply(201, user, { "Set-Cookie": cookie });
          return;
        }
        if (action === "login" && method === "POST") {
          const body = await parseBody(req);
          if (!body || !body.username || !body.password) {
            reply(400, { error: "Missing username or password" });
            return;
          }
          const username = String(body.username).trim().toLowerCase();
          const users = await sb("users", {
            params: { select: "id,username,full_name,admin,hashed_password", username: `eq.${username}` },
          });
          const record = users?.[0];
          if (!record || hashPassword(body.password) !== record.hashed_password) {
            reply(401, { error: "Invalid username or password" });
            return;
          }
          const user = mapUser(record);
          const token = createSession(user);
          const cookie = serializeCookie("sessionId", token, {
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
          });
          reply(200, user, { "Set-Cookie": cookie });
          return;
        }
        if (action === "logout" && method === "POST") {
          const cookie = serializeCookie("sessionId", "", {
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            maxAge: 0,
          });
          if (session?.token) destroySession(session.token);
          reply(200, { success: true }, { "Set-Cookie": cookie });
          return;
        }
        if (action === "me" && method === "GET") {
          await handleAuthMe(session, reply);
          return;
        }
        break;
      }
      case "companies": {
        if (method === "GET") {
          const brands = await sb("brands", { params: { select: "*", order: "name.asc" } });
          reply(200, brands.map(mapCompany));
          return;
        }
        if (method === "POST") {
          if (!requireAuth(req, res, session, { admin: true })) return;
          const body = await parseBody(req);
          if (!body || !body.name) {
            reply(400, { error: "Missing company name" });
            return;
          }
          const created = await sb("brands", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: { name: body.name, description: body.description || "" },
          });
          reply(201, mapCompany(created?.[0]));
          return;
        }
        if (method === "DELETE" && slug) {
          if (!requireAuth(req, res, session, { admin: true })) return;
          const removedProductIds = new Set();
          const removedImages = [];
          const rows = await sb("products", {
            params: { select: "id,images", brand_id: `eq.${slug}` },
          });
          (rows || []).forEach((row) => {
            if (row.id) removedProductIds.add(row.id);
            if (row.images) {
              const images = Array.isArray(row.images) ? row.images : [row.images];
              images.filter(Boolean).forEach((image) => removedImages.push(image));
            }
          });
          if (removedProductIds.size) {
            await sb("products", {
              method: "DELETE",
              params: { id: `in.(${Array.from(removedProductIds).join(",")})` },
            });
          }
          await sb("brands", { method: "DELETE", params: { id: `eq.${slug}` } });
          for (const image of removedImages) {
            try {
              await deleteStoredImage(image);
            } catch (error) {
              console.error("Failed to delete stored image", image, error.message);
            }
          }
          reply(200, { success: true });
          return;
        }
        break;
      }
      case "products":
      case "laptops": {
        const forcedCategory = resource === "laptops" ? "laptop" : "";
        if (method === "GET" && slug) {
          const products = await fetchProducts({ ids: [slug], category: forcedCategory });
          const record = products?.[0];
          if (!record) {
            reply(404, { error: "Product not found" });
            return;
          }
          reply(200, record);
          return;
        }
        if (method === "GET") {
          const idsRaw = (searchParams.get("ids") || "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean);
          const category = normalizeProductType(
            searchParams.get("category") || searchParams.get("type") || forcedCategory
          );
          const companyId = searchParams.get("companyId") || "";
          const products = await fetchProducts({
            ids: idsRaw,
            category,
            companyId,
          });
          const results = filterProducts(products, {
            search: searchParams.get("search") || "",
            companyId,
            category,
            ids: idsRaw.length ? idsRaw : null,
          });
          reply(200, results);
          return;
        }
        if (method === "POST") {
          if (!requireAuth(req, res, session, { admin: true })) return;
          const body = await parseBody(req);
          const incomingType = normalizeProductType(body?.category || body?.type || forcedCategory);
          if (!body || !incomingType || !body.companyId || !body.title || body.price === "" || body.price == null) {
            reply(400, { error: "Missing category, companyId, title, or price" });
            return;
          }
          if (!Number.isFinite(Number(body.price)) || Number(body.price) < 0) {
            reply(400, { error: "Price must be a valid non-negative number" });
            return;
          }
          const brands = await sb("brands", { params: { select: "id", id: `eq.${body.companyId}` } });
          if (!brands.length) {
            reply(404, { error: "Brand not found" });
            return;
          }
          const images = Array.isArray(body.images)
            ? body.images.filter(Boolean)
            : typeof body.images === "string" && body.images
            ? body.images.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)
            : [];
          const rawSpecsInput = body.specsRaw ?? body.specs_raw;
          let specsRaw = null;
          if (rawSpecsInput !== undefined && String(rawSpecsInput).trim() !== "") {
            specsRaw = normalizeSpecsRaw(rawSpecsInput);
            if (specsRaw == null) {
              reply(400, { error: "Invalid specsRaw JSON payload" });
              return;
            }
          }
          const manualRaw = body.manualSpecs;
          const manualSpecified = manualRaw !== undefined;
          let manualSpecs = null;
          if (manualSpecified) {
            try {
              manualSpecs = String(manualRaw || "").trim()
                ? parseManualSpecsString(manualRaw)
                : {};
            } catch (error) {
              reply(400, { error: error.message });
              return;
            }
          }
          const icecatInputRaw = body.icecatId ?? body.icecat_id;
          const icecatSpecified =
            icecatInputRaw !== undefined && String(icecatInputRaw || "").trim() !== "";
          const icecatId = String(icecatInputRaw || "").trim();
          let icecatSpecs = null;
          if (icecatSpecified && icecatId) {
            console.log("[icecat] sync create request", { icecatId, shopname: ICECAT_SHOPNAME });
            try {
              icecatSpecs = await fetchIcecatSpecs(icecatId);
              console.log("[icecat] sync create success", {
                icecatId,
                specCount: Object.keys(icecatSpecs?.specs || {}).length,
                title: icecatSpecs?.title || "",
              });
            } catch (error) {
              console.error("[icecat] sync create failed", { icecatId, message: error.message });
              reply(error.status || 400, { error: `Icecat sync failed: ${error.message}` });
              return;
            }
          }
          specsRaw = mergeProductSpecs(specsRaw, body, {
            manualSpecified,
            manualSpecs,
            icecatSpecified,
            icecatSpecs,
          });
          const payload = {
            type: incomingType,
            brand_id: body.companyId,
            short_name: body.shortName || "",
            title: body.title,
            price: Number(body.price),
            description: body.description || "",
            warranty: body.warranty != null ? Number(body.warranty) : 0,
            images,
            specs_raw: specsRaw || {},
          };
          const created = await sb("products", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: payload,
          });
          const productRecord = created?.[0];
          if (!productRecord) {
            reply(500, { error: "Failed to create product" });
            return;
          }
          const hydrated = await sb("products", {
            params: {
              select:
                "id,type,brand_id,title,short_name,price,description,images,warranty,specs_raw,created_at,brands(*)",
              id: `eq.${productRecord.id}`,
            },
          });
          reply(201, mapProduct(hydrated?.[0], incomingType));
          return;
        }
        if (method === "PATCH" && slug) {
          if (!requireAuth(req, res, session, { admin: true })) return;
          const body = await parseBody(req);
          if (!body) {
            reply(400, { error: "Missing payload" });
            return;
          }
          const current = await sb("products", {
            params: { select: "id,type,specs_raw", id: `eq.${slug}` },
          });
          if (!current.length) {
            reply(404, { error: "Product not found" });
            return;
          }
          const existingType = normalizeProductType(current[0].type);
          const nextType = normalizeProductType(body.category || body.type || existingType);
          if (nextType && existingType !== nextType) {
            reply(400, { error: "Category changes require creating a new product." });
            return;
          }
          const payload = {
            brand_id: body.companyId,
            short_name: body.shortName,
            title: body.title,
            price: body.price != null && body.price !== "" ? Number(body.price) : undefined,
            description: body.description,
            warranty: body.warranty != null ? Number(body.warranty) : undefined,
            images: Array.isArray(body.images)
              ? body.images.filter(Boolean)
              : typeof body.images === "string" && body.images
              ? body.images.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)
              : undefined,
          };
          if (payload.price !== undefined && (!Number.isFinite(payload.price) || payload.price < 0)) {
            reply(400, { error: "Price must be a valid non-negative number" });
            return;
          }
          const rawSpecsInput = body.specsRaw ?? body.specs_raw;
          const hasSpecsRawInput = rawSpecsInput !== undefined;
          const manualRaw = body.manualSpecs;
          const manualSpecified = manualRaw !== undefined;
          let manualSpecs = null;
          if (manualSpecified) {
            try {
              manualSpecs = String(manualRaw || "").trim()
                ? parseManualSpecsString(manualRaw)
                : {};
            } catch (error) {
              reply(400, { error: error.message });
              return;
            }
          }
          const icecatInputRaw = body.icecatId ?? body.icecat_id;
          const icecatSpecified =
            icecatInputRaw !== undefined && String(icecatInputRaw || "").trim() !== "";
          const icecatId = String(icecatInputRaw || "").trim();
          let icecatSpecs = null;
          if (icecatSpecified && icecatId) {
            console.log("[icecat] sync patch request", { productId: slug, icecatId, shopname: ICECAT_SHOPNAME });
            try {
              icecatSpecs = await fetchIcecatSpecs(icecatId);
              console.log("[icecat] sync patch success", {
                productId: slug,
                icecatId,
                specCount: Object.keys(icecatSpecs?.specs || {}).length,
                title: icecatSpecs?.title || "",
              });
            } catch (error) {
              console.error("[icecat] sync patch failed", {
                productId: slug,
                icecatId,
                message: error.message,
              });
              reply(error.status || 400, { error: `Icecat sync failed: ${error.message}` });
              return;
            }
          }
          if (
            hasSpecsRawInput ||
            LEGACY_SPEC_KEYS.some((key) => body[key] !== undefined) ||
            manualSpecified ||
            icecatSpecified
          ) {
            let nextSpecs = hasSpecsRawInput
              ? String(rawSpecsInput).trim() === ""
                ? {}
                : normalizeSpecsRaw(rawSpecsInput)
              : normalizeSpecsRaw(current[0].specs_raw) || {};
            if (hasSpecsRawInput && nextSpecs == null) {
              reply(400, { error: "Invalid specsRaw JSON payload" });
              return;
            }
            nextSpecs = mergeProductSpecs(nextSpecs, body, {
              manualSpecified,
              manualSpecs,
              icecatSpecified,
              icecatSpecs,
            });
            payload.specs_raw = nextSpecs || {};
          }
          Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
          if (payload.brand_id) {
            const brands = await sb("brands", { params: { select: "id", id: `eq.${payload.brand_id}` } });
            if (!brands.length) {
              reply(404, { error: "Brand not found" });
              return;
            }
          }
          await sb("products", {
            method: "PATCH",
            params: { id: `eq.${slug}` },
            headers: { Prefer: "return=representation" },
            body: payload,
          });
          const hydrated = await sb("products", {
            params: {
              select:
                "id,type,brand_id,title,short_name,price,description,images,warranty,specs_raw,created_at,brands(*)",
              id: `eq.${slug}`,
            },
          });
          if (!hydrated.length) {
            reply(404, { error: "Product not found" });
            return;
          }
          reply(200, mapProduct(hydrated?.[0], existingType));
          return;
        }
        if (method === "DELETE" && slug) {
          if (!requireAuth(req, res, session, { admin: true })) return;
          const current = await sb("products", { params: { select: "id", id: `eq.${slug}` } });
          if (!current.length) {
            reply(404, { error: "Product not found" });
            return;
          }
          const records = await sb("products", {
            params: { select: "id,images", id: `eq.${slug}` },
          });
          const record = records?.[0];
          await sb("products", { method: "DELETE", params: { id: `eq.${slug}` } });
          if (record?.images) {
            const images = Array.isArray(record.images) ? record.images : [record.images];
            for (const image of images.filter(Boolean)) {
              try {
                await deleteStoredImage(image);
              } catch (error) {
                console.error("Failed to delete stored image", image, error.message);
              }
            }
          }
          reply(200, { success: true });
          return;
        }
        break;
      }
      case "orders": {
        if (method === "GET") {
          if (!requireAuth(req, res, session)) return;
          const params = {
            select: "*,order_items(*)",
            order: "created_at.desc",
          };
          if (session.role !== "admin") {
            params.user_id = `eq.${session.userId}`;
          }
          const statusFilter = searchParams.get("status");
          if (statusFilter) {
            params.status = `eq.${statusFilter}`;
          }
          const records = await sb("orders", { params });
          const hydrated = await hydrateOrders(records);
          reply(200, hydrated);
          return;
        }
        if (method === "POST") {
          const body = await parseBody(req);
          const items = Array.isArray(body?.items)
            ? body.items
            : body?.productId || body?.laptopId
            ? [
                {
                  productId: body.productId || body.laptopId,
                  quantity: body.quantity != null ? Number(body.quantity) : 1,
                },
              ]
            : [];
          const customerName = String(
            body?.customerName || session?.fullName || session?.username || ""
          ).trim();
          const customerEmail = String(body?.email || "").trim().toLowerCase();
          if (!body || !items.length || !customerName || !customerEmail || !body.phone || !body.address) {
            reply(400, { error: "Missing items, name, email, phone, or address" });
            return;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
            reply(400, { error: "Enter a valid email address for your order confirmation" });
            return;
          }
          const productIds = Array.from(
            new Set(
              items
                .map((item) => item.productId || item.id)
                .map((id) => String(id || "").trim())
                .filter(Boolean)
            )
          );
          if (!productIds.length) {
            reply(400, { error: "Missing product IDs" });
            return;
          }
          const products = await fetchProducts({ ids: productIds });
          if (products.length !== productIds.length) {
            reply(404, { error: "One or more products were not found" });
            return;
          }
          const orderPayload = {
            user_id: session?.userId || null,
            customer_name: customerName,
            delivery_address: body.address,
            email: customerEmail,
            phone: body.phone,
            notes: body.notes || "",
          };
          let orderRecord = null;
          try {
            const createdOrder = await sb("orders", {
              method: "POST",
              headers: { Prefer: "return=representation" },
              body: orderPayload,
            });
            orderRecord = createdOrder?.[0];
            if (!orderRecord) throw new Error("Failed to create order");

            const productsById = new Map(products.map((product) => [product.id, product]));
            const orderItemsPayload = items.map((item) => {
              const productId = item.productId || item.id;
              return {
                order_id: orderRecord.id,
                product_id: productId,
                quantity: item.quantity != null ? Math.max(1, Number(item.quantity)) : 1,
                unit_price: productsById.get(productId)?.price ?? null,
              };
            });
            await sb("order_items", {
              method: "POST",
              headers: { Prefer: "return=representation" },
              body: orderItemsPayload,
            });

            const hydrated = await sb("orders", {
              params: {
                select: "*,order_items(*)",
                id: `eq.${orderRecord.id}`,
              },
            });
            const hydratedOrders = await hydrateOrders(hydrated);
            const order = hydratedOrders?.[0];
            if (!order) throw new Error("Failed to load the completed order");

            let confirmationEmailSent = false;
            try {
              confirmationEmailSent = await sendOrderConfirmationEmail(order);
            } catch (error) {
              console.error(`Could not send confirmation email for order ${order.id}:`, error.message);
            }
            reply(201, { ...order, confirmationEmailSent });
          } catch (error) {
            if (orderRecord?.id) {
              try {
                await sb("order_items", {
                  method: "DELETE",
                  params: { order_id: `eq.${orderRecord.id}` },
                });
                await sb("orders", { method: "DELETE", params: { id: `eq.${orderRecord.id}` } });
              } catch (cleanupError) {
                console.error(`Could not clean up incomplete order ${orderRecord.id}:`, cleanupError.message);
              }
            }
            throw error;
          }
          return;
        }
        if (method === "PATCH" && slug) {
          if (!requireAuth(req, res, session, { admin: true })) return;
          const body = await parseBody(req);
          if (!body || !body.status) {
            reply(400, { error: "Missing status update" });
            return;
          }
          await sb("orders", {
            method: "PATCH",
            params: { id: `eq.${slug}` },
            headers: { Prefer: "return=representation" },
            body: { status: body.status },
          });
          const hydrated = await sb("orders", {
            params: { select: "*,order_items(*)", id: `eq.${slug}` },
          });
          if (!hydrated.length) {
            reply(404, { error: "Order not found" });
            return;
          }
          const hydratedOrders = await hydrateOrders(hydrated);
          reply(200, hydratedOrders?.[0] || null);
          return;
        }
        break;
      }
      case "users": {
        if (!requireAuth(req, res, session, { admin: true })) return;
        if (method === "GET") {
          const users = await sb("users", {
            params: { select: "id,username,full_name,admin" },
          });
          reply(200, users.map(mapUser));
          return;
        }
        if (method === "DELETE" && slug) {
          await sb("users", { method: "DELETE", params: { id: `eq.${slug}` } });
          destroySessionsForUser(slug);
          reply(200, { success: true });
          return;
        }
        break;
      }
      case "contact": {
        if (method === "GET") {
          const record = await fetchContact();
          reply(200, {
            salesHotline: record.sales_hotline || "",
            whatsapp: record.whatsapp || "",
            supportEmail: record.support_email || "",
            address: record.address || "",
            availability: record.availability || [],
            readOnly: Boolean(OLD_SUPABASE_REST_URL && OLD_SUPABASE_KEY),
          });
          return;
        }
        if (method === "PUT") {
          if (!requireAuth(req, res, session, { admin: true })) return;
          if (OLD_SUPABASE_REST_URL && OLD_SUPABASE_KEY) {
            reply(409, { error: "Contact details are loaded read-only from the old database." });
            return;
          }
          const body = await parseBody(req);
          const payload = {
            sales_hotline: body.salesHotline || "",
            whatsapp: body.whatsapp || "",
            support_email: body.supportEmail || "",
            address: body.address || "",
            availability: Array.isArray(body.availability)
              ? body.availability
              : typeof body.availability === "string"
              ? body.availability.split("\n").map((line) => line.trim()).filter(Boolean)
              : [],
          };
          await sb("contact", {
            method: "PATCH",
            params: { id: "eq.1" },
            headers: { Prefer: "return=representation" },
            body: payload,
          });
          const updated = await fetchContact();
          reply(200, {
            salesHotline: updated.sales_hotline || "",
            whatsapp: updated.whatsapp || "",
            supportEmail: updated.support_email || "",
            address: updated.address || "",
            availability: updated.availability || [],
          });
          return;
        }
        break;
      }
      case "uploads": {
        if (!requireAuth(req, res, session, { admin: true })) return;
        if (method === "POST") {
          const body = await parseBody(req);
          if (!body || !body.data) {
            reply(400, { error: "Missing base64 data" });
            return;
          }
          let mime = "";
          let base64Payload = "";
          if (body.data.startsWith("data:")) {
            const match = body.data.match(/^data:([^;]+);base64,(.+)$/);
            if (!match) {
              reply(400, { error: "Invalid data URI format" });
              return;
            }
            mime = match[1];
            base64Payload = match[2];
          } else {
            base64Payload = body.data;
          }
          if (!base64Payload) {
            reply(400, { error: "Empty image payload" });
            return;
          }
          let extension = "";
          if (body.filename && body.filename.includes(".")) {
            extension = path.extname(body.filename).toLowerCase();
          } else if (mime) {
            const subtype = mime.split("/")[1];
            extension = subtype ? `.${subtype.replace(/[^\w]/g, "")}` : "";
          }
          if (!extension) extension = ".png";
          const allowed = new Set([".png", ".jpg", ".jpeg", ".webp"]);
          if (!allowed.has(extension)) {
            reply(400, { error: "Unsupported image type" });
            return;
          }
          const safeBase = sanitizeFilename(body.filename || `upload${extension}`);
          const baseName = safeBase.endsWith(extension)
            ? safeBase.slice(0, -extension.length)
            : safeBase;
          const finalName = `${Date.now()}-${baseName || "upload"}${extension}`;
          const url = await storeImage(finalName, base64Payload, mime);
          reply(201, { url });
          return;
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;
    reply(status, { error: error.message || "Internal Server Error" });
    return;
  }

  reply(404, { error: "Not Found" });
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function serveStatic(res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname);
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch (error) {
    if (pathname === "/") {
      filePath = path.join(PUBLIC_DIR, "index.html");
    } else {
      throw error;
    }
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const content = await fs.readFile(filePath);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
  });
  res.end(content);
}

const server = http.createServer(async (req, res) => {
  const { pathname, query } = parse(req.url);
  const searchParams = new URLSearchParams(query || "");
  if (pathname === "/sitemap.xml") {
    try {
      await serveSitemap(res);
    } catch (error) {
      console.error("Failed to generate sitemap", error.message);
      sendText(res, 500, "Unable to generate sitemap");
    }
    return;
  }
  if (pathname.startsWith("/api/")) {
    await handleApi(req, res, pathname, searchParams);
    return;
  }
  try {
    const normalized = pathname === "/" ? "/" : path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    await serveStatic(res, normalized);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(res, 404, "Not Found");
    } else {
      sendText(res, 500, "Internal Server Error");
    }
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = server;
