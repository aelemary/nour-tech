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
  return String(value || "").trim().toLowerCase() || "other";
}

function categoryMeta(type) {
  const normalized = normalizeType(type);
  if (CATEGORY_META[normalized]) return CATEGORY_META[normalized];
  return {
    label: normalized
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
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
  const values = [
    product.cpu,
    product.gpu,
    product.ram,
    product.storage,
    product.shortName,
    product.description,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return values.slice(0, 3).join(" • ");
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
  if (!badge || !window.Cart) return;
  badge.textContent = window.Cart.count();
}

function addToCart(product, button) {
  if (!window.Cart) return;
  window.Cart.add(product.id);
  updateCartCount();
  const original = button.textContent;
  button.textContent = "✓";
  button.disabled = true;
  window.setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 900);
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.tabIndex = 0;

  const meta = categoryMeta(product.type);
  const brand = product.company?.name || "Nour Tech";
  const image = product.images?.[0] || "/data/nourtechsmall.png";
  const price = formatPrice(product.price);
  const oldPriceValue = getOldPrice(product);
  const oldPrice = formatPrice(oldPriceValue);
  const saleLabel = getSaleLabel(product);
  const featured = isFeatured(product);
  const hasStockField = Object.prototype.hasOwnProperty.call(product, "stock");
  const stock = Number(product.stock);
  const inStock = !hasStockField || !Number.isFinite(stock) || stock > 0;
  const summary = productSummary(product);

  card.innerHTML = `
    <div class="product-flags">
      ${saleLabel ? `<span class="product-flag sale">${escapeHtml(saleLabel)}</span>` : ""}
      ${featured ? `<span class="product-flag featured">مميز</span>` : ""}
    </div>
    <div class="product-media">
      <img src="${escapeHtml(image)}" loading="lazy" decoding="async" alt="${escapeHtml(product.title || "منتج")}" />
    </div>
    <div class="product-body">
      <span class="product-brand">${escapeHtml(brand)} • ${escapeHtml(meta.label)}</span>
      <h3 class="product-title">${escapeHtml(product.title || "منتج بدون اسم")}</h3>
      ${summary ? `<p class="product-summary">${escapeHtml(summary)}</p>` : ""}
      <span class="product-stock ${inStock ? "" : "out"}">${inStock ? "● متوفر للطلب" : "● غير متوفر حاليًا"}</span>
      <div class="product-price-row">
        <div class="product-price">
          ${price ? `<strong>${price}</strong>${oldPrice && Number(oldPriceValue) > Number(product.price) ? `<del>${oldPrice}</del>` : ""}` : `<span class="product-contact-price">تواصل لمعرفة السعر</span>`}
        </div>
        <button class="product-cart-btn" type="button" aria-label="إضافة ${escapeHtml(product.title || "المنتج")} للسلة" ${inStock ? "" : "disabled"}>🛒</button>
      </div>
    </div>
  `;

  const detailUrl = `/laptop.html?id=${encodeURIComponent(product.id)}`;
  const openProduct = () => {
    window.location.href = detailUrl;
  };

  card.addEventListener("click", openProduct);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProduct();
    }
  });

  const cartButton = card.querySelector(".product-cart-btn");
  cartButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    addToCart(product, cartButton);
  });

  return card;
}

function groupedProducts(products) {
  return products.reduce((groups, product) => {
    const type = normalizeType(product.type);
    if (!groups[type]) groups[type] = [];
    groups[type].push(product);
    return groups;
  }, {});
}

function orderedTypes(groups) {
  return [
    ...CATEGORY_ORDER.filter((type) => groups[type]?.length),
    ...Object.keys(groups).filter((type) => !CATEGORY_ORDER.includes(type)).sort(),
  ];
}

function renderCategories(products) {
  const grid = document.getElementById("category-grid");
  if (!grid) return;

  const groups = groupedProducts(products);
  const types = orderedTypes(groups);
  const visibleTypes = types.length ? types : CATEGORY_ORDER.slice(0, 8);
  grid.innerHTML = "";

  visibleTypes.slice(0, 12).forEach((type) => {
    const meta = categoryMeta(type);
    const count = groups[type]?.length || 0;
    const link = document.createElement("a");
    link.className = "category-tile";
    link.href = `/category.html?type=${encodeURIComponent(type)}`;
    link.innerHTML = `
      <span class="category-icon">${meta.icon}</span>
      <strong>${escapeHtml(meta.label)}</strong>
      <small>${count ? `${count} منتج` : "استكشف القسم"}</small>
    `;
    grid.appendChild(link);
  });
}

