-- Rellenar un laboratorio con IA desde su guía es una operación nueva que gasta 1 unidad del presupuesto diario de IA.
alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check check (kind in ('evaluacion', 'rubrica', 'analisis', 'laboratorio'));
