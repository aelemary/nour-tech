function setYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

function formatCurrency(amount = 0, currency = "EGP") {
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
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

function showStatus(message, type = "info") {
  const container = document.getElementById("account-status");
  if (!container) return;
  container.innerHTML = message
    ? `<div class="toast${type === "error" ? " error" : ""}">${message}</div>`
    : "";
}

function renderOrders(orders) {
  const wrapper = document.getElementById("account-orders");
  const tbody = document.getElementById("account-orders-body");
  if (!wrapper || !tbody) return;

  if (!orders.length) {
    wrapper.hidden = true;
    showStatus("No orders yet. Head back to the catalog to reserve your next product.");
    return;
  }

  wrapper.hidden = false;
  showStatus("");
  tbody.innerHTML = "";

  const fragment = document.createDocumentFragment();
  orders.forEach((order) => {
    const row = document.createElement("tr");
    const items = Array.isArray(order.items) ? order.items : [];
    const firstItem = items[0];
    const productTitle = firstItem?.product ? firstItem.product.title : "Product removed";
    const currency = firstItem?.product?.currency || "EGP";
    const statusLabel = order.status
      ? order.status.charAt(0).toUpperCase() + order.status.slice(1)
      : "";
    const priceDisplay = firstItem?.product
      ? formatCurrency(firstItem.product.price, currency)
      : "No longer available";
    const quantityTotal = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const itemCountLabel = items.length > 1 ? ` +${items.length - 1} more` : "";
    row.innerHTML = `
      <td>${order.id}</td>
      <td>${new Intl.DateTimeFormat("en-EG", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(order.createdAt))}</td>
      <td>
        <div><strong>${productTitle}</strong>${itemCountLabel}</div>
        <div class="field-hint">${priceDisplay}</div>
      </td>
      <td>${quantityTotal || 1}</td>
      <td><span class="status-pill ${order.status}">${statusLabel}</span></td>
    `;
    fragment.appendChild(row);
  });

  tbody.appendChild(fragment);
}

async function loadOrders() {
  try {
    showStatus("Loading your orders…");
    const orders = await fetchJSON("/api/orders");
    renderOrders(orders);
  } catch (error) {
    if (error.status === 401) {
      showStatus(
        'Please <a href="/login.html?next=/account.html" style="color: inherit; text-decoration: underline;">sign in</a> to view your orders.',
        "error"
      );
    } else {
      showStatus("Could not load your orders. Please try again later.", "error");
    }
  }
}

function handleUserUpdate(event) {
  const user = event.detail;
  if (!user) {
    const wrapper = document.getElementById("account-orders");
    const tbody = document.getElementById("account-orders-body");
    if (wrapper) wrapper.hidden = true;
    if (tbody) tbody.innerHTML = "";
    showStatus(
      'Please <a href="/login.html?next=/account.html" style="color: inherit; text-decoration: underline;">sign in</a> to view your orders.',
      "error"
    );
    return;
  }
  loadOrders();
}

document.addEventListener("DOMContentLoaded", () => {
  setYear();
  if (window.appUser) {
    loadOrders();
  } else {
    showStatus(
      'Please <a href="/login.html?next=/account.html" style="color: inherit; text-decoration: underline;">sign in</a> to view your orders.',
      "error"
    );
  }
});

document.addEventListener("app:user", handleUserUpdate);
