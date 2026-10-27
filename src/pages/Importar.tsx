import { useState } from 'react';
import { db } from '../db';
import type { Importacion } from '../importar';
import { bs, MESES } from '../format';
import { Tarjeta } from '../components';

export default function Importar() {
  const [nombre, setNombre] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [datos, setDatos] = useState<Importacion | null>(null);
  const [existentes, setExistentes] = useState(0);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState('');

  async function leer(archivo: File | undefined) {
    if (!archivo) return;
    setNombre(archivo.name); setDatos(null); setError(''); setHecho(''); setLeyendo(true);
    try {
      // El lector de Excel se carga solo cuando hace falta, para que la app abra rápido.
      const { importarLibro } = await import('../importar');
      const r = importarLibro(new Uint8Array(await archivo.arrayBuffer()));
      const ya = await db.viajes.bulkGet(r.viajes.map((v) => v.id));
      setExistentes(ya.filter(Boolean).length);
      setDatos(r);
      if (!r.viajes.length && !r.facturas.length) setError('No encontré viajes ni facturas en ese archivo.');
    } catch (e) {
      setError(`No se pudo leer el archivo: ${(e as Error).message}`);
    } finally {
      setLeyendo(false);
    }
  }

  async function importar() {
    if (!datos) return;
    await db.transaction('rw', db.viajes, db.facturas, async () => {
      await db.viajes.bulkPut(datos.viajes);
      await db.facturas.bulkPut(datos.facturas);
    });
    setHecho(`✔ Se importaron ${datos.viajes.length} viajes y ${datos.facturas.length} facturas.`);
    setDatos(null);
  }

  const malos = datos?.comparacion.filter((c) => !c.cuadra).length ?? 0;
  const conIdaNeto = datos?.comparacion.some((c) => c.idaNeto !== null);

  return (
    <>
      <div className="encabezado"><h1>Importar desde Excel</h1></div>
      {hecho && (
        <div className="aviso">
          {hecho} <a href="#/consulta">Ver en Consulta ›</a>
        </div>
      )}

      <section className="panel">
        <h2>1. Elige tu archivo de Excel</h2>
        <p>Sirve <b>control_buses.xlsx</b> o cualquiera de sus versiones (con descuento, mejorado, con facturas). Se leen las hojas <b>Registro</b> (viajes) y <b>Facturas</b>, y se comparan los totales con la hoja <b>Resumen</b> del Excel.</p>
        <label className="boton primario archivo">
          📂 {nombre ? 'Elegir otro archivo' : 'Elegir archivo .xlsx'}
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden
            onChange={(e) => { leer(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {nombre && <p><small>Archivo: {nombre}</small></p>}
        {leyendo && <p>Leyendo…</p>}
        {error && <div className="aviso error">{error}</div>}
      </section>

      {datos && (datos.viajes.length > 0 || datos.facturas.length > 0) && (
        <>
          <section className="tarjetas">
            <Tarjeta titulo="Viajes encontrados" valor={datos.viajes.length} nota={existentes ? `${existentes} ya estaban: se actualizarán` : 'Todos son nuevos'} />
            <Tarjeta titulo="Facturas" valor={datos.facturas.length} color="naranja" />
            <Tarjeta titulo="Avisos" valor={datos.problemas.length} color={datos.problemas.length ? 'naranja' : 'verde'} nota={datos.problemas.length ? 'Revisa la lista abajo' : 'Sin problemas'} />
            <Tarjeta titulo="Meses que cuadran" valor={`${datos.comparacion.length - malos} de ${datos.comparacion.length}`} color={malos ? 'naranja' : 'verde'} />
          </section>

          <section className="panel">
            <h2>2. Comprobación: la app contra tu Excel</h2>
            {datos.comparacion.length === 0
              ? <p className="vacio">El archivo no tiene hoja Resumen para comparar; igual puedes importar.</p>
              : (
                <div className="tabla-wrap">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Bus</th><th>Mes</th>
                        <th>Monto ida<br /><small>App / Excel</small></th>
                        {conIdaNeto && <th>Ida neto<br /><small>App / Excel</small></th>}
                        <th>Llegada<br /><small>App / Excel</small></th>
                        <th>Neto final<br /><small>App / Excel</small></th>
                        <th>Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.comparacion.map((c) => (
                        <tr key={`${c.bus}-${c.anio}-${c.mes}`}>
                          <td><b>{c.bus}</b></td>
                          <td>{MESES[c.mes - 1]} {c.anio}</td>
                          <td className="num">{bs(c.app.montoIda)} / {bs(c.montoIda)}</td>
                          {conIdaNeto && <td className="num">{bs(c.app.idaNeto)} / {bs(c.idaNeto)}</td>}
                          <td className="num">{bs(c.app.montoLlegada)} / {bs(c.montoLlegada)}</td>
                          <td className="num">{bs(c.app.netoFinal)} / {bs(c.netoFinal)}</td>
                          <td>{c.cuadra ? <span className="insignia ok">CUADRA</span> : <span className="insignia mal">NO CUADRA</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            {malos > 0 && <p className="naranja-txt">Algún mes no cuadra. Suele ser por una celda con formato raro en el Excel (mira los avisos). Puedes importar igual y corregir el viaje en la app.</p>}
          </section>

          {datos.problemas.length > 0 && (
            <section className="panel">
              <h2>Avisos</h2>
              <ul className="avisos">
                {datos.problemas.map((p, i) => <li key={i}><b>{p.hoja}, fila {p.fila}:</b> {p.mensaje}</li>)}
              </ul>
            </section>
          )}

          <section className="panel">
            <h2>3. Importar</h2>
            <p>Si vuelves a importar el mismo Excel, los viajes no se duplican: se actualizan.{existentes > 0 && <b> Si cambiaste en la app alguno de esos {existentes} viajes, se reemplazará por lo que dice el Excel.</b>}</p>
            <button type="button" className="boton primario" onClick={importar}>
              ⬇ Importar {datos.viajes.length} viajes y {datos.facturas.length} facturas
            </button>
          </section>
        </>
      )}
    </>
  );
}
