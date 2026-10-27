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
  creado: number;
  actualizado: number;
}

// Base de datos dentro del navegador (IndexedDB): funciona sin internet.
class BusesDB extends Dexie {
  viajes!: Table<Viaje, string>;
  facturas!: Table<Factura, string>;
  constructor() {
    super('control-buses');
    this.version(1).stores({ viajes: 'id, bus, fecha, [bus+fecha]' });
    this.version(2).stores({ facturas: 'id, fecha' });
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

export interface Respaldo { app: 'control-buses'; version: 1 | 2; fecha: string; viajes: Viaje[]; facturas?: Factura[] }

export async function crearRespaldo(): Promise<Respaldo> {
  return {
    app: 'control-buses', version: 2, fecha: new Date().toISOString(),
    viajes: await db.viajes.toArray(), facturas: await db.facturas.toArray(),
  };
}

export async function restaurarRespaldo(r: Respaldo, reemplazar: boolean) {
  if (r?.app !== 'control-buses' || !Array.isArray(r.viajes)) throw new Error('El archivo no es un respaldo de esta app.');
  await db.transaction('rw', db.viajes, db.facturas, async () => {
    if (reemplazar) { await db.viajes.clear(); await db.facturas.clear(); }
    await db.viajes.bulkPut(r.viajes);
    await db.facturas.bulkPut(r.facturas ?? []);
  });
}
