function setYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

function showStatus(message, type = "info") {
  const container = document.getElementById("signup-status");
  if (!container) return;
  container.innerHTML = message
    ? `<div class="toast${type === "error" ? " error" : ""}">${message}</div>`
    : "";
}

async function submitSignup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    showStatus("Creating your account…");
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = text;
      try {
        const data = JSON.parse(text);
        if (data && data.error) message = data.error;
      } catch (error) {
        // ignore parsing errors
      }
      showStatus(message || "Signup failed.", "error");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/account.html";
    window.location.href = next;
  } catch (error) {
    showStatus("Network error while creating your account. Please try again.", "error");
  }
}

function handleUserUpdate(event) {
  if (event.detail) {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/account.html";
    window.location.replace(next);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setYear();
  const form = document.getElementById("signup-form");
  if (form) {
    form.addEventListener("submit", submitSignup);
  }
  if (window.appUser) {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/account.html";
    window.location.replace(next);
  }
});

document.addEventListener("app:user", handleUserUpdate);
