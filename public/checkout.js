const API_BASE = "/api";
const GOOGLE_CUSTOMER_REVIEWS_MERCHANT_ID = 5838618467;
let statusTimer = null;
let currentItems = [];
let currentTotal = 0;
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

function formatCurrency(amount, currency = "EGP") {
  if (amount == null || !Number.isFinite(Number(amount))) return "Price on request";
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
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

function renderSummary(items) {
  const emptyEl = document.getElementById("checkout-empty");
  const contentEl = document.getElementById("checkout-content");
  const list = document.getElementById("summary-list");
  const totalEl = document.getElementById("checkout-total");
  const submitTotalEl = document.getElementById("checkout-submit-total");
  if (!list || !totalEl) return;

  if (!items.length) {
    list.innerHTML = "";
    totalEl.textContent = formatCurrency(0);
    if (submitTotalEl) submitTotalEl.textContent = formatCurrency(0);
    currentTotal = 0;
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
    const lineTotal = item.price == null ? null : quantity * Number(item.price);
    if (lineTotal != null && Number.isFinite(lineTotal)) total += lineTotal;
    const hintParts = [];
    if (item.company?.name) hintParts.push(`Brand: ${item.company.name}`);
    if (item.type) hintParts.push(`Category: ${item.type.toUpperCase()}`);
    if (item.type === "laptop" && item.cpu) hintParts.push(`CPU: ${item.cpu}`);
    if (item.type === "laptop" && item.ram) hintParts.push(`RAM: ${item.ram}`);
    const hintText = hintParts.join(" • ");
    const li = document.createElement("li");
    const itemDetails = document.createElement("span");
    const itemTitle = document.createElement("strong");
    const itemHint = document.createElement("span");
    const itemPrice = document.createElement("span");
    const itemLineTotal = document.createElement("small");

    itemTitle.textContent = item.shortName || item.title;
    itemHint.className = "field-hint";
    itemHint.textContent = hintText || item.gpu || "";
    itemPrice.textContent = `${quantity} × ${formatCurrency(item.price, item.currency)}`;
    itemLineTotal.textContent = formatCurrency(lineTotal, item.currency);
    itemDetails.append(itemTitle, itemHint);
    itemPrice.append(itemLineTotal);
    li.append(itemDetails, itemPrice);
    fragment.appendChild(li);
  });
  list.appendChild(fragment);
  currentTotal = total;
  const formattedTotal = formatCurrency(total, items[0]?.currency || "EGP");
  totalEl.textContent = formattedTotal;
  if (submitTotalEl) submitTotalEl.textContent = formattedTotal;
}

function orderReference(id) {
  return id ? `NT-${String(id).slice(-8).toUpperCase()}` : "Nour Tech order";
}

function estimatedDeliveryDate(createdAt) {
  const date = createdAt ? new Date(createdAt) : new Date();
  if (Number.isNaN(date.getTime())) return "";

  // Nour Tech delivers Sunday–Thursday. Give Google the latest promised date: two business days.
  let businessDays = 0;
  while (businessDays < 2) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day >= 0 && day <= 4) businessDays += 1;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function showGoogleCustomerReviewOptIn(order) {
  if (!order?.id || !order?.email) return;

  const surveyConfig = {
    merchant_id: GOOGLE_CUSTOMER_REVIEWS_MERCHANT_ID,
    order_id: order.id,
    email: order.email,
    delivery_country: "EG",
    estimated_delivery_date: estimatedDeliveryDate(order.createdAt),
  };

  const renderSurvey = () => {
    if (!window.gapi?.load) return;
    window.gapi.load("surveyoptin", () => {
      if (window.gapi?.surveyoptin?.render) {
        window.gapi.surveyoptin.render(surveyConfig);
      }
    });
  };

  window.renderOptIn = renderSurvey;
  const existingScript = document.getElementById("google-customer-reviews-opt-in");
  if (existingScript) {
    renderSurvey();
    return;
  }

  const script = document.createElement("script");
  script.id = "google-customer-reviews-opt-in";
  script.src = "https://apis.google.com/js/platform.js?onload=renderOptIn";
  script.async = true;
  script.defer = true;
  script.addEventListener("error", () => {
    // An ad blocker must not interfere with displaying the completed order.
  });
  document.head.appendChild(script);
}

