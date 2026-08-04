let currentProduct = null;

function specEntries(product) {
  const entries = [];
  const push = (label, value) => {
    const clean = String(value || "").trim();
    if (clean) entries.push([label, clean]);
  };
  push("Brand", product.company?.name);
  push("Model", product.shortName);
  push("Processor", product.cpu);
  push("Graphics", product.gpu);
  push("Memory", product.ram);
  push("Storage", product.storage);
  push("Display", product.display);
  push("Warranty", product.warranty ? `${product.warranty} year${product.warranty === 1 ? "" : "s"}` : "");
  Object.entries(Storefront.manualSpecs(product)).forEach(([key, value]) => {
    const hidden = ["price", "sale price", "current price", "old price", "compare at price", "regular price", "stock", "quantity", "featured", "is featured", "badge", "label", "shipping", "shipping period", "delivery", "payment", "payment methods", "condition", "subcategory", "sub category", "collection"].includes(String(key).trim().toLowerCase());
    if (!hidden && !entries.some(([label]) => label.toLowerCase() === String(key).toLowerCase())) push(key, value);
  });
  return entries;
}

function renderGallery(product) {
  const images = product.images?.length ? product.images : [Storefront.productImage(product, 900, 700)];
  return `
    <div class="store-product-gallery" data-gallery>
      <div class="store-main-image"><img id="main-product-image" src="${Storefront.escapeHtml(images[0])}" alt="${Storefront.escapeHtml(product.title)}" /></div>
      <div class="store-thumbnails">
        ${images.map((image, index) => `<button type="button" class="${index === 0 ? "is-active" : ""}" data-image="${Storefront.escapeHtml(image)}"><img src="${Storefront.escapeHtml(image)}" alt="${Storefront.escapeHtml(product.title)} view ${index + 1}" /></button>`).join("")}
      </div>
    </div>
  `;
}

function renderProduct(product) {
  currentProduct = product;
  const meta = Storefront.productMeta(product);
  const detail = document.getElementById("product-detail");
  const loading = document.getElementById("product-loading");
  const stockText = meta.stock === null ? "Available to order" : meta.stock > 0 ? `Only ${meta.stock} left in stock` : "Out of stock";
  const discount = meta.compareAtPrice > meta.price && meta.price > 0
    ? Math.round(((meta.compareAtPrice - meta.price) / meta.compareAtPrice) * 100)
    : 0;
  detail.innerHTML = `
    ${renderGallery(product)}
    <div class="store-product-info">
      <p class="store-product-brand">${Storefront.escapeHtml(product.company?.name || "Nour Tech")} · ${Storefront.escapeHtml(Storefront.categoryLabel(product.type))}</p>
      ${meta.badge ? `<span class="store-product-label">${Storefront.escapeHtml(meta.badge)}</span>` : ""}
      <h1>${Storefront.escapeHtml(product.title)}</h1>
      <div class="store-product-rating"><span>★★★★★</span><small>Premium selection by Nour Tech</small></div>
      <div class="store-product-price-row">
        <strong>${Storefront.escapeHtml(Storefront.formatCurrency(meta.price))}</strong>
        ${meta.compareAtPrice > meta.price && meta.price > 0 ? `<del>${Storefront.escapeHtml(Storefront.formatCurrency(meta.compareAtPrice))}</del><span class="store-discount">Save ${discount}%</span>` : ""}
      </div>
      <p class="store-product-summary">${Storefront.escapeHtml(Storefront.productSummary(product) || product.description || "Contact us for full details and availability.")}</p>
      <div class="store-stock-line ${meta.stock === 0 ? "is-out" : ""}"><span></span>${Storefront.escapeHtml(stockText)}</div>
      <div class="store-purchase-row">
        <div class="store-quantity"><button type="button" data-qty-minus>−</button><input id="product-quantity" type="number" min="1" max="99" value="1" /><button type="button" data-qty-plus>+</button></div>
        <button class="store-btn store-btn-primary store-btn-large" type="button" data-add-product ${meta.stock === 0 ? "disabled" : ""}>${meta.stock === 0 ? "Sold out" : "Add to cart"}</button>
      </div>
      <button class="store-btn store-btn-dark store-btn-large store-buy-now" type="button" data-buy-product ${meta.stock === 0 ? "disabled" : ""}>Buy now</button>
      <div class="store-secondary-actions"><button type="button" data-save-product>${Storefront.isWishlisted(product.id) ? "♥ Saved" : "♡ Add to wishlist"}</button><a data-whatsapp-link href="https://wa.me/201034898787" target="_blank" rel="noopener noreferrer">Need help?</a></div>
      <div class="store-product-benefits">
        <article><span>🛡️</span><div><strong>Condition & Warranty</strong><p>${Storefront.escapeHtml(meta.condition)}${product.warranty ? ` with ${product.warranty} year${product.warranty === 1 ? "" : "s"} warranty` : ""}</p></div></article>
        <article><span>🚚</span><div><strong>Shipping Period</strong><p>${Storefront.escapeHtml(meta.shipping)}</p></div></article>
        <article><span>💳</span><div><strong>Payment Methods</strong><p>${Storefront.escapeHtml(meta.payment)}</p></div></article>
      </div>
      ${meta.sku ? `<p class="store-sku">SKU: ${Storefront.escapeHtml(meta.sku)}</p>` : ""}
    </div>
  `;
  loading.hidden = true;
  detail.hidden = false;
  document.getElementById("breadcrumb-current").textContent = product.title;
  document.title = `${product.title} | Nour Tech`;

  detail.querySelectorAll("[data-image]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("main-product-image").src = button.dataset.image;
      detail.querySelectorAll("[data-image]").forEach((item) => item.classList.toggle("is-active", item === button));
    });
  });
  const quantity = document.getElementById("product-quantity");
  detail.querySelector("[data-qty-minus]")?.addEventListener("click", () => quantity.value = Math.max(1, Number(quantity.value || 1) - 1));
  detail.querySelector("[data-qty-plus]")?.addEventListener("click", () => quantity.value = Math.min(99, Number(quantity.value || 1) + 1));
  detail.querySelector("[data-add-product]")?.addEventListener("click", () => Storefront.addToCart(product, quantity.value));
  detail.querySelector("[data-buy-product]")?.addEventListener("click", () => {
    const qty = Math.max(1, Number(quantity.value) || 1);
    window.Cart?.setBuyNow(product.id, qty);
    window.location.href = `/checkout.html?source=buy&item=${encodeURIComponent(product.id)}`;
  });
  detail.querySelector("[data-save-product]")?.addEventListener("click", (event) => {
    const active = Storefront.toggleWishlist(product.id);
    event.currentTarget.textContent = active ? "♥ Saved" : "♡ Add to wishlist";
    Storefront.toast(active ? "Added to wishlist." : "Removed from wishlist.");
  });
  Storefront.boot();
}

