// Lee el libro «control_buses*.xlsx»: viajes de la hoja Registro, facturas de la hoja
// Facturas y, para comparar, los totales que calculó el propio Excel en la hoja Resumen.
import { read, utils, type WorkBook } from 'xlsx';
import { leerBoletos, leerGastos, totalizar, type Viaje } from './calc';
import type { Factura } from './db';

export interface Problema { hoja: string; fila: number; mensaje: string }

// Totales de un bus en un mes según el Excel (hoja Resumen).
export interface TotalExcel { bus: string; anio: number; mes: number; montoIda: number; idaNeto: number | null; montoLlegada: number; netoFinal: number }

export interface Comparacion extends TotalExcel {
  app: { montoIda: number; idaNeto: number; montoLlegada: number; netoFinal: number };
  cuadra: boolean;
}

export interface Importacion {
  viajes: Viaje[];
  facturas: Factura[];
  problemas: Problema[];
  totalesExcel: TotalExcel[];
  comparacion: Comparacion[];
}

type Fila = unknown[];

const normal = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const vacio = (v: unknown) => texto(v) === '';

function numero(v: unknown): number | null {
  if (typeof v === 'number') return v;
  const s = texto(v);
  if (!s) return 0;
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Fecha de Excel (número de serie o texto dd-mm-aa / dd/mm/aaaa) → aaaa-mm-dd.
export function fechaExcel(v: unknown): string | null {
  if (typeof v === 'number' && v > 0) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = texto(v).match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (!m) return null;
  const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const mes = Number(m[2]), dia = Number(m[1]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// «08:30 - 15:30», «4:00», «15:30-4:00» o una hora guardada como número de Excel.
export function horario(v: unknown): { salida: string; llegada: string; resto: string } {
  const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (typeof v === 'number') {
    const min = Math.round((v % 1) * 24 * 60);
    return { salida: hhmm(Math.floor(min / 60) % 24, min % 60), llegada: '', resto: '' };
  }
  const s = texto(v);
  const horas = [...s.matchAll(/(\d{1,2})[:.](\d{2})/g)]
    .map((m) => [Number(m[1]), Number(m[2])])
    .filter(([h, m]) => h < 24 && m < 60)
    .map(([h, m]) => hhmm(h, m));
  return { salida: horas[0] ?? '', llegada: horas[1] ?? '', resto: horas.length ? '' : s };
}

// Identificador estable: si importas el mismo Excel dos veces no se duplican los viajes.
function huella(partes: string[]) {
  let h = 5381;
  for (const c of partes.join('|')) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

function columnas(cab: Fila, buscar: Record<string, (h: string) => boolean>) {
  const res: Record<string, number> = {};
  cab.forEach((h, i) => {
    const n = normal(h);
    for (const [k, f] of Object.entries(buscar)) if (res[k] === undefined && f(n)) res[k] = i;
  });
  return res;
}

function leerRegistro(wb: WorkBook, problemas: Problema[]): Viaje[] {
  const ws = wb.Sheets['Registro'];
  if (!ws) { problemas.push({ hoja: 'Registro', fila: 0, mensaje: 'El archivo no tiene la hoja «Registro».' }); return []; }
  const filas = utils.sheet_to_json<Fila>(ws, { header: 1, raw: true, defval: '' });
  const c = columnas(filas[0] ?? [], {
    bus: (h) => h === 'bus',
    fecha: (h) => h === 'fecha',
    destino: (h) => h.startsWith('destino'),
    hora: (h) => h.startsWith('hora'),
    ida: (h) => h.startsWith('boletos de ida'),
    descuento: (h) => h.startsWith('descuento'),
    llegada: (h) => h.startsWith('boletos de llegada'),
    registrado: (h) => h.startsWith('monto registrado'),
    gastos: (h) => h.startsWith('gastos'),
    otros: (h) => h.startsWith('otros gastos'),
    obs: (h) => h.startsWith('observaciones'),
  });
  for (const k of ['bus', 'fecha', 'ida', 'llegada', 'registrado', 'gastos']) {
    if (c[k] === undefined) { problemas.push({ hoja: 'Registro', fila: 1, mensaje: `No encontré la columna «${k}».` }); return []; }
  }
  const celda = (f: Fila, k: string) => (c[k] === undefined ? '' : f[c[k]]);

  const viajes: Viaje[] = [];
  const vistos = new Map<string, number>();
  const ahora = Date.now();
  filas.slice(1).forEach((f, i) => {
    const fila = i + 2;
    if (['bus', 'fecha', 'ida', 'llegada', 'registrado', 'gastos'].every((k) => vacio(celda(f, k)))) return;
    const aviso = (mensaje: string) => problemas.push({ hoja: 'Registro', fila, mensaje });

    const bus = texto(celda(f, 'bus')).toUpperCase();
    const fecha = fechaExcel(celda(f, 'fecha'));
    if (!bus) { aviso('Falta el bus; no se importó.'); return; }
    if (!fecha) { aviso(`Fecha no válida («${texto(celda(f, 'fecha'))}»); no se importó.`); return; }

    // Igual que el Excel: un detalle sin «x» no suma boletos (en la llegada equivale a «Sin boleto»).
    const idaTxt = texto(celda(f, 'ida'));
    const ida = /x/i.test(idaTxt) ? leerBoletos(idaTxt) : { lineas: [], error: false };
    if (ida.error) aviso(`Boletos de ida con formato raro: «${idaTxt}».`);
    const llegTxt = texto(celda(f, 'llegada'));
    const sinBoleto = llegTxt !== '' && !/x/i.test(llegTxt);
    const lleg = sinBoleto ? { lineas: [], error: false } : leerBoletos(llegTxt);
    if (lleg.error) aviso(`Boletos de llegada con formato raro: «${llegTxt}».`);

    const registrado = numero(celda(f, 'registrado'));
    if (registrado === null) aviso(`Monto registrado no es un número: «${texto(celda(f, 'registrado'))}».`);
    const descuento = numero(celda(f, 'descuento'));
    if (descuento === null) aviso(`Descuento no es un número: «${texto(celda(f, 'descuento'))}».`);
    const gTxt = texto(celda(f, 'gastos')), oTxt = texto(celda(f, 'otros'));
    const gastos = leerGastos(gTxt), otros = leerGastos(oTxt);
    if (gastos.error) aviso(`Gastos con formato raro: «${gTxt}».`);
    if (otros.error) aviso(`Otros gastos con formato raro: «${oTxt}».`);

    const h = horario(celda(f, 'hora'));
    const obs = [texto(celda(f, 'obs')), h.resto ? `Horario: ${h.resto}` : ''].filter(Boolean).join(' · ');
    const destino = texto(celda(f, 'destino'));

    const base = huella([bus, fecha, destino, texto(celda(f, 'hora')), idaTxt, llegTxt, String(registrado), gTxt, oTxt]);
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);

    viajes.push({
      id: `xls-${base}-${n}`, bus, fecha, destino, horaSalida: h.salida, horaLlegada: h.llegada,
      boletosIda: ida.lineas, descuentoIda: descuento ?? 0,
      sinBoletoLlegada: sinBoleto, boletosLlegada: lleg.lineas, montoRegistrado: registrado ?? 0,
      gastos: gastos.gastos, otrosGastos: otros.gastos, observaciones: obs,
      creado: ahora + i, actualizado: ahora,
    });
  });
  return viajes;
}

function leerFacturas(wb: WorkBook, problemas: Problema[]): Factura[] {
  const ws = wb.Sheets['Facturas'];
  if (!ws) return [];
  const filas = utils.sheet_to_json<Fila>(ws, { header: 1, raw: true, defval: '' });
  const ic = filas.findIndex((f) => f.some((v) => normal(v) === 'fecha') && f.some((v) => normal(v).startsWith('monto factura')));
  if (ic < 0) return [];
  const c = columnas(filas[ic], {
    fecha: (h) => h === 'fecha',
    numero: (h) => h.startsWith('n'),
    proveedor: (h) => h.startsWith('proveedor'),
    concepto: (h) => h.startsWith('concepto'),
    monto: (h) => h.startsWith('monto factura'),
    obs: (h) => h.startsWith('observaciones'),
  });
  const facturas: Factura[] = [];
  const ahora = Date.now();
  filas.slice(ic + 1).forEach((f, i) => {
    const fila = ic + i + 2;
    const val = (k: string) => (c[k] === undefined ? '' : f[c[k]]);
    if (vacio(val('fecha')) && vacio(val('monto'))) return;
    const fecha = fechaExcel(val('fecha'));
    const monto = numero(val('monto'));
    if (!fecha || monto === null) {
      problemas.push({ hoja: 'Facturas', fila, mensaje: `Factura con fecha o monto no válido; no se importó.` });
      return;
    }
    const numeroF = texto(val('numero'));
    facturas.push({
      id: `xls-f-${huella([fecha, numeroF, texto(val('proveedor')), String(monto)])}`,
      fecha, numero: numeroF, proveedor: texto(val('proveedor')), concepto: texto(val('concepto')),
      monto, observaciones: texto(val('obs')), creado: ahora + i, actualizado: ahora,
    });
  });
  return facturas;
}

function leerResumen(wb: WorkBook): TotalExcel[] {
  const ws = wb.Sheets['Resumen'];
  if (!ws) return [];
  const filas = utils.sheet_to_json<Fila>(ws, { header: 1, raw: true, defval: '' });
  const anio = Number(filas[2]?.[1]);
  const iBuses = filas.findIndex((f) => f.some((v) => ['TDS', 'PIN', 'PKS'].includes(texto(v))));
  if (!anio || iBuses < 0) return [];
  // Las celdas combinadas solo traen el nombre del bus en la primera columna del bloque.
  let actual = '';
  const busDe = filas[iBuses].map((v) => (texto(v) ? (actual = texto(v)) : actual));
  const etiquetas = (filas[iBuses + 1] ?? []).map(normal);
  const col = (bus: string, etiqueta: string) => etiquetas.findIndex((e, i) => busDe[i] === bus && e === etiqueta);

  const res: TotalExcel[] = [];
  for (const bus of ['TDS', 'PIN', 'PKS']) {
    const cIda = col(bus, 'monto ida'), cNeto = col(bus, 'ida neto'), cLleg = col(bus, 'monto llegada'), cFin = col(bus, 'neto final');
    if (cIda < 0 || cLleg < 0 || cFin < 0) continue;
    for (let r = iBuses + 2; r < iBuses + 14; r++) {
      const f = filas[r] ?? [];
      const mes = Number(f[0]);
      if (!(mes >= 1 && mes <= 12)) continue;
      res.push({
        bus, anio, mes,
        montoIda: numero(f[cIda]) ?? 0, idaNeto: cNeto >= 0 ? numero(f[cNeto]) ?? 0 : null,
        montoLlegada: numero(f[cLleg]) ?? 0, netoFinal: numero(f[cFin]) ?? 0,
      });
    }
  }
  return res;
}

export function comparar(viajes: Viaje[], totales: TotalExcel[]): Comparacion[] {
  const iguales = (a: number, b: number) => Math.abs(a - b) < 0.005;
  return totales
    .map((t) => {
      const pref = `${t.anio}-${String(t.mes).padStart(2, '0')}`;
      const tt = totalizar(viajes.filter((v) => v.bus === t.bus && v.fecha.startsWith(pref)));
      const app = { montoIda: tt.montoIda, idaNeto: tt.idaNeto, montoLlegada: tt.montoRegistrado, netoFinal: tt.netoFinal };
      const cuadra = iguales(app.montoIda, t.montoIda) && iguales(app.montoLlegada, t.montoLlegada) && iguales(app.netoFinal, t.netoFinal)
        && (t.idaNeto === null || iguales(app.idaNeto, t.idaNeto));
      return { ...t, app, cuadra };
    })
    .filter((c) => c.cuadra === false || c.montoIda || c.montoLlegada || c.netoFinal || c.app.montoIda || c.app.montoLlegada);
}

export function importarLibro(datos: ArrayBuffer | Uint8Array): Importacion {
  const wb = read(datos, { type: 'array' });
  const problemas: Problema[] = [];
  const viajes = leerRegistro(wb, problemas);
  const facturas = leerFacturas(wb, problemas);
  const totalesExcel = leerResumen(wb);
  return { viajes, facturas, problemas, totalesExcel, comparacion: comparar(viajes, totalesExcel) };
}
