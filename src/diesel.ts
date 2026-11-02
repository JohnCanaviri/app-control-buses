// Control de diésel: cuántos viajes cubre cada carga, según su monto.
import type { Viaje } from './calc';
import type { GastoGeneral } from './db';

export const CATEGORIAS_GENERALES = ['Diésel', 'Sueldos', 'Impuestos', 'Mantenimiento', 'Otro'];
export const DIESEL = 'Diésel';

// 2000–4000 → 1 viaje · 4500–7000 → 2 · más de 7900 → 3 · otros montos no cubren viajes.
export function viajesQueCubre(monto: number): number {
  if (monto > 7900) return 3;
  if (monto >= 4500 && monto <= 7000) return 2;
  if (monto >= 2000 && monto <= 4000) return 1;
  return 0;
}

// Las cargas cubren los viajes del bus en orden de fecha; lo que no alcanza queda sin marcar.
export function controlDiesel(viajes: Viaje[], cargas: GastoGeneral[]) {
  const ordenadas = [...cargas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cubiertos = ordenadas.reduce((s, c) => s + viajesQueCubre(c.monto), 0);
  const filas = [...viajes]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado - b.creado)
    .map((viaje, i) => ({ viaje, cubierto: i < cubiertos }));
  return { cargas: ordenadas, cubiertos, filas };
}
