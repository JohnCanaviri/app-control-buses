// IVA del mes (todos los buses juntos), igual que la hoja «Facturas» del Excel:
// débito = tasa × (ida neto + llegada normal); crédito = tasa × total de facturas.
import { r2, totalizar, type Viaje } from './calc';
import type { Factura } from './db';

export const TASA_IVA_POR_DEFECTO = 0.13;

export interface IVA {
  idaNeto: number;
  llegada: number;
  ventas: number;
  ivaIda: number;
  ivaLlegada: number;
  debito: number;
  cantidadFacturas: number;
  facturas: number;
  credito: number;
  diferencia: number;
  aPagar: number;
  saldoFavor: number;
}

export function calcularIVA(viajes: Viaje[], facturas: Factura[], tasa: number): IVA {
  const t = totalizar(viajes);
  const totalFacturas = r2(facturas.reduce((s, f) => s + f.monto, 0));
  const ivaIda = r2(t.idaNeto * tasa), ivaLlegada = r2(t.montoRegistrado * tasa);
  const debito = r2(ivaIda + ivaLlegada), credito = r2(totalFacturas * tasa);
  const diferencia = r2(debito - credito);
  return {
    idaNeto: t.idaNeto, llegada: t.montoRegistrado, ventas: r2(t.idaNeto + t.montoRegistrado),
    ivaIda, ivaLlegada, debito,
    cantidadFacturas: facturas.length, facturas: totalFacturas, credito,
    diferencia, aPagar: Math.max(diferencia, 0), saldoFavor: Math.max(-diferencia, 0),
  };
}

// --- QR de las facturas de Bolivia ---
// Computarizada: «NIT|N° factura|N° autorización|dd/mm/aaaa|total|importe base CF|código de control|NIT comprador|…»
// Electrónica (SIAT): «https://siat.impuestos.gob.bo/consulta/QR?nit=…&cuf=…&numero=…&t=…» (no trae fecha ni monto)
export interface DatosQR { nit?: string; numero?: string; autorizacion?: string; fecha?: string; monto?: number; cuf?: string; tipo: 'computarizada' | 'electronica' | 'desconocido' }

export function leerQRFactura(texto: string): DatosQR {
  const s = texto.trim();
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const p = (k: string) => u.searchParams.get(k) ?? undefined;
      if (p('nit') || p('cuf')) return { tipo: 'electronica', nit: p('nit'), numero: p('numero'), cuf: p('cuf') };
    } catch { /* no es una dirección válida */ }
    return { tipo: 'desconocido' };
  }
  const c = s.split('|').map((x) => x.trim());
  if (c.length >= 5 && /^\d+$/.test(c[0])) {
    const f = c[3].match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    const monto = Number(c[4].replace(',', '.'));
    return {
      tipo: 'computarizada', nit: c[0], numero: c[1], autorizacion: c[2],
      fecha: f ? `${f[3]}-${f[2].padStart(2, '0')}-${f[1].padStart(2, '0')}` : undefined,
      monto: Number.isFinite(monto) ? monto : undefined,
    };
  }
  return { tipo: 'desconocido' };
}

// --- Texto leído de la foto (OCR): se buscan los datos más probables ---
const MESES_TXT = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dos = (n: number | string) => String(n).padStart(2, '0');

// El OCR confunde letras con números dentro de cifras: «1O5» → «105», «8.4OO,00» → «8.400,00», «l2» → «12».
function corregirCifras(t: string) {
  // Se repite porque cada cambio puede dejar al lado otra letra que ahora sí está entre cifras («8.4OO» → «8.40O» → «8.400»).
  for (let i = 0; i < 6; i++) {
    const n = t.replace(/(?<=[\d.,])[Oo](?=[\d.,Oo]|\b)|(?<=\b)[Oo](?=[\d.,])/g, '0')
      .replace(/(?<=\d)[lI|](?=\d)|(?<=\b)[lI|](?=\d{2,})/g, '1');
    if (n === t) break;
    t = n;
  }
  return t;
}

