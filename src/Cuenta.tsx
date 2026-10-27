import { useState } from 'react';
import { crearCuenta, entrar, salir, sincronizar, useSync } from './sync';

const hora = (t: number | null) => (t ? new Date(t).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '—');

// Indicador pequeño para la barra de arriba.
export function EstadoNube() {
  const s = useSync();
  const texto = {
    'sin-cuenta': '☁ Sin cuenta',
    'sin-internet': `📴 Sin internet${s.pendientes ? ` · ${s.pendientes} por subir` : ''}`,
    sincronizando: '⏳ Sincronizando…',
    listo: s.pendientes ? `☁ ${s.pendientes} por subir` : '☁ Sincronizado',
    error: '⚠ Error al sincronizar',
  }[s.fase];
  const cls = s.fase === 'listo' ? 'on' : s.fase === 'sincronizando' ? 'medio' : 'off';
  return <a href="#/ajustes" className={`estado ${cls}`} title={s.mensaje || 'Cuenta y sincronización'}>{texto}</a>;
}

// Sección «Cuenta y sincronización» de la pantalla Respaldo.
export function PanelCuenta() {
  const s = useSync();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function hacer(f: () => Promise<void>) {
    setOcupado(true); setMsg('');
    try { await f(); } catch (e) { setMsg(`✖ ${(e as Error).message}`); } finally { setOcupado(false); }
  }

  if (s.correo) {
    return (
      <section className="panel borde-verde">
        <h2>Cuenta y sincronización</h2>
        <p>Entraste como <b>{s.correo}</b>. Lo que anotes aquí aparece en tus otros equipos (celular y computadora) donde entres con la misma cuenta.</p>
        <p>
          Estado: <b>{{ 'sin-cuenta': '—', 'sin-internet': 'sin internet (se subirá al volver la conexión)', sincronizando: 'sincronizando…', listo: 'al día', error: 'error' }[s.fase]}</b>
          {' · '}Cambios por subir: <b>{s.pendientes}</b>{' · '}Última vez: <b>{hora(s.ultima)}</b>
        </p>
        {s.fase === 'error' && <div className="aviso error">No se pudo sincronizar: {s.mensaje}</div>}
        <div className="acciones fila">
          <button type="button" className="boton primario" disabled={s.fase === 'sincronizando'} onClick={() => sincronizar()}>🔄 Sincronizar ahora</button>
          <button type="button" className="boton" onClick={() => hacer(salir)}>Cerrar sesión</button>
        </div>
        <p><small>Al cerrar sesión, los datos se quedan en este equipo; lo que no se haya subido se sube cuando vuelvas a entrar.</small></p>
      </section>
    );
  }

  return (
    <section className="panel borde-azul">
      <h2>Cuenta y sincronización</h2>
      <p>Entra con tu cuenta para tener <b>los mismos datos en el celular y en la computadora</b>. Sin cuenta, la app funciona igual, pero los datos se quedan solo en este equipo.</p>
      {msg && <div className={`aviso ${msg.startsWith('✔') ? '' : 'error'}`}>{msg}</div>}
      <form onSubmit={(e) => { e.preventDefault(); hacer(async () => { await entrar(correo.trim(), clave); setMsg('✔ Listo, entraste.'); }); }}>
        <div className="fila-campos">
          <div><label>Correo</label><input type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required /></div>
          <div><label>Contraseña</label><input type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required minLength={6} /></div>
        </div>
        <div className="acciones fila">
          <button type="submit" className="boton primario" disabled={ocupado}>Entrar</button>
          <button type="button" className="boton" disabled={ocupado || !correo || clave.length < 6}
            onClick={() => hacer(async () => {
              const confirmar = await crearCuenta(correo.trim(), clave);
              setMsg(confirmar
                ? '✔ Cuenta creada. Te llegó un correo de Supabase: ábrelo y pulsa el enlace para confirmarla. Después vuelve aquí y pulsa «Entrar».'
                : '✔ Cuenta creada y sesión iniciada.');
            })}>Crear cuenta (solo la primera vez)</button>
        </div>
      </form>
    </section>
  );
}
