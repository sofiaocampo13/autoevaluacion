-- Análisis global del semestre: se guarda con qué números se hizo, qué modelo lo redactó y una firma de los datos
-- (si las evaluaciones no cambiaron, no se vuelve a gastar una petición de IA).
alter table public.semester_analyses
  add column if not exists stats jsonb,
  add column if not exists ai_model text,
  add column if not exists prompt_version text,
  add column if not exists input_signature text;

create index if not exists semester_analyses_subject_idx on public.semester_analyses (subject_id, created_at desc);
-- Las políticas ya existen desde 0001: el estudiante solo lee las suyas y escribe únicamente el servidor.