function renderContent(product) {
  const section = document.getElementById("product-description-section");
  const description = document.getElementById("product-description");
  const specs = document.getElementById("product-specifications");
  const entries = specEntries(product);
  description.innerHTML = `<h2>Product Description</h2><p>${Storefront.escapeHtml(product.description || "Contact Nour Tech for full product details, availability and purchase advice.")}</p>`;
  specs.innerHTML = `<h2>Specifications</h2><div class="store-spec-table">${entries.map(([label, value]) => `<div><span>${Storefront.escapeHtml(label)}</span><strong>${Storefront.escapeHtml(value)}</strong></div>`).join("")}</div>`;
  section.hidden = false;
  section.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      section.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
      description.hidden = button.dataset.tab !== "description";
      specs.hidden = button.dataset.tab !== "specifications";
    });
  });
}

function renderRelated(product, products) {
  const related = products.filter((item) => item.id !== product.id && item.type === product.type).slice(0, 4);
  if (!related.length) return;
  const section = document.getElementById("related-section");
  const grid = document.getElementById("related-products");
  related.forEach((item) => grid.appendChild(Storefront.createProductCard(item)));
  section.hidden = false;
}

async function initProduct() {
  Storefront.boot();
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    document.getElementById("product-loading").textContent = "Missing product ID.";
    return;
  }
  try {
    const [product, products] = await Promise.all([
      Storefront.fetchJSON(`${Storefront.API_BASE}/products/${encodeURIComponent(id)}`),
      Storefront.fetchJSON(`${Storefront.API_BASE}/products`).catch(() => []),
    ]);
    renderProduct(product);
    renderContent(product);
    renderRelated(product, products);
  } catch (error) {
    console.error(error);
    document.getElementById("product-loading").textContent = "This product could not be found or is no longer available.";
  }
}

document.addEventListener("DOMContentLoaded", initProduct);
