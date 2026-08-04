const state = { products: [] };

function groupByType(products) {
  return products.reduce((groups, product) => {
    const type = String(product.type || "other").toLowerCase();
    groups[type] ||= [];
    groups[type].push(product);
    return groups;
  }, {});
}

function renderCategoryTiles(products) {
  const container = document.getElementById("category-tiles");
  if (!container) return;
  const groups = groupByType(products);
  const preferred = ["laptop", "gpu", "monitor", "cpu", "motherboard", "ram", "storage", "accessory"];
  const types = [
    ...preferred.filter((type) => groups[type]?.length),
    ...Object.keys(groups).filter((type) => !preferred.includes(type)),
  ].slice(0, 8);
  container.innerHTML = "";
  types.forEach((type) => {
    const link = document.createElement("a");
    link.className = "store-category-tile";
    link.href = `/category.html?type=${encodeURIComponent(type)}`;
    const product = groups[type][0];
    link.innerHTML = `
      <span class="store-category-icon">${Storefront.categoryIcon(type)}</span>
      <div>
        <strong>${Storefront.escapeHtml(Storefront.categoryLabel(type))}</strong>
        <small>${groups[type].length} product${groups[type].length === 1 ? "" : "s"}</small>
      </div>
      <img src="${Storefront.escapeHtml(Storefront.productImage(product, 360, 260))}" alt="" loading="lazy" />
    `;
    container.appendChild(link);
  });
}

function renderGrid(containerId, products, limit = 8) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  products.slice(0, limit).forEach((product) => container.appendChild(Storefront.createProductCard(product)));
}

function selectFeatured(products) {
  const marked = products.filter((product) => Storefront.productMeta(product).featured);
  if (marked.length) return marked;
  return products
    .slice()
    .sort((a, b) => Storefront.productMeta(b).price - Storefront.productMeta(a).price)
    .slice(0, 8);
}

function renderHero(products) {
  const selected = selectFeatured(products)[0] || products[0];
  if (!selected) return;
  const image = document.getElementById("hero-product-image");
  const card = document.getElementById("hero-product-card");
  const title = document.getElementById("hero-product-title");
  const price = document.getElementById("hero-product-price");
  if (image) {
    image.src = Storefront.productImage(selected, 900, 680);
    image.alt = selected.title;
    image.addEventListener("click", () => {
      window.location.href = `/laptop.html?id=${encodeURIComponent(selected.id)}`;
    });
  }
  if (title) title.textContent = selected.title;
  if (price) price.textContent = Storefront.formatCurrency(Storefront.productMeta(selected).price);
  if (card) card.hidden = false;
}

async function init() {
  Storefront.boot();
  const featuredEmpty = document.getElementById("featured-empty");
  try {
    const products = await Storefront.fetchJSON(`${Storefront.API_BASE}/products`);
    state.products = Array.isArray(products) ? products : [];
    if (!state.products.length) {
      if (featuredEmpty) featuredEmpty.hidden = false;
      return;
    }
    renderHero(state.products);
    renderCategoryTiles(state.products);
    renderGrid("featured-products", selectFeatured(state.products), 8);
    renderGrid("latest-products", state.products.slice().reverse(), 8);
  } catch (error) {
    console.error(error);
    if (featuredEmpty) {
      featuredEmpty.hidden = false;
      featuredEmpty.textContent = "The catalog is loading slowly. Please refresh in a moment.";
    }
  }
}

document.addEventListener("DOMContentLoaded", init);
