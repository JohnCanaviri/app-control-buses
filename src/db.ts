import Dexie, { type Table } from 'dexie';
import type { Viaje } from './calc';

export interface Factura {
  id: string;
  fecha: string; // aaaa-mm-dd
  numero: string;
  proveedor: string; // nombre y/o NIT
  concepto: string;
  monto: number;
  observaciones: string;
  foto?: string; // imagen reducida (data URL JPEG). Solo queda en este equipo y se borra al día siguiente.
  fotoDia?: string; // aaaa-mm-dd en que se tomó la foto
  creado: number;
  actualizado: number;
}

// Gasto tomado directamente del monto total (no es de un viaje). «bus» vacío = general.
export interface GastoGeneral {
  id: string;
  fecha: string; // aaaa-mm-dd
  bus: string;
  categoria: string; // p. ej. Diésel
  vueltas?: number; // diésel: cuántas vueltas (viajes) cubre, anotado a mano
  monto: number;
  observaciones: string;
  creado: number;
  actualizado: number;
}

interface Config { clave: string; valor: unknown }

export type Tabla = 'viajes' | 'facturas' | 'gastos';
// Cambio local que todavía no se subió a internet (también los borrados).
export interface Cambio { clave: string; tabla: Tabla; id: string; marca: number }

// Base de datos dentro del navegador (IndexedDB): funciona sin internet.
class BusesDB extends Dexie {
  viajes!: Table<Viaje, string>;
  facturas!: Table<Factura, string>;
  gastos!: Table<GastoGeneral, string>;
  config!: Table<Config, string>;
  cambios!: Table<Cambio, string>;
  constructor() {
    super('control-buses');
    this.version(1).stores({ viajes: 'id, bus, fecha, [bus+fecha]' });
    this.version(2).stores({ facturas: 'id, fecha' });
    this.version(3).stores({ config: 'clave' });
    this.version(4).stores({ cambios: 'clave, tabla' });
    this.version(5).stores({ gastos: 'id, fecha, bus' });
  }
}

export const db = new BusesDB();

type ConId = { id: string };
const tabla = (t: Tabla) => db[t] as unknown as Table<ConId, string>;
export const anotar = (t: Tabla, ids: string[]) => {
  const marca = Date.now();
  return db.cambios.bulkPut(ids.map((id) => ({ clave: `${t}:${id}`, tabla: t, id, marca })));
};

// Permisos según el rol (los pone sync.ts). El servidor también los controla.
let soloLectura = false;
let puedeBorrar = true;
export const ponerPermisos = (p: { soloLectura: boolean; puedeBorrar: boolean }) => { soloLectura = p.soloLectura; puedeBorrar = p.puedeBorrar; };
const revisar = () => { if (soloLectura) throw new Error('Tu cuenta es de solo lectura.'); };

// Todo lo que la app guarda o borra pasa por aquí, para que luego se sincronice.
export async function guardar<T extends ConId>(t: Tabla, objs: T[]) {
  if (!objs.length) return;
  revisar();
  await db.transaction('rw', db[t], db.cambios, async () => {
    await tabla(t).bulkPut(objs);
    await anotar(t, objs.map((o) => o.id));
  });
  window.dispatchEvent(new Event('datos-cambiados'));
}

export async function eliminar(t: Tabla, ids: string[]) {
  if (!ids.length) return;
  revisar();
  if (!puedeBorrar) throw new Error('Solo el administrador puede borrar.');
  await db.transaction('rw', db[t], db.cambios, async () => {
    await tabla(t).bulkDelete(ids);
    await anotar(t, ids);
  });
  window.dispatchEvent(new Event('datos-cambiados'));
}

// Marca todo lo local para subir (la primera vez que se entra con una cuenta).
export async function marcarTodoParaSubir() {
  await db.transaction('rw', db.viajes, db.facturas, db.gastos, db.cambios, async () => {
    await anotar('viajes', (await db.viajes.toCollection().primaryKeys()) as string[]);
    await anotar('facturas', (await db.facturas.toCollection().primaryKeys()) as string[]);
    await anotar('gastos', (await db.gastos.toCollection().primaryKeys()) as string[]);
  });
}

// Pasa el diésel anotado en los viajes a «gastos del monto total» (una sola vez basta; repetirlo no duplica).
export async function migrarDiesel(): Promise<number> {
  const { separarDiesel } = await import('./diesel');
  const viajes: Viaje[] = [];
  const cargas: GastoGeneral[] = [];
  for (const v of await db.viajes.toArray()) {
    const r = separarDiesel(v);
    if (r) { viajes.push(r.viaje); cargas.push(...r.cargas); }
  }
  await guardar('gastos', cargas);
  await guardar('viajes', viajes);
  return viajes.length;
}

