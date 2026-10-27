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
  foto?: string; // imagen reducida (data URL JPEG)
  creado: number;
  actualizado: number;
}

interface Config { clave: string; valor: unknown }

export type Tabla = 'viajes' | 'facturas';
// Cambio local que todavía no se subió a internet (también los borrados).
export interface Cambio { clave: string; tabla: Tabla; id: string; marca: number }

// Base de datos dentro del navegador (IndexedDB): funciona sin internet.
class BusesDB extends Dexie {
  viajes!: Table<Viaje, string>;
  facturas!: Table<Factura, string>;
  config!: Table<Config, string>;
  cambios!: Table<Cambio, string>;
  constructor() {
    super('control-buses');
    this.version(1).stores({ viajes: 'id, bus, fecha, [bus+fecha]' });
    this.version(2).stores({ facturas: 'id, fecha' });
    this.version(3).stores({ config: 'clave' });
    this.version(4).stores({ cambios: 'clave, tabla' });
  }
}

export const db = new BusesDB();

type ConId = { id: string };
const tabla = (t: Tabla) => db[t] as unknown as Table<ConId, string>;
const anotar = (t: Tabla, ids: string[]) => {
  const marca = Date.now();
  return db.cambios.bulkPut(ids.map((id) => ({ clave: `${t}:${id}`, tabla: t, id, marca })));
};

// Todo lo que la app guarda o borra pasa por aquí, para que luego se sincronice.
export async function guardar<T extends ConId>(t: Tabla, objs: T[]) {
  if (!objs.length) return;
  await db.transaction('rw', db[t], db.cambios, async () => {
    await tabla(t).bulkPut(objs);
    await anotar(t, objs.map((o) => o.id));
  });
  window.dispatchEvent(new Event('datos-cambiados'));
}

export async function eliminar(t: Tabla, ids: string[]) {
  if (!ids.length) return;
  await db.transaction('rw', db[t], db.cambios, async () => {
    await tabla(t).bulkDelete(ids);
    await anotar(t, ids);
  });
  window.dispatchEvent(new Event('datos-cambiados'));
}

// Marca todo lo local para subir (la primera vez que se entra con una cuenta).
export async function marcarTodoParaSubir() {
  await db.transaction('rw', db.viajes, db.facturas, db.cambios, async () => {
    await anotar('viajes', (await db.viajes.toCollection().primaryKeys()) as string[]);
    await anotar('facturas', (await db.facturas.toCollection().primaryKeys()) as string[]);
  });
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

export interface Respaldo { app: 'control-buses'; version: 1 | 2; fecha: string; viajes: Viaje[]; facturas?: Factura[] }

export async function crearRespaldo(): Promise<Respaldo> {
  return {
    app: 'control-buses', version: 2, fecha: new Date().toISOString(),
    viajes: await db.viajes.toArray(), facturas: await db.facturas.toArray(),
  };
}

export async function restaurarRespaldo(r: Respaldo, reemplazar: boolean) {
  if (r?.app !== 'control-buses' || !Array.isArray(r.viajes)) throw new Error('El archivo no es un respaldo de esta app.');
  const facturas = r.facturas ?? [];
  if (reemplazar) {
    // Se borra lo que no está en el respaldo (también en internet, al sincronizar).
    const quedan = (lista: ConId[]) => new Set(lista.map((x) => x.id));
    const v = quedan(r.viajes), f = quedan(facturas);
    await eliminar('viajes', ((await db.viajes.toCollection().primaryKeys()) as string[]).filter((id) => !v.has(id)));
    await eliminar('facturas', ((await db.facturas.toCollection().primaryKeys()) as string[]).filter((id) => !f.has(id)));
  }
  await guardar('viajes', r.viajes);
  await guardar('facturas', facturas);
}
