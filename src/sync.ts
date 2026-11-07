// Sincronización: la app siempre guarda primero en el dispositivo (funciona sin internet);
// cuando hay internet y una cuenta abierta, sube los cambios pendientes y baja los de otros equipos.
// Regla: lo que está en internet es lo que vale. Solo gana lo local mientras tenga un cambio sin subir.
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  anotar, borrarDatosLocales, borrarFotosViejas, db, guardarConfig, leerConfig, marcarTodoParaSubir, ponerPermisos, sinFoto,
  type Cambio, type Factura, type Tabla,
} from './db';
import type { Viaje } from './calc';
import { supabase } from './nube';
import { hoyISO } from './format';

export type Fase = 'sin-cuenta' | 'pendiente' | 'rechazado' | 'sin-internet' | 'sincronizando' | 'listo' | 'error';
export type Rol = 'pendiente' | 'empleado' | 'admin' | 'observador' | 'rechazado';
export interface EstadoSync {
  fase: Fase; mensaje: string; pendientes: number; ultima: number | null;
  sesionLista: boolean; // ya se sabe si hay una sesión guardada en este equipo
  correo: string | null;
  nombre: string | null;
  rol: Rol | null; // null = todavía no se sabe (o no hay sesión)
  solicitudes: number; // cuentas esperando aprobación (solo lo ve el administrador)
  recuperar: boolean; // se entró con el enlace de «olvidé mi contraseña»
  aviso: string; // algo que la persona debe saber de la última sincronización
}

const TABLAS: Tabla[] = ['viajes', 'facturas', 'gastos'];
const TANDA = 200;

let estado: EstadoSync = {
  fase: 'sin-cuenta', mensaje: '', pendientes: 0, ultima: null,
  sesionLista: false, correo: null, nombre: null, rol: null, solicitudes: 0, recuperar: false, aviso: '',
};

// El último rol conocido se guarda en el equipo: así la app abre sin internet.
const claveRol = (usuario: string) => `perfil:${usuario}`;
function rolGuardado(usuario: string): { rol: Rol | null; nombre: string | null } {
  try { return JSON.parse(localStorage.getItem(claveRol(usuario)) ?? '') ?? { rol: null, nombre: null }; } catch { return { rol: null, nombre: null }; }
}
const oyentes = new Set<(e: EstadoSync) => void>();
function poner(cambio: Partial<EstadoSync>) {
  estado = { ...estado, ...cambio };
  ponerPermisos({ soloLectura: estado.rol === 'observador', puedeBorrar: estado.rol === 'admin' });
  oyentes.forEach((f) => f(estado));
}

export function useSync() {
  const [e, setE] = useState(estado);
  useEffect(() => { oyentes.add(setE); setE(estado); return () => { oyentes.delete(setE); }; }, []);
  return e;
}

let sesion: Session | null = null;
let enCurso: Promise<void> | null = null;
let otraVez = false;

// Un error de conexión (se reintenta luego) no es lo mismo que una fila que el servidor no acepta.
const esDeRed = (m: string) => /fetch|network|timeout|load failed|conexi/i.test(m);
const faltaTabla = (m: string) => /does not exist|could not find the table|schema cache/i.test(m);
type TablaLocal = typeof db.viajes | typeof db.facturas | typeof db.gastos;
const local = (t: Tabla) => db[t] as unknown as TablaLocal;

// Las fotos de facturas nunca suben a internet.
const paraSubir = (t: Tabla, obj: unknown) => (t === 'facturas' && obj ? sinFoto(obj as Factura) : obj);

async function subir(): Promise<number> {
  let rechazados = 0;
  const cambios = await db.cambios.toArray();
  for (const t of TABLAS) {
    const deEsta = cambios.filter((c) => c.tabla === t);
    for (let i = 0; i < deEsta.length; i += TANDA) {
      const tanda = deEsta.slice(i, i + TANDA);
      const locales = await local(t).bulkGet(tanda.map((c) => c.id));
      const filas = tanda.map((c, j) => {
        const obj = locales[j] as Viaje | Factura | undefined;
        // Los datos son de toda la empresa: «user_id» (quién lo creó) lo pone el servidor la primera vez.
        return { id: c.id, datos: paraSubir(t, obj) ?? null, borrado: !obj, actualizado: obj?.actualizado ?? Date.now() };
      });
      const malos: Cambio[] = [];
      const { error } = await supabase.from(t).upsert(filas, { onConflict: 'id' });
      if (error) {
        if (esDeRed(error.message)) throw new Error(error.message);
        // Una fila que el servidor no acepta (p. ej. sin permiso) no debe trabar a las demás: se prueban de una en una.
        for (let k = 0; k < filas.length; k++) {
          const { error: e } = await supabase.from(t).upsert([filas[k]], { onConflict: 'id' });
          if (e) { if (esDeRed(e.message)) throw new Error(e.message); malos.push(tanda[k]); }
        }
      }
      // Lo rechazado se deja como está en internet.
      const enInternet = new Map<string, Fila>();
      if (malos.length) {
        const { data, error: e } = await supabase.from(t).select('id,datos,borrado,modificado').in('id', malos.map((c) => c.id));
        if (e) throw new Error(e.message);
        for (const f of (data ?? []) as Fila[]) enInternet.set(f.id, f);
      }
      // Solo se quitan los cambios que no se volvieron a tocar mientras se subían.
      await db.transaction('rw', db.cambios, local(t), async () => {
        for (const c of tanda) {
          const ahora = await db.cambios.get(c.clave);
          if (!ahora || ahora.marca !== c.marca) continue;
          await db.cambios.delete(c.clave);
          if (malos.includes(c)) {
            rechazados++;
            const f = enInternet.get(c.id);
            if (!f || f.borrado || !f.datos) await local(t).delete(c.id);
            else await (local(t) as typeof db.viajes).put(f.datos as Viaje);
          }
        }
      });
    }
  }
  return rechazados;
}

