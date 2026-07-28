begin;

alter table public.products
  add column if not exists price numeric(12, 2) not null default 0,
  add column if not exists old_price numeric(12, 2),
  add column if not exists stock integer not null default 0,
  add column if not exists is_featured boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists sale_label text not null default '',
  add column if not exists sort_order integer not null default 0,
  add column if not exists sku text;

alter table public.products
  drop constraint if exists products_price_non_negative;

alter table public.products
  add constraint products_price_non_negative
  check (price >= 0);

alter table public.products
  drop constraint if exists products_old_price_non_negative;

alter table public.products
  add constraint products_old_price_non_negative
  check (old_price is null or old_price >= 0);

alter table public.products
  drop constraint if exists products_old_price_valid;

alter table public.products
  add constraint products_old_price_valid
  check (
    old_price is null
    or old_price = 0
    or old_price >= price
  );

alter table public.products
  drop constraint if exists products_stock_non_negative;

alter table public.products
  add constraint products_stock_non_negative
  check (stock >= 0);

create index if not exists idx_products_active
  on public.products(is_active);

create index if not exists idx_products_featured
  on public.products(is_featured);

create index if not exists idx_products_sort_order
  on public.products(sort_order);

create unique index if not exists idx_products_sku_unique
  on public.products(sku)
  where sku is not null and trim(sku) <> '';

commit;
