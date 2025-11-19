const http = require("http");
const { parse } = require("url");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
const PORT = process.env.PORT || 3000;
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12;
const sessions = new Map();

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

async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

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

function createSession(user) {
  const token = crypto.randomBytes(30).toString("hex");
  sessions.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName || "",
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
  });
  return token;
}

function destroySession(token) {
  if (!token) return;
  sessions.delete(token);
}

function destroySessionsForUser(userId) {
  if (!userId) return;
  for (const [token, session] of sessions.entries()) {
    if (session.userId === userId) {
      sessions.delete(token);
    }
  }
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
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

async function storeImage(finalName, base64Payload, mime) {
  const buffer = Buffer.from(base64Payload, "base64");
  if (!SUPABASE_STORAGE_BUCKET) {
    await ensureUploadDir();
    const filePath = path.join(UPLOAD_DIR, finalName);
    await fs.writeFile(filePath, buffer);
    return `/uploads/${finalName}`;
  }
  const objectPath = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(
    SUPABASE_STORAGE_BUCKET
  )}/${finalName}`;
  const response = await fetch(objectPath, {
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

function mapCompany(record) {
  if (!record) return null;
  return {
    id: record.id,
    name: record.name,
    description: record.description || "",
  };
}

function mapLaptop(record) {
  if (!record) return null;
  const company = record.brands ? mapCompany(record.brands) : null;
  return {
    id: record.id,
    companyId: record.brand_id,
    title: record.title,
    price: Number(record.price) || 0,
    currency: "EGP",
    gpu: record.gpu || "",
    cpu: record.cpu || "",
    ram: record.ram || "",
    storage: record.storage || "",
    display: record.display || "",
    description: record.description || "",
    images: Array.isArray(record.images) ? record.images : record.images ? [record.images] : [],
    stock: record.stock ?? 0,
    company,
  };
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

function mapOrder(record) {
  if (!record) return null;
  const items = Array.isArray(record.order_items) ? record.order_items : [];
  const firstItem = items[0];
  const laptopData = firstItem?.laptops
    ? mapLaptop({ ...firstItem.laptops, brands: firstItem.laptops.brands })
    : null;
  return {
    id: record.id,
    userId: record.user_id,
    customerName: record.customer_name,
    phone: record.phone || "",
    email: record.email || "",
    address: record.delivery_address,
    paymentType: "Cash on Delivery",
    paymentCurrency: "EGP",
    status: record.status,
    quantity: firstItem?.quantity || 1,
    notes: record.notes || "",
    createdAt: record.created_at,
    laptop: laptopData,
  };
}

function filterLaptops(laptops, filters) {
  return laptops.filter((laptop) => {
    const search = filters.search?.toLowerCase() || "";
    const matchesSearch =
      !search ||
      laptop.title.toLowerCase().includes(search) ||
      (laptop.description || "").toLowerCase().includes(search) ||
      (laptop.cpu || "").toLowerCase().includes(search) ||
      (laptop.ram || "").toLowerCase().includes(search) ||
      (laptop.storage || "").toLowerCase().includes(search);
    const matchesCompany = !filters.companyId || laptop.companyId === filters.companyId;
    const matchesGpu =
      !filters.gpu || (laptop.gpu || "").toLowerCase().includes(filters.gpu.toLowerCase());
    const matchesIds =
      !filters.ids || (Array.isArray(filters.ids) && filters.ids.includes(laptop.id));
    const matchesMin = !filters.minPrice || laptop.price >= Number(filters.minPrice);
    const matchesMax = !filters.maxPrice || laptop.price <= Number(filters.maxPrice);
    return matchesSearch && matchesCompany && matchesGpu && matchesIds && matchesMin && matchesMax;
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
  const data = await sb("contact", { params: { select: "*", id: "eq.1" } });
  return data?.[0] || {
    sales_hotline: "+20 100 000 0000",
    whatsapp: "+20 100 000 0001",
    support_email: "support@nourtech.example",
    address: "Add your office or showroom address here",
    availability: [],
  };
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
  const session = sessionId && sessions.has(sessionId) ? { ...sessions.get(sessionId), token: sessionId } : null;

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
          await sb("brands", { method: "DELETE", params: { id: `eq.${slug}` } });
          reply(200, { success: true });
          return;
        }
        break;
      }
      case "laptops": {
        if (method === "GET" && slug) {
          const laptops = await sb("laptops", {
            params: { select: "*,brands(*)", id: `eq.${slug}` },
          });
          const record = laptops?.[0];
          if (!record) {
            reply(404, { error: "Laptop not found" });
            return;
          }
          reply(200, mapLaptop(record));
          return;
        }
        if (method === "GET") {
          const laptops = await sb("laptops", {
            params: { select: "*,brands(*)", order: "title.asc" },
          });
          const mapped = laptops.map(mapLaptop);
          const idsRaw = (searchParams.get("ids") || "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean);
          const results = filterLaptops(mapped, {
            search: searchParams.get("search") || "",
            companyId: searchParams.get("companyId") || "",
            gpu: searchParams.get("gpu") || "",
            ids: idsRaw.length ? idsRaw : null,
            minPrice: searchParams.get("minPrice"),
            maxPrice: searchParams.get("maxPrice"),
          });
          reply(200, results);
          return;
        }
        if (method === "POST") {
          if (!requireAuth(req, res, session, { admin: true })) return;
          const body = await parseBody(req);
          if (!body || !body.companyId || !body.title || body.price == null) {
            reply(400, { error: "Missing companyId, title, or price" });
            return;
          }
          const brands = await sb("brands", { params: { select: "id", id: `eq.${body.companyId}` } });
          if (!brands.length) {
            reply(404, { error: "Brand not found" });
            return;
          }
          const payload = {
            brand_id: body.companyId,
            title: body.title,
            price: Number(body.price),
            gpu: body.gpu || "",
            cpu: body.cpu || "",
            ram: body.ram || "",
            storage: body.storage || "",
            display: body.display || "",
            description: body.description || "",
            images: Array.isArray(body.images)
              ? body.images
              : typeof body.images === "string" && body.images
              ? body.images.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)
              : [],
            stock: body.stock != null ? Number(body.stock) : 0,
          };
          const created = await sb("laptops", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: payload,
          });
          const record = created?.[0];
          const hydrated = await sb("laptops", {
            params: { select: "*,brands(*)", id: `eq.${record.id}` },
          });
          reply(201, mapLaptop(hydrated?.[0]));
          return;
        }
        if (method === "DELETE" && slug) {
          if (!requireAuth(req, res, session, { admin: true })) return;
          await sb("laptops", { method: "DELETE", params: { id: `eq.${slug}` } });
          reply(200, { success: true });
          return;
        }
        break;
      }
      case "orders": {
        if (method === "GET") {
          if (!requireAuth(req, res, session)) return;
          const params = {
            select: "*,order_items(*,laptops(*,brands(*)))",
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
          reply(200, records.map(mapOrder));
          return;
        }
        if (method === "POST") {
          if (!requireAuth(req, res, session)) return;
          const body = await parseBody(req);
          if (!body || !body.laptopId || !body.phone || !body.address) {
            reply(400, { error: "Missing laptopId, phone, or address" });
            return;
          }
          const laptops = await sb("laptops", {
            params: { select: "id", id: `eq.${body.laptopId}` },
          });
          if (!laptops.length) {
            reply(404, { error: "Laptop not found" });
            return;
          }
          const orderPayload = {
            user_id: session.userId,
            customer_name: body.customerName || session.fullName || session.username,
            delivery_address: body.address,
            email: body.email || "",
            phone: body.phone,
            notes: body.notes || "",
          };
          const createdOrder = await sb("orders", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: orderPayload,
          });
          const orderRecord = createdOrder?.[0];
          await sb("order_items", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: {
              order_id: orderRecord.id,
              laptop_id: body.laptopId,
              quantity: body.quantity != null ? Math.max(1, Number(body.quantity)) : 1,
            },
          });
          const hydrated = await sb("orders", {
            params: {
              select: "*,order_items(*,laptops(*,brands(*)))",
              id: `eq.${orderRecord.id}`,
            },
          });
          reply(201, mapOrder(hydrated?.[0]));
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
            params: { select: "*,order_items(*,laptops(*,brands(*)))", id: `eq.${slug}` },
          });
          if (!hydrated.length) {
            reply(404, { error: "Order not found" });
            return;
          }
          reply(200, mapOrder(hydrated?.[0]));
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
          });
          return;
        }
        if (method === "PUT") {
          if (!requireAuth(req, res, session, { admin: true })) return;
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
