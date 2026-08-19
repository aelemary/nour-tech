const API_BASE = "/api";

const state = {
  companies: [],
  products: [],
  orders: [],
  orderFilter: "",
  users: [],
  userSearch: "",
};
let bootstrapped = false;
let editingProductId = null;

function redirectToLogin() {
  const target = `/login.html?next=${encodeURIComponent("/admin.html")}`;
  window.location.replace(target);
}

function handleAuthChange(user) {
  if (!user) {
    showStatus("company-status", "Please sign in as an admin to access the dashboard.", "error");
    showStatus("users-status", "Authentication required.", "error");
    redirectToLogin();
    return;
  }
  if (user.role !== "admin") {
    showStatus("company-status", "Admin access only.", "error");
    showStatus("users-status", "Admin access only.", "error");
    window.setTimeout(() => {
      window.location.replace("/");
    }, 1200);
    return;
  }
  if (!bootstrapped) {
    bootstrapped = true;
    bootstrap();
  } else {
    // refresh data when admin context changes (e.g., login without reload)
    loadOrders(state.orderFilter);
    refreshUsers({ quiet: true });
  }
}
const statusTimers = new Map();
const MAX_SOURCE_UPLOAD_SIZE = 25 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 1.5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1800;
const TARGET_IMAGE_SIZE = 900 * 1024;
const ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function getStatusLabel(value) {
  const match = ORDER_STATUS_OPTIONS.find((option) => option.value === value);
  return match ? match.label : value;
}

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

