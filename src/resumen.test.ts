import { describe, expect, it } from 'vitest';
import { leerBoletos, leerGastos, type Viaje } from './calc';
import { diasDelMes, filtrarBus, porDia, porMes } from './resumen';

const v = (bus: string, fecha: string, ida: string, registrado: number, gastos = ''): Viaje => ({
  id: `${bus}${fecha}${ida}`, bus, fecha, destino: '', horaSalida: '', horaLlegada: '',
  boletosIda: leerBoletos(ida).lineas, descuentoIda: 0, sinBoletoLlegada: true, boletosLlegada: [],
  montoRegistrado: registrado, gastos: leerGastos(gastos).gastos, otrosGastos: [], observaciones: '', creado: 0, actualizado: 0,
});

const viajes = [
  v('TDS', '2026-10-01', '10x50', 3000, 'Peaje 50'),
  v('TDS', '2026-10-01', '5x40', 2000),
  v('PIN', '2026-10-15', '2x60', 1000),
  v('TDS', '2026-02-28', '1x40', 500),
];

describe('resúmenes', () => {
  it('días de cada mes (incluye bisiestos)', () => {
    expect(diasDelMes(2026, 2)).toBe(28);
    expect(diasDelMes(2028, 2)).toBe(29);
    expect(diasDelMes(2026, 10)).toBe(31);
  });

  it('por mes suma cada mes por separado', () => {
    const m = porMes(viajes, 2026);
    expect(m).toHaveLength(12);
    expect(m[9].viajes).toBe(3);
    expect(m[9].montoIda).toBe(820);
    expect(m[1].montoIda).toBe(40);
    expect(m[0].viajes).toBe(0);
  });

  it('por día trae todos los días del mes y junta los viajes del mismo día', () => {
    const d = porDia(filtrarBus(viajes, 'TDS'), 2026, 10);
    expect(d).toHaveLength(31);
    expect(d[0].t.viajes).toBe(2);
    expect(d[0].t.netoFinal).toBe(4950);
    expect(d[14].t.viajes).toBe(0);
  });

  it('filtrar por bus o todos', () => {
    expect(filtrarBus(viajes, 'PIN')).toHaveLength(1);
    expect(filtrarBus(viajes, 'Todos')).toHaveLength(4);
  });
});
