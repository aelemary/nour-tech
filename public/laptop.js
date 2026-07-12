const API_BASE = "/api";
let statusTimer = null;
const TYPE_LABELS = {
  laptop: "Laptop",
  gpu: "GPU",
  cpu: "CPU",
  hdd: "HDD",
  motherboard: "Motherboard",
};

function formatTypeLabel(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (!normalized) return "Product";
  if (TYPE_LABELS[normalized]) return TYPE_LABELS[normalized];
  if (normalized === "ram") return "RAM";
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, { credentials: "include", ...options });
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      if (data && data.error) message = data.error;
    } catch (error) {
      // ignore parse errors
    }
    const err = new Error(message || `Request failed with status ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

function setYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

function updateCartCount() {
  if (!window.Cart) return;
  const badge = document.getElementById("cart-count");
  if (badge) {
    badge.textContent = window.Cart.count();
  }
}

function renderImages(images = [], title = "Product image") {
  if (!images.length) {
    images = ["https://placehold.co/800x500?text=Product+Preview"];
  }
  const hasMultiple = images.length > 1;
  const slides = images
    .map(
      (url, index) =>
        `<figure class="gallery-slide" data-index="${index}">
          <img src="${url}" alt="${title} ${index + 1}" loading="${index === 0 ? "eager" : "lazy"}" />
        </figure>`
    )
    .join("");
  return `
    <div class="gallery-slider" data-gallery tabindex="0" aria-label="Product images">
      <button class="gallery-nav prev" type="button" aria-label="Previous image"${hasMultiple ? "" : " disabled"}>‹</button>
      <div class="gallery-window">
        <div class="gallery-track">
          ${slides}
        </div>
      </div>
      <button class="gallery-nav next" type="button" aria-label="Next image"${hasMultiple ? "" : " disabled"}>›</button>
    </div>
  `;
}

function renderSpec(label, value) {
  if (!value) return "";
  return `<div class="spec-item"><span>${label}</span><strong>${value}</strong></div>`;
}

function normalizeSpecLabel(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[_/-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function humanizeSpecKey(key) {
  return String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function flattenSpecs(value, trail = [], items = [], limit = 120) {
  if (items.length >= limit || value == null || value === "") return items;
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (items.length >= limit) return;
      flattenSpecs(entry, trail, items, limit);
    });
    return items;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => {
      if (items.length >= limit || entry == null || entry === "") return;
      flattenSpecs(entry, trail.concat(humanizeSpecKey(key)), items, limit);
    });
    return items;
  }
  if (!trail.length) return items;
  items.push({
    label: trail.join(" / "),
    value: String(value),
  });
  return items;
}

function collectSpecEntries(product) {
  const entries = [];
  const addObject = (source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) return;
    Object.entries(source).forEach(([label, value]) => {
      if (value == null || value === "") return;
      if (typeof value === "object") return;
      entries.push({ label: humanizeSpecKey(label), value: String(value) });
    });
  };

  addObject(product.specsRaw?.manual);
  addObject(product.specsRaw?.icecat?.specs);
  addObject(product.specsRaw?.specs);
  addObject(product.specsRaw);
  flattenSpecs(product.specsRaw, [], entries, 160);
  return entries;
}

const COMMON_SPEC_FIELDS = [
  { label: "Model", keys: ["model", "product code", "part number", "mpn"] },
  { label: "Processor", keys: ["processor model", "processor family", "cpu", "processor"] },
  { label: "Graphics", keys: ["discrete graphics card model", "graphics adapter", "graphics processor", "gpu", "graphics"] },
  { label: "Memory", keys: ["internal memory", "system memory", "ram", "memory"] },
  { label: "Memory Type", keys: ["internal memory type", "memory type", "graphics card memory type"] },
  { label: "Storage", keys: ["total storage capacity", "ssd capacity", "storage", "hdd capacity"] },
  { label: "Storage Type", keys: ["storage media", "ssd form factor", "drive type"] },
  { label: "Display Size", keys: ["display diagonal", "screen size"] },
  { label: "Display Resolution", keys: ["display resolution", "resolution"] },
  { label: "Display Type", keys: ["panel type", "display technology", "touchscreen"] },
  { label: "Operating System", keys: ["operating system installed", "operating system", "os"] },
  { label: "Battery", keys: ["battery capacity", "battery technology", "number of battery cells"] },
  { label: "Weight", keys: ["weight"] },
  { label: "Dimensions", keys: ["width", "depth", "height", "dimensions"] },
];

const TYPE_SPEC_FIELDS = {
  gpu: [
    { label: "Graphics Processor", keys: ["graphics processor", "graphics processor family", "gpu"] },
    { label: "Video Memory", keys: ["discrete graphics card memory", "graphics card memory", "memory"] },
    { label: "Memory Bus", keys: ["memory bus"] },
    { label: "Interface", keys: ["interface type", "pci express", "host interface"] },
    { label: "HDMI", keys: ["hdmi ports quantity", "hdmi"] },
    { label: "DisplayPort", keys: ["displayports quantity", "displayport"] },
    { label: "Power", keys: ["minimum system power supply", "power consumption"] },
  ],
  cpu: [
    { label: "Processor", keys: ["processor model", "processor family", "cpu"] },
    { label: "Cores", keys: ["processor cores", "cores"] },
    { label: "Threads", keys: ["processor threads", "threads"] },
    { label: "Base Frequency", keys: ["processor base frequency", "base frequency"] },
    { label: "Boost Frequency", keys: ["processor boost frequency", "turbo frequency"] },
    { label: "Socket", keys: ["processor socket", "socket"] },
    { label: "Cache", keys: ["processor cache", "cache"] },
  ],
  motherboard: [
    { label: "Socket", keys: ["processor socket", "socket"] },
    { label: "Chipset", keys: ["motherboard chipset", "chipset"] },
    { label: "Memory Slots", keys: ["memory slots", "number of memory slots"] },
    { label: "Max Memory", keys: ["maximum internal memory", "max memory"] },
    { label: "Form Factor", keys: ["motherboard form factor", "form factor"] },
    { label: "Networking", keys: ["ethernet lan", "wi fi", "bluetooth"] },
  ],
  hdd: [
    { label: "Capacity", keys: ["hdd capacity", "ssd capacity", "storage capacity", "capacity"] },
    { label: "Interface", keys: ["interface", "serial ata", "sata"] },
    { label: "Drive Size", keys: ["hdd size", "drive size", "form factor"] },
    { label: "Speed", keys: ["hdd speed", "read speed", "write speed"] },
  ],
};

function findSpecValue(entries, keys) {
  const normalizedKeys = keys.map(normalizeSpecLabel).filter(Boolean);
  const exact = entries.find((entry) => normalizedKeys.includes(normalizeSpecLabel(entry.label)));
  if (exact) return exact.value;
  const partial = entries.find((entry) => {
    const label = normalizeSpecLabel(entry.label);
    return normalizedKeys.some((key) => label.includes(key) || key.includes(label));
  });
  return partial?.value || "";
}

function buildCuratedSpecs(product, warrantyLabel) {
  const entries = collectSpecEntries(product);
  const type = String(product.type || "").toLowerCase();
  const fields = [...(TYPE_SPEC_FIELDS[type] || COMMON_SPEC_FIELDS)];
  if (type !== "laptop") {
    fields.unshift({ label: "Model", keys: ["model", "product code", "part number", "mpn"] });
  }
  const specs = [];
  const usedLabels = new Set();
  const usedValues = new Set();
  const addSpec = (label, value) => {
    const normalized = normalizeSpecLabel(label);
    const normalizedValue = normalizeSpecLabel(value);
    if (!value || usedLabels.has(normalized) || usedValues.has(normalizedValue)) return;
    specs.push(renderSpec(label, value));
    usedLabels.add(normalized);
    usedValues.add(normalizedValue);
  };

  fields.forEach((field) => addSpec(field.label, findSpecValue(entries, field.keys)));

  addSpec("Graphics", product.gpu);
  addSpec("Processor", product.cpu);
  addSpec("Memory", product.ram);
  addSpec("Storage", product.storage);
  addSpec("Display", product.display);
  addSpec("Model", product.shortName);
  addSpec("Warranty", warrantyLabel);

  if (specs.length < 8) {
    entries.slice(0, 16).forEach((entry) => addSpec(entry.label, entry.value));
  }
  return specs.slice(0, 18);
}

function buildAdvancedSpecs(product) {
  const icecatSpecs = product.specsRaw?.icecat?.specs;
  const curatedEntries =
    icecatSpecs && typeof icecatSpecs === "object" && !Array.isArray(icecatSpecs)
      ? Object.entries(icecatSpecs).map(([label, value]) => ({
          label: humanizeSpecKey(label),
          value: value == null ? "" : String(value),
        }))
      : flattenSpecs(product.specsRaw?.icecat || product.specsRaw, [], [], 500);
  const seen = new Set();
  const advanced = [];
  curatedEntries.forEach((entry) => {
    const label = String(entry.label || "").trim();
    const value = String(entry.value || "").trim();
    const key = `${normalizeSpecLabel(label)}:${normalizeSpecLabel(value)}`;
    if (!label || !value || seen.has(key)) return;
    seen.add(key);
    advanced.push(renderSpec(label, value));
  });
  return advanced;
}

function showStatus(message, type = "success") {
  const container = document.getElementById("order-status");
  if (!container) return;
  if (statusTimer) {
    clearTimeout(statusTimer);
  }
  container.innerHTML = `<div class="toast ${type === "error" ? "error" : ""}">${message}</div>`;
  statusTimer = window.setTimeout(() => {
    container.innerHTML = "";
  }, 3000);
}

function renderProduct(product) {
  const layout = document.getElementById("detail-layout");
  const typeLabel = formatTypeLabel(product.type);
  const warrantyLabel =
    product.warranty && product.warranty > 0
      ? `${product.warranty} year${product.warranty > 1 ? "s" : ""}`
      : "";
  const description = product.description
    ? `<p class="detail-description">${product.description}</p>`
    : "";
  const specs = buildCuratedSpecs(product, warrantyLabel);
  const advancedSpecs = buildAdvancedSpecs(product);
  layout.innerHTML = `
    <div class="detail-main">
      <div class="detail-gallery gallery">
        ${renderImages(product.images, product.title)}
      </div>
      <div class="detail-copy">
        <div class="detail-heading">
          <h1 class="detail-title">${product.title}</h1>
          <p class="badge">${product.company?.name || "Unassigned"} • ${typeLabel}</p>
          ${description}
        </div>
        <section class="detail-specs detail-specs-inline">
          <h2>Specifications</h2>
          <div class="spec-list">
            ${specs.join("") || `<div class="field-hint">No specifications listed yet.</div>`}
          </div>
          ${
            advancedSpecs.length
              ? `<button class="spec-toggle spec-toggle-bottom" type="button" data-spec-toggle aria-expanded="false" aria-controls="advanced-specs">Advanced specs</button>`
              : ""
          }
          ${
            advancedSpecs.length
              ? `<div id="advanced-specs" class="spec-list advanced-spec-list" hidden>${advancedSpecs.join("")}</div>`
              : ""
          }
        </section>
      </div>
    </div>
    <aside class="panel detail-purchase">
      <h2>Purchase Options</h2>
      <p class="price">${new Intl.NumberFormat("en-EG", {
        style: "currency",
        currency: product.currency || "EGP",
        maximumFractionDigits: 0,
      }).format(product.price)}</p>
      <p class="field-hint">
        Complete payment on the checkout page. Cash on delivery is confirmed as soon as you submit the order.
      </p>
      <div class="btn-stack">
        <button class="btn btn-primary" data-buy-now="${product.id}">Buy Now</button>
        <button class="btn btn-outline" data-add-cart="${product.id}">Add to Cart</button>
        <a class="btn btn-outline" href="/cart.html">View Cart</a>
      </div>
      <div id="order-status" class="order-status"></div>
      <p class="field-hint">
        Need multiple units or a custom tweak? Add the product to your cart and leave detailed notes at checkout.
      </p>
    </aside>
  `;
  initSpecToggle();
  initGallery();
}

function initSpecToggle() {
  const toggle = document.querySelector("[data-spec-toggle]");
  const advanced = document.getElementById("advanced-specs");
  if (!toggle || !advanced) return;
  toggle.addEventListener("click", () => {
    const open = advanced.hidden;
    advanced.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Hide advanced specs" : "Advanced specs";
  });
}

function initGallery() {
  const slider = document.querySelector("[data-gallery]");
  if (!slider) return;
  const track = slider.querySelector(".gallery-track");
  const slides = Array.from(slider.querySelectorAll(".gallery-slide"));
  if (!track || !slides.length) return;
  const prev = slider.querySelector(".gallery-nav.prev");
  const next = slider.querySelector(".gallery-nav.next");
  let index = 0;

  const clampIndex = (value) => Math.min(Math.max(value, 0), slides.length - 1);

  const setIndex = (value) => {
    index = clampIndex(value);
    track.style.transform = `translateX(-${index * 100}%)`;
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === slides.length - 1;
  };

  if (prev) {
    prev.addEventListener("click", () => setIndex(index - 1));
  }
  if (next) {
    next.addEventListener("click", () => setIndex(index + 1));
  }

  slider.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setIndex(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setIndex(index + 1);
    }
  });

  setIndex(0);
}

function attachPurchaseActions(product) {
  const addButton = document.querySelector("[data-add-cart]");
  if (addButton) {
    if (window.Cart) {
      addButton.addEventListener("click", () => {
        window.Cart.add(product.id);
        updateCartCount();
        showStatus(`${product.title} added to cart.`);
      });
    } else {
      addButton.disabled = true;
    }
  }

  const buyButton = document.querySelector("[data-buy-now]");
  if (buyButton) {
    buyButton.addEventListener("click", () => {
      if (window.Cart) {
        window.Cart.setBuyNow(product.id, 1);
      }
      const url = new URL("/checkout.html", window.location.origin);
      url.searchParams.set("source", "buy");
      url.searchParams.set("item", product.id);
      window.location.href = `${url.pathname}${url.search}`;
    });
  }
}

async function init() {
  setYear();
  updateCartCount();
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const layout = document.getElementById("detail-layout");

  if (!id) {
    layout.innerHTML = `<div class="toast error">Missing product ID. Return to the <a href="/index.html" style="color: inherit; text-decoration: underline;">inventory list</a>.</div>`;
    return;
  }

  try {
    const product = await fetchJSON(`${API_BASE}/products/${encodeURIComponent(id)}`);
    renderProduct(product);
    attachPurchaseActions(product);
  } catch (error) {
    console.error(error);
    layout.innerHTML = `<div class="toast error">We couldn't find that product—maybe it was just reserved already.</div>`;
  }
}

document.addEventListener("DOMContentLoaded", init);
