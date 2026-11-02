-- Gastos generales (tomados del monto total) y rol «observador» (solo lectura).
-- Se pega completo en Supabase → SQL Editor → «Run» (después de 02_aprobaciones.sql). Se puede ejecutar más de una vez.

-- 1. El rol «observador» ve todo pero no puede crear ni cambiar nada.
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('pendiente', 'empleado', 'admin', 'observador', 'rechazado'));

drop policy if exists "aprobados ven viajes" on public.viajes;
create policy "aprobados ven viajes" on public.viajes for select to authenticated
  using ((select public.mi_rol()) in ('admin', 'empleado', 'observador'));
drop policy if exists "aprobados ven facturas" on public.facturas;
create policy "aprobados ven facturas" on public.facturas for select to authenticated
  using ((select public.mi_rol()) in ('admin', 'empleado', 'observador'));

-- 2. Tabla de gastos generales, con las mismas reglas que viajes y facturas.
create table if not exists public.gastos (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id          text        primary key,
  datos       jsonb,
  borrado     boolean     not null default false,
  actualizado bigint      not null default 0,
  modificado  timestamptz not null default now()
);
create index if not exists gastos_modificado_todos on public.gastos (modificado);

drop trigger if exists gastos_modificado on public.gastos;
create trigger gastos_modificado before insert or update on public.gastos
  for each row execute function public.marcar_modificado();

alter table public.gastos enable row level security;
revoke all on public.gastos from anon;
grant select, insert, update on public.gastos to authenticated;

drop policy if exists "aprobados ven gastos" on public.gastos;
create policy "aprobados ven gastos" on public.gastos for select to authenticated
  using ((select public.mi_rol()) in ('admin', 'empleado', 'observador'));
drop policy if exists "aprobados crean gastos" on public.gastos;
create policy "aprobados crean gastos" on public.gastos for insert to authenticated
  with check ((select public.mi_rol()) = 'admin' or ((select public.mi_rol()) = 'empleado' and not borrado));
drop policy if exists "aprobados cambian gastos" on public.gastos;
create policy "aprobados cambian gastos" on public.gastos for update to authenticated
  using ((select public.mi_rol()) in ('admin', 'empleado'))
  with check ((select public.mi_rol()) = 'admin' or ((select public.mi_rol()) = 'empleado' and not borrado));
