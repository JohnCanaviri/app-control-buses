import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { crearRespaldo, db, restaurarRespaldo, type Respaldo } from '../db';
import { hoyISO } from '../format';

export default function Ajustes() {
  const total = useLiveQuery(() => db.viajes.count(), []);
  const facturas = useLiveQuery(() => db.facturas.count(), []);
  const [protegido, setProtegido] = useState<boolean | null>(null);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => { navigator.storage?.persisted?.().then(setProtegido).catch(() => setProtegido(false)); }, []);

  async function descargar() {
    const r = await crearRespaldo();
    const url = URL.createObjectURL(new Blob([JSON.stringify(r, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `respaldo-buses-${hoyISO()}.json`; a.click();
    URL.revokeObjectURL(url);
    setMensaje(`✔ Respaldo descargado con ${r.viajes.length} viajes y ${r.facturas?.length ?? 0} facturas.`);
  }

  async function restaurar(archivo: File | undefined) {
    if (!archivo) return;
    try {
      const r = JSON.parse(await archivo.text()) as Respaldo;
      const reemplazar = confirm(`El respaldo tiene ${r.viajes?.length ?? 0} viajes.\n\nAceptar = REEMPLAZAR todo lo que hay ahora.\nCancelar = AGREGAR sin borrar lo actual.`);
      await restaurarRespaldo(r, reemplazar);
      setMensaje(`✔ Respaldo restaurado (${r.viajes.length} viajes).`);
    } catch (e) {
      setMensaje(`✖ No se pudo restaurar: ${(e as Error).message}`);
    }
  }

  return (
    <>
      <div className="encabezado"><h1>Respaldo de datos</h1></div>
      {mensaje && <div className="aviso" onClick={() => setMensaje('')}>{mensaje}</div>}

      <section className="panel">
        <h2>Tus datos</h2>
        <p>Hay <b>{total ?? '…'}</b> viajes y <b>{facturas ?? '…'}</b> facturas guardados en este dispositivo. La app funciona sin internet: todo se guarda aquí mismo.</p>
        <p>
          Protección contra borrado del navegador:{' '}
          {protegido === null ? '…' : protegido ? <b className="verde-txt">activada</b> : <b className="naranja-txt">no disponible en este navegador</b>}
        </p>
      </section>

      <section className="panel">
        <h2>Traer datos de tu Excel</h2>
        <p>Pasa a la app los viajes y facturas de tu archivo control_buses.xlsx, comprobando que los totales cuadren.</p>
        <a href="#/importar" className="boton primario">📥 Importar desde Excel</a>
      </section>

      <section className="panel">
        <h2>Copia de seguridad</h2>
        <p>Descarga una copia cada semana y guárdala en tu correo, Drive o una memoria USB. Si cambias de celular o se borra el navegador, la restauras aquí.</p>
        <div className="acciones fila">
          <button type="button" className="boton primario" onClick={descargar}>⬇ Descargar respaldo</button>
          <label className="boton">
            ⬆ Restaurar respaldo
            <input type="file" accept="application/json,.json" hidden onChange={(e) => { restaurar(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Instalar como aplicación</h2>
        <p><b>En el celular (Chrome):</b> menú ⋮ → «Instalar aplicación» o «Agregar a pantalla principal».</p>
        <p><b>En la computadora (Chrome o Edge):</b> el ícono de instalar ⊕ al final de la barra de direcciones.</p>
      </section>
    </>
  );
}
