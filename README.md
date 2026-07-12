# Nour Tech

Nour Tech is a lightweight Node.js storefront backed by Supabase. It supports a multi-category product catalog, product specifications from manual data and Icecat, cart-based ordering, customer accounts, and an admin dashboard.

## Local setup

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in your own credentials.
4. Run the migrations in `migrations/` against the Supabase project.
5. Start the server with `npm start` and open `http://localhost:3000`.

Do not commit `.env` files or service-role keys. If a service key is exposed, rotate it from the Supabase dashboard rather than only deleting it from the repository.

## Environment variables

- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_KEY`: Server-only service-role key. Never expose it to browser code.
- `SUPABASE_STORAGE_BUCKET`: Public bucket used for product images.
- `OLD_SUPABASE_URL`: Optional legacy Supabase project used only to read contact details.
- `OLD_SUPABASE_SERVICE_KEY`: Server-only key for the legacy contact source.
- `SESSION_SECRET`: Long random value used to sign login cookies. Set the same value on every deployment instance.
- `ICECAT_API_TOKEN`: Icecat API token.
- `ICECAT_CONTENT_TOKEN`: Icecat content token, when required by the account.
- `ICECAT_SHOPNAME`: Icecat shop or username value.
- `ICECAT_API_URL`: Optional Icecat endpoint override.
- `ICECAT_LANG`: Optional language code; defaults to `EN`.

## Data model

Products are stored in one `products` table and differentiated by `type`. Shared listing fields live directly on the product, while flexible manual, Icecat, and imported specifications live in `specs_raw` as JSONB. Brands, users, contact details, orders, and order items use their own tables.

The storefront intentionally does not store or display product prices. Orders contain products and quantities, and the team confirms availability and commercial details with the customer after submission.

## Development

- API endpoints live under `/api`.
- Static pages and browser scripts live under `public/`.
- Admin routes are enforced by the server, not only hidden in the interface.
- The legacy `data/data.json` file is not used by the runtime.
- There is currently no automated test suite; run JavaScript syntax checks and exercise the key browser flows before deployment.