function fechaDeTexto(t: string): string | undefined {
  const valida = (a: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 && a >= 2000 && a <= 2100 ? `${a}-${dos(m)}-${dos(d)}` : undefined);
  // «05 de noviembre de 2026», «5 NOV 2026»
  const larga = t.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóú]{3,10})\.?\s*(?:de(?:l)?\s+)?(\d{4})/i);
  if (larga) {
    const m = MESES_TXT.findIndex((x) => larga[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').startsWith(x.slice(0, 3)));
    if (m >= 0) { const f = valida(Number(larga[3]), m + 1, Number(larga[1])); if (f) return f; }
  }
  const iso = t.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (iso) { const f = valida(Number(iso[1]), Number(iso[2]), Number(iso[3])); if (f) return f; }
  for (const m of t.matchAll(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g)) {
    const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const f = valida(anio, Number(m[2]), Number(m[1]));
    if (f) return f;
  }
  return undefined;
}

// «1.234,50», «1,234.50», «350.00», «8.400» → número.
function aNum(x: string): number {
  const s = x.replace(/\s/g, '');
  const ult = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  // Si el último separador tiene 1 o 2 cifras después, es el decimal; si tiene 3, es de miles.
  if (ult >= 0 && s.length - ult - 1 <= 2) return Number(s.slice(0, ult).replace(/[.,]/g, '') + '.' + s.slice(ult + 1));
  return Number(s.replace(/[.,]/g, ''));
}

export function datosDeTexto(texto: string): Partial<DatosQR> {
  const t = corregirCifras(texto.replace(/\r/g, ''));
  const lineas = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const res: Partial<DatosQR> = {};

  // NIT del que vende: el primero que no sea del cliente («NIT/CI», «NIT CLIENTE»).
  const nits = [...t.matchAll(/N\.?\s*I\.?\s*T\.?(\s*\/\s*C\.?\s*I\.?[^\d\n]*)?\s*(?:CLIENTE|COMPRADOR)?[^\d\n]{0,6}(\d{6,13})/gi)];
  const delVendedor = nits.find((m) => !m[1] && !/cliente|comprador/i.test(m[0])) ?? nits[0];
  if (delVendedor) res.nit = delVendedor[2];

  // «FACTURA N° 123», «FACTURA Nro. 123», «N° DE FACTURA 123», «Nro. Factura: 123» (el OCR lee «°» de muchas formas).
  const num = t.match(/FACTURA\s*(?:N[^\s\d]{0,3}|NUMERO|NÚMERO)?\s*[:.]?\s*(\d{1,10})/i)
    ?? t.match(/N[^\s\d]{0,3}\s*(?:DE\s*)?FACTURA\s*[:.]?\s*(\d{1,10})/i);
  if (num) res.numero = num[1];

  const fecha = fechaDeTexto(t);
  if (fecha) res.fecha = fecha;

  // El total: en una línea con TOTAL / IMPORTE / A PAGAR. No sirven el subtotal, descuentos, la base del
  // crédito fiscal, el IVA, ni lo que se pagó en efectivo o el cambio (que pueden ser mayores que el total).
  const NO = /SUB\s*TOTAL|DESCUENTO|BASE|CR[EÉ]DITO|I\.?V\.?A|CAMBIO|EFECTIVO|RECIBIDO|PAGADO|VUELTO|LITROS|PRECIO\s*UNIT/i;
  const montos = (l: string, conEnteros: boolean) => [...l.matchAll(conEnteros ? /\d{1,3}(?:[.,\s]?\d{3})*(?:[.,]\d{1,2})?/g : /\d{1,3}(?:[.,]?\d{3})*[.,]\d{2}\b/g)]
    .map((m) => aNum(m[0])).filter((n) => n > 0 && n < 10_000_000);
  const fuertes = lineas.filter((l) => /TOTAL\s*(A\s*PAGAR|Bs|BOB|:)|IMPORTE\s*TOTAL|TOTAL\s*$|^\s*TOTAL\b|A\s*PAGAR/i.test(l) && !NO.test(l));
  const candidatos = fuertes.flatMap((l) => montos(l, true));
  const todos = candidatos.length ? candidatos : lineas.filter((l) => !NO.test(l)).flatMap((l) => montos(l, false));
  if (todos.length) res.monto = Math.max(...todos);
  return res;
}

// --- Factura repetida: la misma factura escaneada dos veces contaría su crédito fiscal dos veces ---
const nitDe = (proveedor: string) => proveedor.match(/\d{6,13}/)?.[0] ?? '';

// ¿Ya está registrada esta factura? (misma factura escaneada dos veces = crédito fiscal contado dos veces)
export function facturaRepetida(f: { id: string; fecha: string; numero: string; proveedor: string; monto: number }, otras: Factura[]): Factura | undefined {
  const nit = nitDe(f.proveedor);
  return otras.find((o) => o.id !== f.id && (
    f.numero && o.numero === f.numero && (nit ? nitDe(o.proveedor) === nit : o.proveedor.trim().toLowerCase() === f.proveedor.trim().toLowerCase())
  ));
}
