(function () {
  const announcementMarkup = `
    <div class="store-announcement">
      <span class="store-announcement-message">Your trusted destination for laptops and graphics cards</span>
      <nav class="announcement-socials" aria-label="Nour Tech social media">
        <a href="https://www.facebook.com/share/1BJq8qdpZs/" aria-label="Follow Nour Tech on Facebook" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.3H9.7V14h2.7v8h1.1z"/></svg>
        </a>
        <a href="https://www.instagram.com/nour_tech.1/" aria-label="Follow Nour Tech on Instagram" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" class="announcement-social-dot"/></svg>
        </a>
        <a href="#" data-whatsapp-link aria-label="Chat with Nour Tech on WhatsApp" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.2C20 6.7 16.4 3 12 3S4 6.7 4 11.2c0 1.8.6 3.5 1.6 4.8L4.5 21l5-1.3c1.1.6 2.4.9 3.6.9 4.4 0 7.9-3.7 7.9-9.4zm-8 7.4c-1.1 0-2.2-.3-3.2-.9l-.4-.2-3 .8.8-3-.3-.4c-1-1.3-1.5-2.7-1.5-4.3 0-3.4 2.7-6.2 6.1-6.2s6.1 2.8 6.1 6.2-2.7 6.2-6.1 6.2zm3.4-4.6c-.2-.1-1.3-.6-1.5-.7s-.3-.1-.4.1-.5.7-.6.8-.2.2-.4.1c-.2-.1-.9-.3-1.7-1-.6-.5-1-1.2-1.1-1.4-.1-.2 0-.3.1-.4l.3-.3c.1-.1.1-.2.2-.3.1-.1 0-.2 0-.3 0-.1-.4-1-.6-1.4-.2-.4-.3-.3-.4-.3h-.3c-.1 0-.3 0-.4.2-.1.2-.6.6-.6 1.5s.6 1.7.7 1.8c.1.1 1.2 2 2.9 2.7 1.8.8 1.8.5 2.2.5.4-.1 1.3-.5 1.5-.9.2-.4.2-.8.1-.9-.1-.1-.2-.1-.4-.2z"/></svg>
        </a>
      </nav>
    </div>`;
  const header = document.querySelector("header");
  document.body.classList.add("storefront-page");
  if (header && !header.classList.contains("store-header")) {
    header.insertAdjacentHTML(
      "beforebegin",
      announcementMarkup
    );
    header.className = "store-header";
    header.innerHTML = `
    <div class="store-header-main">
      <a class="logo" href="/" aria-label="Nour Tech home"><img src="/data/nour-tech-logo-transparent.webp" width="2170" height="725" alt="Nour Tech" class="logo-mark" /></a>
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
        <a href="/" class="footer-logo-link" aria-label="Nour Tech home"><img src="/data/nour-tech-logo-transparent.webp" width="2170" height="725" alt="Nour Tech" class="footer-logo" loading="lazy" decoding="async" /></a>
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
    </div>`;
})();