export async function leerConfig<T>(clave: string, porDefecto: T): Promise<T> {
  return ((await db.config.get(clave))?.valor as T) ?? porDefecto;
}
export const guardarConfig = (clave: string, valor: unknown) => db.config.put({ clave, valor });
export const BUSES = ['TDS', 'PIN', 'PKS'];

// Pide al navegador que no borre los datos aunque falte espacio.
export async function protegerDatos(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* sin soporte */ }
  return false;
}

export interface Respaldo {
  app: 'control-buses'; version: 1 | 2 | 3; fecha: string;
  viajes: Viaje[]; facturas?: Factura[]; gastos?: GastoGeneral[];
}

export async function crearRespaldo(): Promise<Respaldo> {
  return {
    app: 'control-buses', version: 3, fecha: new Date().toISOString(),
    viajes: await db.viajes.toArray(),
    facturas: (await db.facturas.toArray()).map(sinFoto),
    gastos: await db.gastos.toArray(),
  };
}

// AGREGAR: añade y actualiza, no borra nada. REEMPLAZAR: además borra lo que no está en el respaldo,
// también en internet y en los equipos de todos (solo el administrador, con confirmación escrita).
export async function restaurarRespaldo(r: Respaldo, modo: 'agregar' | 'reemplazar') {
  if (r?.app !== 'control-buses' || !Array.isArray(r.viajes)) throw new Error('El archivo no es un respaldo de esta app.');
  const facturas = r.facturas ?? [];
  const gastos = r.gastos ?? [];
  if (modo === 'reemplazar') {
    const quedan = (lista: ConId[]) => new Set(lista.map((x) => x.id));
    const v = quedan(r.viajes), f = quedan(facturas), g = quedan(gastos);
    await eliminar('viajes', ((await db.viajes.toCollection().primaryKeys()) as string[]).filter((id) => !v.has(id)));
    await eliminar('facturas', ((await db.facturas.toCollection().primaryKeys()) as string[]).filter((id) => !f.has(id)));
    // Los respaldos antiguos (versión 1 y 2) no traían gastos: en ese caso no se borra ninguno.
    if (r.gastos) await eliminar('gastos', ((await db.gastos.toCollection().primaryKeys()) as string[]).filter((id) => !g.has(id)));
  }
  // Lo restaurado pasa a ser lo más nuevo, para que llegue igual a todos los equipos.
  const ahora = Date.now();
  const marcar = <T extends { actualizado: number }>(l: T[]) => l.map((x) => ({ ...x, actualizado: ahora }));
  await guardar('viajes', marcar(r.viajes));
  await guardar('facturas', marcar(facturas.map(sinFoto)));
  await guardar('gastos', marcar(gastos));
  return { viajes: r.viajes.length, facturas: facturas.length, gastos: gastos.length };
}

export function sinFoto(f: Factura): Factura {
  if (!f.foto && !f.fotoDia) return f;
  const { foto: _f, fotoDia: _d, ...resto } = f;
  void _f; void _d;
  return resto;
}

// Las fotos de las facturas no se guardan: se borran del equipo a partir del día siguiente.
export async function borrarFotosViejas(hoy: string): Promise<number> {
  const viejas = (await db.facturas.toArray()).filter((f) => f.foto && (!f.fotoDia || f.fotoDia < hoy));
  if (viejas.length) await db.facturas.bulkPut(viejas.map(sinFoto)); // solo en este equipo: a internet nunca sube la foto
  return viejas.length;
}

// Al cerrar sesión se borran los datos de la empresa de este equipo (si ya se subió todo).
// Devuelve false si quedan cambios sin subir: en ese caso no se borra nada.
export async function borrarDatosLocales(): Promise<boolean> {
  if (await db.cambios.count()) return false;
  await db.transaction('rw', [db.viajes, db.facturas, db.gastos, db.cambios, db.config], async () => {
    await Promise.all([db.viajes.clear(), db.facturas.clear(), db.gastos.clear(), db.cambios.clear()]);
    const claves = (await db.config.toCollection().primaryKeys()) as string[];
    // Se olvida qué se bajó, para que al volver a entrar se baje todo de nuevo.
    await db.config.bulkDelete(claves.filter((k) => k.startsWith('bajada:')));
  });
  window.dispatchEvent(new Event('datos-cambiados'));
  return true;
}
