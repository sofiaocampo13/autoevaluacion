-- Revisión docente por enlace (sin cuentas de docente).
-- El enlace NUNCA se guarda: solo su hash SHA-256. El docente accede a través del servidor, que valida el enlace.

create type public.review_status as enum ('preliminar', 'aprobada', 'ajustada', 'devuelta');

alter table public.evaluations
  add column review_status public.review_status not null default 'preliminar',
  add column final_percent numeric check (final_percent between 0 and 100),
  add column final_grade numeric,
  add column reviewed_at timestamptz,
  add column reviewer_name text;

create table public.review_links (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  used_at timestamptz,
  last_viewed_at timestamptz
);

create table public.teacher_reviews (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  link_id uuid references public.review_links (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,  -- dueño de la evaluación
  reviewer_name text not null check (char_length(reviewer_name) between 2 and 120),
  reviewer_email text check (reviewer_email is null or char_length(reviewer_email) <= 200),
  decision public.review_status not null check (decision <> 'preliminar'),
  -- [{ position, criterion, original_percent, adjusted_percent, justification }]
  adjustments jsonb not null default '[]',
  final_percent numeric check (final_percent between 0 and 100),
  final_grade numeric,
  comment text not null default '' check (char_length(comment) <= 4000),
  created_at timestamptz not null default now()
);

create index on public.review_links (evaluation_id);
create index on public.teacher_reviews (evaluation_id, created_at desc);

alter table public.review_links enable row level security;
alter table public.teacher_reviews enable row level security;

-- El estudiante ve sus enlaces y las revisiones de sus evaluaciones. Todo lo demás lo escribe el servidor.
create policy review_links_select on public.review_links for select to authenticated
  using (user_id = (select auth.uid()));
create policy teacher_reviews_select on public.teacher_reviews for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.review_links, public.teacher_reviews from anon;
-- El hash del enlace no debe poder leerse ni siquiera con la sesión del propio estudiante.
-- (Revocar una sola columna no sirve si la tabla ya tiene permiso completo: se quita el de la tabla y se
-- conceden solo las columnas permitidas. Por eso las consultas a review_links deben nombrar sus columnas.)
revoke select on public.review_links from authenticated;
grant select (id, evaluation_id, user_id, created_at, expires_at, revoked_at, used_at, last_viewed_at)
  on public.review_links to authenticated;