function formatCurrency(amount, currency = "EGP") {
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showStatus(containerId, message, type = "success") {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (statusTimers.has(containerId)) {
    clearTimeout(statusTimers.get(containerId));
  }
  container.innerHTML = `<div class="toast ${type === "error" ? "error" : ""}">${message}</div>`;
  const timer = setTimeout(() => {
    container.innerHTML = "";
    statusTimers.delete(containerId);
  }, 4000);
  statusTimers.set(containerId, timer);
}

function parseImageList(value) {
  if (!value) return [];
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatManualSpecs(specsRaw) {
  if (!specsRaw || typeof specsRaw !== "object" || Array.isArray(specsRaw)) return "";
  const manual = specsRaw.manual;
  if (!manual || typeof manual !== "object" || Array.isArray(manual)) return "";
  return Object.entries(manual)
    .filter(([key, value]) => key && value != null && String(value).trim() !== "")
    .map(([key, value]) => `${key}: ${String(value).trim()}`)
    .join(", ");
}

function validateManualSpecsFormat(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const segments = raw
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  for (const segment of segments) {
    const colonIndex = segment.indexOf(":");
    if (colonIndex === -1) {
      return `Invalid segment "${segment}". Use "Key: Value".`;
    }
    const key = segment.slice(0, colonIndex).trim();
    const specValue = segment.slice(colonIndex + 1).trim();
    if (!key || !specValue) {
      return `Invalid segment "${segment}". Use "Key: Value".`;
    }
  }
  return "";
}

function renderImagePreview(urls) {
  const preview = document.getElementById("image-preview");
  if (!preview) return;
  preview.innerHTML = "";
  if (!urls.length) {
    const hint = document.createElement("span");
    hint.className = "field-hint";
    hint.textContent = "No images attached yet.";
    preview.appendChild(hint);
    return;
  }
  const fragment = document.createDocumentFragment();
  urls.forEach((url) => {
    const wrapper = document.createElement("div");
    wrapper.className = "image-chip";
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Product image";
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.removeImage = url;
    button.setAttribute("aria-label", "Remove image");
    button.textContent = "✕";
    wrapper.appendChild(img);
    wrapper.appendChild(button);
    fragment.appendChild(wrapper);
  });
  preview.appendChild(fragment);
}

function appendImageUrl(url) {
  const textarea = document.querySelector('#product-form textarea[name="images"]');
  if (!textarea) return;
  const existing = parseImageList(textarea.value);
  if (!existing.includes(url)) {
    existing.push(url);
    textarea.value = existing.join("\n");
  }
  renderImagePreview(existing);
}

function syncImagePreview() {
  const textarea = document.querySelector('#product-form textarea[name="images"]');
  if (!textarea) return;
  renderImagePreview(parseImageList(textarea.value));
}

function toggleCategoryFields(categoryValue) {
  const category = String(categoryValue || "").toLowerCase();
  document.querySelectorAll(".laptop-only").forEach((field) => {
    field.hidden = category && category !== "laptop";
  });
}

function resetProductForm() {
  const form = document.getElementById("product-form");
  if (!form) return;
  form.reset();
  const idInput = form.querySelector('input[name="id"]');
  if (idInput) {
    idInput.value = "";
  }
  editingProductId = null;
  const submitButton = form.querySelector("button[type='submit']");
  if (submitButton) {
    submitButton.textContent = "Publish Listing";
  }
  const cancelButton = document.getElementById("product-cancel");
  if (cancelButton) {
    cancelButton.hidden = true;
  }
  renderImagePreview([]);
  const categorySelect = form.querySelector('select[name="category"]');
  if (categorySelect) {
    categorySelect.disabled = false;
    toggleCategoryFields(categorySelect.value);
  } else {
    toggleCategoryFields("");
  }
}

function startEditingProduct(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  const form = document.getElementById("product-form");
  if (!form) return;
  showAdminView("catalog");
  editingProductId = productId;
  const idInput = form.querySelector('input[name="id"]');
  if (idInput) idInput.value = product.id;
  const categorySelect = form.querySelector('select[name="category"]');
  if (categorySelect) {
    categorySelect.value = product.type || "";
    categorySelect.disabled = true;
  }
  const companySelect = form.querySelector('select[name="companyId"]');
  if (companySelect) companySelect.value = product.companyId || "";
  form.querySelector('input[name="title"]').value = product.title || "";
  const shortNameInput = form.querySelector('input[name="shortName"]');
  if (shortNameInput) shortNameInput.value = product.shortName || "";
  const priceInput = form.querySelector('input[name="price"]');
  if (priceInput) priceInput.value = product.price ?? "";
  form.querySelector('input[name="gpu"]').value = product.gpu || "";
  form.querySelector('input[name="cpu"]').value = product.cpu || "";
  form.querySelector('input[name="ram"]').value = product.ram || "";
  form.querySelector('input[name="storage"]').value = product.storage || "";
  form.querySelector('input[name="display"]').value = product.display || "";
  const warrantyInput = form.querySelector('input[name="warranty"]');
  if (warrantyInput) warrantyInput.value = product.warranty ?? "";
  form.querySelector('textarea[name="description"]').value = product.description || "";
  const icecatInput = form.querySelector('input[name="icecatId"]');
  if (icecatInput) {
    const icecatId = product.icecatId || product.specsRaw?.icecat?.id || "";
    icecatInput.value = icecatId ? String(icecatId) : "";
  }
  const manualSpecsTextarea = form.querySelector('textarea[name="manualSpecs"]');
  if (manualSpecsTextarea) {
    manualSpecsTextarea.value = formatManualSpecs(product.specsRaw);
  }
  const imagesTextarea = form.querySelector('textarea[name="images"]');
  imagesTextarea.value = (product.images || []).join("\n");
  renderImagePreview(product.images || []);
  const submitButton = form.querySelector("button[type='submit']");
  if (submitButton) submitButton.textContent = "Update Listing";
  const cancelButton = document.getElementById("product-cancel");
  if (cancelButton) cancelButton.hidden = false;
  showStatus("product-status", `Editing ${product.title}`);
  toggleCategoryFields(product.type || "");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function loadImageForCompression(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read this image."));
    };
    image.src = url;
  });
}

function canvasToWebp(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't compress this image."))),
      "image/webp",
      quality
    );
  });
}

