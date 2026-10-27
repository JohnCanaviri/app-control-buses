-- Tablas de la app «Control de Buses» en Supabase.
-- Se pega completo en Supabase → SQL Editor → «Run». Se puede ejecutar más de una vez sin problema.
-- Cada fila guarda un viaje o una factura tal como lo usa la app (columna «datos»).
-- La seguridad por filas hace que cada usuario solo pueda ver y cambiar SUS datos.

create table if not exists public.viajes (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id          text        not null,
  datos       jsonb,
  borrado     boolean     not null default false,
  actualizado bigint      not null default 0,
  modificado  timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.facturas (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id          text        not null,
  datos       jsonb,
  borrado     boolean     not null default false,
  actualizado bigint      not null default 0,
  modificado  timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists viajes_modificado on public.viajes (user_id, modificado);
create index if not exists facturas_modificado on public.facturas (user_id, modificado);

-- «modificado» lo pone siempre el servidor: así cada equipo sabe qué le falta bajar.
create or replace function public.marcar_modificado() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.modificado := now();
  return new;
end $$;

drop trigger if exists viajes_modificado on public.viajes;
create trigger viajes_modificado before insert or update on public.viajes
  for each row execute function public.marcar_modificado();
drop trigger if exists facturas_modificado on public.facturas;
create trigger facturas_modificado before insert or update on public.facturas
  for each row execute function public.marcar_modificado();

alter table public.viajes enable row level security;
alter table public.facturas enable row level security;

drop policy if exists "solo mis viajes" on public.viajes;
create policy "solo mis viajes" on public.viajes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "solo mis facturas" on public.facturas;
create policy "solo mis facturas" on public.facturas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.viajes, public.facturas from anon;
grant select, insert, update, delete on public.viajes, public.facturas to authenticated;
