import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES } from '../db';
import { bs, fechaCorta } from '../format';
import { ir, parametros, useRuta } from '../router';
import { SelectorBus, PestanasGastos } from '../components';

const TODOS = 'Todos';
const esMant = (concepto: string) => /mantenim/i.test(concepto);

// Registro de mantenimientos del año: sale de «Otros gastos» de los viajes y de los gastos del monto total.
export default function Mantenimientos() {
  const q = parametros(useRuta());
  const bus = q.get('bus') ?? TODOS;
  const anio = Number(q.get('anio')) || new Date().getFullYear();
  const cambiar = (b: string, a: number) => ir(`/mantenimientos?bus=${b}&anio=${a}`);

  const datos = useLiveQuery(async () => ({
    viajes: await db.viajes.where('fecha').between(`${anio}-01-01`, `${anio}-12-31`, true, true).toArray(),
    generales: await db.gastos.where('fecha').between(`${anio}-01-01`, `${anio}-12-31`, true, true).toArray(),
  }), [anio]);
  if (!datos) return null;

  const filas = [
    ...datos.viajes.flatMap((v) => [...v.gastos, ...v.otrosGastos].filter((g) => esMant(g.concepto))
      .map((g) => ({ id: v.id, viaje: true, bus: v.bus, fecha: v.fecha, monto: g.monto, obs: v.observaciones }))),
    ...datos.generales.filter((g) => esMant(g.categoria))
      .map((g) => ({ id: g.id, viaje: false, bus: g.bus || '—', fecha: g.fecha, monto: g.monto, obs: g.observaciones })),
  ].filter((f) => bus === TODOS || f.bus === bus).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const total = filas.reduce((s, f) => s + f.monto, 0);

  return (
    <>
      <PestanasGastos vista="mantenimientos" />
      <div className="encabezado">
        <h1>Control de mantenimientos — {anio}</h1>
        <div className="selector-mes no-imprimir">
          <button type="button" onClick={() => cambiar(bus, anio - 1)} aria-label="Año anterior">‹</button>
          <input type="number" value={anio} onChange={(e) => cambiar(bus, Number(e.target.value) || anio)} />
          <button type="button" onClick={() => cambiar(bus, anio + 1)} aria-label="Año siguiente">›</button>
        </div>
      </div>
      <div className="filtros no-imprimir">
        <SelectorBus opciones={[...BUSES, TODOS]} valor={bus} onChange={(b) => cambiar(b, anio)} />
      </div>
      <section className="panel">
        <h2>{filas.length} mantenimientos · {bs(total)}</h2>
        {filas.length === 0 ? <p className="vacio">No hay mantenimientos registrados.</p> : (
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Bus</th><th>Origen</th><th>Monto</th><th>Observaciones</th></tr></thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i} className={f.viaje ? 'clic' : ''} onClick={() => f.viaje && ir(`/viaje/${f.id}`)}>
                    <td>{fechaCorta(f.fecha)}</td><td><b>{f.bus}</b></td><td>{f.viaje ? 'Viaje' : 'Monto total'}</td>
                    <td className="num fuerte">{bs(f.monto)}</td><td className="obs">{f.obs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
