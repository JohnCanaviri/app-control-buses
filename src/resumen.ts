// Agrupaciones para los resúmenes: por mes de un año y por día de un mes.
import { totalizar, type Totales, type Viaje } from './calc';

const dos = (n: number) => String(n).padStart(2, '0');

export const diasDelMes = (anio: number, mes: number) => new Date(anio, mes, 0).getDate();

// 12 filas (enero a diciembre) con los totales de cada mes.
export function porMes(viajes: Viaje[], anio: number): Totales[] {
  return Array.from({ length: 12 }, (_, i) => {
    const pref = `${anio}-${dos(i + 1)}`;
    return totalizar(viajes.filter((v) => v.fecha.startsWith(pref)));
  });
}

// Una fila por cada día del mes (28 a 31), aunque no haya viajes.
export function porDia(viajes: Viaje[], anio: number, mes: number): { fecha: string; t: Totales }[] {
  return Array.from({ length: diasDelMes(anio, mes) }, (_, i) => {
    const fecha = `${anio}-${dos(mes)}-${dos(i + 1)}`;
    return { fecha, t: totalizar(viajes.filter((v) => v.fecha === fecha)) };
  });
}

export const filtrarBus = (viajes: Viaje[], bus: string) => (bus === 'Todos' ? viajes : viajes.filter((v) => v.bus === bus));
