// Cuentas para rendir. La IDA y la LLEGADA son montos APARTE: nunca se suman.
// Todos los gastos se descuentan SOLO de la llegada.
//
//   Ida neto        = boletos de ida − descuento (o lo que trajeron, si fue sin boletos)   → monto aparte
//   Llegada neto    = lo que trajeron de la llegada − gastos del viaje (peaje, viático…) − otros gastos del viaje
//   Llegada final   = llegada neto − diésel − otros gastos grandes (sueldos, impuestos, mantenimiento…)  («queda»)
import { calcular, r2, type Viaje } from './calc';
import type { GastoGeneral } from './db';
import { cargasEfectivas, esDiesel, vueltasDe } from './diesel';
import { diasDelMes } from './resumen';

export interface Cuentas {
  viajes: number;
  boletosIda: number;
  descuentoIda: number;
  idaNeto: number;
  idaPendientes: number;
  trajeron: number;
  gastosViaje: number; // gastos + otros gastos anotados en los viajes
  vueltaNeta: number;
  diesel: number;
  otrosGrandes: number;
  queda: number;
}

const vacias = (): Cuentas => ({
  viajes: 0, boletosIda: 0, descuentoIda: 0, idaNeto: 0, idaPendientes: 0, trajeron: 0,
  gastosViaje: 0, vueltaNeta: 0, diesel: 0, otrosGrandes: 0, queda: 0,
});

export function cuentas(viajes: Viaje[], grandesSinViajes: GastoGeneral[]): Cuentas {
  const t = vacias();
  const grandes = cargasEfectivas(viajes, grandesSinViajes); // el diésel anotado en viajes antiguos, una sola vez
  for (const v of viajes) {
    const c = calcular(v);
    t.viajes++;
    t.boletosIda += c.boletosIda;
    t.descuentoIda += c.descuentoIda;
    t.idaNeto += c.idaNeto;
    if (c.idaPendiente) t.idaPendientes++;
    t.trajeron += c.montoRegistrado;
    t.gastosViaje += c.totalGastos + c.totalOtrosGastos;
    t.vueltaNeta += c.netoFinal;
  }
  for (const g of grandes) {
    if (esDiesel(g.categoria)) t.diesel += g.monto;
    else t.otrosGrandes += g.monto;
  }
  t.queda = t.vueltaNeta - t.diesel - t.otrosGrandes; // la ida no entra: es un monto aparte
  for (const k of Object.keys(t) as (keyof Cuentas)[]) t[k] = r2(t[k]);
  return t;
}

export interface DiaInforme { fecha: string; c: Cuentas; viajes: Viaje[]; grandes: GastoGeneral[]; notas: string[] }

const dos = (n: number) => String(n).padStart(2, '0');

// «bus» = TDS/PIN/PKS, o «Todos» (incluye los gastos grandes sin bus, los «generales»).
const delBus = <T extends { bus: string }>(lista: T[], bus: string) => (bus === 'Todos' ? lista : lista.filter((x) => x.bus === bus));

export function notasDelDia(viajes: Viaje[], grandes: GastoGeneral[], conBus: boolean): string[] {
  const pre = (b: string) => (conBus && b ? `${b}: ` : '');
  return [
    ...viajes.filter((v) => v.observaciones).map((v) => `${pre(v.bus)}${v.observaciones}`),
    ...viajes.filter((v) => v.sinBoletoIda).map((v) => `${pre(v.bus)}ida sin boletos${calcular(v).idaPendiente ? ' (falta anotar cuánto trajeron)' : ''}`),
    ...grandes.map((g) => {
      const v = esDiesel(g.categoria) ? vueltasDe(g) : -1;
      return `${pre(g.bus || 'General')}${g.categoria}${v >= 0 ? ` para ${v} vuelta${v === 1 ? '' : 's'}` : ''}${g.observaciones ? ` — ${g.observaciones}` : ''}`;
    }),
  ];
}

// Una fila por cada día del mes, aunque no haya viajes.
export function informeMensual(viajes: Viaje[], grandes: GastoGeneral[], bus: string, anio: number, mes: number) {
  const vs = delBus(viajes, bus);
  const gs = delBus(grandes, bus);
  const dias: DiaInforme[] = Array.from({ length: diasDelMes(anio, mes) }, (_, i) => {
    const fecha = `${anio}-${dos(mes)}-${dos(i + 1)}`;
    const v = vs.filter((x) => x.fecha === fecha).sort((a, b) => a.creado - b.creado);
    const g = gs.filter((x) => x.fecha === fecha);
    return { fecha, c: cuentas(v, g), viajes: v, grandes: g, notas: notasDelDia(v, g, bus === 'Todos') };
  });
  const pref = `${anio}-${dos(mes)}`;
  return { dias, total: cuentas(vs.filter((x) => x.fecha.startsWith(pref)), gs.filter((x) => x.fecha.startsWith(pref))) };
}

// Cuentas de cada bus (y de los gastos sin bus) para el mismo conjunto de datos.
export function porBus(viajes: Viaje[], grandes: GastoGeneral[], buses: string[]) {
  const filas = buses.map((b) => ({ bus: b, c: cuentas(viajes.filter((v) => v.bus === b), grandes.filter((g) => g.bus === b)) }));
  const generales = grandes.filter((g) => !buses.includes(g.bus));
  return { filas, generales: cuentas([], generales), total: cuentas(viajes, grandes) };
}

// Una frase que cualquiera entiende, para el principio del informe.
export function frase(c: Cuentas, quien: string, periodo: string, bs: (n: number) => string): string {
  if (!c.viajes && !c.diesel && !c.otrosGrandes) return `${periodo}: ${quien} no tiene viajes ni gastos registrados.`;
  const partes = [
    `${periodo}, ${quien} hizo ${c.viajes} viaje${c.viajes === 1 ? '' : 's'}.`,
    `Ida neto: Bs ${bs(c.idaNeto)}${c.descuentoIda ? ` (después de Bs ${bs(c.descuentoIda)} de descuento)` : ''}.`,
    `De la vuelta trajeron Bs ${bs(c.trajeron)} y se gastó Bs ${bs(c.gastosViaje)} en el camino, quedando Bs ${bs(c.vueltaNeta)}.`,
  ];
  if (c.diesel || c.otrosGrandes) {
    partes.push(`De la llegada se descontaron además Bs ${bs(c.diesel)} de diésel${c.otrosGrandes ? ` y Bs ${bs(c.otrosGrandes)} de otros gastos` : ''}.`);
  }
  partes.push(`Llegada final: Bs ${bs(c.queda)}.`);
  if (c.idaPendientes) partes.push(`Ojo: ${c.idaPendientes} viaje(s) sin boletos de ida todavía no tienen anotado cuánto trajeron.`);
  return partes.join(' ');
}
