-- 0019_planes_activo.sql
-- Elena confirmo el catalogo real de planes el 2026-08-14
-- (brief-app-centro-entrenamiento.md punto 10): dos precios de bono
-- conviven porque el de 12 sesiones (120€) ya no se ofrece de alta a
-- clientas nuevas, pero las que ya lo tenian lo conservan hasta que Elena
-- las cambie ella misma -- regla operativa para el futuro: un cambio de
-- precio siempre crea una fila NUEVA en planes, nunca edita el precio de una
-- existente (si no, cambiaria retroactivamente lo que ya pagan las clientas
-- antiguas). `activo` es lo que permite retirar un plan de los selectores de
-- alta nueva sin romper las filas de clientes/bonos_cliente/pagos que ya lo
-- referencian.

alter table public.planes add column activo boolean not null default true;
