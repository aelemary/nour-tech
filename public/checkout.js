const API_BASE = "/api";
let statusTimer = null;
let currentItems = [];
let mode = "cart";

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
  const container = document.getElementById("checkout-status");
  if (!container) return;
  if (statusTimer) {
    clearTimeout(statusTimer);
  }
  container.innerHTML = `<div class="toast ${type === "error" ? "error" : ""}">${message}</div>`;
  statusTimer = window.setTimeout(() => {
    container.innerHTML = "";
  }, 4000);
}

function prefillUserDetails(user) {
  if (!user) return;
  const form = document.getElementById("checkout-form");
  if (!form) return;
  const nameInput = form.querySelector('input[name="customerName"]');
  if (nameInput && !nameInput.value) {
    nameInput.value = user.fullName || user.username;
  }
}

function formatCurrency(amount = 0, currency = "EGP") {
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: currency || "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function renderSummary(items) {
  const emptyEl = document.getElementById("checkout-empty");
  const contentEl = document.getElementById("checkout-content");
  const list = document.getElementById("summary-list");
  const totalEl = document.getElementById("checkout-total");
  if (!list || !totalEl) return;

  if (!items.length) {
    list.innerHTML = "";
    totalEl.textContent = formatCurrency(0);
    if (emptyEl) emptyEl.hidden = false;
    if (contentEl) contentEl.hidden = true;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  if (contentEl) contentEl.hidden = false;

  list.innerHTML = "";
  let total = 0;
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const quantity = item.quantity || 1;
    const lineTotal = quantity * item.price;
    total += lineTotal;
    const hintParts = [];
    if (item.company?.name) hintParts.push(`Brand: ${item.company.name}`);
    if (item.cpu) hintParts.push(`CPU: ${item.cpu}`);
    if (item.ram) hintParts.push(`RAM: ${item.ram}`);
    const hintText = hintParts.join(" • ");
    const li = document.createElement("li");
    li.innerHTML = `
      <span>
        <strong>${item.title}</strong>
        <span class="field-hint">${hintText || item.gpu || ""}</span>
      </span>
      <span>${quantity} × ${formatCurrency(item.price, item.currency)}</span>
    `;
    fragment.appendChild(li);
  });
  list.appendChild(fragment);
  const currency = items[0]?.currency || "EGP";
  totalEl.textContent = formatCurrency(total, currency);
}

async function loadItems() {
  if (!window.Cart) {
    showStatus("Local storage isn't available in this browser.", "error");
    return;
  }
  const params = new URLSearchParams(window.location.search);
  mode = params.get("source") === "buy" ? "buy" : "cart";

  let baseItems = [];
  if (mode === "buy") {
    const buyNow = window.Cart.getBuyNow();
    if (buyNow?.id) {
      baseItems = [{ id: buyNow.id, quantity: buyNow.quantity || 1 }];
    } else if (params.get("item")) {
      baseItems = [{ id: params.get("item"), quantity: 1 }];
    }
  } else {
    baseItems = window.Cart.read();
  }

  if (!baseItems.length) {
    currentItems = [];
    renderSummary([]);
    updateCartCount();
    return;
  }

  try {
    const ids = baseItems.map((item) => item.id).join(",");
    const url = new URL(`${API_BASE}/laptops`, window.location.origin);
    url.searchParams.set("ids", ids);
    const laptops = await fetchJSON(url.toString());
    const merged = baseItems
      .map((entry) => {
        const laptop = laptops.find((item) => item.id === entry.id);
        if (!laptop) return null;
        return { ...laptop, quantity: entry.quantity || 1 };
      })
      .filter(Boolean);
    currentItems = merged;
    renderSummary(merged);
    updateCartCount();
  } catch (error) {
    console.error(error);
    showStatus("Couldn't load checkout items—refresh and try again.", "error");
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!currentItems.length) {
    showStatus("Nothing to submit yet.", "error");
    return;
  }
  const data = Object.fromEntries(new FormData(form).entries());

  const submitButton = document.getElementById("checkout-submit");
  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    for (const item of currentItems) {
      await fetchJSON(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laptopId: item.id,
          quantity: item.quantity,
          customerName: data.customerName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          paymentType: data.paymentType || "Cash on Delivery",
          notes: data.notes || "",
        }),
      });
    }

    if (mode === "cart") {
      window.Cart.clear();
    } else {
      window.Cart.clearBuyNow();
      if (currentItems[0]) {
        window.Cart.remove(currentItems[0].id);
      }
    }
    currentItems = [];
    renderSummary([]);
    form.reset();
    updateCartCount();
    showStatus("Order received! Expect a call within 12 working hours.", "success");
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      showStatus(
        'Please <a href="/login.html?next=/checkout.html" style="color: inherit; text-decoration: underline;">sign in</a> before placing an order.',
        "error"
      );
    } else {
      showStatus("Couldn't submit the order—please try again.", "error");
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function init() {
  setYear();
  updateCartCount();
  await loadItems();

  const form = document.getElementById("checkout-form");
  if (form) {
    form.addEventListener("submit", handleSubmit);
  }
  if (window.appUser) {
    prefillUserDetails(window.appUser);
  }
}

document.addEventListener("DOMContentLoaded", init);
document.addEventListener("app:user", (event) => {
  prefillUserDetails(event.detail);
});
