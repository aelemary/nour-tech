insert into contact (id, sales_hotline, whatsapp, support_email, address)
values (1, '01034898787', '01034898787', 'nourelemary28@gmail.com', 'القاهرة')
on conflict (id) do update
set
  sales_hotline = excluded.sales_hotline,
  whatsapp = excluded.whatsapp,
  support_email = excluded.support_email,
  address = excluded.address;
