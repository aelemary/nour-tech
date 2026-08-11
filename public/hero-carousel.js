document.addEventListener("DOMContentLoaded", () => {
  const hero = document.querySelector(".store-hero");
  const slides = Array.from(document.querySelectorAll("[data-hero-slide]"));
  const dots = Array.from(document.querySelectorAll("[data-hero-dot]"));
  const previous = document.querySelector("[data-hero-prev]");
  const next = document.querySelector("[data-hero-next]");
  if (!hero || slides.length < 2) return;

  let activeIndex = 0;
  let timer = null;
  let gestureStart = null;

  const showSlide = (index) => {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === activeIndex;
      slide.hidden = !active;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((dot, dotIndex) => {
      const active = dotIndex === activeIndex;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-selected", String(active));
    });
  };

  const startTimer = () => {
    window.clearInterval(timer);
    timer = window.setInterval(() => showSlide(activeIndex + 1), 6500);
  };

  const chooseSlide = (index) => {
    showSlide(index);
    startTimer();
  };

  previous?.addEventListener("click", () => chooseSlide(activeIndex - 1));
  next?.addEventListener("click", () => chooseSlide(activeIndex + 1));
  dots.forEach((dot) => dot.addEventListener("click", () => chooseSlide(Number(dot.dataset.heroDot))));
  hero.addEventListener("mouseenter", () => window.clearInterval(timer));
  hero.addEventListener("mouseleave", startTimer);
  hero.addEventListener("focusin", () => window.clearInterval(timer));
  hero.addEventListener("focusout", (event) => {
    if (!hero.contains(event.relatedTarget)) startTimer();
  });

  hero.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("a, button, input, select, textarea")) return;
    gestureStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    hero.classList.add("is-dragging");
    window.clearInterval(timer);
    hero.setPointerCapture?.(event.pointerId);
  });

  hero.addEventListener("pointerup", (event) => {
    if (!gestureStart || gestureStart.id !== event.pointerId) return;
    const distanceX = event.clientX - gestureStart.x;
    const distanceY = event.clientY - gestureStart.y;
    const wasHorizontalSwipe = Math.abs(distanceX) >= 48 && Math.abs(distanceX) > Math.abs(distanceY);
    gestureStart = null;
    hero.classList.remove("is-dragging");
    if (wasHorizontalSwipe) {
      chooseSlide(distanceX < 0 ? activeIndex + 1 : activeIndex - 1);
    } else {
      startTimer();
    }
  });

  hero.addEventListener("pointercancel", () => {
    gestureStart = null;
    hero.classList.remove("is-dragging");
    startTimer();
  });

  startTimer();
});
