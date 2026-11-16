-- Límites de almacenamiento. Supabase gratis da 1 GB de Storage en total y hoy nada impedía que una cuenta lo llenara
-- (los archivos suben directo del navegador a Storage). Se limita por usuario (bytes y cantidad de archivos) y en total.
-- Los topes viven en una tabla para poder ajustarlos sin cambiar código.

create table if not exists public.app_limits (
  key text primary key,
  value bigint not null check (value > 0)
);
insert into public.app_limits (key, value) values
  ('user_bytes', 262144000),    -- 250 MB por usuario
  ('user_files', 2500),         -- archivos por usuario
  ('total_bytes', 943718400)    -- 900 MB en total (deja ~100 MB de margen sobre el 1 GB gratuito)
on conflict (key) do nothing;

alter table public.app_limits enable row level security;
-- Sin políticas: nadie la lee ni escribe directamente; solo las funciones de abajo (security definer) y la clave de servicio.
revoke all on public.app_limits from anon, authenticated;

create or replace function public.storage_limits()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_bytes', (select value from app_limits where key = 'user_bytes'),
    'user_files', (select value from app_limits where key = 'user_files'),
    'total_bytes', (select value from app_limits where key = 'total_bytes')
  );
$$;

-- Consumo del usuario con sesión: solo puede consultar el suyo (usa auth.uid(), no recibe parámetros).
create or replace function public.my_storage_usage()
returns jsonb
language sql
stable
security definer
set search_path = public, storage
as $$
  select jsonb_build_object(
    'bytes', coalesce(sum(coalesce((metadata ->> 'size')::bigint, 0)), 0),
    'files', count(*)
  )
  from storage.objects
  where bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text;
$$;

create or replace function public.total_storage_bytes()
returns bigint
language sql
stable
security definer
set search_path = public, storage
as $$
  select coalesce(sum(coalesce((metadata ->> 'size')::bigint, 0)), 0) from storage.objects where bucket_id = 'documents';
$$;

revoke all on function public.storage_limits(), public.my_storage_usage(), public.total_storage_bytes() from public, anon;
grant execute on function public.storage_limits(), public.my_storage_usage(), public.total_storage_bytes() to authenticated, service_role;

-- La subida se rechaza si el usuario ya alcanzó su tope o si el bucket completo llegó al suyo. El tope se comprueba ANTES de
-- subir, así que puede excederse por lo que pese un archivo (máx. 50 MB); el servidor lo vuelve a comprobar al registrar el archivo.
drop policy if exists documents_insert on storage.objects;
create policy documents_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (public.my_storage_usage() ->> 'bytes')::bigint < (public.storage_limits() ->> 'user_bytes')::bigint
    and (public.my_storage_usage() ->> 'files')::bigint < (public.storage_limits() ->> 'user_files')::bigint
    and public.total_storage_bytes() < (public.storage_limits() ->> 'total_bytes')::bigint
  );
