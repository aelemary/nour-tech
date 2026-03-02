begin;

alter table public.products
  add column if not exists brand_id uuid,
  add column if not exists title text,
  add column if not exists short_name text default ''::text,
  add column if not exists price numeric,
  add column if not exists description text default ''::text,
  add column if not exists images text[] default '{}'::text[],
  add column if not exists warranty smallint default 0,
  add column if not exists specs_raw jsonb not null default '{}'::jsonb;

-- Backfill from category tables if they still exist.
do $$
begin
  if to_regclass('public.laptops') is not null then
    update public.products p
    set
      brand_id = l.brand_id,
      title = l.title,
      short_name = coalesce(l.short_name, ''),
      price = l.price,
      description = coalesce(l.description, ''),
      images = coalesce(l.images, '{}'::text[]),
      warranty = coalesce(l.warranty, 0),
      specs_raw = coalesce(p.specs_raw, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'gpu', nullif(l.gpu, ''),
        'cpu', nullif(l.cpu, ''),
        'ram', nullif(l.ram, ''),
        'storage', nullif(l.storage, ''),
        'display', nullif(l.display, '')
      ))
    from public.laptops l
    where l.product_id = p.id;
  end if;
end $$;

do $$
begin
  if to_regclass('public.gpus') is not null then
    update public.products p
    set
      brand_id = g.brand_id,
      title = g.title,
      short_name = coalesce(g.short_name, ''),
      price = g.price,
      description = coalesce(g.description, ''),
      images = coalesce(g.images, '{}'::text[]),
      warranty = coalesce(g.warranty, 0)
    from public.gpus g
    where g.product_id = p.id;
  end if;
end $$;

do $$
begin
  if to_regclass('public.cpus') is not null then
    update public.products p
    set
      brand_id = c.brand_id,
      title = c.title,
      short_name = coalesce(c.short_name, ''),
      price = c.price,
      description = coalesce(c.description, ''),
      images = coalesce(c.images, '{}'::text[]),
      warranty = coalesce(c.warranty, 0)
    from public.cpus c
    where c.product_id = p.id;
  end if;
end $$;

do $$
begin
  if to_regclass('public.hdds') is not null then
    update public.products p
    set
      brand_id = h.brand_id,
      title = h.title,
      short_name = coalesce(h.short_name, ''),
      price = h.price,
      description = coalesce(h.description, ''),
      images = coalesce(h.images, '{}'::text[]),
      warranty = coalesce(h.warranty, 0)
    from public.hdds h
    where h.product_id = p.id;
  end if;
end $$;

do $$
begin
  if to_regclass('public.motherboards') is not null then
    update public.products p
    set
      brand_id = m.brand_id,
      title = m.title,
      short_name = coalesce(m.short_name, ''),
      price = m.price,
      description = coalesce(m.description, ''),
      images = coalesce(m.images, '{}'::text[]),
      warranty = coalesce(m.warranty, 0)
    from public.motherboards m
    where m.product_id = p.id;
  end if;
end $$;

update public.products
set
  short_name = coalesce(short_name, ''),
  title = coalesce(nullif(title, ''), 'Untitled product'),
  price = coalesce(price, 0),
  description = coalesce(description, ''),
  images = coalesce(images, '{}'::text[]),
  warranty = coalesce(warranty, 0),
  specs_raw = coalesce(specs_raw, '{}'::jsonb);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_brand_id_fkey'
  ) then
    alter table public.products
      add constraint products_brand_id_fkey
      foreign key (brand_id) references public.brands(id);
  end if;
end $$;

create index if not exists idx_products_type on public.products(type);
create index if not exists idx_products_brand_id on public.products(brand_id);
create index if not exists idx_products_specs_raw_gin on public.products using gin (specs_raw);

drop table if exists public.laptops;
drop table if exists public.gpus;
drop table if exists public.cpus;
drop table if exists public.hdds;
drop table if exists public.motherboards;

commit;
