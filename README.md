# Nour Tech Marketplace Prototype

Local-first prototype for a laptop marketplace with brand/model management, searchable inventory,
cart + checkout flow, and a lightweight cash-on-delivery pipeline. Everything runs on plain
Node.js—no external dependencies required—so you can iterate quickly before wiring a proper
database or payments layer.

## Features

- Add new laptop brands and models from the **Admin Dashboard**.
- Upload imagery directly from the dashboard (files land in `public/uploads/`) and attach them to listings.
- Publish laptop listings with multiple images and detailed specs.
- Filter catalog by brand, GPU type, processor, RAM, storage, price range (EGP), or free-text search on the home page.
- Dedicated listing page per laptop with gallery, specs, and purchase actions (add to cart / buy now).
- Cart and checkout pages that collect delivery details and fire COD orders into the admin dashboard.
- Orders land in the dashboard with customer info, payment type, quantity, and optional notes.
- Contact page ready for your own support details; placeholders are editable in-browser.
- Streamlined English storefront with consistent copy across inventory, detail, cart, checkout, and admin flows.
- Built-in auth: log in as `admin` / `nourelkhawal123` for catalog management, or `sandra` / `user123` to review the sample customer account.
- Self-serve signup/login with secure sessions so shoppers can view their order history from the **My Orders** page.
- Admins can cancel or progress orders and remove brands, models, or listings directly from the dashboard.

## Project Structure

```
├── server.js          # HTTP server, REST API, static file serving
├── data/data.json     # Simple JSON data store (brands, models, laptops, orders)
└── public/            # Frontend pages, styles, and client-side logic
    ├── index.html       # Home / inventory and filters
    ├── laptop.html      # Laptop detail + purchase actions
    ├── cart.html        # Cart review
    ├── checkout.html    # Checkout + delivery form
    ├── admin.html       # Admin dashboard
    ├── contact.html     # Contact placeholders
    ├── styles.css       # Shared styling
    ├── cart-storage.js  # LocalStorage helpers for cart/buy-now flows
    ├── auth.js          # Global auth state + nav updates
    ├── main.js          # Inventory filters + stats
    ├── laptop.js        # Detail page renderer + cart interactions
    ├── cart.js          # Cart rendering + quantity controls
    ├── checkout.js      # Checkout submission logic
    ├── admin.js         # Admin interactions, uploads, stats, and catalog pruning
    ├── account.html/js  # Customer order history
    ├── login.html/js    # Login flow
    └── signup.html/js   # Signup flow
└── public/uploads/    # Uploaded listing images (auto-created)
```

## Getting Started

1. Ensure Node.js 18+ is installed.
2. From the repository root, run:
   ```bash
   node server.js
   ```
3. Visit `http://localhost:3000` in the browser.

> **Note:** The JSON data file is your current persistence layer. The server rewrites
> `data/data.json` on every create operation, so commit or back up the file regularly.

## Hosting

Pick whichever hosting model fits your stack:

- **Render / Railway / Fly.io** – Create a Node web service, point it at this repo, and set the start
  command to `node server.js`. Add a persistent volume or managed PostgreSQL when you migrate away from the JSON store.
- **Docker + VPS** – Wrap the app in a small image (`FROM node:20-alpine`, copy the repo, expose `3000`, run
  `node server.js`), deploy it to any VPS, and keep the container alive via systemd or docker-compose.
- **Bare-metal VPS** – Install Node 18+, clone the repo, run `node server.js` behind a process manager such as `pm2`
  or `systemd`, and reverse-proxy traffic through Nginx/Traefik. Mount `data/` somewhere persistent so orders survive restarts.

Set `PORT` via environment variable if your platform assigns one automatically (the server falls back to `3000`).

When you eventually swap the JSON file for a database or add image-object storage, keep the API surface and
front-end flows intact to avoid breaking existing pages.

## Next Steps & Ideas

- Swap the JSON store for a database (SQLite/Postgres) once deployments are ready, and persist uploads outside the repo.
- Layer in role management (e.g. staff vs. super-admin) and activity logs for catalog/order changes.
- Add payment integrations (Stripe, Paymob, etc.) and delivery scheduling once the COD flow is validated.
- Prefill checkout/address data from saved profiles and send email/SMS notifications as orders change state.
