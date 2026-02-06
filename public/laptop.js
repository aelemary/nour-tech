const API_BASE = "/api";
let statusTimer = null;
const TYPE_LABELS = {
  laptop: "Laptop",
  gpu: "GPU",
  cpu: "CPU",
  hdd: "HDD",
  motherboard: "Motherboard",
};

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

function renderImages(images = [], title = "Product image") {
  if (!images.length) {
    images = ["https://placehold.co/800x500?text=Product+Preview"];
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
    <div class="gallery-slider" data-gallery tabindex="0" aria-label="Product images">
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

function renderProduct(product) {
  const layout = document.getElementById("detail-layout");
  const typeLabel = TYPE_LABELS[product.type] || "Product";
  const warrantyLabel =
    product.warranty && product.warranty > 0
      ? `${product.warranty} year${product.warranty > 1 ? "s" : ""}`
      : "";
  const description = product.description
    ? `<p class="detail-description">${product.description}</p>`
    : "";
  const specs = [];
  if (product.type === "laptop") {
    specs.push(renderSpec("GPU", product.gpu));
    specs.push(renderSpec("CPU", product.cpu));
    specs.push(renderSpec("RAM", product.ram));
    specs.push(renderSpec("Storage", product.storage));
    specs.push(renderSpec("Display", product.display));
  }
  if (product.shortName) {
    specs.push(renderSpec("Model", product.shortName));
  }
  if (warrantyLabel) {
    specs.push(renderSpec("Warranty", warrantyLabel));
  }
  layout.innerHTML = `
    <div class="detail-main">
      <div class="detail-heading">
        <h1 class="detail-title">${product.title}</h1>
        <p class="badge">${product.company?.name || "Unassigned"} • ${typeLabel}</p>
        ${description}
      </div>
      <div class="detail-gallery gallery">
        ${renderImages(product.images, product.title)}
      </div>
    </div>
    <aside class="panel detail-purchase">
      <h2>Purchase Options</h2>
      <p class="price">${new Intl.NumberFormat("en-EG", {
        style: "currency",
        currency: product.currency || "EGP",
        maximumFractionDigits: 0,
      }).format(product.price)}</p>
      <p class="field-hint">
        Complete payment on the checkout page. Cash on delivery is confirmed as soon as you submit the order.
      </p>
      <div class="btn-stack">
        <button class="btn btn-primary" data-buy-now="${product.id}">Buy Now</button>
        <button class="btn btn-outline" data-add-cart="${product.id}">Add to Cart</button>
        <a class="btn btn-outline" href="/cart.html">View Cart</a>
      </div>
      <div id="order-status" class="order-status"></div>
      <p class="field-hint">
        Need multiple units or a custom tweak? Add the product to your cart and leave detailed notes at checkout.
      </p>
    </aside>
    <section class="detail-specs">
      <h2>Specifications</h2>
      <div class="spec-list">
        ${specs.join("") || `<div class="field-hint">No specifications listed yet.</div>`}
      </div>
    </section>
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

function attachPurchaseActions(product) {
  const addButton = document.querySelector("[data-add-cart]");
  if (addButton) {
    if (window.Cart) {
      addButton.addEventListener("click", () => {
        window.Cart.add(product.id);
        updateCartCount();
        showStatus(`${product.title} added to cart.`);
      });
    } else {
      addButton.disabled = true;
    }
  }

  const buyButton = document.querySelector("[data-buy-now]");
  if (buyButton) {
    buyButton.addEventListener("click", () => {
      if (window.Cart) {
        window.Cart.setBuyNow(product.id, 1);
      }
      const url = new URL("/checkout.html", window.location.origin);
      url.searchParams.set("source", "buy");
      url.searchParams.set("item", product.id);
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
    layout.innerHTML = `<div class="toast error">Missing product ID. Return to the <a href="/index.html" style="color: inherit; text-decoration: underline;">inventory list</a>.</div>`;
    return;
  }

  try {
    const product = await fetchJSON(`${API_BASE}/products/${encodeURIComponent(id)}`);
    renderProduct(product);
    attachPurchaseActions(product);
  } catch (error) {
    console.error(error);
    layout.innerHTML = `<div class="toast error">We couldn't find that product—maybe it was just reserved already.</div>`;
  }
}

document.addEventListener("DOMContentLoaded", init);
