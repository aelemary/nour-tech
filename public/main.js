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
  cpu: "CPUs",
  hdd: "HDDs",
  storage: "Storage",
  motherboard: "Motherboards",
  ram: "Memory",
  monitor: "Monitors",
  printer: "Printers",
  desktop: "Desktops",
  power: "Power",
  accessory: "Accessories",
};

const CATEGORY_ORDER = [
  "laptop",
  "gpu",
  "cpu",
  "storage",
  "hdd",
  "motherboard",
  "ram",
  "monitor",
  "printer",
  "desktop",
  "power",
  "accessory",
];

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

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "laptop-card";
  const typeLabel = formatCategoryLabel(product.type);
  const brandLabel = product.company?.name || "Unassigned";
  const image =
    product.images?.[0] || `https://placehold.co/600x400?text=${encodeURIComponent(typeLabel)}`;
  const detailText = product.shortName || product.description || "—";
  const warrantyText = product.warranty ? `${product.warranty} yr warranty` : "—";
  const specLeft =
    product.type === "laptop"
      ? `<span><strong>GPU</strong><span>${escapeHtml(product.gpu || "n/a")}</span></span>`
      : `<span><strong>Details</strong><span>${escapeHtml(detailText)}</span></span>`;
  const specRight =
    product.type === "laptop"
      ? `<span><strong>CPU</strong><span>${escapeHtml(product.cpu || "n/a")}</span></span>`
      : `<span><strong>Warranty</strong><span>${escapeHtml(warrantyText)}</span></span>`;
  card.innerHTML = `
    <img class="card-thumb" src="${escapeHtml(image)}" loading="lazy" alt="${escapeHtml(product.title)}" />
    <div class="card-content">
      <div class="card-title-row">
        <span class="badge">${escapeHtml(brandLabel)} • ${escapeHtml(typeLabel)}</span>
        <h3 class="title-desktop">${escapeHtml(product.title)}</h3>
        <h3 class="title-mobile">${escapeHtml(product.shortName || product.title)}</h3>
      </div>
      <div class="spec-inline">
        ${specLeft}
        ${specRight}
      </div>
      <div class="card-actions compact-actions">
        <div class="price">${new Intl.NumberFormat("en-EG", {
          style: "currency",
          currency: product.currency || "EGP",
          maximumFractionDigits: 0,
        }).format(product.price)}</div>
      </div>
    </div>
  `;
  const detailUrl = `/laptop.html?id=${encodeURIComponent(product.id)}`;
  card.dataset.href = detailUrl;
  card.addEventListener("click", (event) => {
    window.location.href = detailUrl;
  });
  return card;
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
    section.className = "catalog-section product-rail-section";
    section.innerHTML = `
      <div class="catalog-heading">
        <h2>${formatCategoryLabel(type)}</h2>
        <div class="rail-heading-actions">
          <button class="rail-button" type="button" data-rail-prev aria-label="Scroll ${escapeHtml(formatCategoryLabel(type))} left">‹</button>
          <button class="rail-button" type="button" data-rail-next aria-label="Scroll ${escapeHtml(formatCategoryLabel(type))} right">›</button>
          <a href="/category.html?type=${encodeURIComponent(type)}">View all ${items.length}</a>
        </div>
      </div>
      <div class="product-rail"></div>
    `;
    const rail = section.querySelector(".product-rail");
    items.slice(0, 16).forEach((product) => rail.appendChild(createProductCard(product)));
    const prev = section.querySelector("[data-rail-prev]");
    const next = section.querySelector("[data-rail-next]");
    const scrollRail = (direction) => {
      rail.scrollBy({
        left: direction * Math.max(rail.clientWidth * 0.85, 260),
        behavior: "smooth",
      });
    };
    if (prev) prev.addEventListener("click", () => scrollRail(-1));
    if (next) next.addEventListener("click", () => scrollRail(1));
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
    const inventory = await loadInventory();
    state.allProducts = inventory || [];
    renderProducts(inventory);
  } catch (error) {
    console.error(error);
    showInventoryStatus("Could not load inventory right now.", "error");
    const results = document.getElementById("results");
    results.innerHTML = `<div class="toast error">Inventory isn't loading yet. Please try again shortly.</div>`;
    toggleEmptyState(true);
  }
}

document.addEventListener("DOMContentLoaded", init);
