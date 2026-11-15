-- Paso 3 del motor de evaluación: detalle y trazabilidad de cada criterio valorado.
-- Estas tablas siguen siendo de SOLO LECTURA para el estudiante: las escribe el servidor.

alter table public.criterion_results
  add column position int,
  add column criterion_id uuid references public.rubric_criteria (id) on delete set null,
  add column rubric_level text,
  add column citations jsonb not null default '[]',   -- [{location, quote, supports, status: verificada|no_verificable|invalida}]
  add column concepts jsonb not null default '[]',    -- [{name, status: demostrado|parcial|refuerzo}]
  add column flags jsonb not null default '[]',       -- avisos del verificador (citas rechazadas, nivel ajustado…)
  add column limitations text,
  add column ai_model text;                           -- modelo que respondió (puede ser el alterno)

-- Evita duplicar un criterio si se reintenta o se pulsa dos veces.
create unique index criterion_results_eval_position on public.criterion_results (evaluation_id, position);

alter table public.evaluations
  add column updated_at timestamptz not null default now();

create index on public.evaluations (user_id, lab_id, created_at desc);
