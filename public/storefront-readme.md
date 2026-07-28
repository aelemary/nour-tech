# Nour Tech storefront redesign

This branch contains the Geeks-inspired storefront redesign for Nour Tech.

## Included

- New responsive Arabic homepage
- Store-style header, search, category navigation and footer
- Product cards with optional price, old price, sale label, stock and featured states
- Category filters and sorting
- Redesigned product detail, cart and checkout pages
- Database migration for storefront fields

## Before production merge

1. Run `migrations/20260728_restore_storefront_fields.sql` in the correct Supabase project.
2. Update the server product mapper and admin form to expose and manage the new fields.
3. Test inventory, cart, checkout, authentication and mobile navigation on the Vercel preview.
4. Merge this branch into `main` only after testing.
