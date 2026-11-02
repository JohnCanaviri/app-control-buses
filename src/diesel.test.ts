import { describe, expect, it } from 'vitest';
import { separarDiesel, viajesQueCubre } from './diesel';

describe('viajesQueCubre', () => {
  it('aplica los rangos de monto', () => {
    expect(viajesQueCubre(1500)).toBe(0);
    expect(viajesQueCubre(2000)).toBe(1);
    expect(viajesQueCubre(4000)).toBe(1);
    expect(viajesQueCubre(4200)).toBe(0);
    expect(viajesQueCubre(4500)).toBe(2);
    expect(viajesQueCubre(7000)).toBe(2);
    expect(viajesQueCubre(7500)).toBe(0);
    expect(viajesQueCubre(8000)).toBe(3);
  });
});

describe('separarDiesel', () => {
  it('saca el diésel del viaje y lo vuelve gasto del bus', () => {
    const v = {
      id: 'v1', bus: 'PIN', fecha: '2026-10-05', destino: 'Lp', horaSalida: '', horaLlegada: '',
      boletosIda: [], descuentoIda: 0, sinBoletoLlegada: false, boletosLlegada: [], montoRegistrado: 0,
      gastos: [{ concepto: 'Peaje', monto: 50 }], otrosGastos: [{ concepto: 'Diesel', monto: 3000 }, { concepto: 'Mantenimiento', monto: 200 }],
      observaciones: '', creado: 1, actualizado: 1,
    };
    const r = separarDiesel(v)!;
    expect(r.viaje.otrosGastos).toEqual([{ concepto: 'Mantenimiento', monto: 200 }]);
    expect(r.viaje.gastos).toHaveLength(1);
    expect(r.cargas).toMatchObject([{ bus: 'PIN', fecha: '2026-10-05', categoria: 'Diésel', monto: 3000 }]);
    expect(separarDiesel(r.viaje)).toBeNull();
  });
});
