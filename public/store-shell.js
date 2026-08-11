(function () {
  const header = document.querySelector("header");
  document.body.classList.add("storefront-page");
  if (header && !header.classList.contains("store-header")) {
    header.insertAdjacentHTML(
      "beforebegin",
      '<div class="store-announcement">Your trusted destination for laptops and graphics cards</div>'
    );
    header.className = "store-header";
    header.innerHTML = `
    <div class="store-header-main">
      <a class="logo" href="/" aria-label="Nour Tech home"><img src="/data/nour-tech-logo-transparent.png" alt="Nour Tech" class="logo-mark" /></a>
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
  }

  const footer = document.querySelector("footer.site-footer");
  if (!footer) return;

  footer.className = "site-footer store-footer";
  footer.innerHTML = `
    <div class="footer-main">
      <div class="footer-brand">
        <a href="/" class="footer-logo-link" aria-label="Nour Tech home"><img src="/data/nour-tech-logo-transparent.png" alt="Nour Tech" class="footer-logo" /></a>
        <p>Performance laptops and graphics cards, backed by clear advice and dependable local support.</p>
      </div>
      <div class="footer-links">
        <strong>Shop</strong>
        <a href="/category.html?type=laptop">Laptops</a>
        <a href="/category.html?type=gpu">Graphics Cards</a>
        <a href="/cart.html">Cart</a>
        <a href="/checkout.html">Checkout</a>
      </div>
      <div class="footer-links">
        <strong>Support</strong>
        <a href="/contact.html">Contact us</a>
        <a href="/account.html">My orders</a>
        <a href="/login.html">Login</a>
        <a href="/signup.html">Create account</a>
      </div>
      <div class="footer-contact">
        <p><strong>Sales Hotline</strong><span data-footer-contact="salesHotline">—</span></p>
        <p><strong>WhatsApp</strong><a href="#" id="footer-whatsapp-text-link" target="_blank" rel="noopener noreferrer"><span data-footer-contact="whatsapp">—</span></a></p>
        <p><strong>Email</strong><a href="mailto:nourelemary28@gmail.com" data-footer-contact-email>nourelemary28@gmail.com</a></p>
        <p><strong>Address</strong><span data-footer-contact="address">—</span></p>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">Nour Tech &copy; <span id="year"></span>. All rights reserved.</p>
      <div class="footer-socials">
        <a href="https://www.facebook.com/share/1BJq8qdpZs/" class="footer-social" aria-label="Facebook" target="_blank" rel="noopener noreferrer"><img src="/data/facebook.png" alt="" class="footer-social-icon footer-social-image" /></a>
        <a href="#" class="footer-social" id="footer-whatsapp-link" aria-label="WhatsApp" target="_blank" rel="noopener noreferrer">W</a>
      </div>
    </div>`;
})();
