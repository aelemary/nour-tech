(() => {
  const money = new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  });

  function updateYear() {
    document.querySelectorAll('#year').forEach((node) => {
      node.textContent = new Date().getFullYear();
    });
  }

  function formatPrice(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? money.format(number) : '';
  }

  async function enhanceProductPage() {
    const detail = document.getElementById('detail-layout');
    if (!detail) return;

    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;

    let product = null;
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
        credentials: 'include',
      });
      if (response.ok) product = await response.json();
    } catch (error) {
      console.warn('Could not load product enhancements', error);
    }

    const apply = () => {
      if (!detail.children.length) return false;

      const purchase = detail.querySelector('.detail-purchase');
      const heading = detail.querySelector('.detail-heading');
      const specsTitle = detail.querySelector('.detail-specs h2');
      const buyButton = detail.querySelector('[data-buy-now]');
      const cartButton = detail.querySelector('[data-add-cart]');
      const cartLink = detail.querySelector('.detail-purchase a[href="/cart.html"]');
      const toggle = detail.querySelector('[data-spec-toggle]');

      if (specsTitle) specsTitle.textContent = 'المواصفات';
      if (buyButton) buyButton.textContent = 'اشتري الآن';
      if (cartButton) cartButton.textContent = 'أضف إلى السلة';
      if (cartLink) cartLink.textContent = 'عرض السلة';
      if (toggle) toggle.textContent = 'عرض كل المواصفات';

      if (purchase) {
        const title = purchase.querySelector('h2');
        if (title) title.textContent = 'خيارات الشراء';

        purchase.querySelectorAll('.field-hint').forEach((node, index) => {
          node.textContent = index === 0
            ? 'أضف المنتج للسلة وسيتواصل فريق نور تكنولوجي معك لتأكيد التوفر والتوصيل.'
            : 'للكميات أو التجميعات الخاصة، اكتب طلبك في ملاحظات الطلب.';
        });

        if (!purchase.querySelector('.detail-price-box')) {
          const current = formatPrice(product?.price);
          const old = formatPrice(product?.oldPrice ?? product?.old_price);
          const priceBox = document.createElement('div');
          priceBox.className = 'detail-price-box';
          priceBox.innerHTML = current
            ? `${old && Number(product?.oldPrice ?? product?.old_price) > Number(product?.price) ? `<del>${old}</del>` : ''}<strong>${current}</strong><span>السعر شامل الضريبة عند انطباقها</span>`
            : '<strong style="font-size:22px">تواصل لمعرفة السعر</strong><span>سنؤكد السعر والتوفر قبل إتمام الطلب</span>';
          const stack = purchase.querySelector('.btn-stack');
          purchase.insertBefore(priceBox, stack || purchase.firstChild);
        }

        if (!purchase.querySelector('.detail-trust')) {
          const trust = document.createElement('div');
          trust.className = 'detail-trust';
          trust.innerHTML = `
            <span>✓ منتجات أصلية بضمان موثق</span>
            <span>✓ شحن لجميع المحافظات</span>
            <span>✓ دعم فني قبل وبعد البيع</span>
          `;
          purchase.appendChild(trust);
        }

        if (product && Object.prototype.hasOwnProperty.call(product, 'stock')) {
          const stock = Number(product.stock);
          if (Number.isFinite(stock) && stock <= 0) {
            purchase.querySelectorAll('[data-buy-now], [data-add-cart]').forEach((button) => {
              button.disabled = true;
              button.title = 'غير متوفر حاليًا';
            });
          }
        }
      }

      if (heading && product?.saleLabel && !heading.querySelector('.product-flag.sale')) {
        const flag = document.createElement('span');
        flag.className = 'product-flag sale';
        flag.textContent = product.saleLabel;
        heading.prepend(flag);
      }

      return true;
    };

    if (apply()) return;
    const observer = new MutationObserver(() => {
      if (apply()) observer.disconnect();
    });
    observer.observe(detail, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateYear();
    enhanceProductPage();
  });
})();
