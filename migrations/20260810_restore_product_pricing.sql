begin;

-- Restore catalog prices and retain the price accepted at the time of order.
alter table public.products
  add column if not exists price numeric;

alter table public.order_items
  add column if not exists unit_price numeric;

commit;