function trackPurchase(order, total, items = []) {
  const transactionId = String(order?.id || "").trim();
  if (!transactionId || typeof window.gtag !== "function") return;

  const storageKey = `nour-tech-purchase:${transactionId}`;
  try {
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");
  } catch (error) {
    // Tracking must still work when browser storage is unavailable.
  }

  window.gtag("event", "purchase", {
    transaction_id: transactionId,
    affiliation: "Nour Tech Egypt",
    value: Number(total) || 0,
    currency: "EGP",
    items: items.map((item) => ({
      item_id: String(item.id || ""),
      item_name: item.shortName || item.title || "Nour Tech product",
      item_brand: item.company?.name || "Nour Tech",
      item_category: item.type || "hardware",
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
    })),
  });
}

function showSuccess(order, total, purchasedItems = []) {
  const contentEl = document.getElementById("checkout-content");
  const introEl = document.getElementById("checkout-intro");
  const successEl = document.getElementById("checkout-success");
  const orderIdEl = document.getElementById("success-order-id");
  const emailEl = document.getElementById("success-email");
  const totalEl = document.getElementById("success-total");
  const emailNoteEl = document.getElementById("success-email-note");
  if (!successEl) return;

  if (contentEl) contentEl.hidden = true;
  if (introEl) introEl.hidden = true;
  if (orderIdEl) orderIdEl.textContent = orderReference(order?.id);
  if (emailEl) emailEl.textContent = order?.email || "your email address";
  if (totalEl) totalEl.textContent = formatCurrency(total);
  if (emailNoteEl) {
    emailNoteEl.textContent = order?.confirmationEmailSent
      ? "A confirmation with your order details has been sent to your email."
      : "Your order is confirmed. Our team will send your order details to your email shortly.";
  }
  successEl.hidden = false;
  trackPurchase(order, total, purchasedItems);
  showGoogleCustomerReviewOptIn(order);
  successEl.scrollIntoView({ behavior: "smooth", block: "start" });
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
    const ids = baseItems.map((item) => item.id).filter(Boolean);
    let products = [];
    if (ids.length) {
      const url = new URL(`${API_BASE}/products`, window.location.origin);
      url.searchParams.set("ids", ids.join(","));
      try {
        products = await fetchJSON(url.toString());
      } catch (error) {
        const fallbackUrl = new URL(`${API_BASE}/products`, window.location.origin);
        products = await fetchJSON(fallbackUrl.toString());
      }
    }
    const merged = baseItems
      .map((entry) => {
        const product = products.find((item) => item.id === entry.id);
        if (!product) return null;
        return { ...product, quantity: entry.quantity || 1 };
      })
      .filter(Boolean);
    currentItems = merged;
    renderSummary(merged);
    updateCartCount();
    if (!merged.length && baseItems.length) {
      showStatus("Some checkout items are no longer available.", "error");
    }
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
    const order = await fetchJSON(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: currentItems.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
        customerName: data.customerName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        notes: data.notes || "",
      }),
    });

    const submittedTotal = currentTotal;
    const submittedItems = currentItems.map((item) => ({ ...item }));
    if (mode === "cart") {
      window.Cart.clear();
    } else {
      window.Cart.clearBuyNow();
      if (currentItems[0]) {
        window.Cart.remove(currentItems[0].id);
      }
    }
    currentItems = [];
    form.reset();
    updateCartCount();
    showSuccess(order, submittedTotal, submittedItems);
  } catch (error) {
    console.error(error);
    showStatus(error.message || "Couldn't submit the order—please try again.", "error");
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
