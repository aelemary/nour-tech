const http = require("http");
const { parse } = require("url");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_FILE = path.join(ROOT_DIR, "data", "data.json");
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12;
const sessions = new Map();

async function readData() {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeData(data) {
  const payload = JSON.stringify(data, null, 2);
  await fs.writeFile(DATA_FILE, payload);
}

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

function buildLaptopView(laptop, models, companies) {
  const model = models.find((item) => item.id === laptop.modelId) || null;
  const company = companies.find((item) => item.id === laptop.companyId) || null;
  return {
    ...laptop,
    model,
    company,
  };
}

async function handleApi(req, res, pathname, searchParams) {
  if (req.method === "OPTIONS") {
    const origin = req.headers.origin;
    const headers = {
      "Access-Control-Allow-Methods": "GET,POST,DELETE,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
      headers["Vary"] = "Origin";
    } else {
      headers["Access-Control-Allow-Origin"] = "*";
    }
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const segments = pathname.split("/").filter(Boolean);
  const resource = segments[1] ? decodeURIComponent(segments[1]) : "";
  const slug = segments[2] ? decodeURIComponent(segments[2]) : null;
  const extra = segments[3] ? decodeURIComponent(segments[3]) : null;
  const action = slug ? slug.toLowerCase() : "";

  const cookies = parseCookies(req.headers.cookie || "");
  const rawSessionToken = cookies.sessionId ? decodeURIComponent(cookies.sessionId) : null;
  let session = null;
  if (rawSessionToken && sessions.has(rawSessionToken)) {
    const storedSession = sessions.get(rawSessionToken);
    if (storedSession.expiresAt && storedSession.expiresAt < Date.now()) {
      sessions.delete(rawSessionToken);
    } else {
      storedSession.expiresAt = Date.now() + SESSION_MAX_AGE_MS;
      session = { ...storedSession, token: rawSessionToken };
      sessions.set(rawSessionToken, storedSession);
    }
  }

  try {
    if (segments[0] === "api") {
      const reply = (status, payload, headers) => sendJSON(res, status, payload, headers, req);
      switch (resource) {
        case "auth":
          if (action === "signup" && req.method === "POST") {
            const body = await parseBody(req);
            if (!body || !body.username || !body.password) {
              reply(400, { error: "Missing username or password" });
              return;
            }
            const usernameRaw = String(body.username).trim();
            const password = String(body.password);
            if (password.length < 6) {
              reply(400, { error: "Password must be at least 6 characters long" });
              return;
            }
            if (!usernameRaw.match(/^[a-z0-9_.-]+$/i)) {
              reply(400, { error: "Username can only contain letters, numbers, dots, underscores, and dashes" });
              return;
            }
            const username = usernameRaw.toLowerCase();
            const data = await readData();
            if (!Array.isArray(data.users)) {
              data.users = [];
            }
            const exists = data.users.some((user) => user.username.toLowerCase() === username);
            if (exists) {
              reply(409, { error: "Username is already taken" });
              return;
            }
            const id = `user-${Date.now()}`;
            const fullName =
              typeof body.fullName === "string" && body.fullName.trim()
                ? body.fullName.trim()
                : usernameRaw;
            const userRecord = {
              id,
              username: usernameRaw,
              passwordHash: hashPassword(password),
              role: "customer",
              fullName,
            };
            data.users.push(userRecord);
            await writeData(data);
            const token = createSession(userRecord);
            const cookie = serializeCookie("sessionId", token, {
              path: "/",
              httpOnly: true,
              sameSite: "Lax",
              maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
            });
            reply(
              201,
              {
                id: userRecord.id,
                username: userRecord.username,
                fullName: userRecord.fullName,
                role: userRecord.role,
              },
              { "Set-Cookie": cookie }
            );
            return;
          }
          if (action === "login" && req.method === "POST") {
            const body = await parseBody(req);
            if (!body || !body.username || !body.password) {
              reply(400, { error: "Missing username or password" });
              return;
            }
            const username = String(body.username).trim().toLowerCase();
            const data = await readData();
            const users = Array.isArray(data.users) ? data.users : [];
            const user = users.find((item) => item.username.toLowerCase() === username);
            const password = typeof body.password === "string" ? body.password : "";
            if (!user) {
              reply(401, { error: "Invalid username or password" });
              return;
            }
            const hash = hashPassword(password);
            if (hash !== user.passwordHash) {
              reply(401, { error: "Invalid username or password" });
              return;
            }
            const token = createSession(user);
            const cookie = serializeCookie("sessionId", token, {
              path: "/",
              httpOnly: true,
              sameSite: "Lax",
              maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
            });
            reply(
              200,
              {
                id: user.id,
                username: user.username,
                fullName: user.fullName || "",
                role: user.role,
              },
              { "Set-Cookie": cookie }
            );
            return;
          }
          if (action === "logout" && req.method === "POST") {
            const cookie = serializeCookie("sessionId", "", {
              path: "/",
              httpOnly: true,
              sameSite: "Lax",
              maxAge: 0,
            });
            if (session?.token) {
              destroySession(session.token);
            }
            reply(200, { success: true }, { "Set-Cookie": cookie });
            return;
          }
          if (action === "me" && req.method === "GET") {
            if (!session) {
              reply(200, { authenticated: false });
              return;
            }
            const data = await readData();
            const users = Array.isArray(data.users) ? data.users : [];
            const user = users.find((item) => item.id === session.userId);
            if (!user) {
              if (session.token) destroySession(session.token);
              reply(200, { authenticated: false });
              return;
            }
            reply(200, {
              authenticated: true,
              user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName || "",
                role: user.role,
              },
            });
            return;
          }
          break;
        case "companies":
          if (req.method === "GET") {
            const data = await readData();
            reply(200, data.companies);
            return;
          }
          if (req.method === "POST") {
            if (!requireAuth(req, res, session, { admin: true })) {
              return;
            }
            const body = await parseBody(req);
            if (!body || !body.name) {
              reply(400, { error: "Missing company name" });
              return;
            }
            const data = await readData();
            const id = `comp-${body.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
            const company = {
              id,
              name: body.name,
              description: body.description || "",
            };
            data.companies.push(company);
            await writeData(data);
            reply(201, company);
            return;
          }
          if (req.method === "DELETE" && slug) {
            if (!requireAuth(req, res, session, { admin: true })) {
              return;
            }
            const data = await readData();
            if (!Array.isArray(data.companies)) data.companies = [];
            if (!Array.isArray(data.models)) data.models = [];
            if (!Array.isArray(data.laptops)) data.laptops = [];
            const companyIndex = data.companies.findIndex((company) => company.id === slug);
            if (companyIndex === -1) {
              reply(404, { error: "Company not found" });
              return;
            }
            const companyId = data.companies[companyIndex].id;
            const removedModels = data.models.filter((model) => model.companyId === companyId);
            const removedModelIds = new Set(removedModels.map((model) => model.id));
            const removedLaptops = data.laptops.filter(
              (laptop) => laptop.companyId === companyId || removedModelIds.has(laptop.modelId)
            );
            const removedLaptopIds = new Set(removedLaptops.map((laptop) => laptop.id));
            data.companies.splice(companyIndex, 1);
            data.models = data.models.filter((model) => model.companyId !== companyId);
            data.laptops = data.laptops.filter(
              (laptop) => laptop.companyId !== companyId && !removedModelIds.has(laptop.modelId)
            );
            await writeData(data);
            reply(200, {
              success: true,
              removed: {
                companies: 1,
                models: removedModelIds.size,
                laptops: removedLaptopIds.size,
              },
            });
            return;
          }
          break;
        case "models":
          if (req.method === "GET") {
            const data = await readData();
            const companyId = searchParams.get("companyId");
            const models = companyId
              ? data.models.filter((model) => model.companyId === companyId)
              : data.models;
            reply(200, models);
            return;
          }
          if (req.method === "POST") {
            if (!requireAuth(req, res, session, { admin: true })) {
              return;
            }
            const body = await parseBody(req);
            if (!body || !body.companyId || !body.name) {
              reply(400, { error: "Missing companyId or name" });
              return;
            }
            const data = await readData();
            const companyExists = data.companies.some((c) => c.id === body.companyId);
            if (!companyExists) {
              reply(404, { error: "Company not found" });
              return;
            }
            const id = `model-${body.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
            const model = {
              id,
              companyId: body.companyId,
              name: body.name,
              gpu: body.gpu || "",
              cpu: body.cpu || "",
            };
            data.models.push(model);
            await writeData(data);
            reply(201, model);
            return;
          }
          if (req.method === "DELETE" && slug) {
            if (!requireAuth(req, res, session, { admin: true })) {
              return;
            }
            const data = await readData();
            if (!Array.isArray(data.models)) data.models = [];
            if (!Array.isArray(data.laptops)) data.laptops = [];
            const modelIndex = data.models.findIndex((model) => model.id === slug);
            if (modelIndex === -1) {
              reply(404, { error: "Model not found" });
              return;
            }
            const modelId = data.models[modelIndex].id;
            const removedLaptops = data.laptops.filter((laptop) => laptop.modelId === modelId);
            const removedLaptopIds = new Set(removedLaptops.map((laptop) => laptop.id));
            data.models.splice(modelIndex, 1);
            data.laptops = data.laptops.filter((laptop) => laptop.modelId !== modelId);
            await writeData(data);
            reply(200, {
              success: true,
              removed: {
                models: 1,
                laptops: removedLaptopIds.size,
              },
            });
            return;
          }
          break;
        case "laptops":
          if (req.method === "GET" && slug) {
            const data = await readData();
            const laptop = data.laptops.find((item) => item.id === slug);
            if (!laptop) {
              reply(404, { error: "Laptop not found" });
              return;
            }
            reply(200, buildLaptopView(laptop, data.models, data.companies));
            return;
          }
          if (req.method === "GET") {
            const data = await readData();
            const search = (searchParams.get("search") || "").toLowerCase();
            const companyId = searchParams.get("companyId");
            const gpu = searchParams.get("gpu");
            const minPrice = searchParams.get("minPrice");
            const maxPrice = searchParams.get("maxPrice");
            const cpuFilter = searchParams.get("cpu");
            const ramFilter = searchParams.get("ram");
            const storageFilter = searchParams.get("storage");
            const idsParam = searchParams.get("ids");
            const idFilter = idsParam
              ? idsParam
                  .split(",")
                  .map((id) => id.trim())
                  .filter(Boolean)
              : null;

            const laptops = data.laptops
              .filter((laptop) => {
                if (idFilter && !idFilter.includes(laptop.id)) {
                  return false;
                }
                const matchesSearch =
                  !search ||
                  laptop.title.toLowerCase().includes(search) ||
                  laptop.description.toLowerCase().includes(search) ||
                  (laptop.cpu || "").toLowerCase().includes(search) ||
                  (laptop.ram || "").toLowerCase().includes(search) ||
                  (laptop.storage || "").toLowerCase().includes(search);
                const matchesCompany = !companyId || laptop.companyId === companyId;
                const matchesGpu = !gpu || laptop.gpu.toLowerCase().includes(gpu.toLowerCase());
                const matchesMin = !minPrice || laptop.price >= Number(minPrice);
                const matchesMax = !maxPrice || laptop.price <= Number(maxPrice);
                const matchesCpu =
                  !cpuFilter || (laptop.cpu || "").toLowerCase() === cpuFilter.toLowerCase();
                const matchesRam =
                  !ramFilter || (laptop.ram || "").toLowerCase() === ramFilter.toLowerCase();
                const matchesStorage =
                  !storageFilter ||
                  (laptop.storage || "").toLowerCase() === storageFilter.toLowerCase();
                return (
                  matchesSearch &&
                  matchesCompany &&
                  matchesGpu &&
                  matchesMin &&
                  matchesMax &&
                  matchesCpu &&
                  matchesRam &&
                  matchesStorage
                );
              })
              .map((laptop) => buildLaptopView(laptop, data.models, data.companies));

            reply(200, laptops);
            return;
          }
          if (req.method === "POST") {
            if (!requireAuth(req, res, session, { admin: true })) {
              return;
            }
            const body = await parseBody(req);
            if (!body || !body.modelId || !body.title || !body.price) {
              reply(400, { error: "Missing modelId, title, or price" });
              return;
            }
            const data = await readData();
            const model = data.models.find((item) => item.id === body.modelId);
            if (!model) {
              reply(404, { error: "Model not found" });
              return;
            }
            const id = `lap-${body.title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
            const laptop = {
              id,
              modelId: body.modelId,
              companyId: model.companyId,
              title: body.title,
              price: Number(body.price),
              currency: body.currency || "EGP",
              gpu: body.gpu || model.gpu || "",
              cpu: body.cpu || model.cpu || "",
              ram: body.ram || "",
              storage: body.storage || "",
              display: body.display || "",
              description: body.description || "",
              images: Array.isArray(body.images)
                ? body.images.filter(Boolean)
                : typeof body.images === "string" && body.images
                ? body.images.split(",").map((url) => url.trim()).filter(Boolean)
                : [],
              stock: body.stock != null ? Number(body.stock) : 0,
            };
            data.laptops.push(laptop);
            await writeData(data);
            reply(201, buildLaptopView(laptop, data.models, data.companies));
            return;
          }
          if (req.method === "DELETE" && slug) {
            if (!requireAuth(req, res, session, { admin: true })) {
              return;
            }
            const data = await readData();
            if (!Array.isArray(data.laptops)) data.laptops = [];
            const index = data.laptops.findIndex((laptop) => laptop.id === slug);
            if (index === -1) {
              reply(404, { error: "Laptop not found" });
              return;
            }
            const [removed] = data.laptops.splice(index, 1);
            await writeData(data);
            reply(200, { success: true, laptop: removed });
            return;
          }
          break;
        case "orders":
          if (req.method === "GET") {
            if (!requireAuth(req, res, session)) {
              return;
            }
            const data = await readData();
            const status = searchParams.get("status");
            const relevantOrders =
              session.role === "admin"
                ? data.orders
                : data.orders.filter((order) => order.userId === session.userId);
            const orders = relevantOrders
              .filter((order) => (!status ? true : order.status === status))
              .map((order) => {
                const laptop = data.laptops.find((item) => item.id === order.laptopId) || null;
                return {
                  ...order,
                  laptop,
                };
              });
            reply(200, orders);
            return;
          }
          if (req.method === "POST") {
            if (!requireAuth(req, res, session)) {
              return;
            }
            const body = await parseBody(req);
            if (!body || !body.laptopId || !body.phone || !body.address) {
              reply(400, {
                error: "Missing laptopId, phone, or address",
              });
              return;
            }
            const data = await readData();
            const laptop = data.laptops.find((item) => item.id === body.laptopId);
            if (!laptop) {
              reply(404, { error: "Laptop not found" });
              return;
            }
            const quantity =
              body.quantity != null && Number.isFinite(Number(body.quantity))
                ? Math.max(1, Number(body.quantity))
                : 1;
            const paymentType =
              typeof body.paymentType === "string" && body.paymentType.trim()
                ? body.paymentType.trim()
                : "Cash on Delivery";
            const notes =
              typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : "";
            const id = `order-${Date.now()}`;
            const order = {
              id,
              laptopId: body.laptopId,
              userId: session.userId,
              customerName: body.customerName || session.fullName || session.username,
              phone: body.phone,
              email: body.email || "",
              address: body.address,
              paymentType,
              paymentCurrency: laptop.currency || "EGP",
              status: "pending",
              quantity,
              notes,
              createdAt: new Date().toISOString(),
            };
            data.orders.push(order);
            await writeData(data);
            reply(201, { ...order, laptop });
            return;
          }
          if (req.method === "PATCH" && slug) {
            if (!requireAuth(req, res, session, { admin: true })) {
              return;
            }
            const body = await parseBody(req);
            if (!body || !body.status) {
              reply(400, { error: "Missing status update" });
              return;
            }
            const allowedStatuses = new Set(["pending", "confirmed", "completed", "cancelled"]);
            const status = String(body.status).toLowerCase();
            if (!allowedStatuses.has(status)) {
              reply(400, { error: "Unsupported status value" });
              return;
            }
            const data = await readData();
            const order = data.orders.find((item) => item.id === slug);
            if (!order) {
              reply(404, { error: "Order not found" });
              return;
            }
            order.status = status;
            if (typeof body.notes === "string") {
              order.notes = body.notes.trim();
            }
            if (typeof body.paymentType === "string" && body.paymentType.trim()) {
              order.paymentType = body.paymentType.trim();
            }
            await writeData(data);
            const laptop = data.laptops.find((item) => item.id === order.laptopId) || null;
            reply(200, { ...order, laptop });
            return;
          }
          break;
        case "users":
          if (req.method === "GET") {
            if (!requireAuth(req, res, session, { admin: true })) {
              return;
            }
            const data = await readData();
            const users = (data.users || []).map((user) => ({
              id: user.id,
              username: user.username,
              role: user.role,
              fullName: user.fullName || "",
              isCurrent: session.userId === user.id,
              orders: (data.orders || []).filter((order) => order.userId === user.id).length,
            }));
            reply(200, users);
            return;
          }
          if (req.method === "DELETE" && slug) {
            if (!requireAuth(req, res, session, { admin: true })) {
              return;
            }
            const data = await readData();
            if (!Array.isArray(data.users)) {
              reply(404, { error: "User not found" });
              return;
            }
            const index = data.users.findIndex((user) => user.id === slug);
            if (index === -1) {
              reply(404, { error: "User not found" });
              return;
            }
            const user = data.users[index];
            if (user.role === "admin") {
              reply(400, { error: "Admin accounts cannot be removed from the dashboard." });
              return;
            }
            data.users.splice(index, 1);
            if (Array.isArray(data.orders)) {
              data.orders = data.orders.filter((order) => order.userId !== slug);
            }
            await writeData(data);
            destroySessionsForUser(slug);
            reply(200, { success: true });
            return;
          }
          break;
        case "uploads":
          if (req.method === "POST") {
            if (!requireAuth(req, res, session, { admin: true })) {
              return;
            }
            const body = await parseBody(req);
            if (!body || !body.data) {
              reply(400, { error: "Missing image data" });
              return;
            }

            await ensureUploadDir();

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
            if (!extension) {
              extension = ".png";
            }
            const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
            if (!allowedExtensions.has(extension)) {
              reply(400, { error: "Unsupported image type" });
              return;
            }
            const safeBase = sanitizeFilename(body.filename || `upload${extension}`);
            const withoutExt = safeBase.endsWith(extension)
              ? safeBase.slice(0, -extension.length)
              : safeBase;
            const finalName = `${Date.now()}-${withoutExt || "upload"}${extension}`;
            const filePath = path.join(UPLOAD_DIR, finalName);
            try {
              await fs.writeFile(filePath, Buffer.from(base64Payload, "base64"));
            } catch (error) {
              reply(500, { error: "Failed to write image", details: error.message });
              return;
            }
            reply(201, { url: `/uploads/${finalName}` });
            return;
          }
          break;
        default:
          break;
      }
    }
  } catch (error) {
    sendJSON(res, 500, { error: "Internal Server Error", details: error.message }, {}, req);
    return;
  }

  sendJSON(res, 404, { error: "Not Found" }, {}, req);
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
    const sanitizedPath = pathname === "/" ? "/" : path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    await serveStatic(res, sanitizedPath);
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
