const nf = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfEntero = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 });

export const bs = (n: number | null | undefined) => (n === null || n === undefined ? '-' : nf.format(n));
export const entero = (n: number) => nfEntero.format(n);

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const fechaCorta = (iso: string) => (iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(2, 4)}` : '');
export const diaSemana = (iso: string) => DIAS[new Date(`${iso}T12:00:00`).getDay()];

// Rango de fechas (texto aaaa-mm-dd) de un mes, para consultar la base.
export function rangoMes(anio: number, mes: number): [string, string] {
  const m = String(mes).padStart(2, '0');
  return [`${anio}-${m}-01`, `${anio}-${m}-31`];
}

// Convierte lo escrito en un campo a número (acepta coma decimal). Vacío = 0.
export function aNumero(s: string): number {
  const n = Number(String(s).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function uid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
