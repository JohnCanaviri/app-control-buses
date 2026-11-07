// Pruebas de los cambios de noviembre 2026.
import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { calcular, leerBoletos, leerGastos, totalizar, type Viaje } from './calc';
import type { Factura, GastoGeneral } from './db';
import { cargasEfectivas, estadoDiesel, faltanVueltas, viajesQueCubre, vueltasDe } from './diesel';
import { cuentas, informeMensual, porBus } from './informe';
import { datosDeTexto, facturaRepetida } from './iva';
import { libroCompleto } from './exportar';
import { importarLibro, reemplazados } from './importar';

const viaje = (bus: string, fecha: string, ida: string, registrado: number, gastos = '', extra: Partial<Viaje> = {}): Viaje => ({
  id: `${bus}-${fecha}-${ida}-${registrado}`, bus, fecha, destino: 'Lp', horaSalida: '', horaLlegada: '',
  boletosIda: leerBoletos(ida).lineas, descuentoIda: 0, sinBoletoLlegada: true, boletosLlegada: [],
  montoRegistrado: registrado, gastos: leerGastos(gastos).gastos, otrosGastos: [], observaciones: '', creado: 0, actualizado: 0, ...extra,
});
const gasto = (bus: string, fecha: string, categoria: string, monto: number, vueltas?: number): GastoGeneral => ({
  id: `${bus}-${fecha}-${categoria}-${monto}`, fecha, bus, categoria, monto, ...(vueltas !== undefined ? { vueltas } : {}), observaciones: '', creado: 0, actualizado: 0,
});

describe('sin boletos de ida', () => {
  it('cuenta 0 hasta que se anota cuánto trajeron, y luego ese monto', () => {
    const v = viaje('TDS', '2026-11-03', '', 3000, 'Peaje 50', { sinBoletoIda: true, montoIdaSinBoleto: null, descuentoIda: 0 });
    expect(calcular(v)).toMatchObject({ idaPendiente: true, montoIda: 0, boletosIda: 0, netoFinal: 2950 });
    expect(totalizar([v]).idaPendientes).toBe(1);
    const lleno = { ...v, montoIdaSinBoleto: 1200 };
    expect(calcular(lleno)).toMatchObject({ idaPendiente: false, montoIda: 1200, idaNeto: 1200 });
  });
});

describe('diésel con vueltas a mano desde noviembre', () => {
  it('desde noviembre solo valen las vueltas anotadas; antes, los rangos si no se anotaron', () => {
    expect(viajesQueCubre(3000, undefined, '2026-10-20')).toBe(1);
    expect(viajesQueCubre(3000, undefined, '2026-11-02')).toBe(0);
    expect(viajesQueCubre(3000, 2, '2026-11-02')).toBe(2);
    expect(faltanVueltas(gasto('TDS', '2026-11-02', 'Diésel', 3000))).toBe(true);
    expect(faltanVueltas(gasto('TDS', '2026-11-02', 'Diésel', 3000, 1))).toBe(false);
    expect(vueltasDe(gasto('TDS', '2026-10-02', 'Diésel', 8000))).toBe(3);
  });

  it('el ejemplo del lunes: viajé, eché diésel para 1 vuelta → el martes pide ECHAR DIÉSEL', () => {
    // Domingo: carga para 1 vuelta. Lunes: viaje (usa esa vuelta) y a las 7 pm otra carga para 1 vuelta.
    const cargas = [gasto('PIN', '2026-11-08', 'Diésel', 3000, 1), gasto('PIN', '2026-11-09', 'Diésel', 3000, 1)];
    const viajes = [viaje('PIN', '2026-11-09', '10x50', 2000)];
    const martes = estadoDiesel('PIN', viajes, cargas, '2026-11-10');
    expect(martes).toMatchObject({ quedan: 1, nivel: 'echar' });
    // Si no carga y viaja el martes: 0 vueltas, sin combustible.
    expect(estadoDiesel('PIN', [...viajes, viaje('PIN', '2026-11-10', '5x50', 1000)], cargas, '2026-11-10')).toMatchObject({ quedan: 0, nivel: 'sin' });
    // Con una carga para 3 vueltas queda tranquilo.
    expect(estadoDiesel('PIN', viajes, [...cargas, gasto('PIN', '2026-11-10', 'Diésel', 8000, 3)], '2026-11-10')).toMatchObject({ quedan: 4, nivel: 'ok' });
  });

  it('lo que sobra en octubre pasa a noviembre', () => {
    const e = estadoDiesel('TDS', [viaje('TDS', '2026-10-30', '1x50', 100)], [gasto('TDS', '2026-10-29', 'Diésel', 8000)], '2026-11-01');
    expect(e.quedan).toBe(2);
  });
});

