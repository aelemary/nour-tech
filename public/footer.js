const FOOTER_API_BASE = "/api";
const GOOGLE_CUSTOMER_REVIEWS_BADGE_MERCHANT_ID = 5838618467;

async function fetchFooterJSON(url, options = {}) {
  const response = await fetch(url, { credentials: "include", ...options });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

function normalizePhoneForWhatsApp(value = "") {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits.startsWith("0") ? `20${digits.slice(1)}` : digits;
}

function setFooterYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

function ensureSocialContactPoints() {
  const brand = document.querySelector(".store-footer .footer-brand, footer .footer-brand");
  if (brand && !brand.querySelector(".footer-socials")) {
    brand.insertAdjacentHTML(
      "beforeend",
      `<div class="footer-socials" aria-label="Nour Tech social media">
        <a class="footer-social" href="https://www.facebook.com/share/1BJq8qdpZs/" aria-label="Follow Nour Tech on Facebook" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" class="footer-social-icon" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.3H9.7V14h2.7v8h1.1z"/></svg></a>
        <a class="footer-social" href="https://www.instagram.com/nour_tech.1/" aria-label="Follow Nour Tech on Instagram" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" class="footer-social-icon" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" class="footer-social-dot"/></svg></a>
      </div>`
    );
  }

  if (!document.querySelector(".whatsapp-float")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<a href="#" data-whatsapp-link class="whatsapp-float" aria-label="Chat with Nour Tech on WhatsApp" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.2C20 6.7 16.4 3 12 3S4 6.7 4 11.2c0 1.8.6 3.5 1.6 4.8L4.5 21l5-1.3c1.1.6 2.4.9 3.6.9 4.4 0 7.9-3.7 7.9-9.4zm-8 7.4c-1.1 0-2.2-.3-3.2-.9l-.4-.2-3 .8.8-3-.3-.4c-1-1.3-1.5-2.7-1.5-4.3 0-3.4 2.7-6.2 6.1-6.2s6.1 2.8 6.1 6.2-2.7 6.2-6.1 6.2zm3.4-4.6c-.2-.1-1.3-.6-1.5-.7s-.3-.1-.4.1-.5.7-.6.8-.2.2-.4.1c-.2-.1-.9-.3-1.7-1-.6-.5-1-1.2-1.1-1.4-.1-.2 0-.3.1-.4l.3-.3c.1-.1.1-.2.2-.3.1-.1 0-.2 0-.3 0-.1-.4-1-.6-1.4-.2-.4-.3-.3-.4-.3h-.3c-.1 0-.3 0-.4.2-.1.2-.6.6-.6 1.5s.6 1.7.7 1.8c.1.1 1.2 2 2.9 2.7 1.8.8 1.8.5 2.2.5.4-.1 1.3-.5 1.5-.9.2-.4.2-.8.1-.9-.1-.1-.2-.1-.4-.2z"/></svg><span>WhatsApp</span></a>`
    );
  }
}

function loadVercelAnalytics() {
  const localHosts = new Set(["localhost", "127.0.0.1"]);
  if (localHosts.has(window.location.hostname)) return;
  if (document.querySelector('script[data-vercel-analytics]')) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = "/_vercel/insights/script.js";
  script.dataset.vercelAnalytics = "true";
  document.head.appendChild(script);
}

function loadGoogleCustomerReviewsBadge() {
  const localHosts = new Set(["localhost", "127.0.0.1"]);
  if (localHosts.has(window.location.hostname)) return;
  if (document.getElementById("merchantWidgetScript")) return;

  const startBadge = () => {
    if (!window.merchantwidget?.start) return;
    window.merchantwidget.start({
      merchant_id: GOOGLE_CUSTOMER_REVIEWS_BADGE_MERCHANT_ID,
      position: "BOTTOM_RIGHT",
      region: "EG",
    });
  };

  const script = document.createElement("script");
  script.id = "merchantWidgetScript";
  script.src = "https://www.gstatic.com/shopping/merchant/merchantwidget.js";
  script.defer = true;
  script.addEventListener("load", startBadge, { once: true });
  document.head.appendChild(script);
}

function populateFooterContact(contact = {}) {
  document.querySelectorAll("[data-footer-contact]").forEach((node) => {
    const field = node.getAttribute("data-footer-contact");
    node.textContent = contact[field] || "—";
  });

  const emailNode = document.querySelector("[data-footer-contact-email]");
  if (emailNode) {
    const email = contact.supportEmail || "nourelemary28@gmail.com";
    emailNode.textContent = email;
    emailNode.href = `mailto:${email}`;
  }

  const whatsappRaw = contact.whatsapp || "";
  const whatsappDigits = normalizePhoneForWhatsApp(whatsappRaw);
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "#";

  document.querySelectorAll("[data-whatsapp-link], #footer-whatsapp-link").forEach((whatsappIconLink) => {
    whatsappIconLink.href = whatsappHref;
    if (!whatsappDigits) {
      whatsappIconLink.removeAttribute("target");
      whatsappIconLink.removeAttribute("rel");
    }
  });

  const whatsappTextLink = document.getElementById("footer-whatsapp-text-link");
  if (whatsappTextLink) {
    whatsappTextLink.href = whatsappHref;
    if (!whatsappDigits) {
      whatsappTextLink.removeAttribute("target");
      whatsappTextLink.removeAttribute("rel");
    }
  }
}

async function initFooter() {
  setFooterYear();
  ensureSocialContactPoints();
  loadVercelAnalytics();
  loadGoogleCustomerReviewsBadge();
  try {
    const contact = await fetchFooterJSON(`${FOOTER_API_BASE}/contact`);
    populateFooterContact(contact || {});
  } catch (error) {
    // Keep safe fallback placeholders when contact API is unavailable.
    populateFooterContact({});
  }
}

document.addEventListener("DOMContentLoaded", initFooter);
