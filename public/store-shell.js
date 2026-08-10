(function () {
  const header = document.querySelector("header");
  if (!header || header.classList.contains("store-header")) return;

  document.body.classList.add("storefront-page");
  header.insertAdjacentHTML(
    "beforebegin",
    '<div class="store-announcement">Your trusted destination for laptops and graphics cards</div>'
  );
  header.className = "store-header";
  header.innerHTML = `
    <div class="store-header-main">
      <a class="logo" href="/" aria-label="Nour Tech home"><img src="/data/nourtechlogo.png" alt="Nour Tech" class="logo-mark" /></a>
      <form id="header-search" class="header-search" role="search">
        <input type="search" name="search" placeholder="What are you looking for?" aria-label="Search products" />
        <button type="submit">Search</button>
      </form>
      <div class="store-header-actions">
        <a href="/account.html" id="nav-account" class="header-action" data-requires-auth="true"><span class="header-action-icon" aria-hidden="true">&#9786;</span><span>My account</span></a>
        <a href="/cart.html" class="header-action cart-link"><span class="header-action-icon" aria-hidden="true">&#128722;</span><span>Cart <span id="cart-count" class="cart-count">0</span></span></a>
        <button class="nav-toggle" type="button" aria-label="Toggle menu" aria-expanded="false" aria-controls="site-nav">Menu</button>
      </div>
    </div>
    <nav id="site-nav" class="store-nav">
      <a href="/index.html">Home</a><a href="/category.html?type=laptop">Laptops</a><a href="/category.html?type=gpu">Graphics Cards</a><a href="/contact.html">Contact</a>
      <a href="/admin.html" data-requires-role="admin">Admin</a><span id="nav-user" class="nav-user" hidden></span><a href="/signup.html" id="nav-signup">Sign Up</a><a href="/login.html" id="nav-auth">Login</a>
    </nav>`;
})();
