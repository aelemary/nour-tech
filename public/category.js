const API_BASE = "/api";

const state = {
  products: [],
  companies: [],
};

const CATEGORY_META = {
  laptop: { label: "لابتوبات", icon: "💻" },
  gpu: { label: "كروت شاشة", icon: "🎮" },
  cpu: { label: "معالجات", icon: "🧠" },
  motherboard: { label: "لوحات أم", icon: "🧩" },
  ram: { label: "رامات", icon: "⚡" },
  storage: { label: "وحدات تخزين", icon: "💾" },
  hdd: { label: "هاردات", icon: "🗄️" },
  monitor: { label: "شاشات", icon: "🖥️" },
  printer: { label: "طابعات", icon: "🖨️" },
  desktop: { label: "أجهزة مكتبية", icon: "🧰" },
  power: { label: "مزودات طاقة", icon: "🔌" },
  accessory: { label: "إكسسوارات", icon: "⌨️" },
};

const CATEGORY_ORDER = [
  "laptop",
  "gpu",
  "cpu",
  "motherboard",
  "ram",
  "storage",
  "hdd",
  "monitor",
  "desktop",
  "power",
  "accessory",
  "printer",
];

const moneyFormatter = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeType(value = "") {
  return String(value || "").trim().toLowerCase();
}

function metaFor(type) {
  const normalized = normalizeType(type);
  return CATEGORY_META[normalized] || {
    label: normalized
      ? normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
      : "المنتجات",
    icon: "🛍️",
  };
}

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? moneyFormatter.format(amount) : "";
}

function getOldPrice(product) {
  return product.oldPrice ?? product.old_price ?? null;
}

function getSaleLabel(product) {
  return product.saleLabel ?? product.sale_label ?? "";
}

function isFeatured(product) {
  return Boolean(product.isFeatured ?? product.is_featured);
}

function productSummary(product) {
  return [product.cpu, product.gpu, product.ram, product.storage]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" • ");
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, { credentials: "include", ...options });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json();
}

function updateCartCount() {
  const badge = document.getElementById("cart-count");
  if (badge && window.Cart) badge.textContent = window.Cart.count();
}

function addToCart(product, button) {
  if (!window.Cart) return;
  window.Cart.add(product.id);
  updateCartCount();
  const old = button.textContent;
  button.textContent = "✓";
  button.disabled = true;
  setTimeout(() => {
    button.textContent = old;
    button.disabled = false;
  }, 900);
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.tabIndex = 0;

  const meta = metaFor(product.type);
  const brand = product.company?.name || "Nour Tech";
  const image = product.images?.[0] || "/data/nourtechsmall.png";
  const price = formatPrice(product.price);
  const oldPriceValue = getOldPrice(product);
  const oldPrice = formatPrice(oldPriceValue);
  const saleLabel = getSaleLabel(product);
  const featured = isFeatured(product);
  const hasStock = Object.prototype.hasOwnProperty.call(product, "stock");
  const stockNumber = Number(product.stock);
  const inStock = !hasStock || !Number.isFinite(stockNumber) || stockNumber > 0;
  const summary = productSummary(product);

  card.innerHTML = `
    <div class="product-flags">
      ${saleLabel ? `<span class="product-flag sale">${escapeHtml(saleLabel)}</span>` : ""}
      ${featured ? `<span class="product-flag featured">مميز</span>` : ""}
    </div>
    <div class="product-media"><img src="${escapeHtml(image)}" loading="lazy" decoding="async" alt="${escapeHtml(product.title || "منتج")}" /></div>
    <div class="product-body">
      <span class="product-brand">${escapeHtml(brand)} • ${escapeHtml(meta.label)}</span>
      <h3 class="product-title">${escapeHtml(product.title || "منتج بدون اسم")}</h3>
      ${summary ? `<p class="product-summary">${escapeHtml(summary)}</p>` : ""}
      <span class="product-stock ${inStock ? "" : "out"}">${inStock ? "● متوفر للطلب" : "● غير متوفر حاليًا"}</span>
      <div class="product-price-row">
        <div class="product-price">
          ${price ? `<strong>${price}</strong>${oldPrice && Number(oldPriceValue) > Number(product.price) ? `<del>${oldPrice}</del>` : ""}` : `<span class="product-contact-price">تواصل لمعرفة السعر</span>`}
        </div>
        <button class="product-cart-btn" type="button" aria-label="إضافة للسلة" ${inStock ? "" : "disabled"}>🛒</button>
      </div>
    </div>
  `;

  const url = `/laptop.html?id=${encodeURIComponent(product.id)}`;
  const open = () => { window.location.href = url; };
  card.addEventListener("click", open);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
  card.querySelector(".product-cart-btn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    addToCart(product, event.currentTarget);
  });

  return card;
}

