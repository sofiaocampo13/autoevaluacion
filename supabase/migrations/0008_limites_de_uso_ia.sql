-- Límites de uso de la IA. La cuota gratuita de Gemini es de ~20 peticiones diarias por modelo y es COMPARTIDA por todos
-- los usuarios: sin un tope, una sola cuenta (o un bucle) podría agotarla para todos.
-- Cada operación que llama a la IA reserva "unidades" (evaluación 3, interpretar rúbrica 1, análisis del semestre 1) en una
-- ventana móvil de 24 horas, con un tope por usuario y otro global. La reserva es atómica (bloqueo de aviso).

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('evaluacion', 'rubrica', 'analisis')),
  units int not null check (units > 0),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);
create index if not exists ai_usage_time_idx on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;
-- El estudiante solo puede LEER su propio consumo; escribir (reservar) es cosa del servidor.
create policy ai_usage_select on public.ai_usage for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.ai_usage from anon, authenticated;

create or replace function public.reserve_ai_budget(p_user uuid, p_kind text, p_units int, p_user_limit int, p_global_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  used_user int;
  used_global int;
  oldest_user timestamptz;
  oldest_global timestamptz;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ai_budget'));

  select coalesce(sum(units), 0), min(created_at) into used_global, oldest_global
    from ai_usage where created_at > now() - interval '24 hours';
  select coalesce(sum(units), 0), min(created_at) into used_user, oldest_user
    from ai_usage where user_id = p_user and created_at > now() - interval '24 hours';

  if used_user + p_units > p_user_limit then
    return jsonb_build_object('ok', false, 'reason', 'user', 'used', used_user, 'limit', p_user_limit,
                              'retry_at', oldest_user + interval '24 hours');
  end if;
  if used_global + p_units > p_global_limit then
    return jsonb_build_object('ok', false, 'reason', 'global', 'used', used_global, 'limit', p_global_limit,
                              'retry_at', oldest_global + interval '24 hours');
  end if;

  insert into ai_usage (user_id, kind, units) values (p_user, p_kind, p_units) returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id, 'used', used_user + p_units, 'limit', p_user_limit);
end;
$$;

-- Solo el servidor (clave de servicio) puede reservar.
revoke all on function public.reserve_ai_budget(uuid, text, int, int, int) from public, anon, authenticated;
grant execute on function public.reserve_ai_budget(uuid, text, int, int, int) to service_role;
