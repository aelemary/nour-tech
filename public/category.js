const shopState = { products: [], companies: [] };

function textIndex(product) {
  return [
    product.title,
    product.shortName,
    product.description,
    product.company?.name,
    product.type,
    product.cpu,
    product.gpu,
    product.ram,
    product.storage,
    product.display,
    JSON.stringify(product.specsRaw || {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function readFilters() {
  const form = document.getElementById("shop-filters");
  const values = Object.fromEntries(new FormData(form).entries());
  return {
    search: String(values.search || "").trim().toLowerCase(),
    category: String(values.category || "").trim().toLowerCase(),
    companyId: String(values.companyId || "").trim(),
    minPrice: Number(values.minPrice || 0),
    maxPrice: Number(values.maxPrice || 0),
    cpu: String(values.cpu || "").trim().toLowerCase(),
    gpu: String(values.gpu || "").trim().toLowerCase(),
    ram: String(values.ram || "").trim().toLowerCase(),
    storage: String(values.storage || "").trim().toLowerCase(),
    inStock: values.inStock === "1",
  };
}

function includes(product, field, value) {
  if (!value) return true;
  return String(field || "").toLowerCase().includes(value) || textIndex(product).includes(value);
}

function filterProducts(products, filters) {
  return products.filter((product) => {
    const meta = Storefront.productMeta(product);
    if (filters.search && !textIndex(product).includes(filters.search)) return false;
    if (filters.category && String(product.type || "").toLowerCase() !== filters.category) return false;
    if (filters.companyId && String(product.companyId || "") !== filters.companyId) return false;
    if (filters.minPrice && meta.price < filters.minPrice) return false;
    if (filters.maxPrice && meta.price > filters.maxPrice) return false;
    if (filters.inStock && meta.stock === 0) return false;
    if (!includes(product, product.cpu, filters.cpu)) return false;
    if (!includes(product, product.gpu, filters.gpu)) return false;
    if (!includes(product, product.ram, filters.ram)) return false;
    if (!includes(product, product.storage, filters.storage)) return false;
    return true;
  });
}

function sortProducts(products) {
  const sort = document.getElementById("sort-products")?.value || "featured";
  const items = products.slice();
  if (sort === "price-asc") items.sort((a, b) => Storefront.productMeta(a).price - Storefront.productMeta(b).price);
  if (sort === "price-desc") items.sort((a, b) => Storefront.productMeta(b).price - Storefront.productMeta(a).price);
  if (sort === "name") items.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "newest") items.reverse();
  if (sort === "featured") {
    items.sort((a, b) => Number(Storefront.productMeta(b).featured) - Number(Storefront.productMeta(a).featured));
  }
  return items;
}

function render() {
  const filters = readFilters();
  const filtered = sortProducts(filterProducts(shopState.products, filters));
  const grid = document.getElementById("category-results");
  const empty = document.getElementById("category-empty");
  const count = document.getElementById("result-count");
  if (count) count.textContent = filtered.length;
  grid.innerHTML = "";
  filtered.forEach((product) => grid.appendChild(Storefront.createProductCard(product)));
  if (empty) empty.hidden = filtered.length > 0;
  updateHeading(filters);
}

function updateHeading(filters) {
  const title = document.getElementById("shop-title");
  const subtitle = document.getElementById("shop-subtitle");
  const label = filters.category ? Storefront.categoryLabel(filters.category) : "Shop all products";
  if (title) title.textContent = filters.search ? `Results for “${filters.search}”` : label;
  if (subtitle) subtitle.textContent = filters.category ? `Browse our ${label.toLowerCase()} collection.` : "Explore laptops, components, monitors and accessories.";
  document.title = `${label} | Nour Tech`;
}

function populateFilters() {
  const category = document.getElementById("filter-category");
  const company = document.getElementById("filter-company");
  const types = [...new Set(shopState.products.map((item) => String(item.type || "").toLowerCase()).filter(Boolean))];
  types.sort((a, b) => Storefront.categoryLabel(a).localeCompare(Storefront.categoryLabel(b)));
  types.forEach((type) => category.add(new Option(Storefront.categoryLabel(type), type)));
  shopState.companies
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((brand) => company.add(new Option(brand.name, brand.id)));
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const mapping = { search: "filter-search", type: "filter-category", companyId: "filter-company" };
  Object.entries(mapping).forEach(([param, id]) => {
    const value = params.get(param);
    const element = document.getElementById(id);
    if (value && element) element.value = value;
  });
  const sort = params.get("sort");
  if (sort && document.getElementById("sort-products")) document.getElementById("sort-products").value = sort;
}

function setupMobileFilters() {
  const panel = document.getElementById("filter-panel");
  const open = document.getElementById("filter-toggle");
  const close = document.getElementById("filter-close");
  const setOpen = (value) => document.body.classList.toggle("store-filters-open", value);
  open?.addEventListener("click", () => setOpen(true));
  close?.addEventListener("click", () => setOpen(false));
  panel?.addEventListener("click", (event) => {
    if (event.target.closest("button[type='submit']")) setOpen(false);
  });
}

async function initShop() {
  Storefront.boot();
  setupMobileFilters();
  try {
    const [products, companies] = await Promise.all([
      Storefront.fetchJSON(`${Storefront.API_BASE}/products`),
      Storefront.fetchJSON(`${Storefront.API_BASE}/companies`).catch(() => []),
    ]);
    shopState.products = Array.isArray(products) ? products : [];
    shopState.companies = Array.isArray(companies) ? companies : [];
    populateFilters();
    applyUrlParams();
    render();
  } catch (error) {
    console.error(error);
    const empty = document.getElementById("category-empty");
    empty.hidden = false;
    empty.textContent = "The catalog could not be loaded. Please refresh in a moment.";
  }

  document.getElementById("shop-filters")?.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  document.getElementById("filter-reset")?.addEventListener("click", () => {
    document.getElementById("shop-filters").reset();
    render();
  });
  document.getElementById("sort-products")?.addEventListener("change", render);
}

document.addEventListener("DOMContentLoaded", initShop);
