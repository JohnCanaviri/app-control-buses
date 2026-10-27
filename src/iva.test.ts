import { describe, expect, it } from 'vitest';
import { leerBoletos, type Viaje } from './calc';
import type { Factura } from './db';
import { calcularIVA, datosDeTexto, leerQRFactura } from './iva';

const viaje = (ida: string, registrado: number, descuento = 0): Viaje => ({
  id: ida, bus: 'TDS', fecha: '2026-10-01', destino: '', horaSalida: '', horaLlegada: '',
  boletosIda: leerBoletos(ida).lineas, descuentoIda: descuento, sinBoletoLlegada: true, boletosLlegada: [],
  montoRegistrado: registrado, gastos: [], otrosGastos: [], observaciones: '', creado: 0, actualizado: 0,
});
const factura = (monto: number): Factura => ({ id: String(monto), fecha: '2026-10-05', numero: '', proveedor: '', concepto: '', monto, observaciones: '', creado: 0, actualizado: 0 });

describe('IVA del mes', () => {
  it('reproduce la prueba de la hoja Facturas del Excel (octubre 2026)', () => {
    // Ida neto 106.655 y llegada 131.014 (los 3 buses); facturas 8.400 + 3.000.
    const i = calcularIVA([viaje('1x106655', 131014)], [factura(8400), factura(3000)], 0.13);
    expect(i.ventas).toBe(237669);
    expect(i.ivaIda).toBe(13865.15);
    expect(i.ivaLlegada).toBe(17031.82);
    expect(i.debito).toBe(30896.97);
    expect(i.credito).toBe(1482);
    expect(i.aPagar).toBe(29414.97);
    expect(i.saldoFavor).toBe(0);
  });
  it('el descuento baja la ida neta y el IVA', () => {
    expect(calcularIVA([viaje('1x1000', 0, 100)], [], 0.13).debito).toBe(117);
  });
  it('saldo a favor cuando las facturas superan a las ventas', () => {
    const i = calcularIVA([viaje('1x100', 0)], [factura(1000)], 0.13);
    expect(i.aPagar).toBe(0);
    expect(i.saldoFavor).toBe(117);
  });
});

describe('QR de facturas', () => {
  it('factura computarizada', () => {
    expect(leerQRFactura('1020703023|12345|29040011007|05/10/2026|8400.00|8400.00|7B-F3-48-A8|0|0|0|0|0')).toMatchObject({
      tipo: 'computarizada', nit: '1020703023', numero: '12345', fecha: '2026-10-05', monto: 8400,
    });
  });
  it('factura electrónica del SIAT', () => {
    expect(leerQRFactura('https://siat.impuestos.gob.bo/consulta/QR?nit=1020703023&cuf=ABC123&numero=77&t=2')).toMatchObject({
      tipo: 'electronica', nit: '1020703023', numero: '77', cuf: 'ABC123',
    });
  });
  it('texto que no es de factura', () => {
    expect(leerQRFactura('hola').tipo).toBe('desconocido');
  });
});

describe('texto de la foto (OCR)', () => {
  it('encuentra NIT, número, fecha y total', () => {
    const t = 'ESTACION DE SERVICIO\nNIT: 1020703023\nFACTURA N° 004512\nFecha: 05/10/2026 14:22\nDIESEL 1.000,00\nSUBTOTAL 8.400,00\nTOTAL Bs 8.400,00\n';
    expect(datosDeTexto(t)).toMatchObject({ nit: '1020703023', numero: '004512', fecha: '2026-10-05', monto: 8400 });
  });
  it('número de factura con distintas lecturas del símbolo «N°»', () => {
    for (const linea of ['FACTURA N* 004512', 'FACTURA Nº 004512', 'FACTURA NRO. 004512', 'FACTURA N? 004512', 'FACTURA No: 004512', 'FACTURA N"004512', 'N° DE FACTURA 004512']) {
      expect(datosDeTexto(linea).numero).toBe('004512');
    }
  });
});
