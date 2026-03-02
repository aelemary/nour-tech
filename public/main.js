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
  motherboard: "Motherboards",
};

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
      ? `<span><strong>GPU</strong><span>${product.gpu || "n/a"}</span></span>`
      : `<span><strong>Details</strong><span>${detailText}</span></span>`;
  const specRight =
    product.type === "laptop"
      ? `<span><strong>CPU</strong><span>${product.cpu || "n/a"}</span></span>`
      : `<span><strong>Warranty</strong><span>${warrantyText}</span></span>`;
  card.innerHTML = `
    <img class="card-thumb" src="${image}" loading="lazy" alt="${product.title}" />
    <div class="card-content">
      <div class="card-title-row">
        <span class="badge">${brandLabel} • ${typeLabel}</span>
        <h3 class="title-desktop">${product.title}</h3>
        <h3 class="title-mobile">${product.shortName || product.title}</h3>
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
  const grouped = products.reduce((acc, product) => {
    const type = String(product.type || "other").toLowerCase();
    if (!acc[type]) acc[type] = [];
    acc[type].push(product);
    return acc;
  }, {});
  const knownOrder = Object.keys(CATEGORY_LABELS);
  const categoryOrder = [
    ...knownOrder.filter((type) => grouped[type]?.length),
    ...Object.keys(grouped)
      .filter((type) => !knownOrder.includes(type))
      .sort((a, b) => formatCategoryLabel(a).localeCompare(formatCategoryLabel(b))),
  ];
  categoryOrder.forEach((type) => {
    const items = grouped[type] || [];
    if (!items.length) return;
    const section = document.createElement("section");
    section.className = "catalog-section";
    section.innerHTML = `
      <div class="catalog-heading">
        <h2>${formatCategoryLabel(type)}</h2>
        <span>${items.length} item${items.length > 1 ? "s" : ""}</span>
      </div>
      <div class="catalog-grid"></div>
    `;
    const grid = section.querySelector(".catalog-grid");
    items.forEach((product) => grid.appendChild(createProductCard(product)));
    fragment.appendChild(section);
  });
  results.appendChild(fragment);
}

async function init() {
  setYear();
  inventoryStatusEl = document.getElementById("inventory-status");
  updateCartCount();
  try {
    const inventoryPromise = loadInventory();
    const companiesPromise = loadCompanies().catch(() => []);
    const [inventory, companies] = await Promise.all([inventoryPromise, companiesPromise]);
    state.allProducts = inventory || [];
    state.companies = companies || [];
    populateCompanyFilter(state.companies);
    populateCategoryFilter(inventory || []);
    renderProducts(inventory);
    const form = document.getElementById("filter-form");
    const resetButton = document.getElementById("filter-reset");
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const params = Object.fromEntries(formData.entries());
        showInventoryStatus("Loading fresh results…");
        const results = await loadInventory(params);
        renderProducts(results);
        if (!results.length) {
          showInventoryStatus("No products matched that search.", "error");
        } else {
          showInventoryStatus("Inventory updated.");
        }
      });
    }
    if (resetButton && form) {
      resetButton.addEventListener("click", async () => {
        form.reset();
        populateCompanyFilter(state.companies);
        populateCategoryFilter(state.allProducts);
        showInventoryStatus("Resetting filters…");
        const results = await loadInventory();
        renderProducts(results);
        showInventoryStatus("Showing all products.");
      });
    }
  } catch (error) {
    console.error(error);
    showInventoryStatus("Could not load inventory right now.", "error");
    const results = document.getElementById("results");
    results.innerHTML = `<div class="toast error">Inventory isn't loading yet. Please try again shortly.</div>`;
    toggleEmptyState(true);
  }
}

document.addEventListener("DOMContentLoaded", init);
