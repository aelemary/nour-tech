(function () {
  const STORAGE_KEY = "nourtech-cart";
  const BUY_NOW_KEY = "nourtech-buy-now";

  function safeParse(value, fallback) {
    if (!value) return fallback;
    try {
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch (error) {
      console.error("Failed to parse cart storage", error);
      return fallback;
    }
  }

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error("Unable to access localStorage", error);
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error("Unable to persist cart data", error);
    }
  }

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Unable to clear cart data", error);
    }
  }

  function readCart() {
    return safeParse(safeGet(STORAGE_KEY), []);
  }

  function writeCart(items) {
    safeSet(STORAGE_KEY, JSON.stringify(items));
  }

  function add(laptopId, quantity = 1) {
    const cart = readCart();
    const item = cart.find((entry) => entry.id === laptopId);
    if (item) {
      item.quantity = Math.min((item.quantity || 0) + quantity, 99);
    } else {
      cart.push({ id: laptopId, quantity });
    }
    writeCart(cart);
    return cart;
  }

  function updateQuantity(laptopId, quantity) {
    const cart = readCart();
    const item = cart.find((entry) => entry.id === laptopId);
    if (!item) return cart;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      const filtered = cart.filter((entry) => entry.id !== laptopId);
      writeCart(filtered);
      return filtered;
    }
    item.quantity = Math.min(Math.round(quantity), 99);
    writeCart(cart);
    return cart;
  }

  function remove(laptopId) {
    const filtered = readCart().filter((item) => item.id !== laptopId);
    writeCart(filtered);
    return filtered;
  }

  function clear() {
    safeRemove(STORAGE_KEY);
  }

  function count() {
    return readCart().reduce((total, item) => total + (item.quantity || 0), 0);
  }

  function setBuyNow(laptopId, quantity = 1) {
    safeSet(BUY_NOW_KEY, JSON.stringify({ id: laptopId, quantity }));
  }

  function getBuyNow() {
    return safeParse(safeGet(BUY_NOW_KEY), null);
  }

  function clearBuyNow() {
    safeRemove(BUY_NOW_KEY);
  }

  window.Cart = {
    read: readCart,
    write: writeCart,
    add,
    remove,
    updateQuantity,
    clear,
    count,
    setBuyNow,
    getBuyNow,
    clearBuyNow,
  };
})();