interface Fila { id: string; datos: (Viaje | Factura) | null; borrado: boolean; modificado: string }

async function bajar(puedeEditar: boolean) {
  const hoy = hoyISO();
  for (const t of TABLAS) {
    const claveDesde = `bajada:${t}`;
    let desde = await leerConfig<string>(claveDesde, '1970-01-01T00:00:00Z');
    // Pequeño margen hacia atrás por si dos cambios llegaron casi al mismo tiempo.
    const margen = new Date(new Date(desde).getTime() - 5000).toISOString();
    const conFotoEnInternet: string[] = [];
    for (let pagina = 0; ; pagina++) {
      // Se ordena también por id: una tanda subida junta tiene la misma hora y sin esto se podían saltar filas.
      const { data, error } = await supabase.from(t).select('id,datos,borrado,modificado')
        .gt('modificado', margen).order('modificado').order('id').range(pagina * 1000, pagina * 1000 + 999);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as Fila[];
      if (!filas.length) break;
      const tablaLocal = local(t);
      await db.transaction('rw', tablaLocal, db.cambios, async () => {
        const pendientes = new Set((await db.cambios.where('tabla').equals(t).toArray()).map((c: Cambio) => c.id));
        for (const f of filas) {
          if (pendientes.has(f.id)) continue; // lo local cambió y aún no se subió: se sube en la próxima vuelta
          if (f.borrado || !f.datos) { await tablaLocal.delete(f.id); continue; }
          let datos = f.datos;
          if (t === 'facturas') {
            const fac = datos as Factura;
            if (fac.foto) conFotoEnInternet.push(f.id);
            datos = sinFoto(fac);
            // La foto tomada hoy en este equipo se conserva hasta mañana.
            const antes = (await tablaLocal.get(f.id)) as Factura | undefined;
            if (antes?.foto && antes.fotoDia === hoy) datos = { ...datos, foto: antes.foto, fotoDia: antes.fotoDia } as Factura;
          }
          await (tablaLocal as typeof db.viajes).put(datos as Viaje);
        }
      });
      desde = filas[filas.length - 1].modificado;
      if (filas.length < 1000) break;
    }
    await guardarConfig(claveDesde, desde);
    // Fotos que se subieron con versiones anteriores de la app: se vuelven a subir sin la foto.
    if (puedeEditar && conFotoEnInternet.length) await anotar('facturas', conFotoEnInternet);
  }
}

// --- Ajustes compartidos por toda la empresa (por ahora: la tasa del IVA) ---
// Tabla «ajustes» de supabase/04_mejoras.sql. Si todavía no existe, la app sigue usando el valor de este equipo.
const CLAVES_COMPARTIDAS = ['tasaIVA'];
export async function guardarAjuste(clave: string, valor: unknown) {
  await guardarConfig(clave, valor);
  await guardarConfig(`ajustePendiente:${clave}`, true);
  window.dispatchEvent(new Event('ajustes-cambiados'));
  pronto();
}
async function sincronizarAjustes(esAdmin: boolean) {
  if (esAdmin) {
    for (const clave of CLAVES_COMPARTIDAS) {
      if (!(await leerConfig(`ajustePendiente:${clave}`, false))) continue;
      const { error } = await supabase.from('ajustes').upsert({ clave, valor: await leerConfig(clave, null) }, { onConflict: 'clave' });
      if (error) { if (faltaTabla(error.message)) return; throw new Error(error.message); }
      await guardarConfig(`ajustePendiente:${clave}`, false);
    }
  }
  const { data, error } = await supabase.from('ajustes').select('clave,valor');
  if (error) { if (faltaTabla(error.message)) return; throw new Error(error.message); }
  let cambio = false;
  for (const a of (data ?? []) as { clave: string; valor: unknown }[]) {
    if (!CLAVES_COMPARTIDAS.includes(a.clave) || (await leerConfig(`ajustePendiente:${a.clave}`, false))) continue;
    if (JSON.stringify(await leerConfig(a.clave, null)) !== JSON.stringify(a.valor)) { await guardarConfig(a.clave, a.valor); cambio = true; }
  }
  if (cambio) window.dispatchEvent(new Event('ajustes-cambiados'));
}

