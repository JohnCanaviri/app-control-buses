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
export function datosDeTexto(texto: string): Partial<DatosQR> {
  const t = texto.replace(/\r/g, '');
  const res: Partial<DatosQR> = {};
  const nit = t.match(/N\.?\s*I\.?\s*T\.?\s*[:.]?\s*(\d{6,13})/i);
  if (nit) res.nit = nit[1];
  // «FACTURA N° 123», «FACTURA Nro. 123», «FACTURA No 123» (el OCR lee «°» de muchas formas) o «N° DE FACTURA 123».
  const num = t.match(/FACTURA\s*(?:N[^\s\d]{0,3}|NUMERO|NÚMERO)?\s*[:.]?\s*(\d{1,10})/i) ?? t.match(/N[^\s\d]{0,3}\s*(?:DE\s*)?FACTURA\s*[:.]?\s*(\d{1,10})/i);
  if (num) res.numero = num[1];
  const fecha = t.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (fecha) res.fecha = `${fecha[3]}-${fecha[2].padStart(2, '0')}-${fecha[1].padStart(2, '0')}`;
  // El total suele estar en una línea con «TOTAL»; si no, el monto más grande con centavos.
  const aNum = (x: string) => Number(x.replace(/\.(?=\d{3}(\D|$))/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  const lineasTotal = t.split('\n').filter((l) => /TOTAL|IMPORTE|A PAGAR/i.test(l) && !/SUB\s*TOTAL|DESCUENTO/i.test(l));
  const montos = (ls: string[]) => ls.flatMap((l) => [...l.matchAll(/\d{1,3}(?:[.,]?\d{3})*[.,]\d{2}\b/g)].map((m) => aNum(m[0]))).filter((n) => n > 0);
  const candidatos = montos(lineasTotal);
  const todos = candidatos.length ? candidatos : montos(t.split('\n'));
  if (todos.length) res.monto = Math.max(...todos);
  return res;
}
