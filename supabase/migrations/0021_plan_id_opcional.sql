-- Elena quiere poder tener en la app clientas "en el aire" (estudiantes o
-- profesoras con horario muy variable, gente de temporada) sin ningun plan
-- asignado ni cobro activo, en vez de no poder darlas de alta hasta que
-- vuelvan a entrenar con regularidad. Antes plan_id era obligatorio.
alter table public.clientes alter column plan_id drop not null;