async function compressImageForUpload(file) {
  const image = await loadImageForCompression(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d", { alpha: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let blob = await canvasToWebp(canvas, 0.84);
  for (const quality of [0.78, 0.72, 0.66]) {
    if (blob.size <= TARGET_IMAGE_SIZE) break;
    blob = await canvasToWebp(canvas, quality);
  }

  const stem = file.name.replace(/\.[^.]+$/, "") || "product-image";
  return new File([blob], `${stem}.webp`, { type: "image/webp" });
}

function populateCompanySelect(elementId) {
  const select = document.getElementById(elementId);
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Select Brand</option>';
  state.companies
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((company) => {
      const option = document.createElement("option");
      option.value = company.id;
      option.textContent = company.name;
      select.appendChild(option);
    });
  if (current && state.companies.find((company) => company.id === current)) {
    select.value = current;
  }
}

function updateStats() {
  document.getElementById("stat-admin-brands").textContent = state.companies.length;
  document.getElementById("stat-admin-products").textContent = state.products.length;
  const pending = state.orders.filter(
    (order) => order.status !== "completed" && order.status !== "cancelled"
  ).length;
  document.getElementById("stat-admin-orders").textContent = pending;
}

function showAdminView(view) {
  const panels = Array.from(document.querySelectorAll("[data-admin-view-panel]"));
  const buttons = Array.from(document.querySelectorAll("[data-admin-view]"));
  if (!panels.some((panel) => panel.dataset.adminViewPanel === view)) return;
  panels.forEach((panel) => {
    panel.hidden = panel.dataset.adminViewPanel !== view;
  });
  buttons.forEach((button) => {
    const active = button.dataset.adminView === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function setupAdminViews() {
  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.addEventListener("click", () => showAdminView(button.dataset.adminView));
  });
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("en-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function renderOrders(orders) {
  const workspace = document.getElementById("orders-body");
  if (!workspace) return;
  workspace.innerHTML = "";
  if (!orders.length) {
    const empty = document.createElement("div");
    empty.className = "admin-order-empty";
    empty.textContent = "No orders to display right now.";
    workspace.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  orders.forEach((order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    let orderTotal = 0;
    const itemLines = items
      .map((item) => {
        const product = item.product;
        const quantity = item.quantity || 1;
        if (!product) {
          return `<div class="admin-order-item"><span>Product removed</span><small>Qty ${quantity}</small></div>`;
        }
        const unitPrice = item.unitPrice ?? product.price;
        const lineTotal = Number(unitPrice) * quantity;
        if (Number.isFinite(lineTotal)) orderTotal += lineTotal;
        return `<div class="admin-order-item"><span>${escapeHtml(product.title)}</span><small>${quantity} × ${escapeHtml(formatCurrency(unitPrice, product.currency))}</small><strong>${escapeHtml(formatCurrency(lineTotal, product.currency))}</strong></div>`;
      })
      .join("");
    const statusLabel = getStatusLabel(order.status);
    const card = document.createElement("article");
    card.className = "admin-order-card";
    card.innerHTML = `
      <header class="admin-order-header">
        <div>
          <span class="admin-order-kicker">Order reference</span>
          <h3>${escapeHtml(order.id)}</h3>
          <p>Placed ${escapeHtml(formatDate(order.createdAt))}</p>
        </div>
        <div class="status-control" data-status-cell="${escapeHtml(order.id)}"></div>
      </header>
      <div class="admin-order-details">
        <div><span>Customer</span><strong>${escapeHtml(order.customerName || "—")}</strong><small>${order.userId ? "Account customer" : "Guest checkout"}</small></div>
        <div><span>Phone / WhatsApp</span><strong>${escapeHtml(order.phone || "—")}</strong><small>Email: ${escapeHtml(order.email || "—")}</small></div>
        <div class="admin-order-address"><span>Delivery address</span><strong>${escapeHtml(order.address || "—")}</strong></div>
        ${order.notes ? `<div class="admin-order-notes"><span>Customer notes</span><strong>${escapeHtml(order.notes)}</strong></div>` : ""}
      </div>
      <section class="admin-order-items">
        <div class="admin-order-items-heading"><strong>Order items</strong><strong>${escapeHtml(formatCurrency(orderTotal, items[0]?.product?.currency || "EGP"))}</strong></div>
        ${itemLines || '<div class="admin-order-item"><span>No items recorded</span></div>'}
      </section>
    `;
    const statusCell = card.querySelector("[data-status-cell]");
    if (statusCell) {
      statusCell.innerHTML = `
        <span class="status-pill ${escapeHtml(order.status)}">${escapeHtml(statusLabel)}</span>
        <select class="status-select" aria-label="Update order status" data-order-status="${escapeHtml(order.id)}">
          ${ORDER_STATUS_OPTIONS.map(
            (option) =>
              `<option value="${option.value}"${option.value === order.status ? " selected" : ""}>${option.label}</option>`
          ).join("")}
        </select>
      `;
    }
    fragment.appendChild(card);
  });
  workspace.appendChild(fragment);
}

function renderCompanyList() {
  const list = document.getElementById("company-list");
  if (!list) return;
  list.innerHTML = "";
  if (!state.companies.length) {
    const empty = document.createElement("li");
    empty.textContent = "No brands yet.";
    empty.style.opacity = "0.7";
    list.appendChild(empty);
    return;
  }
  state.companies
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((company) => {
      const item = document.createElement("li");
      item.innerHTML = `<span>${company.name}</span>`;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.deleteCompany = company.id;
      button.textContent = "Remove";
      item.appendChild(button);
      list.appendChild(item);
    });
}

function renderCatalog() {
  const tbody = document.getElementById("catalog-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!state.products.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.style.textAlign = "center";
    cell.style.color = "var(--text-muted)";
    cell.textContent = "No listings published yet.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }
  const fragment = document.createDocumentFragment();
  state.products
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .forEach((product) => {
      const company = state.companies.find((item) => item.id === product.companyId);
      const warrantyLabel = product.warranty
        ? `${product.warranty} yr${product.warranty > 1 ? "s" : ""} warranty`
        : "";
      const typeLabel = product.type ? product.type.toUpperCase() : "PRODUCT";
      const row = document.createElement("tr");
      row.innerHTML = `
      <td><strong>${product.title}</strong><div class="field-hint">${company ? company.name : "—"} • ${typeLabel}</div>${
        warrantyLabel ? `<div class="field-hint">${warrantyLabel}</div>` : ""
      }</td>
      <td>${formatCurrency(product.price, product.currency)}</td>
      <td>
        <button class="link-button" data-edit-product="${product.id}">Edit</button>
        <button class="link-button" data-delete-product="${product.id}">Remove</button>
      </td>
    `;
      fragment.appendChild(row);
    });
  tbody.appendChild(fragment);
}

function renderUsersList(search = state.userSearch || "") {
  const tbody = document.getElementById("users-body");
  if (!tbody) return;
  const normalized = search.trim().toLowerCase();
  state.userSearch = search;
  const filtered = state.users.filter((user) => {
    if (!normalized) return true;
    const haystack = `${user.username} ${user.fullName || ""}`.toLowerCase();
    return haystack.includes(normalized);
  });
  tbody.innerHTML = "";
  if (!filtered.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.style.textAlign = "center";
    cell.style.color = "var(--text-muted)";
    cell.textContent = search ? "No users match your search." : "No users found.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }
  const fragment = document.createDocumentFragment();
  filtered
    .slice()
    .sort((a, b) => a.username.localeCompare(b.username))
    .forEach((user) => {
      const orderCount = state.orders.filter((order) => order.userId === user.id).length;
      const currentUsername = window.appUser ? window.appUser.username : "";
      const isCurrent = window.appUser && user.username === currentUsername;
      const isAdmin = user.role === "admin";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${user.username}</strong></td>
        <td>${user.fullName || "—"}</td>
        <td>${user.role}</td>
        <td>${orderCount}</td>
        <td></td>
      `;
      const actionsCell = row.lastElementChild;
      if (actionsCell) {
        if (isAdmin) {
          actionsCell.innerHTML = '<span class="field-hint">Admin accounts are protected</span>';
        } else {
          const button = document.createElement("button");
          button.className = "link-button";
          button.type = "button";
          button.dataset.deleteUser = user.id;
          button.textContent = isCurrent ? "Deactivate (logout first)" : "Remove";
          button.disabled = isCurrent;
          actionsCell.appendChild(button);
        }
      }
      fragment.appendChild(row);
    });
  tbody.appendChild(fragment);
}

async function deleteCompany(companyId) {
  if (!companyId) return;
  const company = state.companies.find((item) => item.id === companyId);
  const confirmed = window.confirm(
    `Delete brand "${company ? company.name : companyId}"? Listings under it will be removed.`
  );
  if (!confirmed) return;
  try {
    await fetchJSON(`${API_BASE}/companies/${encodeURIComponent(companyId)}`, {
      method: "DELETE",
    });
    state.companies = state.companies.filter((item) => item.id !== companyId);
    const removedProductIds = new Set(
      state.products.filter((item) => item.companyId === companyId).map((item) => item.id)
    );
    state.products = state.products.filter((item) => item.companyId !== companyId);
    state.orders = state.orders.map((order) => {
      const items = Array.isArray(order.items) ? order.items : [];
      const updatedItems = items.map((item) =>
        removedProductIds.has(item.productId) ? { ...item, product: null } : item
      );
      return { ...order, items: updatedItems };
    });
    populateCompanySelect("product-brand");
    renderCompanyList();
    renderCatalog();
    const filteredOrders = state.orderFilter
      ? state.orders.filter((order) => order.status === state.orderFilter)
      : state.orders;
    renderOrders(filteredOrders);
    renderUsersList(state.userSearch);
    updateStats();
    showStatus("company-status", "Brand removed successfully.");
  } catch (error) {
    console.error(error);
    showStatus("company-status", "Could not delete brand. Please try again.", "error");
  }
}

async function deleteProduct(productId) {
  if (!productId) return;
  const product = state.products.find((item) => item.id === productId);
  const confirmed = window.confirm(`Delete listing "${product ? product.title : productId}"?`);
  if (!confirmed) return;
  try {
    await fetchJSON(`${API_BASE}/products/${encodeURIComponent(productId)}`, {
      method: "DELETE",
    });
    state.products = state.products.filter((item) => item.id !== productId);
    renderCatalog();
    if (editingProductId === productId) {
      resetProductForm();
    }
    state.orders = state.orders.map((order) => {
      const items = Array.isArray(order.items) ? order.items : [];
      const updatedItems = items.map((item) =>
        item.productId === productId ? { ...item, product: null } : item
      );
      return { ...order, items: updatedItems };
    });
    const filteredOrders = state.orderFilter
      ? state.orders.filter((order) => order.status === state.orderFilter)
      : state.orders;
    renderOrders(filteredOrders);
    renderUsersList(state.userSearch);
    updateStats();
    showStatus("product-status", "Listing removed.");
  } catch (error) {
    console.error(error);
    showStatus("product-status", "Could not delete listing.", "error");
  }
}

async function updateOrderStatus(orderId, status) {
  if (!orderId || !status) return;
  try {
    const updated = await fetchJSON(`${API_BASE}/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const index = state.orders.findIndex((order) => order.id === orderId);
    if (index !== -1) {
      state.orders[index] = updated;
    } else {
      state.orders.push(updated);
    }
    const currentFilter = state.orderFilter;
    const filtered = currentFilter
      ? state.orders.filter((order) => order.status === currentFilter)
      : state.orders;
    renderOrders(filtered);
    renderUsersList(state.userSearch);
    updateStats();
    showStatus("orders-status", `Order ${orderId} updated to ${getStatusLabel(status)}.`);
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      showStatus("orders-status", "Please sign in to manage orders.", "error");
    } else if (error.status === 403) {
      showStatus("orders-status", "Admin privileges are required to update orders.", "error");
    } else {
      showStatus("orders-status", "Could not update order status.", "error");
    }
  }
}

async function deleteUser(userId) {
  if (!userId) return;
  const user = state.users.find((item) => item.id === userId);
  const label = user ? `${user.username}${user.fullName ? ` (${user.fullName})` : ""}` : userId;
  const confirmed = window.confirm(`Remove user "${label}" and their orders?`);
  if (!confirmed) return;
  try {
    await fetchJSON(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    state.users = state.users.filter((item) => item.id !== userId);
    state.orders = state.orders.filter((order) => order.userId !== userId);
    const filteredOrders = state.orderFilter
      ? state.orders.filter((order) => order.status === state.orderFilter)
      : state.orders;
    renderOrders(filteredOrders);
    renderUsersList(state.userSearch);
    updateStats();
    showStatus("users-status", "User removed.");
    refreshUsers({ quiet: true });
  } catch (error) {
    console.error(error);
    if (error.status === 400) {
      showStatus("users-status", error.message || "Cannot remove that user.", "error");
    } else if (error.status === 401) {
      showStatus("users-status", "Please sign in as an admin first.", "error");
    } else if (error.status === 403) {
      showStatus("users-status", "Admin privileges required to manage users.", "error");
    } else {
      showStatus("users-status", "Could not remove user.", "error");
    }
  }
}

async function loadOrders(status = state.orderFilter || "") {
  try {
    const statusEl = document.getElementById("orders-status");
    if (statusEl) {
      statusEl.textContent = "Refreshing orders…";
    }
    const orders = await fetchJSON(`${API_BASE}/orders`);
    state.orders = orders;
    state.orderFilter = status;
    const filter = document.getElementById("order-status-filter");
    if (filter && filter.value !== state.orderFilter) {
      filter.value = state.orderFilter;
    }
    if (statusEl) statusEl.textContent = "";
    const filtered = status ? orders.filter((order) => order.status === status) : orders;
    renderOrders(filtered);
    renderUsersList(state.userSearch);
    updateStats();
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      showStatus("orders-status", "Please sign in to view orders.", "error");
    } else if (error.status === 403) {
      showStatus("orders-status", "You need admin privileges to view all orders.", "error");
    } else {
      showStatus("orders-status", "Couldn't load orders—please try again.", "error");
    }
  }
}

async function refreshUsers({ quiet = false } = {}) {
  try {
    const users = await fetchJSON(`${API_BASE}/users`);
    state.users = users.map((user) => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName || "",
      role: user.role,
    }));
    renderUsersList(state.userSearch);
    if (!quiet) {
      showStatus("users-status", "");
    }
  } catch (error) {
    console.error(error);
    if (!quiet) {
      if (error.status === 401) {
        showStatus("users-status", "Please sign in as an admin to manage users.", "error");
      } else if (error.status === 403) {
        showStatus("users-status", "You don't have permission to manage users.", "error");
      } else {
        showStatus("users-status", "Failed to refresh users.", "error");
      }
    }
  }
}

async function bootstrap() {
  try {
    const [companies, products, orders, users] = await Promise.all([
      fetchJSON(`${API_BASE}/companies`),
      fetchJSON(`${API_BASE}/products`),
      fetchJSON(`${API_BASE}/orders`),
      fetchJSON(`${API_BASE}/users`),
    ]);
    state.companies = companies;
    state.products = products;
    state.orders = orders;
    state.users = users.map((user) => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName || "",
      role: user.role,
    }));
    state.userSearch = "";
    state.orderFilter = "";
    populateCompanySelect("product-brand");
    renderCompanyList();
    renderCatalog();
    renderOrders(orders);
    renderUsersList();
    showStatus("company-status", "");
    showStatus("users-status", "");
    updateStats();
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      showStatus("company-status", "Please sign in as an admin to access the dashboard.", "error");
      showStatus("users-status", "Please sign in as an admin to manage users.", "error");
    } else if (error.status === 403) {
      showStatus("company-status", "You don't have permission to view this dashboard.", "error");
      showStatus("users-status", "You don't have permission to manage users.", "error");
    } else {
      showStatus("company-status", "Failed to load initial data.", "error");
      showStatus("users-status", "Failed to load users.", "error");
    }
  }
}

async function handleCompanySubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  try {
    showStatus("company-status", "Creating brand…");
    const company = await fetchJSON(`${API_BASE}/companies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.companies.push(company);
    populateCompanySelect("product-brand");
    renderCompanyList();
    updateStats();
    showStatus("company-status", `Brand ${company.name} added.`);
    form.reset();
  } catch (error) {
    console.error(error);
    if (error.status === 401 || error.status === 403) {
      showStatus("company-status", "Admin access required to add brands.", "error");
    } else {
      showStatus("company-status", "Couldn't create brand.", "error");
    }
  }
}

async function handleImageUpload(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showStatus("product-status", "Choose an image file (PNG, JPG, or WebP).", "error");
    return;
  }
  if (file.size > MAX_SOURCE_UPLOAD_SIZE) {
    showStatus("product-status", "Image exceeds the 25MB source limit.", "error");
    return;
  }
  try {
    showStatus("product-status", "Compressing image…");
    const compressedFile = await compressImageForUpload(file);
    if (compressedFile.size > MAX_UPLOAD_SIZE) {
      throw new Error("The compressed image is still too large. Try a smaller source image.");
    }
    showStatus("product-status", "Uploading compressed image…");
    const dataUrl = await readFileAsDataURL(compressedFile);
    const result = await fetchJSON(`${API_BASE}/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: compressedFile.name,
        data: dataUrl,
      }),
    });
    appendImageUrl(result.url);
    const saved = Math.max(0, Math.round((1 - compressedFile.size / file.size) * 100));
    showStatus("product-status", `Compressed ${saved}% and attached image.`);
  } catch (error) {
    console.error(error);
    if (error.status === 401 || error.status === 403) {
      showStatus("product-status", "Admin access required to upload images.", "error");
    } else {
      showStatus("product-status", error.message || "Couldn't upload image.", "error");
    }
  }
}