describe('informes con gastos grandes', () => {
  const viajes = [
    viaje('TDS', '2026-11-02', '10x50', 3000, 'Peaje 50; Viático 50'),
    viaje('TDS', '2026-11-02', '4x50', 1000),
    viaje('PIN', '2026-11-03', '2x60', 500, 'Peaje 20'),
  ];
  const grandes = [
    gasto('TDS', '2026-11-02', 'Diésel', 3000, 1), gasto('PIN', '2026-11-03', 'Diésel', 2500, 1),
    gasto('', '2026-11-05', 'Sueldos', 1000),
  ];
  it('la ida va aparte: los gastos se descuentan solo de la llegada', () => {
    const c = cuentas(viajes.slice(0, 2), grandes.slice(0, 1));
    expect(c).toMatchObject({ viajes: 2, idaNeto: 700, trajeron: 4000, gastosViaje: 100, vueltaNeta: 3900, diesel: 3000, queda: 900 });
  });
  it('día a día del mes, y con «Todos» entran los gastos sin bus', () => {
    const tds = informeMensual(viajes, grandes, 'TDS', 2026, 11);
    expect(tds.dias).toHaveLength(30);
    expect(tds.dias[1].c).toMatchObject({ viajes: 2, diesel: 3000, queda: 900 });
    expect(tds.total.otrosGrandes).toBe(0);
    const todos = informeMensual(viajes, grandes, 'Todos', 2026, 11);
    expect(todos.total.otrosGrandes).toBe(1000);
    expect(todos.dias[4].notas).toEqual(['General: Sueldos']);
  });
  it('por bus y total', () => {
    const p = porBus(viajes, grandes, ['TDS', 'PIN', 'PKS']);
    expect(p.filas.map((f) => f.c.queda)).toEqual([900, 480 - 2500, 0]);
    expect(p.generales.otrosGrandes).toBe(1000);
    expect(p.total.queda).toBe(900 - 2020 - 1000);
  });
});

describe('Excel: exportar e importar sin perder ni duplicar', () => {
  it('trae gastos, sin boletos de ida y conserva los ID', () => {
    const viajes = [viaje('TDS', '2026-11-02', '10x50', 3000, 'Peaje 50'), viaje('PIN', '2026-11-03', '', 500, '', { sinBoletoIda: true, montoIdaSinBoleto: 700 })];
    const grandes = [gasto('TDS', '2026-11-02', 'Diésel', 3000, 2), gasto('', '2026-11-05', 'Sueldos', 1000)];
    const r = importarLibro(new Uint8Array(write(libroCompleto(viajes, [], 0.13, grandes), { type: 'array', bookType: 'xlsx' })));
    expect(r.problemas).toEqual([]);
    expect(r.viajes.map((v) => v.id)).toEqual(viajes.map((v) => v.id));
    expect(r.viajes[1]).toMatchObject({ sinBoletoIda: true, montoIdaSinBoleto: 700 });
    expect(totalizar(r.viajes)).toEqual(totalizar(viajes));
    expect(r.gastos).toMatchObject([{ bus: 'TDS', categoria: 'Diésel', monto: 3000, vueltas: 2, id: grandes[0].id }, { bus: '', categoria: 'Sueldos', monto: 1000 }]);
  });

  const libroOriginal = (filas: (string | number)[][], facturas: (string | number)[][] = []) => {
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.aoa_to_sheet([['Bus', 'Fecha', 'Destino', 'Boletos de ida', 'Boletos de llegada', 'Monto registrado', 'Gastos'], ...filas]), 'Registro');
    utils.book_append_sheet(wb, utils.aoa_to_sheet([['Fecha', 'N° factura', 'Proveedor', 'Concepto', 'Monto factura'], ...facturas]), 'Facturas');
    return importarLibro(new Uint8Array(write(wb, { type: 'array', bookType: 'xlsx' })));
  };

  it('dos facturas iguales siguen siendo dos', () => {
    const r = libroOriginal([], [['05/11/2026', '', 'Surtidor X', 'Diésel', 3000], ['05/11/2026', '', 'Surtidor X', 'Diésel', 3000]]);
    expect(new Set(r.facturas.map((f) => f.id)).size).toBe(2);
  });

  it('corregir una celda del Excel original y volver a importar actualiza el viaje (no lo duplica)', () => {
    const a = libroOriginal([['TDS', '02/11/2026', 'Lp', '10x50', '1x3000', 3000, 'Peaje 50']]);
    const b = libroOriginal([['TDS', '02/11/2026', 'Lp', '10x50', '1x3100', 3100, 'Peaje 50']]);
    expect(b.viajes[0].id).toBe(a.viajes[0].id);
    // Viajes importados con la versión anterior (otro id) de esos mismos días se reemplazan.
    const antiguo = { ...a.viajes[0], id: 'xls-1abc2-1' };
    const aMano = { ...a.viajes[0], id: 'uuid-registrado-en-la-app' };
    expect(reemplazados([antiguo, aMano, a.viajes[0]], b.viajes, true)).toEqual(['xls-1abc2-1']);
  });
});

