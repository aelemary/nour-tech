# Nour Tech Marketplace Prototype

Local-first laptop marketplace with a lightweight Node.js backend, JSON persistence, and static HTML/CSS/JS frontend. Everything lives in this repo so you can iterate quickly before wiring a database or payment gateway.

## Stack & Layout

```
├── server.js          # HTTP server, REST API proxy, uploads, Supabase integration
├── data/              # Legacy JSON datastore (unused once Supabase is configured)
└── public/            # Frontend pages, styling, and client-side logic
    ├── *.html / *.js    # Inventory, product detail, cart, checkout, auth, admin
    ├── styles.css       # Shared styling + components
    └── uploads/         # Image uploads (auto-created when the server starts)
```

- Admin login: `admin / nourelkhawal123`
- Sample customer: `sandra / user123`

## Server Setup

1. **Install Node.js 18+** – no other dependencies are required.
2. **Clone or download** the repository onto the machine that will run the server.
3. Create a `.env` file and add your Supabase credentials:
   ```
   SUPABASE_URL=https://nlooktzgammeqjejrjgk.supabase.co
   SUPABASE_SERVICE_KEY=sb_secret_TjrizrL010VCq0X3KoSSPg_DqLGAxyj
   ```
   Use your own project URL/Service key in real deployments.
4. From the project root, run:
   ```bash
   node server.js
   ```
5. Visit `http://localhost:3000`. Override with `PORT=8080 node server.js` if needed.
6. All data now lives inside your Supabase project (brands, laptops, users, orders, order items, contact info). No local JSON persistence required.

For deployments (Render, Railway, Fly, bare VPS, Docker), point the start command to `node server.js` and persist `data/` plus `public/uploads/`.

## Key Features

- Inventory-wide search to zero in on matching laptops instantly.
- Individual laptop detail pages with square galleries, specs, and quick purchase actions.
- Cart + checkout flow with cash-on-delivery orders that land in the admin dashboard.
- Admin dashboard for managing brands, listings, uploads, and orders.
- Image uploads directly from the admin panel with previews before publishing.
- Contact page content is editable directly by admins and persists to the datastore.
- Built-in authentication/session handling for admins and customers; basic signup/login UI.
- JSON datastore keeps everything simple—perfect for demos or early validation.

## Development Notes

- The server and frontend are plain JavaScript; restart `node server.js` after backend changes.
- API endpoints live under `/api` (e.g., `/api/laptops`, `/api/orders`). Requests require cookies for admin-only routes.
- Seed or migrate data directly inside Supabase (SQL editor or table editor). The legacy `data/data.json` file is no longer read at runtime.
- When production-ready, move image uploads to a persistent bucket (Supabase Storage / S3) so `/public/uploads` is optional.

Have fun iterating, and evolve the datastore or UI as your workflows mature.
