import { describe, expect, it } from 'vitest';
import { calcular, leerBoletos, leerGastos, totalizar, type Viaje } from './calc';

// Viajes reales de TDS (octubre 2026) tomados de control_buses.xlsx, con sus resultados en el Excel.
function viaje(ida: string, llegada: string, registrado: number, gastos: string, otros = '', descuento = 0): Viaje {
  return {
    id: 'x', bus: 'TDS', fecha: '2026-10-01', destino: '', horaSalida: '', horaLlegada: '',
    boletosIda: leerBoletos(ida).lineas, descuentoIda: descuento,
    sinBoletoLlegada: llegada.toLowerCase() === 'sin boleto', boletosLlegada: leerBoletos(llegada).lineas,
    montoRegistrado: registrado, gastos: leerGastos(gastos).gastos, otrosGastos: leerGastos(otros).gastos,
    observaciones: '', creado: 0, actualizado: 0,
  };
}

describe('calcular (igual que el Excel)', () => {
  it('01-10-26: 25x40; 3x50', () => {
    const c = calcular(viaje('25x40; 3x50', '1x3300', 3300, 'Peaje 50; Veatico 50'));
    expect(c.boletosIda).toBe(28);
    expect(c.montoIda).toBe(1150);
    expect(c.montoCalculadoLlegada).toBe(3300);
    expect(c.verificacion).toBe('CONFORME');
    expect(c.totalGastos).toBe(100);
    expect(c.totalMenosGastos).toBe(3200);
    expect(c.netoFinal).toBe(3200);
  });

  it('03-10-26: con otros gastos (diésel) el neto sale negativo', () => {
    const c = calcular(viaje('43x50; 2x80; 10x70', '1x3599', 3599, 'Peaje 50; Veatico 50', 'Diesel 8400'));
    expect(c.boletosIda).toBe(55);
    expect(c.montoIda).toBe(3010);
    expect(c.totalMenosGastos).toBe(3499);
    expect(c.netoFinal).toBe(-4901);
  });

  it('05-10-26: gastos con diésel dentro de gastos', () => {
    const c = calcular(viaje('37x40; 2x50; 2x70; 8x60', '1x3300', 3300, 'Peaje 50; Diesel 400; Veatico 50', 'Diesel 7500'));
    expect(c.montoIda).toBe(2200);
    expect(c.totalGastos).toBe(500);
    expect(c.netoFinal).toBe(-4700);
  });

  it('el descuento se resta solo a la ida', () => {
    const c = calcular(viaje('25x40; 3x50', '1x3300', 3300, 'Peaje 50; Veatico 50', '', 100));
    expect(c.idaNeto).toBe(1050);
    expect(c.netoFinal).toBe(3200);
  });

  it('verificación: falta boletos, diferencia, sin boleto', () => {
    expect(calcular(viaje('1x40', '1x3000', 3300, '')).verificacion).toBe('FALTA BOLETOS');
    expect(calcular(viaje('1x40', '1x3500', 3300, '')).verificacion).toBe('DIFERENCIA');
    const s = calcular(viaje('1x40', 'Sin boleto', 2100, ''));
    expect(s.montoCalculadoLlegada).toBe(2100);
    expect(s.verificacion).toBe('CONFORME');
  });

  it('totalizar suma los viajes', () => {
    const t = totalizar([
      viaje('25x40; 3x50', '1x3300', 3300, 'Peaje 50; Veatico 50'),
      viaje('15x40; 15x50; 5x60', '1x4060', 4060, 'Peaje 50; Veatico 50; Gasto 100'),
    ]);
    expect(t.viajes).toBe(2);
    expect(t.montoIda).toBe(2800);
    expect(t.netoFinal).toBe(7060);
  });
});

describe('leer texto del Excel', () => {
  it('boletos con ; + y saltos de línea', () => {
    expect(leerBoletos('25x40;3x50\n2 x 70 + 1X80').lineas).toEqual([
      { cantidad: 25, precio: 40 }, { cantidad: 3, precio: 50 }, { cantidad: 2, precio: 70 }, { cantidad: 1, precio: 80 },
    ]);
    expect(leerBoletos('abc').error).toBe(true);
  });
  it('gastos «concepto monto»', () => {
    expect(leerGastos('Peaje 50; Veatico 50; Engrase 40').gastos.map((g) => g.monto)).toEqual([50, 50, 40]);
  });
});
