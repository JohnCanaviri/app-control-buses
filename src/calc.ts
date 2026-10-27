// Cálculos de un viaje: replican las fórmulas de la hoja «Cálculo» del Excel.

export interface Linea { cantidad: number; precio: number }
export interface Gasto { concepto: string; monto: number }

export interface Viaje {
  id: string;
  bus: string;
  fecha: string; // aaaa-mm-dd
  destino: string;
  horaSalida: string;
  horaLlegada: string;
  boletosIda: Linea[];
  descuentoIda: number; // se resta solo a la ida
  sinBoletoLlegada: boolean; // «Sin boleto»: el monto calculado se iguala al registrado
  boletosLlegada: Linea[];
  montoRegistrado: number; // monto que trajeron
  gastos: Gasto[];
  otrosGastos: Gasto[]; // p. ej. diésel; se restan después
  observaciones: string;
  creado: number;
  actualizado: number;
}

export type Verificacion = 'CONFORME' | 'FALTA BOLETOS' | 'DIFERENCIA' | '';

export interface Calculo {
  boletosIda: number;
  montoIda: number;
  descuentoIda: number;
  idaNeto: number;
  boletosLlegada: number;
  montoCalculadoLlegada: number | null; // null = no se anotó la llegada
  verificacion: Verificacion;
  montoRegistrado: number;
  totalGastos: number;
  totalMenosGastos: number;
  totalOtrosGastos: number;
  netoFinal: number;
}

export const r2 = (n: number) => Math.round(n * 100) / 100;
const cant = (ls: Linea[]) => ls.reduce((s, l) => s + l.cantidad, 0);
const monto = (ls: Linea[]) => r2(ls.reduce((s, l) => s + l.cantidad * l.precio, 0));
const suma = (gs: Gasto[]) => r2(gs.reduce((s, g) => s + g.monto, 0));

export function calcular(v: Viaje): Calculo {
  const montoIda = monto(v.boletosIda);
  const descuentoIda = r2(v.descuentoIda || 0);
  const hayLlegada = v.sinBoletoLlegada || v.boletosLlegada.length > 0;
  const montoCalculadoLlegada = !hayLlegada ? null : v.sinBoletoLlegada ? r2(v.montoRegistrado) : monto(v.boletosLlegada);

  let verificacion: Verificacion = '';
  if (montoCalculadoLlegada !== null) {
    if (montoCalculadoLlegada < v.montoRegistrado) verificacion = 'FALTA BOLETOS';
    else if (montoCalculadoLlegada === r2(v.montoRegistrado)) verificacion = 'CONFORME';
    else verificacion = 'DIFERENCIA';
  }

  const totalGastos = suma(v.gastos);
  const totalOtrosGastos = suma(v.otrosGastos);
  const totalMenosGastos = r2(v.montoRegistrado - totalGastos);
  return {
    boletosIda: cant(v.boletosIda),
    montoIda,
    descuentoIda,
    idaNeto: r2(montoIda - descuentoIda),
    boletosLlegada: v.sinBoletoLlegada ? 0 : cant(v.boletosLlegada),
    montoCalculadoLlegada,
    verificacion,
    montoRegistrado: r2(v.montoRegistrado),
    totalGastos,
    totalMenosGastos,
    totalOtrosGastos,
    netoFinal: r2(totalMenosGastos - totalOtrosGastos),
  };
}

export interface Totales {
  viajes: number;
  boletosIda: number;
  montoIda: number;
  descuentoIda: number;
  idaNeto: number;
  boletosLlegada: number;
  montoCalculadoLlegada: number;
  montoRegistrado: number;
  totalGastos: number;
  totalMenosGastos: number;
  totalOtrosGastos: number;
  netoFinal: number;
  faltaBoletos: number;
}

export function totalizar(viajes: Viaje[]): Totales {
  const t: Totales = {
    viajes: viajes.length, boletosIda: 0, montoIda: 0, descuentoIda: 0, idaNeto: 0, boletosLlegada: 0,
    montoCalculadoLlegada: 0, montoRegistrado: 0, totalGastos: 0, totalMenosGastos: 0, totalOtrosGastos: 0,
    netoFinal: 0, faltaBoletos: 0,
  };
  for (const v of viajes) {
    const c = calcular(v);
    t.boletosIda += c.boletosIda;
    t.montoIda += c.montoIda;
    t.descuentoIda += c.descuentoIda;
    t.idaNeto += c.idaNeto;
    t.boletosLlegada += c.boletosLlegada;
    t.montoCalculadoLlegada += c.montoCalculadoLlegada ?? 0;
    t.montoRegistrado += c.montoRegistrado;
    t.totalGastos += c.totalGastos;
    t.totalMenosGastos += c.totalMenosGastos;
    t.totalOtrosGastos += c.totalOtrosGastos;
    t.netoFinal += c.netoFinal;
    if (c.verificacion === 'FALTA BOLETOS') t.faltaBoletos++;
  }
  for (const k of Object.keys(t) as (keyof Totales)[]) t[k] = r2(t[k]);
  return t;
}

// --- Lectura del formato de texto del Excel («25x40; 3x50», «Peaje 50; Veatico 50») ---

const partes = (texto: string) =>
  texto.split(/[;\n+]/).map((p) => p.trim()).filter((p) => p !== '');

const numero = (s: string) => Number(s.replace(',', '.'));

export function leerBoletos(texto: string): { lineas: Linea[]; error: boolean } {
  const lineas: Linea[] = [];
  let error = false;
  for (const p of partes(texto.toLowerCase())) {
    const m = p.replace(/\s/g, '').match(/^(\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)$/);
    if (m) lineas.push({ cantidad: numero(m[1]), precio: numero(m[2]) });
    else error = true;
  }
  return { lineas, error };
}

export function leerGastos(texto: string): { gastos: Gasto[]; error: boolean } {
  const gastos: Gasto[] = [];
  let error = false;
  for (const p of partes(texto)) {
    const m = p.match(/^(.*?)\s*(-?\d+(?:[.,]\d+)?)$/);
    if (m) gastos.push({ concepto: m[1].trim(), monto: numero(m[2]) });
    else error = true;
  }
  return { gastos, error };
}
