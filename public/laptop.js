const API_BASE = "/api";
let statusTimer = null;

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

function renderImages(images = [], title = "Laptop image") {
  if (!images.length) {
    images = ["https://placehold.co/800x500?text=Laptop+Preview"];
  }
  const hasMultiple = images.length > 1;
  const slides = images
    .map(
      (url, index) =>
        `<figure class="gallery-slide" data-index="${index}">
          <img src="${url}" alt="${title} ${index + 1}" loading="${index === 0 ? "eager" : "lazy"}" />
        </figure>`
    )
    .join("");
  return `
    <div class="gallery-slider" data-gallery tabindex="0" aria-label="Laptop images">
      <button class="gallery-nav prev" type="button" aria-label="Previous image"${hasMultiple ? "" : " disabled"}>‹</button>
      <div class="gallery-window">
        <div class="gallery-track">
          ${slides}
        </div>
      </div>
      <button class="gallery-nav next" type="button" aria-label="Next image"${hasMultiple ? "" : " disabled"}>›</button>
    </div>
  `;
}

function renderSpec(label, value) {
  if (!value) return "";
  return `<div class="spec-item"><span>${label}</span><strong>${value}</strong></div>`;
}

function showStatus(message, type = "success") {
  const container = document.getElementById("order-status");
  if (!container) return;
  if (statusTimer) {
    clearTimeout(statusTimer);
  }
  container.innerHTML = `<div class="toast ${type === "error" ? "error" : ""}">${message}</div>`;
  statusTimer = window.setTimeout(() => {
    container.innerHTML = "";
  }, 3000);
}

function renderLaptop(laptop) {
  const layout = document.getElementById("detail-layout");
  const modelName = laptop.model?.name ? `• ${laptop.model.name}` : "";
  const warrantyLabel =
    laptop.warranty && laptop.warranty > 0
      ? `${laptop.warranty} year${laptop.warranty > 1 ? "s" : ""}`
      : "";
  layout.innerHTML = `
    <div>
      <h1>${laptop.title}</h1>
      <p class="badge">${laptop.company?.name || "Unassigned"} ${modelName}</p>
      <p>${laptop.description || "Ready to reserve with documented thermal and warranty checks."}</p>
      <div class="gallery">
        ${renderImages(laptop.images, laptop.title)}
      </div>
      <h2>Technical Specifications</h2>
      <div class="spec-list">
        ${renderSpec("GPU", laptop.gpu)}
        ${renderSpec("CPU", laptop.cpu)}
        ${renderSpec("RAM", laptop.ram)}
        ${renderSpec("Storage", laptop.storage)}
        ${renderSpec("Display", laptop.display)}
        ${renderSpec("In Stock", `${laptop.stock ?? 0} units`)}
        ${renderSpec("Warranty", warrantyLabel)}
      </div>
    </div>
    <aside class="panel">
      <h2>Purchase Options</h2>
      <p class="price">${new Intl.NumberFormat("en-EG", {
        style: "currency",
        currency: laptop.currency || "EGP",
        maximumFractionDigits: 0,
      }).format(laptop.price)}</p>
      <p class="field-hint">
        Complete payment on the checkout page. Cash on delivery is confirmed as soon as you submit the order.
      </p>
      <div class="btn-stack">
        <button class="btn btn-primary" data-buy-now="${laptop.id}">Buy Now</button>
        <button class="btn btn-outline" data-add-cart="${laptop.id}">Add to Cart</button>
        <a class="btn btn-outline" href="/cart.html">View Cart</a>
      </div>
      <div id="order-status" class="order-status"></div>
      <p class="field-hint">
        Need multiple units or a custom tweak? Add the laptop to your cart and leave detailed notes at checkout.
      </p>
    </aside>
  `;
  initGallery();
}

function initGallery() {
  const slider = document.querySelector("[data-gallery]");
  if (!slider) return;
  const track = slider.querySelector(".gallery-track");
  const slides = Array.from(slider.querySelectorAll(".gallery-slide"));
  if (!track || !slides.length) return;
  const prev = slider.querySelector(".gallery-nav.prev");
  const next = slider.querySelector(".gallery-nav.next");
  let index = 0;

  const clampIndex = (value) => Math.min(Math.max(value, 0), slides.length - 1);

  const setIndex = (value) => {
    index = clampIndex(value);
    track.style.transform = `translateX(-${index * 100}%)`;
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === slides.length - 1;
  };

  if (prev) {
    prev.addEventListener("click", () => setIndex(index - 1));
  }
  if (next) {
    next.addEventListener("click", () => setIndex(index + 1));
  }

  slider.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setIndex(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setIndex(index + 1);
    }
  });

  setIndex(0);
}

function attachPurchaseActions(laptop) {
  const addButton = document.querySelector("[data-add-cart]");
  if (addButton) {
    if (window.Cart) {
      addButton.addEventListener("click", () => {
        window.Cart.add(laptop.id);
        updateCartCount();
        showStatus(`${laptop.title} added to cart.`);
      });
    } else {
      addButton.disabled = true;
    }
  }

  const buyButton = document.querySelector("[data-buy-now]");
  if (buyButton) {
    buyButton.addEventListener("click", () => {
      if (window.Cart) {
        window.Cart.setBuyNow(laptop.id, 1);
      }
      const url = new URL("/checkout.html", window.location.origin);
      url.searchParams.set("source", "buy");
      url.searchParams.set("item", laptop.id);
      window.location.href = `${url.pathname}${url.search}`;
    });
  }
}

async function init() {
  setYear();
  updateCartCount();
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const layout = document.getElementById("detail-layout");

  if (!id) {
    layout.innerHTML = `<div class="toast error">Missing laptop ID. Return to the <a href="/index.html" style="color: inherit; text-decoration: underline;">inventory list</a>.</div>`;
    return;
  }

  try {
    const laptop = await fetchJSON(`${API_BASE}/laptops/${encodeURIComponent(id)}`);
    renderLaptop(laptop);
    attachPurchaseActions(laptop);
  } catch (error) {
    console.error(error);
    layout.innerHTML = `<div class="toast error">We couldn't find that laptop—maybe it was just reserved already.</div>`;
  }
}

document.addEventListener("DOMContentLoaded", init);
