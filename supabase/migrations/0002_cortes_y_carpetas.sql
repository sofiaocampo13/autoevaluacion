-- Fase 2b: corte académico por laboratorio y ruta relativa de cada archivo (subida de carpetas).

alter table public.labs
  add column cut smallint check (cut between 1 and 10);

-- Ruta dentro de la carpeta subida, p. ej. "evidence/E1_entorno.png". Vacía si se subió suelto.
alter table public.lab_files
  add column relative_path text not null default '' check (char_length(relative_path) <= 500);

create index on public.labs (user_id, cut);
