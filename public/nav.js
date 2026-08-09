document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.textContent = open ? "Close" : "Menu";
  };

  toggle.addEventListener("click", () => {
    const open = !document.body.classList.contains("nav-open");
    setOpen(open);
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      setOpen(false);
    }
  });

  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target) && !toggle.contains(event.target)) {
      setOpen(false);
    }
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 760px)").matches) {
      setOpen(false);
    }
  });

  const searchForm = document.getElementById("header-search");
  if (searchForm && searchForm.dataset.searchBound !== "true") {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const search = String(new FormData(searchForm).get("search") || "").trim();
      const url = new URL("/category.html", window.location.origin);
      if (search) url.searchParams.set("search", search);
      window.location.href = url.toString();
    });
  }
});