export function sincronizar(): Promise<void> {
  if (enCurso) { otraVez = true; return enCurso; }
  enCurso = sincronizarAhora().finally(() => {
    enCurso = null;
    if (otraVez) { otraVez = false; setTimeout(sincronizar, 500); }
  });
  return enCurso;
}

async function sincronizarAhora() {
  await borrarFotosViejas(hoyISO());
  const pendientes = await db.cambios.count();
  if (!sesion) { poner({ fase: 'sin-cuenta', pendientes, correo: null, rol: null, solicitudes: 0 }); return; }
  if (!navigator.onLine) { poner({ fase: 'sin-internet', pendientes }); return; }
  poner({ fase: 'sincronizando', pendientes });
  try {
    // El rol se vuelve a leer cada vez: así una cuenta pendiente se activa sola cuando la apruebas.
    const rol = await leerRol(sesion.user.id);
    if (rol !== 'admin' && rol !== 'empleado' && rol !== 'observador') {
      poner({ fase: rol === 'rechazado' ? 'rechazado' : 'pendiente', rol, mensaje: '' });
      return;
    }
    poner({ rol });
    const puedeEditar = rol !== 'observador';
    let rechazados = 0;
    if (puedeEditar) rechazados = await subir();
    await bajar(puedeEditar);
    if (puedeEditar && (await db.cambios.count())) rechazados += await subir(); // fotos viejas quitadas de internet
    await sincronizarAjustes(rol === 'admin');
    if (rol === 'admin') {
      const { count } = await supabase.from('perfiles').select('user_id', { count: 'exact', head: true }).eq('rol', 'pendiente');
      poner({ solicitudes: count ?? 0 });
    }
    poner({
      fase: 'listo', mensaje: '', pendientes: await db.cambios.count(), ultima: Date.now(),
      ...(rechazados ? { aviso: `${rechazados} cambio(s) no se aceptaron en internet (tu cuenta no tiene permiso para eso) y se dejó lo que había allí.` } : {}),
    });
  } catch (e) {
    const msg = (e as Error).message;
    poner({ fase: navigator.onLine ? 'error' : 'sin-internet', mensaje: msg, pendientes: await db.cambios.count() });
  }
}

export const quitarAviso = () => poner({ aviso: '' });

async function leerRol(usuario: string): Promise<Rol> {
  const { data, error } = await supabase.from('perfiles').select('rol,nombre').eq('user_id', usuario).maybeSingle();
  if (error) throw new Error(error.message);
  const rol = (data?.rol as Rol | undefined) ?? 'pendiente';
  const nombre = (data?.nombre as string | null | undefined) ?? null;
  try { localStorage.setItem(claveRol(usuario), JSON.stringify({ rol, nombre })); } catch { /* sin almacenamiento */ }
  poner({ rol, nombre });
  return rol;
}

let espera: ReturnType<typeof setTimeout> | undefined;
const pronto = (ms = 1500) => { clearTimeout(espera); espera = setTimeout(sincronizar, ms); };

async function alEntrar(s: Session) {
  // Solo se sube lo que había en el equipo si nunca se usó con una cuenta (datos de antes de la nube).
  // Si ya se usó, lo que hay aquí vino de internet o son cambios pendientes, que ya están anotados para subir.
  const claves = (await db.config.toCollection().primaryKeys()) as string[];
  const usadoConCuenta = claves.some((k) => k === 'dueno' || k.startsWith('subidaInicial:') || k.startsWith('bajada:'));
  if (!usadoConCuenta) await marcarTodoParaSubir();
  await guardarConfig('dueno', s.user.id);
  await guardarConfig(`subidaInicial:${s.user.id}`, true);
}

