// Control de diésel: cuántos viajes (vueltas) cubre cada carga.
import { dieselDelViaje, type Viaje } from './calc';
import type { GastoGeneral } from './db';

export const CATEGORIAS_GENERALES = ['Diésel', 'Sueldos', 'Impuestos', 'Mantenimiento', 'Otro'];
export const DIESEL = 'Diésel';

// Desde noviembre de 2026 las vueltas de cada carga se anotan siempre a mano y el diésel ya no
// se anota dentro de los viajes. Las cargas anteriores sin vueltas usan los rangos de monto de antes.
export const DESDE_VUELTAS_MANUALES = '2026-11-01';

// Rangos antiguos: 2000–4000 → 1 · 4500–7000 → 2 · más de 7900 → 3 · otros montos: 0.
export function vueltasPorMonto(monto: number): number {
  if (monto > 7900) return 3;
  if (monto >= 4500 && monto <= 7000) return 2;
  if (monto >= 2000 && monto <= 4000) return 1;
  return 0;
}

// Vueltas que cubre una carga: las anotadas a mano; si no se anotaron, los rangos (solo antes de noviembre).
export function viajesQueCubre(monto: number, vueltas?: number, fecha?: string): number {
  if (vueltas !== undefined && vueltas !== null) return vueltas;
  if (fecha && fecha >= DESDE_VUELTAS_MANUALES) return 0;
  return vueltasPorMonto(monto);
}

export const vueltasDe = (g: Pick<GastoGeneral, 'monto' | 'vueltas' | 'fecha'>) => viajesQueCubre(g.monto, g.vueltas, g.fecha);
// Carga de noviembre en adelante a la que le falta anotar las vueltas (cuenta 0 hasta que se corrija).
export const faltanVueltas = (g: GastoGeneral) => esDiesel(g.categoria) && (g.vueltas === undefined || g.vueltas === null) && g.fecha >= DESDE_VUELTAS_MANUALES;
// Carga antigua cuyas vueltas salen de los rangos de monto.
export const vueltasPorRango = (g: GastoGeneral) => esDiesel(g.categoria) && (g.vueltas === undefined || g.vueltas === null) && g.fecha < DESDE_VUELTAS_MANUALES;

const mesDe = (fecha: string) => fecha.slice(0, 7);

// Vueltas de diésel que sobraron de los meses anteriores (pasan al siguiente mes).
export function sobranteAnterior(viajes: Viaje[], cargas: GastoGeneral[]): number {
  const meses = [...new Set([...viajes.map((v) => mesDe(v.fecha)), ...cargas.map((c) => mesDe(c.fecha))])].sort();
  let sobra = 0;
  for (const m of meses) {
    const vueltas = cargas.filter((c) => mesDe(c.fecha) === m).reduce((s, c) => s + viajesQueCubre(c.monto, c.vueltas, c.fecha), 0);
    sobra = Math.max(0, sobra + vueltas - viajes.filter((v) => mesDe(v.fecha) === m).length);
  }
  return sobra;
}

// Las cargas (más lo que sobró antes) cubren los viajes del bus en orden de fecha; lo que no alcanza queda sin marcar.
export function controlDiesel(viajes: Viaje[], cargas: GastoGeneral[], arrastre = 0) {
  const ordenadas = [...cargas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cubiertos = arrastre + ordenadas.reduce((s, c) => s + viajesQueCubre(c.monto, c.vueltas, c.fecha), 0);
  const filas = [...viajes]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado - b.creado)
    .map((viaje, i) => ({ viaje, cubierto: i < cubiertos }));
  return { cargas: ordenadas, cubiertos, filas, pasaAlSiguiente: Math.max(0, cubiertos - filas.length) };
}

export type NivelDiesel = 'sin' | 'echar' | 'ok';
export interface EstadoDiesel { bus: string; quedan: number; nivel: NivelDiesel; sinCubrir: number; faltanVueltas: number }

