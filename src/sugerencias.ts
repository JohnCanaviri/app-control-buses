import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

// Sin mayúsculas ni tildes: «cbba» encuentra «Cbba», «diesel» encuentra «Diésel».
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Cuenta cuántas veces se usó cada texto (la forma escrita más reciente gana).
export function contar(textos: string[]): Map<string, { texto: string; veces: number }> {
  const m = new Map<string, { texto: string; veces: number }>();
  for (const t of textos) {
    const limpio = t?.trim();
    if (!limpio) continue;
    const k = normalizar(limpio);
    const e = m.get(k);
    m.set(k, { texto: limpio, veces: (e?.veces ?? 0) + 1 });
  }
  return m;
}

// Primero lo que empieza igual, luego lo que lo contiene; dentro de cada grupo, lo más usado.
export function filtrar(lista: { texto: string; veces: number }[], escrito: string, max = 8): string[] {
  const q = normalizar(escrito);
  if (!q) return lista.slice().sort((a, b) => b.veces - a.veces).slice(0, max).map((x) => x.texto);
  const puntaje = (t: string) => {
    const n = normalizar(t);
    if (n === q) return -1; // ya está escrito completo: no hace falta sugerirlo
    if (n.startsWith(q)) return 2;
    if (n.split(/[\s/,.-]+/).some((p) => p.startsWith(q))) return 1;
    return n.includes(q) ? 0 : -1;
  };
  return lista
    .map((x) => ({ ...x, p: puntaje(x.texto) }))
    .filter((x) => x.p >= 0)
    .sort((a, b) => b.p - a.p || b.veces - a.veces || a.texto.localeCompare(b.texto))
    .slice(0, max)
    .map((x) => x.texto);
}

export type Fuente = 'destinos' | 'proveedores' | 'conceptosFactura' | 'conceptosGasto' | 'categoriasGasto';

// Lee de la base de datos local los textos ya usados, para sugerirlos al escribir.
async function leer(f: Fuente): Promise<string[]> {
  switch (f) {
    case 'destinos': return (await db.viajes.toArray()).map((v) => v.destino);
    case 'proveedores': return (await db.facturas.toArray()).map((x) => x.proveedor);
    case 'conceptosFactura': return (await db.facturas.toArray()).map((x) => x.concepto);
    case 'conceptosGasto': return (await db.viajes.toArray()).flatMap((v) => [...v.gastos, ...v.otrosGastos].map((g) => g.concepto));
    case 'categoriasGasto': return (await db.gastos.toArray()).map((g) => g.categoria);
  }
}

export function useSugerencias(f: Fuente, extra: string[] = []) {
  return useLiveQuery(async () => [...contar([...extra, ...(await leer(f))]).values()], [f, extra.join('|')]) ?? [];
}
