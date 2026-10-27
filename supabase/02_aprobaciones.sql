-- Cuentas con aprobación y datos compartidos.
-- Se pega completo en Supabase → SQL Editor → «Run» (después de esquema.sql). Se puede ejecutar más de una vez.
--
-- · Cualquiera puede crearse una cuenta, pero queda «pendiente» hasta que el administrador la apruebe.
-- · Todas las cuentas aprobadas trabajan sobre los MISMOS viajes y facturas.
-- · Rol «empleado»: registra, edita y ve; no puede borrar. Rol «admin»: todo, y aprueba cuentas.
-- · El administrador es la primera cuenta que se creó en el proyecto.

-- 1. Perfiles: una fila por cuenta, con su rol.
create table if not exists public.perfiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  correo  text,
  nombre  text,
  rol     text not null default 'pendiente' check (rol in ('pendiente', 'empleado', 'admin', 'rechazado')),
  creado  timestamptz not null default now()
);

-- Cada cuenta nueva entra como «pendiente».
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (user_id, correo, nombre)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();

-- Cuentas que ya existían: la más antigua es el administrador; las demás quedan pendientes.
insert into public.perfiles (user_id, correo, rol)
select u.id, u.email,
       case when u.id = (select id from auth.users order by created_at limit 1) then 'admin' else 'pendiente' end
from auth.users u
on conflict (user_id) do nothing;

-- Rol de quien está usando la app (lo usan las reglas de seguridad).
create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where user_id = (select auth.uid())
$$;

alter table public.perfiles enable row level security;
drop policy if exists "ver perfiles" on public.perfiles;
create policy "ver perfiles" on public.perfiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.mi_rol()) = 'admin');
drop policy if exists "admin cambia roles" on public.perfiles;
create policy "admin cambia roles" on public.perfiles for update to authenticated
  using ((select public.mi_rol()) = 'admin') with check ((select public.mi_rol()) = 'admin');
revoke all on public.perfiles from anon;
grant select, update (rol) on public.perfiles to authenticated;

-- 2. Viajes y facturas compartidos: la clave pasa a ser solo «id»; user_id queda como «quién lo creó».
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'viajes_pkey'
             and array_length(conkey, 1) = 2 and conrelid = 'public.viajes'::regclass) then
    alter table public.viajes drop constraint viajes_pkey;
    alter table public.viajes add primary key (id);
  end if;
  if exists (select 1 from pg_constraint where conname = 'facturas_pkey'
             and array_length(conkey, 1) = 2 and conrelid = 'public.facturas'::regclass) then
    alter table public.facturas drop constraint facturas_pkey;
    alter table public.facturas add primary key (id);
  end if;
end $$;

create index if not exists viajes_modificado_todos on public.viajes (modificado);
create index if not exists facturas_modificado_todos on public.facturas (modificado);

-- 3. Reglas: solo cuentas aprobadas; borrar (marcar «borrado») solo el administrador.
drop policy if exists "solo mis viajes" on public.viajes;
drop policy if exists "solo mis facturas" on public.facturas;

drop policy if exists "aprobados ven viajes" on public.viajes;
create policy "aprobados ven viajes" on public.viajes for select to authenticated
  using ((select public.mi_rol()) in ('admin', 'empleado'));
drop policy if exists "aprobados crean viajes" on public.viajes;
create policy "aprobados crean viajes" on public.viajes for insert to authenticated
  with check ((select public.mi_rol()) = 'admin' or ((select public.mi_rol()) = 'empleado' and not borrado));
drop policy if exists "aprobados cambian viajes" on public.viajes;
create policy "aprobados cambian viajes" on public.viajes for update to authenticated
  using ((select public.mi_rol()) in ('admin', 'empleado'))
  with check ((select public.mi_rol()) = 'admin' or ((select public.mi_rol()) = 'empleado' and not borrado));

drop policy if exists "aprobados ven facturas" on public.facturas;
create policy "aprobados ven facturas" on public.facturas for select to authenticated
  using ((select public.mi_rol()) in ('admin', 'empleado'));
drop policy if exists "aprobados crean facturas" on public.facturas;
create policy "aprobados crean facturas" on public.facturas for insert to authenticated
  with check ((select public.mi_rol()) = 'admin' or ((select public.mi_rol()) = 'empleado' and not borrado));
drop policy if exists "aprobados cambian facturas" on public.facturas;
create policy "aprobados cambian facturas" on public.facturas for update to authenticated
  using ((select public.mi_rol()) in ('admin', 'empleado'))
  with check ((select public.mi_rol()) = 'admin' or ((select public.mi_rol()) = 'empleado' and not borrado));

-- Nadie borra filas de verdad: un borrado es «borrado = true», para que llegue a todos los equipos.
revoke delete on public.viajes, public.facturas from authenticated;

-- Para revisar: debe aparecer tu correo con rol «admin».
select correo, rol, creado from public.perfiles order by creado;
