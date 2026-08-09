const API_BASE = "/api";
const state = {
  products: [],
  allProducts: [],
  companies: [],
};
let inventoryStatusEl = null;
let statusTimer = null;
const CATEGORY_LABELS = {
  laptop: "Laptops",
  gpu: "GPUs",
};

const STOREFRONT_CATEGORIES = ["laptop", "gpu"];
const CATEGORY_ORDER = ["laptop", "gpu"];
const FEATURED_LAPTOP_ID = "baf031a7-c94d-477a-adef-90e7b3da603a";

function formatCategoryLabel(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (!normalized) return "Products";
  if (CATEGORY_LABELS[normalized]) return CATEGORY_LABELS[normalized];
  if (normalized === "ram") return "RAM";
  const title = normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return title.endsWith("s") ? title : `${title}s`;
}

function normalizeCategory(type) {
  const normalized = String(type || "").trim().toLowerCase();
  return normalized || "other";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      if (data && data.error) message = data.error;
    } catch (error) {
      // ignore parse errors
    }
    const error = new Error(message || `Request failed with status ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

function updateCartCount() {
  if (!window.Cart) return;
  const badge = document.getElementById("cart-count");
  if (!badge) return;
  badge.textContent = window.Cart.count();
}

function showInventoryStatus(message, type = "success") {
  if (!inventoryStatusEl) return;
  if (statusTimer) {
    clearTimeout(statusTimer);
  }
  inventoryStatusEl.innerHTML = `<div class="toast ${type === "error" ? "error" : ""}">${message}</div>`;
  statusTimer = window.setTimeout(() => {
    inventoryStatusEl.innerHTML = "";
  }, 3000);
}

function populateCompanyFilter(companies = []) {
  const select = document.getElementById("filter-company");
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">Any brand</option>`;
  companies.forEach((company) => {
    const option = document.createElement("option");
    option.value = company.id;
    option.textContent = company.name;
    select.appendChild(option);
  });
  if (current && companies.find((company) => company.id === current)) {
    select.value = current;
  }
}

function populateCategoryFilter(products = []) {
  const select = document.getElementById("filter-category");
  if (!select) return;
  const current = select.value;
  const knownOrder = Object.keys(CATEGORY_LABELS);
  const dynamicTypes = Array.from(
    new Set(
      (products || [])
        .map((product) => String(product.type || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
  const types = [
    ...knownOrder.filter((type) => dynamicTypes.includes(type)),
    ...dynamicTypes.filter((type) => !knownOrder.includes(type)).sort(),
  ];
  select.innerHTML = `<option value="">All categories</option>`;
  types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = formatCategoryLabel(type);
    select.appendChild(option);
  });
  if (current && types.includes(current)) {
    select.value = current;
  }
}

function setupHeaderSearch() {
  const form = document.getElementById("header-search");
  if (!form) return;
  form.dataset.searchBound = "true";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const search = String(new FormData(form).get("search") || "").trim();
    const url = new URL("/category.html", window.location.origin);
    if (search) url.searchParams.set("search", search);
    window.location.href = url.toString();
  });
}

function groupProducts(products) {
  return products.reduce((acc, product) => {
    const type = normalizeCategory(product.type);
    if (!acc[type]) acc[type] = [];
    acc[type].push(product);
    return acc;
  }, {});
}

function orderedCategories(grouped) {
  return [
    ...CATEGORY_ORDER.filter((type) => grouped[type]?.length),
    ...Object.keys(grouped)
      .filter((type) => !CATEGORY_ORDER.includes(type))
      .sort((a, b) => formatCategoryLabel(a).localeCompare(formatCategoryLabel(b))),
  ];
}

function productSummary(product) {
  const title = String(product.title || "").trim().toLowerCase();
  const laptopSpecs = [product.cpu, product.gpu, product.ram, product.storage]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" • ");
  return [laptopSpecs, product.shortName, product.description]
    .map((value) => String(value || "").trim())
    .find((value) => value && value.toLowerCase() !== title) || "";
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card rail-card";
  const typeLabel = formatCategoryLabel(product.type);
  const brandLabel = product.company?.name || "Unassigned";
  const image = product.images?.[0] || "/data/nourtechsmall.png";
  const summary = productSummary(product);
  card.innerHTML = `
    <div class="product-media">
      <img src="${escapeHtml(image)}" loading="lazy" decoding="async" alt="${escapeHtml(product.title)}" />
    </div>
    <div class="product-body">
      <span class="product-category">${escapeHtml(brandLabel)} • ${escapeHtml(typeLabel)}</span>
      <h3 class="product-title">${escapeHtml(product.title)}</h3>
      ${summary ? `<p class="product-summary">${escapeHtml(summary)}</p>` : ""}
      <span class="product-card-action">View product</span>
    </div>
  `;
  card.querySelector("img")?.addEventListener("error", (event) => {
    if (!event.currentTarget.src.endsWith("/data/nourtechsmall.png")) {
      event.currentTarget.src = "/data/nourtechsmall.png";
    }
  });
  const detailUrl = `/laptop.html?id=${encodeURIComponent(product.id)}`;
  card.dataset.href = detailUrl;
  card.addEventListener("click", (event) => {
    window.location.href = detailUrl;
  });
  return card;
}

