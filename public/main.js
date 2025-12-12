const API_BASE = "/api";
const state = {
  laptops: [],
  companies: [],
};
let inventoryStatusEl = null;
let statusTimer = null;

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

function populateGpuFilter(laptops = []) {
  const select = document.getElementById("filter-gpu");
  if (!select) return;
  const current = select.value;
  const gpuValues = Array.from(
    new Set(
      laptops
        .map((item) => item.gpu || "")
        .filter(Boolean)
        .map((gpu) => gpu.trim())
    )
  ).sort((a, b) => a.localeCompare(b));
  select.innerHTML = `<option value="">Any GPU</option>`;
  gpuValues.forEach((gpu) => {
    const option = document.createElement("option");
    option.value = gpu;
    option.textContent = gpu;
    select.appendChild(option);
  });
  if (current && gpuValues.includes(current)) {
    select.value = current;
  }
}

function createLaptopCard(laptop) {
  const card = document.createElement("article");
  card.className = "laptop-card";
  const image = laptop.images?.[0] || "https://placehold.co/600x400?text=Laptop";
  card.innerHTML = `
    <img class="card-thumb" src="${image}" loading="lazy" alt="${laptop.title}" />
    <div class="card-content">
      <div class="card-title-row">
        <span class="badge">${laptop.company?.name || "Unassigned"}</span>
        <h3 class="title-desktop">${laptop.title}</h3>
        <h3 class="title-mobile">${laptop.shortName || laptop.title}</h3>
      </div>
      <div class="spec-inline">
        <span><strong>GPU</strong><span>${laptop.gpu || "n/a"}</span></span>
        <span><strong>CPU</strong><span>${laptop.cpu || "n/a"}</span></span>
      </div>
      <div class="card-actions compact-actions">
        <div class="price">${new Intl.NumberFormat("en-EG", {
          style: "currency",
          currency: laptop.currency || "EGP",
          maximumFractionDigits: 0,
        }).format(laptop.price)}</div>
      </div>
    </div>
  `;
  const detailUrl = `/laptop.html?id=${encodeURIComponent(laptop.id)}`;
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
  const url = new URL(`${API_BASE}/laptops`, window.location.origin);
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

function renderLaptops(laptops) {
  state.laptops = laptops;
  const results = document.getElementById("results");
  results.innerHTML = "";
  if (!laptops.length) {
    toggleEmptyState(false);
    return;
  }
  toggleEmptyState(true);
  const fragment = document.createDocumentFragment();
  laptops.forEach((laptop) => fragment.appendChild(createLaptopCard(laptop)));
  results.appendChild(fragment);
  populateGpuFilter(laptops);
}

async function init() {
  setYear();
  inventoryStatusEl = document.getElementById("inventory-status");
  updateCartCount();
  try {
    const inventoryPromise = loadInventory();
    const companiesPromise = loadCompanies().catch(() => []);
    const [inventory, companies] = await Promise.all([inventoryPromise, companiesPromise]);
    state.companies = companies || [];
    populateCompanyFilter(state.companies);
    renderLaptops(inventory);
    const form = document.getElementById("filter-form");
    const resetButton = document.getElementById("filter-reset");
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const params = Object.fromEntries(formData.entries());
        showInventoryStatus("Loading fresh results…");
        const results = await loadInventory(params);
        renderLaptops(results);
        if (!results.length) {
          showInventoryStatus("No laptops matched that search.", "error");
        } else {
          showInventoryStatus("Inventory updated.");
        }
      });
    }
    if (resetButton && form) {
      resetButton.addEventListener("click", async () => {
        form.reset();
        populateCompanyFilter(state.companies);
        showInventoryStatus("Resetting filters…");
        const results = await loadInventory();
        renderLaptops(results);
        showInventoryStatus("Showing all laptops.");
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
