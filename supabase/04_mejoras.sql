-- Mejoras de noviembre 2026.
-- Se pega completo en Supabase → SQL Editor → «Run» (después de 03_gastos_observador.sql). Se puede ejecutar más de una vez.

-- 1. Ajustes compartidos por toda la empresa (por ahora la tasa del IVA).
--    Todos los aprobados los leen; solo el administrador los cambia.
create table if not exists public.ajustes (
  clave      text        primary key,
  valor      jsonb,
  modificado timestamptz not null default now()
);

drop trigger if exists ajustes_modificado on public.ajustes;
create trigger ajustes_modificado before insert or update on public.ajustes
  for each row execute function public.marcar_modificado();

alter table public.ajustes enable row level security;
revoke all on public.ajustes from anon;
grant select, insert, update on public.ajustes to authenticated;

drop policy if exists "aprobados ven ajustes" on public.ajustes;
create policy "aprobados ven ajustes" on public.ajustes for select to authenticated
  using ((select public.mi_rol()) in ('admin', 'empleado', 'observador'));
drop policy if exists "admin crea ajustes" on public.ajustes;
create policy "admin crea ajustes" on public.ajustes for insert to authenticated
  with check ((select public.mi_rol()) = 'admin');
drop policy if exists "admin cambia ajustes" on public.ajustes;
create policy "admin cambia ajustes" on public.ajustes for update to authenticated
  using ((select public.mi_rol()) = 'admin') with check ((select public.mi_rol()) = 'admin');

-- 2. Si el proyecto todavía no tiene ninguna cuenta, la primera que se cree será el administrador.
--    Todas las demás quedan «pendientes» hasta que el administrador las apruebe en la app.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (user_id, correo, nombre, rol)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
          case when not exists (select 1 from public.perfiles) then 'admin' else 'pendiente' end)
  on conflict (user_id) do nothing;
  return new;
end $$;

-- 3. El administrador no puede quitarse a sí mismo el rol (evita quedarse sin nadie que apruebe cuentas).
drop policy if exists "admin cambia roles" on public.perfiles;
create policy "admin cambia roles" on public.perfiles for update to authenticated
  using ((select public.mi_rol()) = 'admin' and user_id <> (select auth.uid()))
  with check ((select public.mi_rol()) = 'admin');

-- Para revisar: debe aparecer tu correo con rol «admin».
select correo, rol, creado from public.perfiles order by creado;
