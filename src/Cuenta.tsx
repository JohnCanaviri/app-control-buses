import { useState } from 'react';
import { crearCuenta, entrar, salir, sincronizar, useSync } from './sync';

const hora = (t: number | null) => (t ? new Date(t).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '—');
const NOMBRE_ROL = { admin: 'administrador', empleado: 'empleado (registra y ve, no borra)', pendiente: 'esperando aprobación', rechazado: 'sin acceso' };

// Indicador pequeño para la barra de arriba.
export function EstadoNube() {
  const s = useSync();
  if (s.rol === 'admin' && s.solicitudes > 0) {
    return <a href="#/usuarios" className="estado medio" title="Cuentas esperando tu aprobación">🔔 {s.solicitudes} por aprobar</a>;
  }
  const texto = {
    'sin-cuenta': '☁ Sin cuenta',
    pendiente: '⏳ Esperando aprobación',
    rechazado: '⛔ Sin acceso',
    'sin-internet': `📴 Sin internet${s.pendientes ? ` · ${s.pendientes} por subir` : ''}`,
    sincronizando: '⏳ Sincronizando…',
    listo: s.pendientes ? `☁ ${s.pendientes} por subir` : '☁ Sincronizado',
    error: '⚠ Error al sincronizar',
  }[s.fase];
  const cls = s.fase === 'listo' ? 'on' : s.fase === 'sincronizando' || s.fase === 'pendiente' ? 'medio' : 'off';
  return <a href="#/ajustes" className={`estado ${cls}`} title={s.mensaje || 'Cuenta y sincronización'}>{texto}</a>;
}

// Sección «Cuenta y sincronización» de la pantalla Cuenta.
export function PanelCuenta() {
  const s = useSync();
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function hacer(f: () => Promise<void>) {
    setOcupado(true); setMsg('');
    try { await f(); } catch (e) { setMsg(`✖ ${(e as Error).message}`); } finally { setOcupado(false); }
  }

  if (s.correo && (s.fase === 'pendiente' || s.fase === 'rechazado')) {
    return (
      <section className="panel borde-naranja">
        <h2>Cuenta</h2>
        {s.fase === 'pendiente'
          ? <p>⏳ Tu cuenta <b>{s.correo}</b> está <b>esperando que el administrador la apruebe</b>. Cuando lo haga, los datos de la empresa aparecerán solos (no hace falta cerrar la app).</p>
          : <p>⛔ El administrador <b>no aprobó</b> la cuenta <b>{s.correo}</b> o le quitó el acceso. Si crees que es un error, habla con él.</p>}
        <div className="acciones fila">
          <button type="button" className="boton" onClick={() => sincronizar()}>🔄 Volver a revisar</button>
          <button type="button" className="boton suave" onClick={() => hacer(salir)}>Cerrar sesión</button>
        </div>
      </section>
    );
  }

  if (s.correo) {
    return (
      <section className="panel borde-verde">
        <h2>Cuenta y sincronización</h2>
        <p>Entraste como <b>{s.correo}</b>{s.rol && <> · <b>{NOMBRE_ROL[s.rol]}</b></>}. Todas las cuentas aprobadas comparten los mismos viajes y facturas.</p>
        <p>
          Estado: <b>{{ 'sin-cuenta': '—', pendiente: '—', rechazado: '—', 'sin-internet': 'sin internet (se subirá al volver la conexión)', sincronizando: 'sincronizando…', listo: 'al día', error: 'error' }[s.fase]}</b>
          {' · '}Cambios por subir: <b>{s.pendientes}</b>{' · '}Última vez: <b>{hora(s.ultima)}</b>
        </p>
        {s.fase === 'error' && <div className="aviso error">No se pudo sincronizar: {s.mensaje}</div>}
        <div className="acciones fila">
          <button type="button" className="boton primario" disabled={s.fase === 'sincronizando'} onClick={() => sincronizar()}>🔄 Sincronizar ahora</button>
          {s.rol === 'admin' && <a href="#/usuarios" className="boton">👥 Usuarios{s.solicitudes ? ` (${s.solicitudes} por aprobar)` : ''}</a>}
          <button type="button" className="boton suave" onClick={() => hacer(salir)}>Cerrar sesión</button>
        </div>
        <p><small>Al cerrar sesión, los datos se quedan en este equipo; lo que no se haya subido se sube cuando vuelvas a entrar.</small></p>
      </section>
    );
  }

  return (
    <section className="panel borde-azul">
      <h2>Cuenta y sincronización</h2>
      <p>Entra con tu cuenta para tener <b>los mismos datos en el celular y en la computadora</b>. Sin cuenta, la app funciona igual, pero los datos se quedan solo en este equipo.</p>
      <div className="botones" style={{ marginBottom: 8 }}>
        <button type="button" className={modo === 'entrar' ? 'sel' : ''} onClick={() => { setModo('entrar'); setMsg(''); }}>Ya tengo cuenta</button>
        <button type="button" className={modo === 'crear' ? 'sel' : ''} onClick={() => { setModo('crear'); setMsg(''); }}>Pedir una cuenta</button>
      </div>
      {msg && <div className={`aviso ${msg.startsWith('✔') ? '' : 'error'}`}>{msg}</div>}
      <form onSubmit={(e) => {
        e.preventDefault();
        if (modo === 'entrar') hacer(async () => { await entrar(correo.trim(), clave); setMsg('✔ Listo, entraste.'); });
        else hacer(async () => {
          const confirmar = await crearCuenta(nombre.trim(), correo.trim(), clave);
          setMsg(confirmar
            ? '✔ Solicitud enviada. 1) Abre el correo que te llegó y pulsa el enlace para confirmarlo. 2) Espera a que el administrador apruebe tu cuenta. Luego entra con «Ya tengo cuenta».'
            : '✔ Solicitud enviada. Espera a que el administrador apruebe tu cuenta.');
        });
      }}>
        {modo === 'crear' && <><label>Tu nombre</label><input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Para que el administrador sepa quién eres" /></>}
        <div className="fila-campos">
          <div><label>Correo</label><input type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required /></div>
          <div><label>Contraseña</label><input type="password" autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} value={clave} onChange={(e) => setClave(e.target.value)} required minLength={6} /></div>
        </div>
        <div className="acciones fila">
          <button type="submit" className="boton primario" disabled={ocupado}>{modo === 'entrar' ? 'Entrar' : 'Enviar solicitud'}</button>
        </div>
      </form>
      {modo === 'crear' && <p><small>Tu cuenta quedará en espera hasta que el administrador la apruebe.</small></p>}
    </section>
  );
}