function setMerchandisingImages(products) {
  const laptop =
    products.find((product) => product.id === FEATURED_LAPTOP_ID) ||
    products.find((product) => normalizeCategory(product.type) === "laptop");
  const gpu = products.find((product) => normalizeCategory(product.type) === "gpu");
  const mappings = [
    ["hero-laptop-image", laptop],
    ["category-laptop-image", laptop],
    ["hero-gpu-image", gpu],
    ["category-gpu-image", gpu],
  ];
  mappings.forEach(([id, product]) => {
    const image = document.getElementById(id);
    if (!image) return;
    image.src = product?.images?.[0] || "/data/nourtechsmall.png";
    image.addEventListener("error", () => {
      if (!image.src.endsWith("/data/nourtechsmall.png")) image.src = "/data/nourtechsmall.png";
    });
  });
}

function setYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

async function loadInventory(params = {}) {
  const url = new URL(`${API_BASE}/products`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value != null) {
      url.searchParams.set(key, value);
    }
  });
  return fetchJSON(url.toString());
}

async function loadCompanies() {
  return fetchJSON(`${API_BASE}/companies`);
}

function toggleEmptyState(hasResults) {
  const empty = document.getElementById("empty");
  if (!empty) return;
  empty.hidden = hasResults;
}

function renderProducts(products) {
  state.products = products;
  const results = document.getElementById("results");
  results.innerHTML = "";
  if (!products.length) {
    toggleEmptyState(false);
    return;
  }
  toggleEmptyState(true);
  const fragment = document.createDocumentFragment();
  const grouped = groupProducts(products);
  const categoryOrder = orderedCategories(grouped);
  categoryOrder.forEach((type) => {
    const items = grouped[type] || [];
    if (!items.length) return;
    const section = document.createElement("section");
    section.className = `catalog-section store-product-section store-product-section-${type}`;
    section.innerHTML = `
      <div class="catalog-heading">
        <div>
          <span class="store-section-kicker">${type === "laptop" ? "Work, create and play anywhere" : "Desktop performance starts here"}</span>
          <h2>${formatCategoryLabel(type)}</h2>
        </div>
        <a class="store-view-all" href="/category.html?type=${encodeURIComponent(type)}">View all ${items.length}</a>
      </div>
      <div class="store-promo-band">
        <strong>${type === "laptop" ? "Find your next everyday machine" : "Give your PC the graphics power it deserves"}</strong>
        <span>${type === "laptop" ? "Compare processors, memory, storage and displays." : "Explore GPUs for gaming, creation and demanding workloads."}</span>
      </div>
      <div class="store-product-grid"></div>
    `;
    const grid = section.querySelector(".store-product-grid");
    items.slice(0, 10).forEach((product) => grid.appendChild(createProductCard(product)));
    fragment.appendChild(section);
  });
  results.appendChild(fragment);
}

async function init() {
  setYear();
  inventoryStatusEl = document.getElementById("inventory-status");
  updateCartCount();
  setupHeaderSearch();
  try {
    const categoryInventories = await Promise.all(
      STOREFRONT_CATEGORIES.map((type) => loadInventory({ type }))
    );
    const inventory = categoryInventories.flat();
    state.allProducts = (inventory || []).filter((product) =>
      STOREFRONT_CATEGORIES.includes(normalizeCategory(product.type))
    );
    setMerchandisingImages(state.allProducts);
    renderProducts(state.allProducts);
  } catch (error) {
    console.error(error);
    showInventoryStatus("Could not load inventory right now.", "error");
    const results = document.getElementById("results");
    results.innerHTML = `<div class="toast error">Inventory isn't loading yet. Please try again shortly.</div>`;
    toggleEmptyState(true);
  }
}

document.addEventListener("DOMContentLoaded", init);
