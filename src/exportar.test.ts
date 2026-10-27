import { describe, expect, it } from 'vitest';
import { write } from 'xlsx';
import { leerBoletos, leerGastos, totalizar, type Viaje } from './calc';
import type { Factura } from './db';
import { libroCompleto, libroMesContador } from './exportar';
import { importarLibro } from './importar';

const viaje = (fecha: string, ida: string, llegada: string, registrado: number, g: string, o = '', descuento = 0): Viaje => ({
  id: fecha + ida, bus: 'TDS', fecha, destino: 'Lp', horaSalida: '08:30', horaLlegada: '15:30',
  boletosIda: leerBoletos(ida).lineas, descuentoIda: descuento, sinBoletoLlegada: llegada === 'Sin boleto',
  boletosLlegada: leerBoletos(llegada).lineas, montoRegistrado: registrado, gastos: leerGastos(g).gastos,
  otrosGastos: leerGastos(o).gastos, observaciones: 'nota', creado: 0, actualizado: 0,
});
const viajes = [
  viaje('2026-10-01', '25x40; 3x50', '1x3300', 3300, 'Peaje 50; Viático 50'),
  viaje('2026-10-03', '43x50; 2x80; 10x70', '1x3599', 3599, 'Peaje 50; Viático 50', 'Diésel 8400', 100),
  viaje('2026-10-31', '5x60', 'Sin boleto', 2100, ''),
];
const facturas: Factura[] = [
  { id: 'a', fecha: '2026-10-05', numero: '4512', proveedor: 'YPFB / NIT 1020703023', concepto: 'Diésel', monto: 8400, observaciones: '', creado: 0, actualizado: 0 },
];

describe('exportar a Excel', () => {
  it('el archivo completo se puede volver a importar sin perder nada', () => {
    const datos = write(libroCompleto(viajes, facturas, 0.13), { type: 'array', bookType: 'xlsx' });
    const r = importarLibro(new Uint8Array(datos));
    expect(r.problemas).toEqual([]);
    expect(r.viajes).toHaveLength(3);
    expect(r.viajes.map((v) => v.fecha)).toEqual(['2026-10-01', '2026-10-03', '2026-10-31']);
    expect(totalizar(r.viajes)).toEqual(totalizar(viajes));
    expect(r.viajes[2].sinBoletoLlegada).toBe(true);
    expect(r.viajes[0].horaSalida).toBe('08:30');
    expect(r.facturas).toHaveLength(1);
    expect(r.facturas[0]).toMatchObject({ fecha: '2026-10-05', numero: '4512', monto: 8400 });
  });

  it('el archivo del contador trae la hoja IVA con los totales', () => {
    const wb = libroMesContador(2026, 10, viajes, facturas, 0.13);
    expect(wb.SheetNames).toEqual(['IVA', 'Facturas', 'Registro']);
    expect(wb.Sheets.IVA.C10.v).toBeCloseTo(totalizar(viajes).idaNeto * 0.13 + totalizar(viajes).montoRegistrado * 0.13 - 8400 * 0.13, 2);
  });
});
