import { useEffect, useState } from 'react';
import { cambiarRol, listarPerfiles, useSync, type Perfil, type Rol } from '../sync';

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: '2-digit' });
const ROL: Record<Rol, string> = { admin: 'Administrador', empleado: 'Empleado', pendiente: 'Esperando', rechazado: 'Sin acceso' };

export default function Usuarios() {
  const s = useSync();
  const [perfiles, setPerfiles] = useState<Perfil[] | null>(null);
  const [msg, setMsg] = useState('');

  const cargar = () => listarPerfiles().then(setPerfiles).catch((e) => setMsg(`✖ ${(e as Error).message}`));
  useEffect(() => { if (s.rol === 'admin') cargar(); }, [s.rol, s.solicitudes]);

  if (s.rol !== 'admin') {
    return <section className="panel"><h1>Usuarios</h1><p className="vacio">Solo el administrador puede ver y aprobar cuentas.</p></section>;
  }

  async function poner(p: Perfil, rol: Rol, texto: string) {
    if (rol === 'rechazado' && p.rol === 'empleado' && !confirm(`¿Quitarle el acceso a ${p.nombre || p.correo}?`)) return;
    try {
      await cambiarRol(p.user_id, rol);
      setMsg(`✔ ${p.nombre || p.correo}: ${texto}.`);
      await cargar();
    } catch (e) {
      setMsg(`✖ ${(e as Error).message}`);
    }
  }

  const grupos: { titulo: string; filtro: (p: Perfil) => boolean; vacio: string }[] = [
    { titulo: '🔔 Esperando tu aprobación', filtro: (p) => p.rol === 'pendiente', vacio: 'No hay solicitudes nuevas.' },
    { titulo: '✅ Con acceso', filtro: (p) => p.rol === 'admin' || p.rol === 'empleado', vacio: '' },
    { titulo: '⛔ Sin acceso', filtro: (p) => p.rol === 'rechazado', vacio: 'Nadie.' },
  ];

  return (
    <>
      <div className="encabezado"><h1>Usuarios</h1></div>
      <p>Cualquiera puede pedir una cuenta desde la app, pero <b>no ve ni toca nada hasta que tú la apruebes</b>. Los empleados registran, editan y ven todo; <b>no pueden borrar, importar ni aprobar</b>.</p>
      {msg && <div className={`aviso ${msg.startsWith('✔') ? '' : 'error'}`} onClick={() => setMsg('')}>{msg}</div>}
      {!perfiles && <p className="vacio">Cargando…</p>}
      {perfiles && grupos.map((g) => {
        const lista = perfiles.filter(g.filtro);
        return (
          <section className="panel" key={g.titulo}>
            <h2>{g.titulo} ({lista.length})</h2>
            {lista.length === 0 && g.vacio && <p className="vacio">{g.vacio}</p>}
            <div className="lista">
              {lista.map((p) => (
                <div className="fila-usuario" key={p.user_id}>
                  <div>
                    <b>{p.nombre || '(sin nombre)'}</b>
                    <div><small>{p.correo} · pidió el {fecha(p.creado)} · {ROL[p.rol]}</small></div>
                  </div>
                  <div className="acciones fila">
                    {p.rol === 'admin' ? <span className="insignia ok">Tú (administrador)</span> : <>
                      {p.rol !== 'empleado' && <button type="button" className="boton primario" onClick={() => poner(p, 'empleado', 'aprobado')}>✔ Aprobar</button>}
                      {p.rol !== 'rechazado' && <button type="button" className="boton peligro" onClick={() => poner(p, 'rechazado', p.rol === 'pendiente' ? 'rechazado' : 'acceso quitado')}>{p.rol === 'pendiente' ? '✖ Rechazar' : 'Quitar acceso'}</button>}
                    </>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
