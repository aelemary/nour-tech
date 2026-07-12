const API_BASE = "/api";

const state = {
  products: [],
  companies: [],
};

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

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCategoryLabel(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (!normalized) return "Products";
  if (CATEGORY_LABELS[normalized]) return CATEGORY_LABELS[normalized];
  const title = normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return title.endsWith("s") ? title : `${title}s`;
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
    const err = new Error(message || `Request failed with status ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function setYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

function updateCartCount() {
  if (!window.Cart) return;
  const badge = document.getElementById("cart-count");
  if (badge) badge.textContent = window.Cart.count();
}

function setupHeaderSearch() {
  const form = document.getElementById("header-search");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const search = String(new FormData(form).get("search") || "").trim();
    const input = document.getElementById("filter-search");
    if (input) input.value = search;
    renderProducts();
  });
}

function productText(product) {
  return [
    product.title,
    product.shortName,
    product.description,
    product.company?.name,
    product.type,
    product.gpu,
    product.cpu,
    product.ram,
    product.storage,
    product.display,
    product.specsRaw ? JSON.stringify(product.specsRaw) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesText(value, search) {
  if (!search) return true;
  return String(value || "").toLowerCase().includes(search);
}

function includesFieldOrProductText(product, fieldValue, search) {
  if (!search) return true;
  return includesText(fieldValue, search) || productText(product).includes(search);
}

function readFilters() {
  const form = document.getElementById("category-filter-form");
  const data = form ? Object.fromEntries(new FormData(form).entries()) : {};
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
  );
}

function filterProducts(products, filters) {
  const search = (filters.search || "").toLowerCase();
  return products.filter((product) => {
    const type = String(product.type || "").toLowerCase();
    if (filters.category && type !== filters.category) return false;
    if (filters.companyId && product.companyId !== filters.companyId) return false;
    if (search && !productText(product).includes(search)) return false;
    if (!includesFieldOrProductText(product, product.cpu || product.description, filters.cpu?.toLowerCase())) return false;
    if (!includesFieldOrProductText(product, product.gpu || product.description, filters.gpu?.toLowerCase())) return false;
    if (!includesFieldOrProductText(product, product.ram || product.description, filters.ram?.toLowerCase())) return false;
    if (!includesFieldOrProductText(product, product.storage || product.description, filters.storage?.toLowerCase())) return false;
    return true;
  });
}

function populateCategorySelect(products = []) {
  const select = document.getElementById("filter-category");
  if (!select) return;
  const current = select.value;
  const dynamicTypes = Array.from(
    new Set(products.map((product) => String(product.type || "").trim().toLowerCase()).filter(Boolean))
  );
  const knownOrder = Object.keys(CATEGORY_LABELS);
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
  if (current && types.includes(current)) select.value = current;
}

function populateCompanySelect(companies = []) {
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
  if (current && companies.some((company) => company.id === current)) select.value = current;
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "laptop-card";
  const typeLabel = formatCategoryLabel(product.type);
  const brandLabel = product.company?.name || "Unassigned";
  const image =
    product.images?.[0] || `https://placehold.co/600x400?text=${encodeURIComponent(typeLabel)}`;
  const detailText = product.shortName || product.description || "-";
  const warrantyText = product.warranty ? `${product.warranty} yr warranty` : "-";
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
    </div>
  `;
  card.addEventListener("click", () => {
    window.location.href = `/laptop.html?id=${encodeURIComponent(product.id)}`;
  });
  return card;
}

function updateHead(filters, count) {
  const title = document.getElementById("category-title");
  const subtitle = document.getElementById("category-subtitle");
  const resultCount = document.getElementById("result-count");
  const resultContext = document.getElementById("result-context");
  const categoryLabel = filters.category ? formatCategoryLabel(filters.category) : "";
  if (title) title.textContent = categoryLabel || "Catalog Search";
  if (subtitle) {
    subtitle.textContent = categoryLabel
      ? `Browse ${categoryLabel.toLowerCase()} with brand and specification filters.`
      : "Refine products by keyword, brand, category, and visible specification text.";
  }
  if (resultCount) resultCount.textContent = `${count} product${count === 1 ? "" : "s"}`;
  if (resultContext) resultContext.textContent = filters.search ? `Search: "${filters.search}"` : "";
  document.title = `Nour Tech | ${categoryLabel || "Catalog Search"}`;
}

function renderProducts() {
  const results = document.getElementById("category-results");
  const empty = document.getElementById("category-empty");
  if (!results) return;
  const filters = readFilters();
  const filtered = filterProducts(state.products, filters);
  results.innerHTML = "";
  if (!filtered.length) {
    if (empty) empty.hidden = false;
  } else {
    if (empty) empty.hidden = true;
    const fragment = document.createDocumentFragment();
    filtered.forEach((product) => fragment.appendChild(createProductCard(product)));
    results.appendChild(fragment);
  }
  updateHead(filters, filtered.length);
}

function applyInitialParams() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type") || "";
  const search = params.get("search") || "";
  const categoryInput = document.getElementById("filter-category");
  const searchInput = document.getElementById("filter-search");
  const headerInput = document.querySelector("#header-search input[name='search']");
  if (categoryInput && type) categoryInput.value = type;
  if (searchInput && search) searchInput.value = search;
  if (headerInput && search) headerInput.value = search;
}

async function init() {
  setYear();
  updateCartCount();
  setupHeaderSearch();
  const form = document.getElementById("category-filter-form");
  const resetButton = document.getElementById("filter-reset");
  try {
    const [products, companies] = await Promise.all([
      fetchJSON(`${API_BASE}/products`),
      fetchJSON(`${API_BASE}/companies`).catch(() => []),
    ]);
    state.products = products || [];
    state.companies = companies || [];
    populateCategorySelect(state.products);
    populateCompanySelect(state.companies);
    applyInitialParams();
    renderProducts();
  } catch (error) {
    console.error(error);
    const status = document.getElementById("category-status");
    if (status) status.innerHTML = `<div class="toast error">Could not load catalog data.</div>`;
  }
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      renderProducts();
    });
  }
  if (resetButton && form) {
    resetButton.addEventListener("click", () => {
      form.reset();
      renderProducts();
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
