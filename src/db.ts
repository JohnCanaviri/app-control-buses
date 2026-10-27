import Dexie, { type Table } from 'dexie';
import type { Viaje } from './calc';

// Base de datos dentro del navegador (IndexedDB): funciona sin internet.
class BusesDB extends Dexie {
  viajes!: Table<Viaje, string>;
  constructor() {
    super('control-buses');
    this.version(1).stores({ viajes: 'id, bus, fecha, [bus+fecha]' });
  }
}

export const db = new BusesDB();
export const BUSES = ['TDS', 'PIN', 'PKS'];

// Pide al navegador que no borre los datos aunque falte espacio.
export async function protegerDatos(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* sin soporte */ }
  return false;
}

export interface Respaldo { app: 'control-buses'; version: 1; fecha: string; viajes: Viaje[] }

export async function crearRespaldo(): Promise<Respaldo> {
  return { app: 'control-buses', version: 1, fecha: new Date().toISOString(), viajes: await db.viajes.toArray() };
}

export async function restaurarRespaldo(r: Respaldo, reemplazar: boolean) {
  if (r?.app !== 'control-buses' || !Array.isArray(r.viajes)) throw new Error('El archivo no es un respaldo de esta app.');
  await db.transaction('rw', db.viajes, async () => {
    if (reemplazar) await db.viajes.clear();
    await db.viajes.bulkPut(r.viajes);
  });
}
