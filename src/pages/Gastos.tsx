import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES } from '../db';
import { bs, fechaCorta, MESES, rangoMes } from '../format';
import { ir, parametros, useRuta } from '../router';
import { Botones, PestanasGastos, SelectorMes, Tarjeta } from '../components';

const TODOS = 'Todos';
interface Fila { fecha: string; concepto: string; monto: number; obs: string }

// Gastos por bus: normales (viático, peaje) y fuertes (otros gastos y gastos del monto total).
// No se mezclan con los montos de ida.
export default function Gastos() {
  const q = parametros(useRuta());
  const hoy = new Date();
  const bus = q.get('bus') ?? TODOS;
  const anio = Number(q.get('anio')) || hoy.getFullYear();
  const mes = Number(q.get('mes')) || hoy.getMonth() + 1;
  const cambiar = (b: string, a: number, m: number) => ir(`/gastos?bus=${b}&anio=${a}&mes=${m}`);
  const [desde, hasta] = rangoMes(anio, mes);

  const datos = useLiveQuery(async () => ({
    viajes: await db.viajes.where('fecha').between(desde, hasta, true, true).toArray(),
    generales: await db.gastos.where('fecha').between(desde, hasta, true, true).toArray(),
  }), [desde, hasta]);
  if (!datos) return null;

  const suma = (l: Fila[]) => l.reduce((s, g) => s + g.monto, 0);
  const filas = (bus === TODOS ? BUSES : [bus]).map((b) => {
    const vs = datos.viajes.filter((v) => v.bus === b).sort((x, y) => x.fecha.localeCompare(y.fecha));
    const normales: Fila[] = vs.flatMap((v) => v.gastos.map((g) => ({ ...g, fecha: v.fecha, obs: v.observaciones })));
    const fuertes: Fila[] = [
      ...vs.flatMap((v) => v.otrosGastos.map((g) => ({ ...g, fecha: v.fecha, obs: v.observaciones }))),
      ...datos.generales.filter((g) => g.bus === b)
        .map((g) => ({ concepto: `${g.categoria} (monto total)`, monto: g.monto, fecha: g.fecha, obs: g.observaciones })),
    ].sort((x, y) => x.fecha.localeCompare(y.fecha));
    return { b, normales, fuertes };
  });

  return (
    <>
      <PestanasGastos vista="gastos" />
      <div className="encabezado">
        <h1>Gastos — {bus} · {MESES[mes - 1]} {anio}</h1>
        <button type="button" className="boton no-imprimir" onClick={() => print()}>🖨 Imprimir / PDF</button>
      </div>
      <div className="filtros no-imprimir">
        <Botones opciones={[...BUSES, TODOS]} valor={bus} onChange={(b) => cambiar(b, anio, mes)} />
        <SelectorMes anio={anio} mes={mes} onChange={(a, m) => cambiar(bus, a, m)} />
      </div>
      {filas.map((f) => (
        <section className="panel borde-naranja" key={f.b}>
          <h2>{f.b}</h2>
          <section className="tarjetas">
            <Tarjeta titulo="Gastos normales" valor={bs(suma(f.normales))} color="naranja" nota="Viático y peaje" />
            <Tarjeta titulo="Gastos fuertes" valor={bs(suma(f.fuertes))} color="naranja" nota="Mantenimiento, diésel…" />
          </section>
          <TablaGastos titulo="Normales" lista={f.normales} />
          <TablaGastos titulo="Fuertes" lista={f.fuertes} />
        </section>
      ))}
    </>
  );
}

function TablaGastos({ titulo, lista }: { titulo: string; lista: Fila[] }) {
  return (
    <>
      <h3>{titulo} ({lista.length})</h3>
      {lista.length === 0 ? <p className="vacio">Sin gastos.</p> : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Observaciones</th></tr></thead>
            <tbody>
              {lista.map((g, i) => (
                <tr key={i}><td>{fechaCorta(g.fecha)}</td><td>{g.concepto}</td><td className="num">{bs(g.monto)}</td><td className="obs">{g.obs}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