export function iniciarSync() {
  supabase.auth.onAuthStateChange((evento, s) => {
    // Al abrir la app (o volver a ella) tras mucho tiempo sin usarla, hay que entrar de nuevo
    // (sin internet no: no se podría volver a entrar y la app quedaría inservible en el camino).
    if (s && evento === 'INITIAL_SESSION' && sesionVencida() && navigator.onLine) { setTimeout(() => salir({ automatico: true }), 0); }
    if (s && evento === 'SIGNED_IN') marcarActividad();
    const nueva = s && (!sesion || sesion.user.id !== s.user.id);
    sesion = s;
    poner({
      sesionLista: true, correo: s?.user.email ?? null,
      ...(s ? (nueva ? rolGuardado(s.user.id) : {}) : { rol: null, nombre: null, solicitudes: 0, aviso: '' }),
      ...(evento === 'PASSWORD_RECOVERY' ? { recuperar: true } : {}),
    });
    if (nueva) alEntrar(s!).then(() => pronto(100));
    else pronto(100);
  });
  window.addEventListener('datos-cambiados', () => { db.cambios.count().then((n) => poner({ pendientes: n })); pronto(); });
  window.addEventListener('online', () => pronto(300));
  window.addEventListener('offline', () => poner({ fase: sesion ? 'sin-internet' : 'sin-cuenta' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (sesion && sesionVencida() && navigator.onLine) { salir({ automatico: true }); return; }
    pronto(300);
  });
  setInterval(() => { if (document.visibilityState === 'visible') sincronizar(); }, 60_000);
  borrarFotosViejas(hoyISO());
}

// --- Cuenta ---
export async function entrar(correo: string, clave: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  if (error) throw new Error(traducir(error.message));
}

// Pide una cuenta: queda «pendiente» hasta que el administrador la apruebe.
export async function crearCuenta(nombre: string, correo: string, clave: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email: correo, password: clave,
    options: { data: { nombre }, emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw new Error(traducir(error.message));
  return !data.session; // true = primero hay que confirmar el correo
}

// --- Administración de cuentas (solo el administrador; lo controla también el servidor) ---
export interface Perfil { user_id: string; correo: string | null; nombre: string | null; rol: Rol; creado: string }

export async function listarPerfiles(): Promise<Perfil[]> {
  const { data, error } = await supabase.from('perfiles').select('user_id,correo,nombre,rol,creado').order('creado');
  if (error) throw new Error(error.message);
  return data as Perfil[];
}

export async function cambiarRol(usuario: string, rol: Rol) {
  const { error } = await supabase.from('perfiles').update({ rol }).eq('user_id', usuario);
  if (error) throw new Error(error.message);
  pronto(100);
}

// «Olvidé mi contraseña»: llega un correo con un enlace que abre la app para poner una nueva.
export async function recuperarClave(correo: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(correo, { redirectTo: location.origin + location.pathname });
  if (error) throw new Error(traducir(error.message));
}

export async function cambiarClave(nueva: string) {
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) throw new Error(traducir(error.message));
  poner({ recuperar: false });
}

// Cierra la sesión si nadie usa la app durante este tiempo (solo con internet).
export const MINUTOS_INACTIVIDAD = 10;
const ULTIMA_ACTIVIDAD = 'ultima-actividad';
export function marcarActividad() {
  try { localStorage.setItem(ULTIMA_ACTIVIDAD, String(Date.now())); } catch { /* sin almacenamiento */ }
}
// true = pasó demasiado tiempo desde la última vez que se usó la app (aunque estuviera cerrada).
function sesionVencida() {
  try { const t = Number(localStorage.getItem(ULTIMA_ACTIVIDAD)); return !!t && Date.now() - t > MINUTOS_INACTIVIDAD * 60_000; } catch { return false; }
}

// Cerrar sesión: primero se sube lo pendiente; luego se borran de este equipo los datos de la empresa.
// Si algo no se pudo subir, los datos se quedan aquí (no se pierde nada) y se suben en la próxima entrada.
export async function salir(op: { automatico?: boolean } = {}) {
  if (sesion && navigator.onLine) { try { await sincronizar(); } catch { /* se intenta igual */ } }
  const pendientes = await db.cambios.count();
  if (pendientes && !op.automatico && !confirm(`Hay ${pendientes} cambio(s) que todavía no se subieron a internet.\n\nSi cierras sesión ahora se quedan guardados en este equipo y se subirán la próxima vez que alguien entre aquí.\n\n¿Cerrar sesión igual?`)) return;
  // «local»: cierra solo este equipo, no los otros celulares de la misma cuenta.
  await supabase.auth.signOut({ scope: 'local' });
  await borrarDatosLocales();
}

function traducir(m: string) {
  if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'Todavía no confirmaste tu correo: abre el mensaje que te llegó y pulsa el enlace.';
  if (/already registered/i.test(m)) return 'Ese correo ya tiene cuenta. Usa «Entrar».';
  if (/password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit/i.test(m)) return 'Demasiados intentos seguidos. Espera unos minutos.';
  if (/fetch/i.test(m)) return 'No hay conexión con internet.';
  return m;
}

// Qué puede hacer quien usa la app según su rol.
export function usePermisos() {
  const { rol } = useSync();
  const admin = rol === 'admin';
  return { puedeBorrar: admin, puedeImportar: admin, esAdmin: admin, puedeEditar: rol !== 'observador' };
}
