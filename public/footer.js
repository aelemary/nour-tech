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
