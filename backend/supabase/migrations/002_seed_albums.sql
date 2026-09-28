insert into public.albums (nama, deskripsi)
values
  ('Foto Keluarga', 'Foto bersama di rumah dan momen sehari-hari.'),
  ('Masa Muda & Pernikahan', 'Kisah janji suci dan masa muda orang tua.'),
  ('Hari Raya', 'Lebaran, sungkem, dan hari besar keluarga.'),
  ('Cucu & Liburan', 'Perjalanan, pantai, dan tawa cucu.')
on conflict (nama) do nothing;
