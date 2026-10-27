import { salir, sincronizar, useSync } from './sync';

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
    listo: s.pendientes ? `☁ ${s.pendientes} por subir` : '☁ Al día',
    error: '⚠ Error al sincronizar',
  }[s.fase];
  const cls = s.fase === 'listo' ? 'on' : s.fase === 'sincronizando' ? 'medio' : 'off';
  return <a href="#/ajustes" className={`estado ${cls}`} title={s.mensaje || 'Cuenta y sincronización'}>{texto}</a>;
}

// Sección «Tu cuenta» de la pantalla Cuenta.
export function PanelCuenta() {
  const s = useSync();
  return (
    <section className="panel borde-verde">
      <h2>Tu cuenta</h2>
      <p>
        {s.nombre && <><b>{s.nombre}</b> · </>}{s.correo}{s.rol && <> · <b>{NOMBRE_ROL[s.rol]}</b></>}
      </p>
      <p>
        Sincronización: <b>{{ 'sin-cuenta': '—', pendiente: '—', rechazado: '—', 'sin-internet': 'sin internet (se subirá al volver la conexión)', sincronizando: 'sincronizando…', listo: 'al día', error: 'error' }[s.fase]}</b>
        {' · '}Por subir: <b>{s.pendientes}</b>{' · '}Última vez: <b>{hora(s.ultima)}</b>
      </p>
      {s.fase === 'error' && <div className="aviso error">No se pudo sincronizar: {s.mensaje}</div>}
      <div className="acciones fila">
        <button type="button" className="boton primario" disabled={s.fase === 'sincronizando'} onClick={() => sincronizar()}>🔄 Sincronizar ahora</button>
        {s.rol === 'admin' && <a href="#/usuarios" className="boton">👥 Usuarios{s.solicitudes ? ` (${s.solicitudes} por aprobar)` : ''}</a>}
        <button type="button" className="boton suave" onClick={() => { if (confirm('¿Cerrar sesión en este equipo?')) salir(); }}>Cerrar sesión</button>
      </div>
      <p><small>Todas las cuentas aprobadas comparten los mismos viajes y facturas. Al cerrar sesión, los datos se quedan en este equipo.</small></p>
    </section>
  );
}