describe('lector de facturas (texto)', () => {
  it('no confunde el total con lo pagado en efectivo o el cambio', () => {
    const t = 'NIT: 1020703023\nFACTURA N° 77\nTOTAL Bs 350,00\nEFECTIVO 500,00\nCAMBIO 150,00\n';
    expect(datosDeTexto(t)).toMatchObject({ nit: '1020703023', numero: '77', monto: 350 });
  });
  it('fecha con el mes en letras, NIT del cliente aparte y cifras con «O»', () => {
    const t = 'ESTACION SAN JOSE\nNIT 1020703023\nFecha: 05 de noviembre de 2026\nNIT/CI/CEX: 4455667\nIMPORTE TOTAL: 8.4OO,00\n';
    expect(datosDeTexto(t)).toMatchObject({ nit: '1020703023', fecha: '2026-11-05', monto: 8400 });
  });
  it('fecha con año de dos cifras y total sin centavos', () => {
    expect(datosDeTexto('Fecha 07/11/26\nTOTAL A PAGAR 1.250')).toMatchObject({ fecha: '2026-11-07', monto: 1250 });
  });
});

describe('factura repetida', () => {
  const f = (id: string, numero: string, proveedor: string): Factura => ({ id, fecha: '2026-11-05', numero, proveedor, concepto: '', monto: 100, observaciones: '', creado: 0, actualizado: 0 });
  it('mismo número y mismo NIT = repetida; otro NIT o sin número = no', () => {
    const ya = [f('a', '77', 'YPFB / NIT 1020703023')];
    expect(facturaRepetida(f('b', '77', 'NIT 1020703023'), ya)?.id).toBe('a');
    expect(facturaRepetida(f('b', '77', 'NIT 99999999'), ya)).toBeUndefined();
    expect(facturaRepetida(f('b', '', 'NIT 1020703023'), ya)).toBeUndefined();
    expect(facturaRepetida(f('a', '77', 'NIT 1020703023'), ya)).toBeUndefined();
  });
});

describe('el diésel nunca se descuenta dos veces', () => {
  // Caso de TDS en octubre: el diésel quedó anotado dentro del viaje Y como gasto del mes.
  const conDiesel = viaje('TDS', '2026-10-03', '10x50', 3599, 'Peaje 50; Viático 50', { otrosGastos: [{ concepto: 'Diesel', monto: 8400 }] });
  const carga = gasto('TDS', '2026-10-03', 'Diésel', 8400);
  it('si está en los dos lugares, se cuenta una sola vez', () => {
    const c = cuentas([conDiesel], [carga]);
    expect(c).toMatchObject({ gastosViaje: 100, vueltaNeta: 3499, diesel: 8400, queda: 3499 - 8400 });
    expect(cargasEfectivas([conDiesel], [carga])).toHaveLength(1);
  });
  it('si solo está dentro del viaje, igual se descuenta (una vez) como gasto del mes', () => {
    const c = cuentas([conDiesel], []);
    expect(c).toMatchObject({ vueltaNeta: 3499, diesel: 8400, queda: 3499 - 8400 });
    expect(cargasEfectivas([conDiesel], [])[0]).toMatchObject({ bus: 'TDS', fecha: '2026-10-03', monto: 8400, categoria: 'Diésel' });
  });
  it('otra carga de otro día no se confunde con la del viaje', () => {
    expect(cuentas([conDiesel], [gasto('TDS', '2026-10-04', 'Diésel', 8400)]).diesel).toBe(16800);
  });
  it('por día y por mes da lo mismo', () => {
    const m = informeMensual([conDiesel], [carga], 'TDS', 2026, 10);
    expect(m.total.diesel).toBe(8400);
    expect(m.dias.reduce((s, d) => s + d.c.diesel, 0)).toBe(8400);
  });
});