function renderFeatured(products) {
  const grid = document.getElementById("featured-products");
  if (!grid) return;

  const featured = products.filter(isFeatured);
  const list = (featured.length ? featured : products).slice(0, 8);
  grid.innerHTML = "";
  list.forEach((product) => grid.appendChild(createProductCard(product)));
}

function renderCatalog(products) {
  const results = document.getElementById("results");
  const empty = document.getElementById("empty");
  if (!results) return;

  results.innerHTML = "";
  if (!products.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const groups = groupedProducts(products);
  orderedTypes(groups).forEach((type) => {
    const items = groups[type];
    const meta = categoryMeta(type);
    const section = document.createElement("section");
    section.className = "catalog-section";
    section.innerHTML = `
      <div class="catalog-heading">
        <h2>${escapeHtml(meta.label)}</h2>
        <div class="rail-heading-actions">
          <button class="rail-button" type="button" data-prev aria-label="السابق">‹</button>
          <button class="rail-button" type="button" data-next aria-label="التالي">›</button>
          <a class="store-section-link" href="/category.html?type=${encodeURIComponent(type)}">عرض الكل</a>
        </div>
      </div>
      <div class="product-rail"></div>
    `;

    const rail = section.querySelector(".product-rail");
    items.slice(0, 16).forEach((product) => rail.appendChild(createProductCard(product)));
    section.querySelector("[data-prev]")?.addEventListener("click", () => {
      rail.scrollBy({ left: Math.max(rail.clientWidth * 0.85, 280), behavior: "smooth" });
    });
    section.querySelector("[data-next]")?.addEventListener("click", () => {
      rail.scrollBy({ left: -Math.max(rail.clientWidth * 0.85, 280), behavior: "smooth" });
    });
    results.appendChild(section);
  });
}

function updateHero(products) {
  const chosen = products.find(isFeatured) || products[0];
  if (!chosen) return;

  const title = document.getElementById("hero-title");
  const description = document.getElementById("hero-description");
  const image = document.getElementById("hero-product-image");
  const placeholder = document.getElementById("hero-placeholder");

  if (title) title.textContent = chosen.title || "قوة تستحقها في كل لعبة وكل مشروع";
  if (description) {
    description.textContent = productSummary(chosen) || chosen.description || "اكتشف أحدث منتجات نور تكنولوجي بضمان ودعم فني.";
  }
  if (image && chosen.images?.[0]) {
    image.src = chosen.images[0];
    image.alt = chosen.title || "منتج مميز";
    image.classList.add("store-hero-product");
    if (placeholder) placeholder.style.background = "rgba(255,255,255,.08)";
  }
}

function setupSearch() {
  const form = document.getElementById("header-search");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = String(new FormData(form).get("search") || "").trim();
    const url = new URL("/category.html", window.location.origin);
    if (query) url.searchParams.set("search", query);
    window.location.href = `${url.pathname}${url.search}`;
  });
}

function showStatus(message, isError = false) {
  const container = document.getElementById("inventory-status");
  if (!container) return;
  container.innerHTML = `<div class="toast ${isError ? "error" : ""}">${escapeHtml(message)}</div>`;
}

async function init() {
  updateCartCount();
  setupSearch();

  try {
    const [products, companies] = await Promise.all([
      fetchJSON(`${API_BASE}/products`),
      fetchJSON(`${API_BASE}/companies`).catch(() => []),
    ]);
    state.products = Array.isArray(products) ? products : [];
    state.companies = Array.isArray(companies) ? companies : [];
    renderCategories(state.products);
    renderFeatured(state.products);
    renderCatalog(state.products);
    updateHero(state.products);
  } catch (error) {
    console.error(error);
    renderCategories([]);
    showStatus("تعذر تحميل المنتجات الآن. جرّب تحديث الصفحة بعد قليل.", true);
    const empty = document.getElementById("empty");
    if (empty) empty.hidden = false;
  }
}

document.addEventListener("DOMContentLoaded", init);
