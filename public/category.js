const API_BASE = "/api";

const state = {
  products: [],
  companies: [],
};

const CATEGORY_LABELS = {
  laptop: "Laptops",
  gpu: "GPUs",
};
const STOREFRONT_CATEGORIES = ["laptop", "gpu"];

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
  form.dataset.searchBound = "true";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const search = String(new FormData(form).get("search") || "").trim();
    const url = new URL("/category.html", window.location.origin);
    const currentType = new URLSearchParams(window.location.search).get("type");
    if (currentType) url.searchParams.set("type", currentType);
    if (search) url.searchParams.set("search", search);
    window.location.href = `${url.pathname}${url.search}`;
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

function readFilters() {
  const params = new URLSearchParams(window.location.search);
  const type = String(params.get("type") || "").toLowerCase();
  return {
    category: STOREFRONT_CATEGORIES.includes(type) ? type : "",
    search: String(params.get("search") || "").trim(),
  };
}

function filterProducts(products, filters) {
  const search = (filters.search || "").toLowerCase();
  return products.filter((product) => {
    const type = String(product.type || "").toLowerCase();
    if (filters.category && type !== filters.category) return false;
    if (search && !productText(product).includes(search)) return false;
    return true;
  });
}

function formatPrice(price, currency = "EGP") {
  if (price == null || !Number.isFinite(Number(price))) return "Contact for price";
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

function populateCategorySelect(products = []) {
  const select = document.getElementById("filter-category");
  if (!select) return;
  const current = select.value;
  const dynamicTypes = Array.from(
    new Set(products.map((product) => String(product.type || "").trim().toLowerCase()).filter(Boolean))
  );
  const types = STOREFRONT_CATEGORIES.filter((type) => dynamicTypes.includes(type));
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
  card.className = "product-card";
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
      <strong class="product-price">${escapeHtml(formatPrice(product.price, product.currency))}</strong>
      <span class="product-card-action">View product</span>
    </div>
  `;
  card.querySelector("img")?.addEventListener("error", (event) => {
    if (!event.currentTarget.src.endsWith("/data/nourtechsmall.png")) {
      event.currentTarget.src = "/data/nourtechsmall.png";
    }
  });
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
      ? `Browse available ${categoryLabel.toLowerCase()}.`
      : "Browse available laptops and graphics cards.";
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
  const requestedType = String(params.get("type") || "").toLowerCase();
  const type = STOREFRONT_CATEGORIES.includes(requestedType) ? requestedType : "";
  const search = params.get("search") || "";
  const headerInput = document.querySelector("#header-search input[name='search']");
  if (headerInput && search) headerInput.value = search;
}

async function init() {
  setYear();
  updateCartCount();
  setupHeaderSearch();
  try {
    const categoryInventories = await Promise.all(
      STOREFRONT_CATEGORIES.map((type) => fetchJSON(`${API_BASE}/products?type=${encodeURIComponent(type)}`))
    );
    const products = categoryInventories.flat();
    state.products = (products || []).filter((product) =>
      STOREFRONT_CATEGORIES.includes(String(product.type || "").trim().toLowerCase())
    );
    applyInitialParams();
    renderProducts();
  } catch (error) {
    console.error(error);
    const results = document.getElementById("category-results");
    if (results) results.innerHTML = `<div class="toast error">Could not load catalog data.</div>`;
  }
}

document.addEventListener("DOMContentLoaded", init);