function productText(product) {
  return [
    product.title,
    product.shortName,
    product.description,
    product.company?.name,
    product.type,
    product.cpu,
    product.gpu,
    product.ram,
    product.storage,
    product.display,
    product.specsRaw ? JSON.stringify(product.specsRaw) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function readFilters() {
  const form = document.getElementById("category-filter-form");
  if (!form) return {};
  return Object.fromEntries(
    Array.from(new FormData(form).entries()).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
  );
}

function includesValue(product, value, search) {
  if (!search) return true;
  const needle = String(search).toLowerCase();
  return String(value || "").toLowerCase().includes(needle) || productText(product).includes(needle);
}

function filterProducts(products, filters) {
  const search = String(filters.search || "").toLowerCase();
  const minPrice = Number(filters.minPrice);
  const maxPrice = Number(filters.maxPrice);

  return products.filter((product) => {
    const type = normalizeType(product.type);
    const price = Number(product.price);
    const stock = Number(product.stock);

    if (filters.category && type !== filters.category) return false;
    if (filters.companyId && product.companyId !== filters.companyId) return false;
    if (search && !productText(product).includes(search)) return false;
    if (!includesValue(product, product.cpu, filters.cpu)) return false;
    if (!includesValue(product, product.gpu, filters.gpu)) return false;
    if (!includesValue(product, product.ram, filters.ram)) return false;
    if (!includesValue(product, product.storage, filters.storage)) return false;
    if (Number.isFinite(minPrice) && minPrice > 0 && (!Number.isFinite(price) || price < minPrice)) return false;
    if (Number.isFinite(maxPrice) && maxPrice > 0 && (!Number.isFinite(price) || price > maxPrice)) return false;
    if (filters.inStock && Object.prototype.hasOwnProperty.call(product, "stock") && Number.isFinite(stock) && stock <= 0) return false;
    return true;
  });
}

function sortProducts(products) {
  const mode = document.getElementById("sort-products")?.value || "featured";
  return [...products].sort((a, b) => {
    if (mode === "featured") {
      const featuredDiff = Number(isFeatured(b)) - Number(isFeatured(a));
      if (featuredDiff) return featuredDiff;
      return Number(b.sortOrder ?? b.sort_order ?? 0) - Number(a.sortOrder ?? a.sort_order ?? 0);
    }
    if (mode === "price-asc") {
      const aPrice = Number(a.price) > 0 ? Number(a.price) : Number.MAX_SAFE_INTEGER;
      const bPrice = Number(b.price) > 0 ? Number(b.price) : Number.MAX_SAFE_INTEGER;
      return aPrice - bPrice;
    }
    if (mode === "price-desc") return Number(b.price || 0) - Number(a.price || 0);
    if (mode === "name") return String(a.title || "").localeCompare(String(b.title || ""), "ar");
    return String(b.createdAt || b.created_at || "").localeCompare(String(a.createdAt || a.created_at || ""));
  });
}

function populateCategories(products) {
  const select = document.getElementById("filter-category");
  if (!select) return;
  const current = select.value;
  const types = Array.from(new Set(products.map((product) => normalizeType(product.type)).filter(Boolean)));
  const ordered = [
    ...CATEGORY_ORDER.filter((type) => types.includes(type)),
    ...types.filter((type) => !CATEGORY_ORDER.includes(type)).sort(),
  ];
  select.innerHTML = '<option value="">كل الأقسام</option>';
  ordered.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = metaFor(type).label;
    select.appendChild(option);
  });
  if (current && ordered.includes(current)) select.value = current;
}

function populateCompanies(companies) {
  const select = document.getElementById("filter-company");
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">كل البراندات</option>';
  companies.forEach((company) => {
    const option = document.createElement("option");
    option.value = company.id;
    option.textContent = company.name;
    select.appendChild(option);
  });
  if (current && companies.some((company) => company.id === current)) select.value = current;
}

function updateHead(filters, count) {
  const title = document.getElementById("category-title");
  const subtitle = document.getElementById("category-subtitle");
  const countNode = document.getElementById("result-count");
  const context = document.getElementById("result-context");
  const category = filters.category ? metaFor(filters.category).label : "كل المنتجات";

  if (title) title.textContent = category;
  if (subtitle) subtitle.textContent = filters.search
    ? `نتائج البحث عن: ${filters.search}`
    : `تصفح ${category} واختر المواصفات المناسبة.`;
  if (countNode) countNode.textContent = `${count} منتج`;
  if (context) context.textContent = filters.search ? `البحث: “${filters.search}”` : "";
  document.title = `نور تكنولوجي | ${category}`;
}

function renderProducts() {
  const results = document.getElementById("category-results");
  const empty = document.getElementById("category-empty");
  if (!results) return;

  const filters = readFilters();
  const filtered = sortProducts(filterProducts(state.products, filters));
  results.innerHTML = "";
  filtered.forEach((product) => results.appendChild(createProductCard(product)));
  if (empty) empty.hidden = filtered.length > 0;
  updateHead(filters, filtered.length);
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type") || "";
  const search = params.get("search") || "";
  const category = document.getElementById("filter-category");
  const searchInput = document.getElementById("filter-search");
  const headerInput = document.querySelector('#header-search input[name="search"]');
  if (category && type) category.value = type;
  if (searchInput && search) searchInput.value = search;
  if (headerInput && search) headerInput.value = search;
}

function setupHeaderSearch() {
  const form = document.getElementById("header-search");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = String(new FormData(form).get("search") || "").trim();
    const filterInput = document.getElementById("filter-search");
    if (filterInput) filterInput.value = value;
    renderProducts();
  });
}

async function init() {
  updateCartCount();
  setupHeaderSearch();

  const form = document.getElementById("category-filter-form");
  const reset = document.getElementById("filter-reset");
  const sort = document.getElementById("sort-products");

  try {
    const [products, companies] = await Promise.all([
      fetchJSON(`${API_BASE}/products`),
      fetchJSON(`${API_BASE}/companies`).catch(() => []),
    ]);
    state.products = Array.isArray(products) ? products : [];
    state.companies = Array.isArray(companies) ? companies : [];
    populateCategories(state.products);
    populateCompanies(state.companies);
    applyUrlParams();
    renderProducts();
  } catch (error) {
    console.error(error);
    const status = document.getElementById("category-status");
    if (status) status.innerHTML = '<div class="toast error">تعذر تحميل بيانات المنتجات حاليًا.</div>';
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    renderProducts();
  });
  reset?.addEventListener("click", () => {
    form?.reset();
    history.replaceState({}, "", "/category.html");
    renderProducts();
  });
  sort?.addEventListener("change", renderProducts);
}

document.addEventListener("DOMContentLoaded", init);