// Cómo está el tanque de cada bus HOY: todas las cargas y viajes hasta hoy.
// Las cargas se anotan cuando se echa el diésel (aunque sea después de llegar de un viaje),
// así que lo que queda es: vueltas cargadas − viajes ya hechos. Si queda 1 o menos, hay que echar diésel
// antes del próximo viaje (avisa aunque hoy todavía no se haya registrado ningún viaje).
export function estadoDiesel(bus: string, viajes: Viaje[], cargas: GastoGeneral[], hoy: string): EstadoDiesel {
  const vs = viajes.filter((v) => v.bus === bus && v.fecha <= hoy);
  const cs = cargas.filter((c) => c.bus === bus && esDiesel(c.categoria) && c.fecha <= hoy);
  const mes = mesDe(hoy);
  const arrastre = sobranteAnterior(vs.filter((v) => mesDe(v.fecha) < mes), cs.filter((c) => mesDe(c.fecha) < mes));
  const d = controlDiesel(vs.filter((v) => mesDe(v.fecha) === mes), cs.filter((c) => mesDe(c.fecha) === mes), arrastre);
  const quedan = d.pasaAlSiguiente;
  return {
    bus, quedan, nivel: quedan <= 0 ? 'sin' : quedan === 1 ? 'echar' : 'ok',
    sinCubrir: d.filas.filter((f) => !f.cubierto).length,
    faltanVueltas: cs.filter(faltanVueltas).length,
  };
}

export const esDiesel = (concepto: string) => /di[eé]sel/i.test(concepto);

// Saca del viaje las cargas de diésel (de «Gastos» u «Otros gastos») y las convierte en gastos
// del monto total de ese bus y día. null = el viaje no tenía diésel. Solo se usa con viajes antiguos.
export function separarDiesel(v: Viaje): { viaje: Viaje; cargas: GastoGeneral[] } | null {
  const todos = [...v.gastos, ...v.otrosGastos].filter((g) => esDiesel(g.concepto) && g.monto);
  if (!todos.length) return null;
  const ahora = Date.now();
  return {
    viaje: { ...v, gastos: v.gastos.filter((g) => !esDiesel(g.concepto)), otrosGastos: v.otrosGastos.filter((g) => !esDiesel(g.concepto)), actualizado: ahora },
    cargas: todos.map((g, i) => ({
      // id fijo por viaje: si dos equipos lo pasan a la vez no se duplica.
      id: `${v.id}-diesel-${i}`, fecha: v.fecha, bus: v.bus, categoria: DIESEL, monto: g.monto,
      observaciones: [`Del viaje ${v.destino || ''}`.trim(), v.observaciones].filter(Boolean).join(' · '),
      creado: ahora, actualizado: ahora,
    })),
  };
}

// Todas las cargas de diésel que cuentan, cada una UNA sola vez:
// las de «gastos del monto total» y, de los viajes antiguos que traían el diésel anotado dentro,
// solo las que no tienen ya una carga igual (mismo bus, mismo día y mismo monto) en gastos del mes.
export function cargasEfectivas(viajes: Viaje[], cargas: GastoGeneral[]): GastoGeneral[] {
  const libres = cargas.filter((c) => esDiesel(c.categoria)).map((c) => ({ c, usada: false }));
  const extra: GastoGeneral[] = [];
  for (const v of viajes) {
    dieselDelViaje(v).forEach((g, i) => {
      const igual = libres.find((x) => !x.usada && x.c.bus === v.bus && x.c.fecha === v.fecha && Math.abs(x.c.monto - g.monto) < 0.005);
      if (igual) { igual.usada = true; return; } // ya está en gastos del mes: no se cuenta otra vez
      extra.push({
        id: `${v.id}-dv-${i}`, fecha: v.fecha, bus: v.bus, categoria: DIESEL, monto: g.monto,
        observaciones: `Anotado dentro del viaje${v.destino ? ` a ${v.destino}` : ''}`, creado: v.creado, actualizado: v.actualizado,
      });
    });
  }
  return [...cargas, ...extra];
}
