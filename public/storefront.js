(function () {
  const API_BASE = "/api";
  const WISHLIST_KEY = "nourtech-wishlist";
  const CATEGORY_LABELS = {
    laptop: "Laptops",
    gpu: "Graphics Cards",
    cpu: "Processors",
    motherboard: "Motherboards",
    ram: "Memory",
    storage: "Storage",
    hdd: "Storage",
    monitor: "Monitors",
    printer: "Printers",
    desktop: "Desktop PCs",
    power: "Power Supplies",
    accessory: "Accessories",
  };
  const CATEGORY_ICONS = {
    laptop: "💻",
    gpu: "🎮",
    cpu: "⚙️",
    motherboard: "🧩",
    ram: "🧠",
    storage: "💾",
    hdd: "💾",
    monitor: "🖥️",
    printer: "🖨️",
    desktop: "🖥️",
    power: "🔌",
    accessory: "⌨️",
  };

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function fetchJSON(url, options = {}) {
    const response = await fetch(url, { credentials: "include", ...options });
    if (!response.ok) {
      const text = await response.text();
      let message = text || `Request failed with status ${response.status}`;
      try {
        const data = JSON.parse(text);
        if (data?.error) message = data.error;
      } catch (_) {
        // Keep the plain response body.
      }
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function normalizeKey(value = "") {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, " ");
  }

  function manualSpecs(product) {
    const manual = product?.specsRaw?.manual;
    return manual && typeof manual === "object" && !Array.isArray(manual) ? manual : {};
  }

  function findMeta(product, aliases, fallback = "") {
    const source = manualSpecs(product);
    const aliasSet = new Set(aliases.map(normalizeKey));
    for (const [key, value] of Object.entries(source)) {
      if (aliasSet.has(normalizeKey(key))) return value;
    }
    return fallback;
  }

  function parseNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (value == null || value === "") return 0;
    const normalized = String(value).replace(/[^0-9.-]/g, "");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function parseBoolean(value) {
    if (typeof value === "boolean") return value;
    return ["1", "true", "yes", "featured", "on"].includes(normalizeKey(value));
  }

  function productMeta(product) {
    const price = parseNumber(findMeta(product, ["price", "sale price", "current price"]));
    const compareAtPrice = parseNumber(
      findMeta(product, ["old price", "compare at price", "regular price", "before price"])
    );
    const stockValue = findMeta(product, ["stock", "quantity", "inventory"]);
    const stock = stockValue === "" ? null : Math.max(0, Math.floor(parseNumber(stockValue)));
    const featured = parseBoolean(findMeta(product, ["featured", "is featured"]));
    const subcategory = String(findMeta(product, ["subcategory", "sub category", "collection"]) || "").trim();
    const sku = String(findMeta(product, ["sku", "product code", "model code"]) || product.shortName || "").trim();
    const condition = String(findMeta(product, ["condition"]) || "Brand New (Sealed)").trim();
    const shipping = String(
      findMeta(product, ["shipping", "shipping period", "delivery"]) ||
        "Delivery time is confirmed after placing the order"
    ).trim();
    const payment = String(
      findMeta(product, ["payment", "payment methods"]) ||
        "Cash on Delivery, InstaPay, Bank Transfer and E-Wallets"
    ).trim();
    const badge = String(findMeta(product, ["badge", "label"]) || "").trim();
    return { price, compareAtPrice, stock, featured, subcategory, sku, condition, shipping, payment, badge };
  }

  function formatCurrency(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return "Ask for price";
    return `${new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(amount)} EGP`;
  }

  function categoryLabel(type) {
    const normalized = String(type || "").trim().toLowerCase();
    if (!normalized) return "Products";
    if (CATEGORY_LABELS[normalized]) return CATEGORY_LABELS[normalized];
    return normalized
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function categoryIcon(type) {
    return CATEGORY_ICONS[String(type || "").toLowerCase()] || "✨";
  }

  function productImage(product, width = 700, height = 520) {
    const type = categoryLabel(product?.type);
    return (
      product?.images?.[0] ||
      `https://placehold.co/${width}x${height}/f4f6f8/123b66?text=${encodeURIComponent(type)}`
    );
  }

  function productSummary(product) {
    const items = [product.cpu, product.gpu, product.ram, product.storage, product.display]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    if (items.length) return items.slice(0, 3).join(" • ");
    return String(product.description || product.shortName || "").trim();
  }

  function discountPercent(meta) {
    if (!meta.price || !meta.compareAtPrice || meta.compareAtPrice <= meta.price) return 0;
    return Math.round(((meta.compareAtPrice - meta.price) / meta.compareAtPrice) * 100);
  }

  function readWishlist() {
    try {
      const value = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function writeWishlist(ids) {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
    } catch (_) {
      // Browsing still works when storage is blocked.
    }
  }

  function isWishlisted(id) {
    return readWishlist().includes(String(id));
  }

  function toggleWishlist(id) {
    const normalized = String(id);
    const items = readWishlist();
    const exists = items.includes(normalized);
    const next = exists ? items.filter((item) => item !== normalized) : [...items, normalized];
    writeWishlist(next);
    return !exists;
  }

  function updateCartCount() {
    const badge = document.getElementById("cart-count");
    if (badge && window.Cart) badge.textContent = window.Cart.count();
  }

  function toast(message, type = "success") {
    let element = document.getElementById("store-toast");
    if (!element) {
      element = document.createElement("div");
      element.id = "store-toast";
      element.className = "store-toast";
      element.setAttribute("role", "status");
      document.body.appendChild(element);
    }
    element.className = `store-toast ${type === "error" ? "is-error" : "is-success"} is-visible`;
    element.textContent = message;
    window.clearTimeout(element._timer);
    element._timer = window.setTimeout(() => element.classList.remove("is-visible"), 2600);
  }

  function addToCart(product, quantity = 1) {
    if (!window.Cart) {
      toast("Cart is not available right now.", "error");
      return;
    }
    window.Cart.add(product.id, Math.max(1, Number(quantity) || 1));
    updateCartCount();
    toast(`${product.title} added to cart.`);
  }

  function createProductCard(product, options = {}) {
    const meta = productMeta(product);
    const discount = discountPercent(meta);
    const card = document.createElement("article");
    card.className = "store-product-card";
    const detailUrl = `/laptop.html?id=${encodeURIComponent(product.id)}`;
    const wishlisted = isWishlisted(product.id);
    const stockText = meta.stock === null ? "Available" : meta.stock > 0 ? `${meta.stock} in stock` : "Out of stock";
    const badge = meta.badge || (discount ? `-${discount}%` : meta.featured ? "Featured" : "");

    card.innerHTML = `
      <div class="store-card-media">
        ${badge ? `<span class="store-sale-badge">${escapeHtml(badge)}</span>` : ""}
        <button class="store-wishlist ${wishlisted ? "is-active" : ""}" type="button" data-wishlist aria-label="Save ${escapeHtml(product.title)}">♡</button>
        <a href="${detailUrl}" aria-label="View ${escapeHtml(product.title)}">
          <img src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.title)}" loading="lazy" decoding="async" />
        </a>
      </div>
      <div class="store-card-content">
        <div class="store-card-eyebrow">
          <span>${escapeHtml(product.company?.name || "Nour Tech")}</span>
          <span class="store-stock ${meta.stock === 0 ? "is-out" : ""}">${escapeHtml(stockText)}</span>
        </div>
        <h3><a href="${detailUrl}">${escapeHtml(product.title)}</a></h3>
        <p class="store-card-summary">${escapeHtml(productSummary(product))}</p>
        <div class="store-card-price">
          <strong>${escapeHtml(formatCurrency(meta.price))}</strong>
          ${
            meta.compareAtPrice > meta.price && meta.price > 0
              ? `<del>${escapeHtml(formatCurrency(meta.compareAtPrice))}</del>`
              : ""
          }
        </div>
        <div class="store-card-actions">
          <a class="store-btn store-btn-light" href="${detailUrl}">View details</a>
          <button class="store-btn store-btn-primary" type="button" data-add-cart ${meta.stock === 0 ? "disabled" : ""}>
            ${meta.stock === 0 ? "Sold out" : "Add to cart"}
          </button>
        </div>
      </div>
    `;

    card.querySelector("[data-add-cart]")?.addEventListener("click", () => addToCart(product));
    card.querySelector("[data-wishlist]")?.addEventListener("click", (event) => {
      const active = toggleWishlist(product.id);
      event.currentTarget.classList.toggle("is-active", active);
      event.currentTarget.textContent = active ? "♥" : "♡";
      toast(active ? "Added to wishlist." : "Removed from wishlist.");
    });
    return card;
  }

  function setupHeaderSearch() {
    const forms = document.querySelectorAll("[data-store-search]");
    forms.forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const search = String(new FormData(form).get("search") || "").trim();
        const url = new URL("/category.html", window.location.origin);
        if (search) url.searchParams.set("search", search);
        window.location.href = `${url.pathname}${url.search}`;
      });
    });
  }

  function setupHeaderMenu() {
    const toggle = document.querySelector("[data-store-menu-toggle]");
    const panel = document.querySelector("[data-store-menu]");
    if (!toggle || !panel) return;
    const setOpen = (open) => {
      document.body.classList.toggle("store-menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("store-menu-open")));
    panel.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("click", (event) => {
      if (!panel.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
    });
  }

  function setYear() {
    document.querySelectorAll("[data-current-year], #year").forEach((element) => {
      element.textContent = new Date().getFullYear();
    });
  }

  async function hydrateContactLinks() {
    try {
      const contact = await fetchJSON(`${API_BASE]/contact`);
      const raw = String(contact.whatsapp || contact.salesHotline || "").replace(/\D/g, "");
      const number = raw.startsWith("0") ? `20${raw.slice(1)}` : raw;
      document.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
        if (number) link.href = `https://wa.me/${number}`;
      });
      document.querySelectorAll("[data-sales-hotline]").forEach((element) => {
        element.textContent = contact.salesHotline || contact.whatsapp || "01034898787";
      });
    } catch (_) {
      // Footer.js may hydrate the same information on existing pages.
    }
  }

  function boot() {
    updateCartCount();
    setupHeaderSearch();
    setupHeaderMenu();
    setYear();
    hydrateContactLinks();
  }

  window.Storefront = {
    API_BASE,
    CATEGORY_LABELS,
    escapeHtml,
    fetchJSON,
    manualSpecs,
    findMeta,
    productMeta,
    formatCurrency,
    categoryLabel,
    categoryIcon,
    productImage,
    productSummary,
    createProductCard,
    addToCart,
    toggleWishlist,
    isWishlisted,
    updateCartCount,
    toast,
    boot,
  };
})();
