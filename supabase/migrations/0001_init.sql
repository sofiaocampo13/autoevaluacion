-- Fase 1: esquema base, RLS y almacenamiento privado.
-- Regla general: el estudiante solo ve y edita lo suyo. Las tablas de resultados
-- (evaluations, criterion_results, ...) son de SOLO LECTURA para el estudiante;
-- las escribe el servidor con la service_role key.

create extension if not exists pgcrypto;

-- ───────────── Tipos ─────────────
create type public.material_category as enum
  ('guia', 'rubrica', 'mapa_mental', 'material_estudio', 'complementario');
create type public.eval_status as enum
  ('pendiente', 'procesando', 'completada', 'fallida');
create type public.evidence_level as enum
  ('suficiente', 'parcial', 'inexistente');

-- ───────────── Perfiles ─────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  ai_consent_at timestamptz,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── Asignaturas ─────────────
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 200),
  academic_period text not null default '',
  grade_scale_max numeric not null default 5 check (grade_scale_max in (5, 100)),
  created_at timestamptz not null default now()
);

-- ───────────── Materiales de referencia ─────────────
-- user_id NULL = material precargado (solo lectura para todos los autenticados).
create table public.reference_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade default auth.uid(),
  subject_id uuid references public.subjects (id) on delete cascade,
  lab_id uuid,
  category public.material_category not null,
  title text not null check (char_length(title) between 1 and 200),
  version text not null default '1',
  storage_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes <= 52428800),
  created_at timestamptz not null default now()
);

-- ───────────── Laboratorios ─────────────
create table public.labs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  number int,
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '',
  instructions_material_id uuid references public.reference_materials (id) on delete set null,
  rubric_material_id uuid references public.reference_materials (id) on delete set null,
  mindmap_topics text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reference_materials
  add constraint reference_materials_lab_fk
  foreign key (lab_id) references public.labs (id) on delete set null;

create table public.lab_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  lab_id uuid not null references public.labs (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes <= 52428800),
  created_at timestamptz not null default now()
);

-- ───────────── Resultados (escribe solo el servidor) ─────────────
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lab_id uuid not null references public.labs (id) on delete cascade,
  status public.eval_status not null default 'pendiente',
  has_rubric boolean not null default false,
  grade_scale_max numeric not null,
  overall_percent numeric check (overall_percent between 0 and 100),
  estimated_grade numeric,
  summary jsonb,          -- valoración general
  feedback jsonb,         -- retroalimentación
  infographic jsonb,      -- datos de la infografía
  limitations text,
  materials_used jsonb,   -- qué guía/rúbrica/versión se usó
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.criterion_results (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  criterion text not null,
  weight numeric not null check (weight >= 0),
  evidence_level public.evidence_level not null,
  percent numeric not null check (percent between 0 and 100),
  evidence text,
  evidence_location text,   -- archivo / página / sección
  argumentation text,
  recommendation text,
  confidence text
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table public.semester_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  labs_count int not null,
  analysis jsonb not null,
  infographic jsonb,
  created_at timestamptz not null default now()
);

create index on public.subjects (user_id);
create index on public.labs (user_id, subject_id);
create index on public.lab_files (lab_id);
create index on public.reference_materials (user_id, subject_id);
create index on public.evaluations (lab_id, created_at desc);
create index on public.criterion_results (evaluation_id);

-- ───────────── RLS ─────────────
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.reference_materials enable row level security;
alter table public.labs enable row level security;
alter table public.lab_files enable row level security;
alter table public.evaluations enable row level security;
alter table public.criterion_results enable row level security;
alter table public.reports enable row level security;
alter table public.semester_analyses enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy subjects_all on public.subjects for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Precargados (user_id null) visibles para todos; solo los propios son editables.
create policy materials_select on public.reference_materials for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy materials_insert on public.reference_materials for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (subject_id is null or exists (
      select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid())))
    and (lab_id is null or exists (
      select 1 from public.labs l where l.id = lab_id and l.user_id = (select auth.uid())))
  );
create policy materials_update on public.reference_materials for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy materials_delete on public.reference_materials for delete to authenticated
  using (user_id = (select auth.uid()));

create policy labs_all on public.labs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid()))
  );

create policy lab_files_all on public.lab_files for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.labs l where l.id = lab_id and l.user_id = (select auth.uid()))
    and storage_path like (select auth.uid())::text || '/%'
  );

-- Solo lectura para el estudiante (sin políticas de escritura).
create policy evaluations_select on public.evaluations for select to authenticated
  using (user_id = (select auth.uid()));
create policy criterion_results_select on public.criterion_results for select to authenticated
  using (user_id = (select auth.uid()));
create policy reports_select on public.reports for select to authenticated
  using (user_id = (select auth.uid()));
create policy semester_analyses_select on public.semester_analyses for select to authenticated
  using (user_id = (select auth.uid()));

-- Nada para el rol anónimo.
revoke all on all tables in schema public from anon;

-- ───────────── Storage privado ─────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- Ruta obligatoria: <user_id>/<...>. Cada usuario solo toca su carpeta.
create policy documents_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
