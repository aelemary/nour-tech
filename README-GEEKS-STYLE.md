# Nour Tech storefront redesign

This package recreates the public shopping experience and feature pattern of a premium Egyptian tech store using original HTML, CSS and JavaScript. It does not copy proprietary source code, logos, images or backend code from another website.

## Product pricing and shop metadata

The current API does not expose dedicated price and stock columns. The redesign reads commercial data from the existing **Manual Specs** field in Admin.

Add these keys when publishing/editing a product:

```text
Price: 225000,
Old Price: 235000,
Stock: 3,
Featured: yes,
Badge: Limited Offer,
SKU: 83F500FBIN,
Subcategory: Gaming Laptops,
Condition: Brand New (Sealed),
Shipping Period: Within 24 hours after confirming the order,
Payment Methods: Cash on Delivery, InstaPay, Visa, Bank Transfer, E-Wallets
```

Only `Price` is needed to display a price. Products without a price show **Ask for price**.

## Deployment

1. Add the storefront files to the repository.
2. Add pricing metadata to products from `/admin.html`.
3. Deploy the branch through Vercel.

## Included UX

- Premium responsive header and category navigation
- Large hero area with featured product
- Category tiles
- Featured and latest product grids
- Sale prices and percentage discounts
- Wishlist stored in the browser
- Add to cart and Buy Now flows
- Shop filters, price range and sorting
- Product image gallery
- Warranty, shipping and payment blocks
- Related products
- Floating WhatsApp action
