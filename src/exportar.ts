// Exportar a Excel. El archivo completo usa las mismas columnas que la hoja Registro del Excel
// original, así que se puede volver a importar en la app (sirve como respaldo legible).
import { utils, writeFile, type WorkBook, type WorkSheet } from 'xlsx';
import { calcular, type Gasto, type Linea, type Viaje } from './calc';
import type { Factura } from './db';
import { calcularIVA } from './iva';
import { hoyISO, MESES } from './format';

const FORMATO_BS = '#,##0.00';
const serial = (iso: string) => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000;
const boletos = (ls: Linea[]) => ls.map((l) => `${l.cantidad}x${l.precio}`).join('; ');
const gastos = (gs: Gasto[]) => gs.map((g) => `${g.concepto} ${g.monto}`.trim()).join('; ');

// Da formato de fecha y de moneda a columnas enteras (filas desde «desde»).
function formato(ws: WorkSheet, filas: number, desde: number, fechas: number[], montos: number[], anchos: number[]) {
  for (let r = desde; r < filas; r++) {
    for (const c of fechas) { const cel = ws[utils.encode_cell({ r, c })]; if (cel && cel.t === 'n') cel.z = 'dd-mm-yy'; }
    for (const c of montos) { const cel = ws[utils.encode_cell({ r, c })]; if (cel && cel.t === 'n') cel.z = FORMATO_BS; }
  }
  ws['!cols'] = anchos.map((wch) => ({ wch }));
}

function hojaRegistro(viajes: Viaje[]): WorkSheet {
  const orden = [...viajes].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.bus.localeCompare(b.bus) || a.creado - b.creado);
  const filas: (string | number)[][] = [[
    'Bus', 'Fecha', 'Destino', 'Hora salida - llegada', 'Boletos de ida (detalle)', 'Descuento ida (monto)',
    'Boletos de llegada (detalle)', 'Monto registrado que trajeron', 'Gastos (concepto y monto)', 'Otros gastos (concepto y monto)', 'Observaciones',
    'Monto ida', 'Ida neto', 'Monto calculado llegada', 'Verificación', 'Total gastos', 'Total otros gastos', 'Neto final',
  ]];
  for (const v of orden) {
    const c = calcular(v);
    filas.push([
      v.bus, serial(v.fecha), v.destino, [v.horaSalida, v.horaLlegada].filter(Boolean).join(' - '), boletos(v.boletosIda), v.descuentoIda || '',
      v.sinBoletoLlegada ? 'Sin boleto' : boletos(v.boletosLlegada), v.montoRegistrado, gastos(v.gastos), gastos(v.otrosGastos), v.observaciones,
      c.montoIda, c.idaNeto, c.montoCalculadoLlegada ?? '', c.verificacion, c.totalGastos, c.totalOtrosGastos, c.netoFinal,
    ]);
  }
  const ws = utils.aoa_to_sheet(filas);
  formato(ws, filas.length, 1, [1], [5, 7, 11, 12, 13, 15, 16, 17], [6, 10, 10, 16, 26, 12, 22, 14, 30, 24, 24, 12, 12, 14, 15, 12, 14, 12]);
  return ws;
}

function hojaFacturas(facturas: Factura[], tasa: number): WorkSheet {
  const orden = [...facturas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const filas: (string | number)[][] = [['Fecha', 'N° factura', 'Proveedor / NIT', 'Concepto', 'Monto factura', 'IVA (crédito)', 'Observaciones']];
  for (const f of orden) filas.push([serial(f.fecha), f.numero, f.proveedor, f.concepto, f.monto, Math.round(f.monto * tasa * 100) / 100, f.observaciones]);
  const ws = utils.aoa_to_sheet(filas);
  formato(ws, filas.length, 1, [0], [4, 5], [10, 12, 28, 24, 14, 12, 30]);
  return ws;
}

export function libroCompleto(viajes: Viaje[], facturas: Factura[], tasa: number): WorkBook {
  const wb = utils.book_new();
  utils.book_append_sheet(wb, hojaRegistro(viajes), 'Registro');
  utils.book_append_sheet(wb, hojaFacturas(facturas, tasa), 'Facturas');
  return wb;
}

export function libroMesContador(anio: number, mes: number, viajes: Viaje[], facturas: Factura[], tasa: number): WorkBook {
  const iva = calcularIVA(viajes, facturas, tasa);
  const pct = `${Math.round(tasa * 1000) / 10}%`;
  const resumen: (string | number)[][] = [
    [`IVA de ${MESES[mes - 1]} ${anio} — todos los buses`],
    [],
    ['Concepto', 'Monto', `IVA (${pct})`],
    ['Ida neto del mes', iva.idaNeto, iva.ivaIda],
    ['Llegada normal del mes', iva.llegada, iva.ivaLlegada],
    ['TOTAL VENTAS → IVA débito', iva.ventas, iva.debito],
    [`Facturas del mes (${iva.cantidadFacturas}) → IVA crédito`, iva.facturas, iva.credito],
    ['Diferencia', iva.ventas - iva.facturas, iva.diferencia],
    [],
    ['IVA A PAGAR', '', iva.aPagar],
    ['SALDO A FAVOR', '', iva.saldoFavor],
  ];
  const ws = utils.aoa_to_sheet(resumen);
  formato(ws, resumen.length, 3, [], [1, 2], [40, 16, 16]);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'IVA');
  utils.book_append_sheet(wb, hojaFacturas(facturas, tasa), 'Facturas');
  utils.book_append_sheet(wb, hojaRegistro(viajes), 'Registro');
  return wb;
}

export function exportarMesContador(anio: number, mes: number, viajes: Viaje[], facturas: Factura[], tasa: number) {
  writeFile(libroMesContador(anio, mes, viajes, facturas, tasa), `IVA_${MESES[mes - 1]}_${anio}.xlsx`);
}

export function exportarTodo(viajes: Viaje[], facturas: Factura[], tasa: number) {
  writeFile(libroCompleto(viajes, facturas, tasa), `control_buses_app_${hoyISO()}.xlsx`);
}
