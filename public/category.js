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
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.forEach((value, key) => url.searchParams.set(key, value));
    if (search) url.searchParams.set("search", search);
    else url.searchParams.delete("search");
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
    brands: params.getAll("brand").filter(Boolean),
    minPrice: String(params.get("minPrice") || ""),
    maxPrice: String(params.get("maxPrice") || ""),
  };
}

function matchesPriceRange(product, minimum, maximum) {
  const price = Number(product.price);
  if ((!minimum && !maximum) || !Number.isFinite(price)) return !minimum && !maximum;
  return (!minimum || price >= Number(minimum)) && (!maximum || price <= Number(maximum));
}

function productBrand(product) {
  return String(product.company?.name || "Other").trim() || "Other";
}

function filterProducts(products, filters) {
  const search = (filters.search || "").toLowerCase();
  return products.filter((product) => {
    const type = String(product.type || "").toLowerCase();
    if (filters.category && type !== filters.category) return false;
    if (search && !productText(product).includes(search)) return false;
    if (filters.brands.length && !filters.brands.includes(productBrand(product))) return false;
    if (!matchesPriceRange(product, filters.minPrice, filters.maxPrice)) return false;
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

function categoryPriceBounds(filters) {
  const prices = state.products
    .filter((product) => !filters.category || String(product.type || "").toLowerCase() === filters.category)
    .map((product) => Number(product.price))
    .filter(Number.isFinite);
  const lowest = prices.length ? Math.floor(Math.min(...prices) / 5000) * 5000 : 0;
  const highest = prices.length ? Math.ceil(Math.max(...prices) / 5000) * 5000 : 200000;
  return { minimum: Math.max(lowest, 0), maximum: Math.max(highest, 5000) };
}

function updatePriceRangeDisplay() {
  const minRange = document.getElementById("filter-price-min");
  const maxRange = document.getElementById("filter-price-max");
  const track = document.getElementById("price-range-track");
  const label = document.getElementById("price-range-label");
  if (!minRange || !maxRange || !track || !label) return;
  const minimum = Number(minRange.min);
  const maximum = Number(maxRange.max);
  const low = Number(minRange.value);
  const high = Number(maxRange.value);
  const start = ((low - minimum) / (maximum - minimum || 1)) * 100;
  const end = ((high - minimum) / (maximum - minimum || 1)) * 100;
  track.style.setProperty("--range-start", `${start}%`);
  track.style.setProperty("--range-end", `${end}%`);
  const anyRange = low <= minimum && high >= maximum;
  label.textContent = anyRange ? "Any budget" : `${formatPrice(low)} – ${formatPrice(high)}`;
  const minValue = document.getElementById("price-min-value");
  const maxValue = document.getElementById("price-max-value");
  if (minValue) minValue.textContent = formatPrice(low);
  if (maxValue) maxValue.textContent = high >= maximum ? "Any price" : formatPrice(high);
}

function populateBrandFilters(products, filters) {
  const container = document.getElementById("filter-brands");
  if (!container) return;
  const available = Array.from(new Set(products.map(productBrand))).sort((a, b) => a.localeCompare(b));
  container.innerHTML = "";
  available.forEach((brand) => {
    const label = document.createElement("label");
    label.className = "model-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "brand";
    input.value = brand;
    input.checked = filters.brands.includes(brand);
    const text = document.createElement("span");
    text.textContent = brand;
    label.append(input, text);
    container.appendChild(label);
  });
}

function syncFilterControls(filters) {
  const minRange = document.getElementById("filter-price-min");
  const maxRange = document.getElementById("filter-price-max");
  if (!minRange || !maxRange) return;
  const bounds = categoryPriceBounds(filters);
  const selectedMin = Number(filters.minPrice);
  const selectedMax = Number(filters.maxPrice);
  const low = Number.isFinite(selectedMin) && filters.minPrice ? selectedMin : bounds.minimum;
  const high = Number.isFinite(selectedMax) && filters.maxPrice ? selectedMax : bounds.maximum;
  minRange.min = maxRange.min = String(bounds.minimum);
  minRange.max = maxRange.max = String(bounds.maximum);
  minRange.value = String(Math.min(low, high));
  maxRange.value = String(Math.max(low, high));
  updatePriceRangeDisplay();
}

function updateFilterUrl(updates = {}, brands = []) {
  const url = new URL(window.location.href);
  Object.entries(updates).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  });
  url.searchParams.delete("model");
  url.searchParams.delete("brand");
  brands.forEach((brand) => url.searchParams.append("brand", brand));
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

function setupFilters() {
  const form = document.getElementById("catalog-filters");
  if (!form) return;
  const minRange = document.getElementById("filter-price-min");
  const maxRange = document.getElementById("filter-price-max");
  [minRange, maxRange].filter(Boolean).forEach((range) => {
    range.addEventListener("input", () => {
      const step = Number(range.step || 1);
      if (range === minRange && Number(minRange.value) > Number(maxRange.value) - step) minRange.value = String(Number(maxRange.value) - step);
      if (range === maxRange && Number(maxRange.value) < Number(minRange.value) + step) maxRange.value = String(Number(minRange.value) + step);
      updatePriceRangeDisplay();
    });
  });
  form.addEventListener("change", () => {
    const bounds = categoryPriceBounds(readFilters());
    const brands = Array.from(form.querySelectorAll('input[name="brand"]:checked'), (input) => input.value);
    const low = Number(minRange.value);
    const high = Number(maxRange.value);
    updateFilterUrl({
      minPrice: low > bounds.minimum ? low : "",
      maxPrice: high < bounds.maximum ? high : "",
      price: "",
      cpu: "",
      laptopGpu: "",
      ram: "",
      gpuFamily: "",
      vram: "",
    }, brands);
    syncFilterControls(readFilters());
    renderProducts();
  });
  document.getElementById("clear-filters")?.addEventListener("click", () => {
    updateFilterUrl({ minPrice: "", maxPrice: "", price: "", cpu: "", laptopGpu: "", ram: "", gpuFamily: "", vram: "" });
    populateBrandFilters(state.products.filter((product) => !readFilters().category || String(product.type || "").toLowerCase() === readFilters().category), readFilters());
    syncFilterControls(readFilters());
    renderProducts();
  });
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
  const activeFilters = filters.brands.length + [filters.minPrice, filters.maxPrice].filter(Boolean).length;
  if (resultContext) {
    resultContext.textContent = [
      filters.search ? `Search: "${filters.search}"` : "",
      activeFilters ? `${activeFilters} filter${activeFilters === 1 ? "" : "s"} applied` : "",
    ].filter(Boolean).join(" • ");
  }
  const filterCount = document.getElementById("active-filter-count");
  if (filterCount) filterCount.textContent = activeFilters ? `${activeFilters} active` : "All products";
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
    const filters = readFilters();
    populateBrandFilters(
      state.products.filter((product) => !filters.category || String(product.type || "").toLowerCase() === filters.category),
      filters
    );
    syncFilterControls(filters);
    setupFilters();
    renderProducts();
  } catch (error) {
    console.error(error);
    const results = document.getElementById("category-results");
    if (results) results.innerHTML = `<div class="toast error">Could not load catalog data.</div>`;
  }
}

document.addEventListener("DOMContentLoaded", init);
