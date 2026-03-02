const FOOTER_API_BASE = "/api";

async function fetchFooterJSON(url, options = {}) {
  const response = await fetch(url, { credentials: "include", ...options });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

function normalizePhoneForWhatsApp(value = "") {
  return String(value || "").replace(/[^\d]/g, "");
}

function setFooterYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

function populateFooterContact(contact = {}) {
  document.querySelectorAll("[data-footer-contact]").forEach((node) => {
    const field = node.getAttribute("data-footer-contact");
    node.textContent = contact[field] || "—";
  });

  const emailNode = document.querySelector("[data-footer-contact-email]");
  if (emailNode) {
    const email = contact.supportEmail || "support@nourtech.example";
    emailNode.textContent = email;
    emailNode.href = `mailto:${email}`;
  }

  const whatsappRaw = contact.whatsapp || "";
  const whatsappDigits = normalizePhoneForWhatsApp(whatsappRaw);
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "#";

  const whatsappIconLink = document.getElementById("footer-whatsapp-link");
  if (whatsappIconLink) {
    whatsappIconLink.href = whatsappHref;
    if (!whatsappDigits) {
      whatsappIconLink.removeAttribute("target");
      whatsappIconLink.removeAttribute("rel");
    }
  }

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
  try {
    const contact = await fetchFooterJSON(`${FOOTER_API_BASE}/contact`);
    populateFooterContact(contact || {});
  } catch (error) {
    // Keep safe fallback placeholders when contact API is unavailable.
    populateFooterContact({});
  }
}

document.addEventListener("DOMContentLoaded", initFooter);
