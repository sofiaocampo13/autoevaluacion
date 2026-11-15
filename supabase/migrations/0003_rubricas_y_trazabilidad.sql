-- Fase 3a: rúbricas parametrizadas (editables hasta confirmarlas), objetivos del laboratorio,
-- fuente de código por repositorio y columnas de trazabilidad de cada evaluación.

create type public.rubric_status as enum ('borrador', 'confirmada');

alter table public.labs
  add column objectives text not null default '' check (char_length(objectives) <= 4000),
  add column repo_url text check (repo_url is null or repo_url ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$');

-- ───────────── Rúbricas ─────────────
create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  lab_id uuid not null references public.labs (id) on delete cascade,
  source_material_id uuid references public.reference_materials (id) on delete set null,
  version int not null default 1,
  status public.rubric_status not null default 'borrador',
  title text not null default '',
  scale_max numeric not null default 5 check (scale_max in (5, 100)),
  issues jsonb not null default '[]',   -- inconsistencias detectadas (se recalculan al editar)
  parsed_by text,                       -- modelo que propuso la estructura (trazabilidad)
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lab_id, version)
);

create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  position int not null default 0,
  competency text not null default '' check (char_length(competency) <= 200),
  criterion text not null check (char_length(criterion) between 1 and 300),
  description text not null default '' check (char_length(description) <= 2000),
  weight numeric not null check (weight >= 0 and weight <= 100),  -- porcentaje
  -- [{ "name": "Excelente", "min_percent": 90, "descriptor": "..." }, ...]
  levels jsonb not null default '[]'
);

create index on public.rubrics (user_id, lab_id);
create index on public.rubric_criteria (rubric_id, position);

-- Al confirmar: debe haber criterios y los pesos deben sumar 100 %. Lo exige la BD, no solo la interfaz.
create function public.rubric_enforce_confirm() returns trigger
language plpgsql set search_path = '' as $$
declare total numeric; n int;
begin
  if new.status = 'confirmada' and old.status = 'borrador' then
    select coalesce(sum(weight), 0), count(*) into total, n from public.rubric_criteria where rubric_id = new.id;
    if n = 0 then raise exception 'La rúbrica no tiene criterios'; end if;
    if abs(total - 100) > 0.01 then raise exception 'Los pesos suman % y deben sumar 100', total; end if;
    new.confirmed_at := now();
  end if;
  if old.status = 'confirmada' and new.status <> 'confirmada' then
    raise exception 'Una rúbrica confirmada no se puede reabrir; crea una nueva versión';
  end if;
  return new;
end $$;

create trigger rubric_confirm_guard
  before update on public.rubrics
  for each row execute function public.rubric_enforce_confirm();

alter table public.rubrics enable row level security;
alter table public.rubric_criteria enable row level security;

create policy rubrics_select on public.rubrics for select to authenticated
  using (user_id = (select auth.uid()));
create policy rubrics_insert on public.rubrics for insert to authenticated
  with check (
    user_id = (select auth.uid()) and status = 'borrador'
    and exists (select 1 from public.labs l where l.id = lab_id and l.user_id = (select auth.uid()))
  );
-- Solo se edita mientras es borrador; confirmarla es un UPDATE de borrador → confirmada.
create policy rubrics_update on public.rubrics for update to authenticated
  using (user_id = (select auth.uid()) and status = 'borrador')
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.labs l where l.id = lab_id and l.user_id = (select auth.uid()))
  );
create policy rubrics_delete on public.rubrics for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'borrador');

create policy criteria_select on public.rubric_criteria for select to authenticated
  using (user_id = (select auth.uid()));
create policy criteria_write on public.rubric_criteria for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.rubrics r where r.id = rubric_id and r.status = 'borrador' and r.user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.rubrics r where r.id = rubric_id and r.status = 'borrador' and r.user_id = (select auth.uid()))
  );

revoke all on public.rubrics, public.rubric_criteria from anon;

-- ───────────── Trazabilidad de cada evaluación ─────────────
alter table public.evaluations
  add column rubric_id uuid references public.rubrics (id) on delete set null,
  add column rubric_version int,
  add column rubric_snapshot jsonb,        -- copia exacta de la rúbrica usada
  add column ai_provider text,
  add column ai_model text,
  add column prompt_version text,
  add column test_results jsonb,           -- verificaciones técnicas del código (sintaxis, estático, pruebas)
  add column evidence_inventory jsonb;     -- archivos analizados y cómo se leyó cada uno
