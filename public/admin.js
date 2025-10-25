const API_BASE = "/api";

const state = {
  companies: [],
  models: [],
  laptops: [],
  orders: [],
  orderFilter: "",
  users: [],
  userSearch: "",
};
let bootstrapped = false;

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
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
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
    img.alt = "Laptop image";
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
  const textarea = document.querySelector('#laptop-form textarea[name="images"]');
  if (!textarea) return;
  const existing = parseImageList(textarea.value);
  if (!existing.includes(url)) {
    existing.push(url);
    textarea.value = existing.join("\n");
  }
  renderImagePreview(existing);
}

function syncImagePreview() {
  const textarea = document.querySelector('#laptop-form textarea[name="images"]');
  if (!textarea) return;
  renderImagePreview(parseImageList(textarea.value));
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
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

function populateModelSelect() {
  const select = document.getElementById("laptop-model");
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Select Model</option>';
  state.models
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((model) => {
      const company = state.companies.find((c) => c.id === model.companyId);
      const label = company ? `${company.name} • ${model.name}` : model.name;
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = label;
      select.appendChild(option);
    });
  if (current && state.models.find((model) => model.id === current)) {
    select.value = current;
  }
}

function updateStats() {
  document.getElementById("stat-admin-brands").textContent = state.companies.length;
  document.getElementById("stat-admin-models").textContent = state.models.length;
  document.getElementById("stat-admin-laptops").textContent = state.laptops.length;
  const pending = state.orders.filter(
    (order) => order.status !== "completed" && order.status !== "cancelled"
  ).length;
  document.getElementById("stat-admin-orders").textContent = pending;
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
  const tbody = document.getElementById("orders-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!orders.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.style.textAlign = "center";
    cell.style.color = "var(--text-muted)";
    cell.textContent = "No orders to display right now.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }
  const fragment = document.createDocumentFragment();
  orders.forEach((order) => {
    const row = document.createElement("tr");
    const contact = [order.phone, order.email].filter(Boolean).join(" • ");
    const quantityLabel = order.quantity ? ` • Qty ${order.quantity}` : "";
    const laptopLabel = order.laptop
      ? `${order.laptop.title} (${order.laptop.currency || "EGP"} ${order.laptop.price})${quantityLabel}`
      : `Listing removed${quantityLabel}`;
    const statusLabel = getStatusLabel(order.status);
    row.innerHTML = `
      <td>${order.id}</td>
      <td>${formatDate(order.createdAt)}</td>
      <td>${order.customerName}</td>
      <td>${contact || "—"}</td>
      <td>${order.paymentType}</td>
      <td>${laptopLabel}</td>
      <td data-status-cell="${order.id}"></td>
    `;
    const statusCell = row.querySelector(`[data-status-cell="${order.id}"]`);
    if (statusCell) {
      statusCell.innerHTML = `
        <div class="status-control">
          <span class="status-pill ${order.status}">${statusLabel}</span>
          <select class="status-select" data-order-status="${order.id}">
            ${ORDER_STATUS_OPTIONS.map(
              (option) =>
                `<option value="${option.value}"${option.value === order.status ? " selected" : ""}>${
                  option.label
                }</option>`
            ).join("")}
          </select>
        </div>
      `;
    }
    if (order.notes) {
      const listingCell = row.cells[5];
      if (listingCell) {
        const note = document.createElement("div");
        note.className = "field-hint";
        note.textContent = `Notes: ${order.notes}`;
        listingCell.appendChild(note);
      }
    }
    fragment.appendChild(row);
  });
  tbody.appendChild(fragment);
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

function renderModelList() {
  const list = document.getElementById("model-list");
  if (!list) return;
  list.innerHTML = "";
  if (!state.models.length) {
    const empty = document.createElement("li");
    empty.textContent = "No models yet.";
    empty.style.opacity = "0.7";
    list.appendChild(empty);
    return;
  }
  state.models
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((model) => {
      const company = state.companies.find((company) => company.id === model.companyId);
      const item = document.createElement("li");
      item.innerHTML = `<span>${company ? `${company.name} • ` : ""}${model.name}</span>`;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.deleteModel = model.id;
      button.textContent = "Remove";
      item.appendChild(button);
      list.appendChild(item);
    });
}

function renderLaptopCatalog() {
  const tbody = document.getElementById("catalog-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!state.laptops.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.style.textAlign = "center";
    cell.style.color = "var(--text-muted)";
    cell.textContent = "No listings published yet.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }
  const fragment = document.createDocumentFragment();
  state.laptops
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .forEach((laptop) => {
      const model = state.models.find((item) => item.id === laptop.modelId);
      const company = state.companies.find((item) => item.id === laptop.companyId);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${laptop.title}</strong><div class="field-hint">${company ? company.name : "—"}</div></td>
        <td>${model ? model.name : "—"}</td>
        <td>${new Intl.NumberFormat("en-EG", {
          style: "currency",
          currency: laptop.currency || "EGP",
          maximumFractionDigits: 0,
        }).format(laptop.price)}</td>
        <td>
          <button class="link-button" data-delete-laptop="${laptop.id}">Remove</button>
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
    `Delete brand "${company ? company.name : companyId}"? Models and listings under it will be removed.`
  );
  if (!confirmed) return;
  try {
    await fetchJSON(`${API_BASE}/companies/${encodeURIComponent(companyId)}`, {
      method: "DELETE",
    });
    state.companies = state.companies.filter((item) => item.id !== companyId);
    const removedModelIds = new Set(state.models.filter((item) => item.companyId === companyId).map((m) => m.id));
    const removedLaptopIds = new Set(
      state.laptops
        .filter((item) => item.companyId === companyId || removedModelIds.has(item.modelId))
        .map((item) => item.id)
    );
    state.models = state.models.filter((item) => item.companyId !== companyId);
    state.laptops = state.laptops.filter(
      (item) => item.companyId !== companyId && !removedModelIds.has(item.modelId)
    );
    state.orders = state.orders.map((order) =>
      removedLaptopIds.has(order.laptopId) ? { ...order, laptop: null } : order
    );
    populateCompanySelect("model-company");
    populateModelSelect();
    renderCompanyList();
    renderModelList();
    renderLaptopCatalog();
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

async function deleteModel(modelId) {
  if (!modelId) return;
  const model = state.models.find((item) => item.id === modelId);
  const confirmed = window.confirm(
    `Delete model "${model ? model.name : modelId}" and any listings attached to it?`
  );
  if (!confirmed) return;
  try {
    await fetchJSON(`${API_BASE}/models/${encodeURIComponent(modelId)}`, {
      method: "DELETE",
    });
    const removedLaptopIds = new Set(state.laptops.filter((item) => item.modelId === modelId).map((item) => item.id));
    state.models = state.models.filter((item) => item.id !== modelId);
    state.laptops = state.laptops.filter((item) => item.modelId !== modelId);
    populateModelSelect();
    renderModelList();
    renderLaptopCatalog();
    state.orders = state.orders.map((order) =>
      removedLaptopIds.has(order.laptopId) ? { ...order, laptop: null } : order
    );
    const filteredOrders = state.orderFilter
      ? state.orders.filter((order) => order.status === state.orderFilter)
      : state.orders;
    renderOrders(filteredOrders);
    renderUsersList(state.userSearch);
    updateStats();
    showStatus("model-status", "Model removed successfully.");
  } catch (error) {
    console.error(error);
    showStatus("model-status", "Could not delete model. Please try again.", "error");
  }
}

async function deleteLaptop(laptopId) {
  if (!laptopId) return;
  const laptop = state.laptops.find((item) => item.id === laptopId);
  const confirmed = window.confirm(`Delete listing "${laptop ? laptop.title : laptopId}"?`);
  if (!confirmed) return;
  try {
    await fetchJSON(`${API_BASE}/laptops/${encodeURIComponent(laptopId)}`, {
      method: "DELETE",
    });
    state.laptops = state.laptops.filter((item) => item.id !== laptopId);
    renderLaptopCatalog();
    state.orders = state.orders.map((order) =>
      order.laptopId === laptopId ? { ...order, laptop: null } : order
    );
    const filteredOrders = state.orderFilter
      ? state.orders.filter((order) => order.status === state.orderFilter)
      : state.orders;
    renderOrders(filteredOrders);
    renderUsersList(state.userSearch);
    updateStats();
    showStatus("laptop-status", "Listing removed.");
  } catch (error) {
    console.error(error);
    showStatus("laptop-status", "Could not delete listing.", "error");
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
    const [companies, models, laptops, orders, users] = await Promise.all([
      fetchJSON(`${API_BASE}/companies`),
      fetchJSON(`${API_BASE}/models`),
      fetchJSON(`${API_BASE}/laptops`),
      fetchJSON(`${API_BASE}/orders`),
      fetchJSON(`${API_BASE}/users`),
    ]);
    state.companies = companies;
    state.models = models;
    state.laptops = laptops;
    state.orders = orders;
    state.users = users.map((user) => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName || "",
      role: user.role,
    }));
    state.userSearch = "";
    state.orderFilter = "";
    populateCompanySelect("model-company");
    populateModelSelect();
    renderCompanyList();
    renderModelList();
    renderLaptopCatalog();
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
    populateCompanySelect("model-company");
    populateModelSelect();
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

async function handleModelSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  try {
    showStatus("model-status", "Saving model…");
    const model = await fetchJSON(`${API_BASE}/models`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.models.push(model);
    populateModelSelect();
    renderModelList();
    updateStats();
    showStatus("model-status", `Model ${model.name} added.`);
    form.reset();
  } catch (error) {
    console.error(error);
    if (error.status === 401 || error.status === 403) {
      showStatus("model-status", "Admin access required to add models.", "error");
    } else {
      showStatus("model-status", "Couldn't create model.", "error");
    }
  }
}

async function handleImageUpload(file) {
  if (!file) return;
  if (file.size > MAX_UPLOAD_SIZE) {
    showStatus("laptop-status", "Image exceeds 5MB limit.", "error");
    return;
  }
  try {
    showStatus("laptop-status", "Uploading image…");
    const dataUrl = await readFileAsDataURL(file);
    const result = await fetchJSON(`${API_BASE}/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        data: dataUrl,
      }),
    });
    appendImageUrl(result.url);
    showStatus("laptop-status", "Image uploaded and attached.");
  } catch (error) {
    console.error(error);
    if (error.status === 401 || error.status === 403) {
      showStatus("laptop-status", "Admin access required to upload images.", "error");
    } else {
      showStatus("laptop-status", "Couldn't upload image.", "error");
    }
  }
}

async function handleLaptopSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  if (payload.price !== undefined && payload.price !== "") {
    payload.price = Number(payload.price);
  }
  if (payload.stock !== undefined && payload.stock !== "") {
    payload.stock = Number(payload.stock);
  }
  try {
    showStatus("laptop-status", "Publishing listing…");
    const laptop = await fetchJSON(`${API_BASE}/laptops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.laptops.push(laptop);
    renderLaptopCatalog();
    updateStats();
    showStatus("laptop-status", `Listing ${laptop.title} is live.`);
    form.reset();
    renderImagePreview([]);
  } catch (error) {
    console.error(error);
    if (error.status === 401 || error.status === 403) {
      showStatus("laptop-status", "Admin access required to publish listings.", "error");
    } else {
      showStatus("laptop-status", "Couldn't publish listing.", "error");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setYear();

  const companyForm = document.getElementById("company-form");
  const modelForm = document.getElementById("model-form");
  const laptopForm = document.getElementById("laptop-form");
  const orderFilter = document.getElementById("order-status-filter");
  const uploadButton = document.getElementById("image-upload-button");
  const imageFileInput = document.getElementById("image-file-input");
  const imagesTextarea = document.querySelector('#laptop-form textarea[name="images"]');
  const imagePreview = document.getElementById("image-preview");
  const companyList = document.getElementById("company-list");
  const modelList = document.getElementById("model-list");
  const catalogBody = document.getElementById("catalog-body");
  const ordersBody = document.getElementById("orders-body");
  const userSearchInput = document.getElementById("user-search");
  const usersBody = document.getElementById("users-body");

  if (companyForm) companyForm.addEventListener("submit", handleCompanySubmit);
  if (modelForm) modelForm.addEventListener("submit", handleModelSubmit);
  if (laptopForm) laptopForm.addEventListener("submit", handleLaptopSubmit);
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
  if (companyList) {
    companyList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-delete-company]");
      if (!button) return;
      deleteCompany(button.dataset.deleteCompany);
    });
  }
  if (modelList) {
    modelList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-delete-model]");
      if (!button) return;
      deleteModel(button.dataset.deleteModel);
    });
  }
  if (catalogBody) {
    catalogBody.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-delete-laptop]");
      if (!button) return;
      deleteLaptop(button.dataset.deleteLaptop);
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
