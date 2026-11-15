-- Un criterio puede quedar "sin peso" mientras la rúbrica es borrador (la IA no lo encontró en el documento).
-- Al confirmar, la BD exige que todos tengan peso y sumen 100.

alter table public.rubric_criteria alter column weight drop not null;

create or replace function public.rubric_enforce_confirm() returns trigger
language plpgsql set search_path = '' as $$
declare total numeric; n int; missing int;
begin
  if new.status = 'confirmada' and old.status = 'borrador' then
    select coalesce(sum(weight), 0), count(*), count(*) filter (where weight is null)
      into total, n, missing
      from public.rubric_criteria where rubric_id = new.id;
    if n = 0 then raise exception 'La rúbrica no tiene criterios'; end if;
    if missing > 0 then raise exception '% criterio(s) no tienen peso', missing; end if;
    if abs(total - 100) > 0.01 then raise exception 'Los pesos suman % y deben sumar 100', total; end if;
    new.confirmed_at := now();
  end if;
  if old.status = 'confirmada' and new.status <> 'confirmada' then
    raise exception 'Una rúbrica confirmada no se puede reabrir; crea una nueva versión';
  end if;
  return new;
end $$;
