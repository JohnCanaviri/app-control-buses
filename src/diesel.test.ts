import { describe, expect, it } from 'vitest';
import { controlDiesel, separarDiesel, sobranteAnterior, viajesQueCubre } from './diesel';

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

describe('diésel que sobra', () => {
  const viaje = (fecha: string) => ({ id: fecha, bus: 'TDS', fecha, creado: 0 }) as never;
  const carga = (fecha: string, monto: number, vueltas?: number) => ({ id: fecha, fecha, monto, vueltas }) as never;
  it('pasa al mes siguiente y respeta las vueltas indicadas', () => {
    expect(viajesQueCubre(4200)).toBe(0);
    expect(viajesQueCubre(4200, 2)).toBe(2);
    // Octubre: 3 + 3 vueltas, 4 viajes → sobran 2. Noviembre: 1 viaje, nada cargado → sobra 1.
    const v = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-11-01'].map(viaje);
    const c = [carga('2026-10-01', 8000), carga('2026-10-03', 8000)];
    expect(sobranteAnterior(v.slice(0, 4), c)).toBe(2);
    expect(sobranteAnterior(v, c)).toBe(1);
    const d = controlDiesel([v[4]], [], 2);
    expect(d.filas[0].cubierto).toBe(true);
    expect(d.pasaAlSiguiente).toBe(1);
  });
});
