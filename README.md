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
3. Create a `.env` file and add your Supabase credentials (plus the storage bucket you'll use for uploads):
   ```
   SUPABASE_URL=https://nlooktzgammeqjejrjgk.supabase.co
   SUPABASE_SERVICE_KEY=sb_secret_TjrizrL010VCq0X3KoSSPg_DqLGAxyj
   SUPABASE_STORAGE_BUCKET=laptop-images
   ```
   Use your own project URL/service key/bucket name in real deployments.
4. In Supabase Storage, create the `laptop-images` bucket (or whatever name you set above) and mark it as public so uploaded listings resolve anywhere.
5. From the project root, run:
   ```bash
   node server.js
   ```
6. Visit `http://localhost:3000`. Override with `PORT=8080 node server.js` if needed.
7. All data now lives inside your Supabase project (brands, laptops, users, orders, order items, contact info). No local JSON persistence required.

For deployments (Render, Railway, Fly, bare VPS, Docker), point the start command to `node server.js` and persist `data/` plus `public/uploads/`.

## Supabase Schema

Run these SQL snippets (or use the Supabase Table Editor) to mirror the expected backend shape:

```sql
create extension if not exists "pgcrypto";

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text default '',
  created_at timestamptz default timezone('utc', now())
);

create table laptops (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  title text not null,
  price numeric(12,2) not null,
  gpu text,
  cpu text,
  ram text,
  storage text,
  display text,
  description text,
  images text[] not null default '{}',
  stock integer not null default 0,
  created_at timestamptz default timezone('utc', now())
);

create table users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  is_registered boolean not null default false,
  admin boolean not null default false,
  hashed_password text,
  full_name text,
  email text,
  phone text,
  created_at timestamptz default timezone('utc', now()),
  constraint registered_requires_password check (is_registered = false or hashed_password is not null)
);

create type order_status as enum ('pending','confirmed','completed','cancelled');

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status order_status not null default 'pending',
  customer_name text not null,
  delivery_address text not null,
  email text,
  phone text not null,
  notes text,
  created_at timestamptz default timezone('utc', now())
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  laptop_id uuid not null references laptops(id) on delete restrict,
  quantity integer not null default 1,
  created_at timestamptz default timezone('utc', now()),
  constraint quantity_positive check (quantity > 0)
);

create table contact (
  id int primary key default 1,
  sales_hotline text,
  whatsapp text,
  support_email text,
  address text,
  availability text[]
);

insert into contact (id) values (1) on conflict (id) do nothing;

create index idx_laptops_brand on laptops (brand_id);
create index idx_orders_user on orders (user_id);
create index idx_orders_status on orders (status);
create index idx_order_items_order on order_items (order_id);
create index idx_order_items_laptop on order_items (laptop_id);
```

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
