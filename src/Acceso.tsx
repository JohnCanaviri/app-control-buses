// Pantallas que se ven antes de entrar a la app: iniciar sesión, pedir cuenta,
// recuperar la contraseña y esperar la aprobación del administrador.
import { useState, type ReactNode } from 'react';
import { cambiarClave, crearCuenta, entrar, recuperarClave, salir, sincronizar, useSync } from './sync';

const ICONO = `${import.meta.env.BASE_URL}icon.svg`;

function Marco({ children }: { children: ReactNode }) {
  return (
    <div className="acceso">
      <div className="acceso-caja">
        <div className="acceso-marca">
          <img src={ICONO} alt="" />
          <h1>Control de Buses</h1>
          <p>Boletos, gastos, facturas e IVA</p>
        </div>
        {children}
        <div className="acceso-talon" aria-hidden="true">
          <span>Válido: TDS · PIN · PKS</span>
          <span>N° {String(new Date().getFullYear()).slice(2)}-{String(new Date().getMonth() + 1).padStart(2, '0')}-0001</span>
        </div>
      </div>
    </div>
  );
}

function useAccion() {
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function hacer(f: () => Promise<string | void>) {
    setOcupado(true); setMsg('');
    try { const ok = await f(); if (ok) setMsg(ok); } catch (e) { setMsg(`✖ ${(e as Error).message}`); } finally { setOcupado(false); }
  }
  const aviso = msg && <div className={`aviso ${msg.startsWith('✔') ? '' : 'error'}`}>{msg}</div>;
  return { hacer, ocupado, aviso, setMsg };
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <Marco><p className="acceso-centro">⏳ {texto}</p></Marco>;
}

export function PantallaLogin() {
  const [modo, setModo] = useState<'entrar' | 'crear' | 'olvide'>('entrar');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const { hacer, ocupado, aviso, setMsg } = useAccion();
  const cambiar = (m: typeof modo) => { setModo(m); setMsg(''); };

  function enviar() {
    const c = correo.trim();
    if (modo === 'entrar') hacer(() => entrar(c, clave));
    else if (modo === 'crear') {
      hacer(async () => (await crearCuenta(nombre.trim(), c, clave))
        ? '✔ Solicitud enviada. 1) Abre el correo que te llegó y pulsa el enlace para confirmarlo. 2) Cuando el administrador te apruebe, entra aquí con tu correo y contraseña.'
        : '✔ Solicitud enviada. Cuando el administrador te apruebe, entra con tu correo y contraseña.');
    } else hacer(async () => { await recuperarClave(c); return '✔ Te enviamos un correo con un enlace para poner una contraseña nueva.'; });
  }

  return (
    <Marco>
      {modo !== 'olvide' && (
        <div className="pestanas">
          <button type="button" className={modo === 'entrar' ? 'sel' : ''} onClick={() => cambiar('entrar')}>Iniciar sesión</button>
          <button type="button" className={modo === 'crear' ? 'sel' : ''} onClick={() => cambiar('crear')}>Pedir una cuenta</button>
        </div>
      )}
      {modo === 'olvide' && <h2>Recuperar contraseña</h2>}
      {aviso}
      <form onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        {modo === 'crear' && <>
          <label>Tu nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Para que el administrador sepa quién eres" />
        </>}
        <label>Correo</label>
        <input type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
        {modo !== 'olvide' && <>
          <label>Contraseña</label>
          <input type="password" autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} value={clave}
            onChange={(e) => setClave(e.target.value)} required minLength={6} />
        </>}
        <button type="submit" className="boton primario ancho" disabled={ocupado}>
          {ocupado ? '⏳ …' : modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Enviar solicitud' : 'Enviar enlace'}
        </button>
      </form>
      {modo === 'entrar' && <button type="button" className="enlace" onClick={() => cambiar('olvide')}>¿Olvidaste tu contraseña?</button>}
      {modo === 'crear' && <p className="acceso-nota">Tu cuenta quedará en espera hasta que el administrador la apruebe.</p>}
      {modo === 'olvide' && <button type="button" className="enlace" onClick={() => cambiar('entrar')}>‹ Volver a iniciar sesión</button>}
    </Marco>
  );
}

export function PantallaEspera() {
  const s = useSync();
  const { hacer, ocupado } = useAccion();
  return (
    <Marco>
      {s.rol === 'rechazado'
        ? <p>⛔ El administrador <b>no aprobó</b> la cuenta <b>{s.correo}</b> o le quitó el acceso. Si crees que es un error, habla con él.</p>
        : <p>⏳ Hola{s.nombre ? `, ${s.nombre}` : ''}. Tu cuenta <b>{s.correo}</b> está <b>esperando que el administrador la apruebe</b>. Cuando lo haga, esta pantalla se abrirá sola.</p>}
      {s.rol === null && s.fase === 'sin-internet' && <div className="aviso error">Sin internet: conéctate para comprobar tu cuenta.</div>}
      <button type="button" className="boton primario ancho" disabled={ocupado} onClick={() => hacer(sincronizar)}>🔄 Volver a revisar</button>
      <button type="button" className="enlace" onClick={() => hacer(salir)}>Cerrar sesión</button>
    </Marco>
  );
}

export function PantallaNuevaClave() {
  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const { hacer, ocupado, aviso, setMsg } = useAccion();
  return (
    <Marco>
      <h2>Nueva contraseña</h2>
      {aviso}
      <form onSubmit={(e) => {
        e.preventDefault();
        if (clave !== repetir) { setMsg('✖ Las dos contraseñas no son iguales.'); return; }
        hacer(() => cambiarClave(clave));
      }}>
        <label>Contraseña nueva</label>
        <input type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} required minLength={6} />
        <label>Repítela</label>
        <input type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required minLength={6} />
        <button type="submit" className="boton primario ancho" disabled={ocupado}>Guardar contraseña</button>
      </form>
    </Marco>
  );
}
