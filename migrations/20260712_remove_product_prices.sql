begin;

alter table public.products
  drop column if exists price;

commit;
