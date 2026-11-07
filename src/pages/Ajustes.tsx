import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { crearRespaldo, db, leerConfig, migrarDiesel, restaurarRespaldo, type Respaldo } from '../db';
import { TASA_IVA_POR_DEFECTO } from '../iva';
import { PanelCuenta } from '../Cuenta';
import { usePermisos } from '../sync';
import { hoyISO } from '../format';

export default function Ajustes() {
  const { puedeImportar } = usePermisos();
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
    setMensaje(`✔ Respaldo descargado con ${r.viajes.length} viajes, ${r.facturas?.length ?? 0} facturas y ${r.gastos?.length ?? 0} gastos del monto total.`);
  }

  async function exportar() {
    const [{ exportarTodo }, viajes, facturas, gastos, tasa] = await Promise.all([
      import('../exportar'), db.viajes.toArray(), db.facturas.toArray(), db.gastos.toArray(), leerConfig('tasaIVA', TASA_IVA_POR_DEFECTO),
    ]);
    exportarTodo(viajes, facturas, tasa, gastos);
    setMensaje(`✔ Excel descargado con ${viajes.length} viajes, ${facturas.length} facturas y ${gastos.length} gastos del monto total.`);
  }

  // Agregar es lo normal y no borra nada. Reemplazar borra para TODOS lo que no está en el respaldo:
  // hay que escribir REEMPLAZAR para confirmarlo.
  async function restaurar(archivo: File | undefined, modo: 'agregar' | 'reemplazar') {
    if (!archivo) return;
    try {
      const r = JSON.parse(await archivo.text()) as Respaldo;
      const cuantos = `${r.viajes?.length ?? 0} viajes, ${r.facturas?.length ?? 0} facturas y ${r.gastos?.length ?? 0} gastos`;
      const fecha = r.fecha ? new Date(r.fecha).toLocaleString('es-BO') : 'fecha desconocida';
      if (modo === 'agregar') {
        if (!confirm(`Respaldo del ${fecha} con ${cuantos}.\n\nSe AGREGAN a lo que ya hay (no se borra nada). Lo que tenga el mismo registro se reemplaza por lo del respaldo.\n\n¿Continuar?`)) return;
      } else {
        const ok = prompt(`⚠ PELIGRO — Respaldo del ${fecha} con ${cuantos}.\n\nSe BORRARÁ todo lo que no esté en el respaldo, en internet y en los equipos de TODAS las cuentas (también lo registrado después de esa fecha).\n\nPara confirmar escribe REEMPLAZAR:`);
        if (ok?.trim().toUpperCase() !== 'REEMPLAZAR') { setMensaje('No se restauró nada.'); return; }
      }
      const n = await restaurarRespaldo(r, modo);
      setMensaje(`✔ Respaldo ${modo === 'agregar' ? 'agregado' : 'restaurado'}: ${n.viajes} viajes, ${n.facturas} facturas y ${n.gastos} gastos.`);
    } catch (e) {
      setMensaje(`✖ No se pudo restaurar: ${(e as Error).message}`);
    }
  }

  return (
    <>
      <div className="encabezado"><h1>Cuenta y respaldo</h1></div>
      {mensaje && <div className="aviso" onClick={() => setMensaje('')}>{mensaje}</div>}

      <PanelCuenta />

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
        <div className="acciones fila">
          {puedeImportar && <a href="#/importar" className="boton primario">📥 Importar desde Excel</a>}
          <button type="button" className="boton" onClick={exportar}>📤 Exportar todo a Excel</button>
        </div>
        <p><small>El Excel exportado tiene las mismas columnas que tu hoja Registro (más los cálculos) y se puede volver a importar.</small></p>
      </section>

      {puedeImportar && <section className="panel">
        <h2>Diésel de los viajes</h2>
        <p>Pasa el diésel que quedó anotado en viajes antiguos a «gastos del monto total» de su mes y bus, y lo quita de los viajes. Repetirlo no duplica nada. Desde noviembre el diésel ya no se puede anotar en los viajes.</p>
        <button type="button" className="boton primario" onClick={async () => {
          if (!confirm('¿Pasar el diésel de todos los viajes a gastos del monto total? La «Llegada neto» de esos viajes subirá.')) return;
          const n = await migrarDiesel();
          alert(n ? `✔ Diésel pasado de ${n} viajes.` : 'No había diésel en los viajes.');
        }}>⛽ Pasar diésel a gastos del mes</button>
      </section>}

      <section className="panel">
        <h2>Copia de seguridad</h2>
        <p>Descarga una copia cada semana y guárdala en tu correo, Drive o una memoria USB. Si cambias de celular o se borra el navegador, la restauras aquí.</p>
        <div className="acciones fila">
          <button type="button" className="boton primario" onClick={descargar}>⬇ Descargar respaldo</button>
          {puedeImportar && <label className="boton">
            ⬆ Agregar desde un respaldo
            <input type="file" accept="application/json,.json" hidden onChange={(e) => { restaurar(e.target.files?.[0], 'agregar'); e.target.value = ''; }} />
          </label>}
          {puedeImportar && <label className="boton peligro">
            ⚠ Reemplazar todo con un respaldo
            <input type="file" accept="application/json,.json" hidden onChange={(e) => { restaurar(e.target.files?.[0], 'reemplazar'); e.target.value = ''; }} />
          </label>}
        </div>
        <p><small>El respaldo trae viajes, facturas (sin fotos) y gastos del monto total. «Agregar» no borra nada. «Reemplazar» borra para todos lo que no esté en el respaldo: úsalo solo si sabes lo que haces.</small></p>
      </section>

      <section className="panel">
        <h2>Instalar como aplicación</h2>
        <p><b>En el celular (Chrome):</b> menú ⋮ → «Instalar aplicación» o «Agregar a pantalla principal».</p>
        <p><b>En la computadora (Chrome o Edge):</b> el ícono de instalar ⊕ al final de la barra de direcciones.</p>
      </section>
    </>
  );
}
