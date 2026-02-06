const API_BASE = "/api";
let statusTimer = null;
let currentItems = [];

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

function showStatus(message, type = "success") {
  const container = document.getElementById("cart-status");
  if (!container) return;
  if (statusTimer) {
    clearTimeout(statusTimer);
  }
  container.innerHTML = `<div class="toast ${type === "error" ? "error" : ""}">${message}</div>`;
  statusTimer = window.setTimeout(() => {
    container.innerHTML = "";
  }, 3000);
}

function formatCurrency(amount = 0, currency = "EGP") {
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: currency || "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function renderCart(items) {
  const emptyEl = document.getElementById("cart-empty");
  const contentEl = document.getElementById("cart-content");
  const body = document.getElementById("cart-body");
  const totalEl = document.getElementById("cart-total");
  if (!body || !totalEl) return;

  if (!items.length) {
    if (body) body.innerHTML = "";
    totalEl.textContent = formatCurrency(0);
    if (emptyEl) emptyEl.hidden = false;
    if (contentEl) contentEl.hidden = true;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  if (contentEl) contentEl.hidden = false;
  body.innerHTML = "";
  let total = 0;
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const quantity = item.quantity || 1;
    const lineTotal = quantity * item.price;
    total += lineTotal;
    const hintParts = [];
    if (item.company?.name) hintParts.push(`Brand: ${item.company.name}`);
    if (item.type) hintParts.push(`Category: ${item.type.toUpperCase()}`);
    if (item.type === "laptop" && item.cpu) hintParts.push(`CPU: ${item.cpu}`);
    if (item.type === "laptop" && item.ram) hintParts.push(`RAM: ${item.ram}`);
    const hintText = hintParts.join(" • ");
    const row = document.createElement("tr");
    const image =
      item.images?.[0] ||
      `https://placehold.co/160x120?text=${encodeURIComponent(
        item.type ? item.type.toUpperCase() : "Product"
      )}`;
    row.innerHTML = `
      <td>
        <div class="cart-item">
          <img src="${image}" alt="${item.title}" loading="lazy" />
          <div>
            <strong>${item.title}</strong>
            <div class="field-hint">${hintText || item.gpu || ""}</div>
          </div>
        </div>
      </td>
      <td>${formatCurrency(item.price, item.currency)}</td>
      <td>
        <input
          type="number"
          min="1"
          max="99"
          value="${quantity}"
          data-quantity="${item.id}"
          class="quantity-input"
        />
      </td>
      <td>${formatCurrency(lineTotal, item.currency)}</td>
      <td><button class="link-button" data-remove="${item.id}">Remove</button></td>
    `;
    fragment.appendChild(row);
  });

  body.appendChild(fragment);
  const currency = items[0]?.currency || "EGP";
  totalEl.textContent = formatCurrency(total, currency);
}

async function loadCart() {
  if (!window.Cart) {
    showStatus("Local storage isn't available in this browser.", "error");
    return;
  }
  const stored = window.Cart.read();
  updateCartCount();
  if (!stored.length) {
    currentItems = [];
    renderCart([]);
    return;
  }

  try {
    const ids = stored.map((entry) => entry.id).join(",");
    const url = new URL(`${API_BASE}/products`, window.location.origin);
    url.searchParams.set("ids", ids);
    const products = await fetchJSON(url.toString());
    const merged = stored
      .map((entry) => {
        const product = products.find((item) => item.id === entry.id);
        if (!product) return null;
        return { ...product, quantity: entry.quantity || 1 };
      })
      .filter(Boolean);
    currentItems = merged;
    renderCart(merged);
  } catch (error) {
    console.error(error);
    showStatus("Couldn't load the cart right now—refresh and try again.", "error");
  }
}

async function handleQuantityChange(id, value) {
  if (!window.Cart) return;
  const quantity = Number(value);
  window.Cart.updateQuantity(id, quantity);
  await loadCart();
  showStatus("Quantity updated.");
}

async function handleRemove(id) {
  if (!window.Cart) return;
  window.Cart.remove(id);
  await loadCart();
  showStatus("Removed from cart.");
}

async function init() {
  setYear();
  updateCartCount();

  const body = document.getElementById("cart-body");
  const clearButton = document.getElementById("clear-cart");
  const checkoutButton = document.getElementById("checkout-button");

  if (body) {
    body.addEventListener("input", async (event) => {
      const target = event.target;
      if (target && target.matches("input[data-quantity]")) {
        await handleQuantityChange(target.dataset.quantity, target.value);
      }
    });
    body.addEventListener("click", async (event) => {
      const button = event.target.closest
        ? event.target.closest("button[data-remove]")
        : null;
      if (button) {
        await handleRemove(button.dataset.remove);
      }
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", async () => {
      if (!window.Cart) return;
      window.Cart.clear();
      await loadCart();
      showStatus("Cart cleared.");
      updateCartCount();
    });
  }

  if (checkoutButton) {
    checkoutButton.addEventListener("click", () => {
      const url = new URL("/checkout.html", window.location.origin);
      url.searchParams.set("source", "cart");
      window.location.href = `${url.pathname}${url.search}`;
    });
  }

  await loadCart();
}

document.addEventListener("DOMContentLoaded", init);
