// Sincronización: la app siempre guarda primero en el dispositivo (funciona sin internet);
// cuando hay internet y una cuenta abierta, sube los cambios pendientes y baja los de otros equipos.
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { db, guardarConfig, leerConfig, marcarTodoParaSubir, type Cambio, type Factura, type Tabla } from './db';
import type { Viaje } from './calc';
import { supabase } from './nube';

export type Fase = 'sin-cuenta' | 'sin-internet' | 'sincronizando' | 'listo' | 'error';
export interface EstadoSync { fase: Fase; mensaje: string; pendientes: number; ultima: number | null; correo: string | null }

const TABLAS: Tabla[] = ['viajes', 'facturas'];
const TANDA = 200;

let estado: EstadoSync = { fase: 'sin-cuenta', mensaje: '', pendientes: 0, ultima: null, correo: null };
const oyentes = new Set<(e: EstadoSync) => void>();
function poner(cambio: Partial<EstadoSync>) {
  estado = { ...estado, ...cambio };
  oyentes.forEach((f) => f(estado));
}

export function useSync() {
  const [e, setE] = useState(estado);
  useEffect(() => { oyentes.add(setE); setE(estado); return () => { oyentes.delete(setE); }; }, []);
  return e;
}

let sesion: Session | null = null;
let corriendo = false;
let otraVez = false;

async function subir(usuario: string) {
  const cambios = await db.cambios.toArray();
  for (const t of TABLAS) {
    const deEsta = cambios.filter((c) => c.tabla === t);
    for (let i = 0; i < deEsta.length; i += TANDA) {
      const tanda = deEsta.slice(i, i + TANDA);
      const locales = await (db[t] as typeof db.viajes | typeof db.facturas).bulkGet(tanda.map((c) => c.id));
      const filas = tanda.map((c, j) => {
        const obj = locales[j] as Viaje | Factura | undefined;
        return { user_id: usuario, id: c.id, datos: obj ?? null, borrado: !obj, actualizado: obj?.actualizado ?? Date.now() };
      });
      const { error } = await supabase.from(t).upsert(filas, { onConflict: 'user_id,id' });
      if (error) throw new Error(error.message);
      // Solo se quitan los cambios que no se volvieron a tocar mientras se subían.
      await db.transaction('rw', db.cambios, async () => {
        for (const c of tanda) {
          const ahora = await db.cambios.get(c.clave);
          if (ahora && ahora.marca === c.marca) await db.cambios.delete(c.clave);
        }
      });
    }
  }
}

interface Fila { id: string; datos: (Viaje | Factura) | null; borrado: boolean; modificado: string }

async function bajar() {
  for (const t of TABLAS) {
    const claveDesde = `bajada:${t}`;
    let desde = await leerConfig<string>(claveDesde, '1970-01-01T00:00:00Z');
    // Pequeño margen hacia atrás por si dos cambios llegaron casi al mismo tiempo.
    const margen = new Date(new Date(desde).getTime() - 5000).toISOString();
    for (let pagina = 0; ; pagina++) {
      const { data, error } = await supabase.from(t).select('id,datos,borrado,modificado')
        .gt('modificado', margen).order('modificado').range(pagina * 1000, pagina * 1000 + 999);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as Fila[];
      if (!filas.length) break;
      const pendientes = new Set((await db.cambios.where('tabla').equals(t).toArray()).map((c: Cambio) => c.id));
      const tablaLocal = db[t] as typeof db.viajes | typeof db.facturas;
      await db.transaction('rw', tablaLocal, async () => {
        for (const f of filas) {
          if (pendientes.has(f.id)) continue; // lo local cambió y aún no se subió: gana lo local
          if (f.borrado || !f.datos) { await tablaLocal.delete(f.id); continue; }
          const local = await tablaLocal.get(f.id);
          if (!local || local.actualizado <= f.datos.actualizado) await (tablaLocal as typeof db.viajes).put(f.datos as Viaje);
        }
      });
      desde = filas[filas.length - 1].modificado;
      if (filas.length < 1000) break;
    }
    await guardarConfig(claveDesde, desde);
  }
}

export async function sincronizar() {
  if (corriendo) { otraVez = true; return; }
  const pendientes = await db.cambios.count();
  if (!sesion) { poner({ fase: 'sin-cuenta', pendientes, correo: null }); return; }
  if (!navigator.onLine) { poner({ fase: 'sin-internet', pendientes }); return; }
  corriendo = true;
  poner({ fase: 'sincronizando', pendientes });
  try {
    await subir(sesion.user.id);
    await bajar();
    poner({ fase: 'listo', mensaje: '', pendientes: await db.cambios.count(), ultima: Date.now() });
  } catch (e) {
    const msg = (e as Error).message;
    poner({ fase: navigator.onLine ? 'error' : 'sin-internet', mensaje: msg, pendientes: await db.cambios.count() });
  } finally {
    corriendo = false;
    if (otraVez) { otraVez = false; setTimeout(sincronizar, 500); }
  }
}

let espera: ReturnType<typeof setTimeout> | undefined;
const pronto = (ms = 1500) => { clearTimeout(espera); espera = setTimeout(sincronizar, ms); };

async function alEntrar(s: Session) {
  // La primera vez que esta cuenta entra en este equipo, se sube todo lo que ya había aquí.
  const clave = `subidaInicial:${s.user.id}`;
  if (!(await leerConfig(clave, false))) {
    await marcarTodoParaSubir();
    await guardarConfig(clave, true);
  }
}

export function iniciarSync() {
  supabase.auth.onAuthStateChange((_evento, s) => {
    const nueva = s && (!sesion || sesion.user.id !== s.user.id);
    sesion = s;
    poner({ correo: s?.user.email ?? null });
    if (nueva) alEntrar(s!).then(() => pronto(100));
    else pronto(100);
  });
  window.addEventListener('datos-cambiados', () => { db.cambios.count().then((n) => poner({ pendientes: n })); pronto(); });
  window.addEventListener('online', () => pronto(300));
  window.addEventListener('offline', () => poner({ fase: sesion ? 'sin-internet' : 'sin-cuenta' }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pronto(300); });
  setInterval(() => { if (document.visibilityState === 'visible') sincronizar(); }, 60_000);
}

// --- Cuenta ---
export async function entrar(correo: string, clave: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  if (error) throw new Error(traducir(error.message));
}

export async function salir() {
  await supabase.auth.signOut();
}

function traducir(m: string) {
  if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'Todavía no confirmaste tu correo: abre el mensaje que te llegó y pulsa el enlace.';
  if (/rate limit/i.test(m)) return 'Demasiados intentos seguidos. Espera unos minutos.';
  if (/fetch/i.test(m)) return 'No hay conexión con internet.';
  return m;
}