async function handleProductSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const editId = payload.id ? payload.id.trim() : "";
  delete payload.id;
  payload.shortName = payload.shortName ? payload.shortName.trim() : "";
  payload.category = payload.category ? payload.category.trim().toLowerCase() : "";
  payload.price = Number(payload.price);
  if (!Number.isFinite(payload.price) || payload.price < 0) {
    showStatus("product-status", "Enter a valid non-negative price in EGP.", "error");
    return;
  }
  if (payload.warranty !== undefined && payload.warranty !== "") {
    payload.warranty = Number(payload.warranty);
  } else {
    payload.warranty = 0;
  }
  payload.icecatId = payload.icecatId ? payload.icecatId.trim() : "";
  payload.manualSpecs = payload.manualSpecs ? payload.manualSpecs.trim() : "";
  if (!payload.icecatId) {
    delete payload.icecatId;
  }
  if (!payload.manualSpecs) {
    delete payload.manualSpecs;
  }
  const manualSpecsError = validateManualSpecsFormat(payload.manualSpecs || "");
  if (manualSpecsError) {
    showStatus("product-status", manualSpecsError, "error");
    return;
  }
  payload.images = parseImageList(payload.images);
  if (payload.category !== "laptop") {
    delete payload.gpu;
    delete payload.cpu;
    delete payload.ram;
    delete payload.storage;
    delete payload.display;
  }
  try {
    showStatus("product-status", editId ? "Updating listing…" : "Publishing listing…");
    const endpoint = editId ? `${API_BASE}/products/${encodeURIComponent(editId)}` : `${API_BASE}/products`;
    const method = editId ? "PATCH" : "POST";
    const product = await fetchJSON(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const index = state.products.findIndex((item) => item.id === product.id);
    if (index === -1) {
      state.products.push(product);
    } else {
      state.products[index] = product;
    }
    renderCatalog();
    updateStats();
    showStatus(
      "product-status",
      editId ? `Listing ${product.title} updated.` : `Listing ${product.title} is live.`
    );
    resetProductForm();
  } catch (error) {
    console.error(error);
    if (error.status === 401 || error.status === 403) {
      showStatus("product-status", "Admin access required to publish listings.", "error");
    } else {
      showStatus(
        "product-status",
        error && error.message ? error.message : "Couldn't publish listing.",
        "error"
      );
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setYear();
  setupAdminViews();

  const companyForm = document.getElementById("company-form");
  const productForm = document.getElementById("product-form");
  const orderFilter = document.getElementById("order-status-filter");
  const uploadButton = document.getElementById("image-upload-button");
  const imageFileInput = document.getElementById("image-file-input");
  const imagesTextarea = document.querySelector('#product-form textarea[name="images"]');
  const imagePreview = document.getElementById("image-preview");
  const companyList = document.getElementById("company-list");
  const catalogBody = document.getElementById("catalog-body");
  const ordersBody = document.getElementById("orders-body");
  const userSearchInput = document.getElementById("user-search");
  const usersBody = document.getElementById("users-body");
  const cancelEditButton = document.getElementById("product-cancel");
  const categorySelect = document.getElementById("product-category");

  if (companyForm) companyForm.addEventListener("submit", handleCompanySubmit);
  if (productForm) productForm.addEventListener("submit", handleProductSubmit);
  if (cancelEditButton) {
    cancelEditButton.addEventListener("click", () => resetProductForm());
  }
  if (categorySelect) {
    categorySelect.addEventListener("change", (event) => toggleCategoryFields(event.target.value));
  }
  if (orderFilter) {
    orderFilter.addEventListener("change", (event) => {
      loadOrders(event.target.value);
    });
  }
  if (uploadButton && imageFileInput) {
    uploadButton.addEventListener("click", () => imageFileInput.click());
    imageFileInput.addEventListener("change", async (event) => {
      const [file] = event.target.files || [];
      if (file) {
        await handleImageUpload(file);
      }
      event.target.value = "";
    });
  }
  if (imagesTextarea) {
    imagesTextarea.addEventListener("input", () => syncImagePreview());
    syncImagePreview();
  }
  if (imagePreview) {
    imagePreview.addEventListener("click", (event) => {
      const target = event.target.closest
        ? event.target.closest("button[data-remove-image]")
        : null;
      if (!target) return;
      const url = target.dataset.removeImage;
      if (!url || !imagesTextarea) return;
      const filtered = parseImageList(imagesTextarea.value).filter((item) => item !== url);
      imagesTextarea.value = filtered.join("\n");
      renderImagePreview(filtered);
    });
  }

  resetProductForm();
  if (companyList) {
    companyList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-delete-company]");
      if (!button) return;
      deleteCompany(button.dataset.deleteCompany);
    });
  }
  if (catalogBody) {
    catalogBody.addEventListener("click", (event) => {
      const editButton = event.target.closest("button[data-edit-product]");
      if (editButton) {
        startEditingProduct(editButton.dataset.editProduct);
        return;
      }
      const deleteButton = event.target.closest("button[data-delete-product]");
      if (deleteButton) {
        deleteProduct(deleteButton.dataset.deleteProduct);
      }
    });
  }
  if (ordersBody) {
    ordersBody.addEventListener("change", (event) => {
      const select = event.target.closest("select[data-order-status]");
      if (!select) return;
      const { orderStatus } = select.dataset;
      if (!orderStatus) return;
      select.disabled = true;
      updateOrderStatus(orderStatus, select.value).finally(() => {
        if (document.body.contains(select)) {
          select.disabled = false;
        }
      });
    });
  }
  if (userSearchInput) {
    userSearchInput.addEventListener("input", (event) => {
      renderUsersList(event.target.value);
    });
  }
  if (usersBody) {
    usersBody.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-delete-user]");
      if (!button) return;
      deleteUser(button.dataset.deleteUser);
    });
  }
  if (window.Cart) {
    const badge = document.getElementById("cart-count");
    if (badge) {
      badge.textContent = window.Cart.count();
    }
  }

  if (window.appUser) {
    handleAuthChange(window.appUser);
  } else {
    showStatus("company-status", "Verifying admin session…");
    showStatus("users-status", "Verifying admin session…");
  }

  document.addEventListener("app:user", (event) => {
    handleAuthChange(event.detail);
  });
});
