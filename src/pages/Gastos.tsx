import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES, type GastoGeneral } from '../db';
import { bs, fechaCorta, MESES, rangoMes } from '../format';
import { ir, parametros, useRuta } from '../router';
import { SelectorBus, PestanasGastos, SelectorMes, Tarjeta } from '../components';
import { cargasEfectivas, esDiesel } from '../diesel';
import { usePermisos } from '../sync';
import { VentanaGasto } from './Inicio';

const TODOS = 'Todos';
// «viaje»: el gasto es de un viaje (se edita en el viaje); «general»: gasto del monto total.
interface Fila { fecha: string; concepto: string; monto: number; obs: string; viaje?: string; general?: GastoGeneral }

// Gastos por bus: combustible (solo diésel) y normales (todo lo demás, de los viajes y del monto total).
// No se mezclan con los montos de ida.
export default function Gastos() {
  const q = parametros(useRuta());
  const hoy = new Date();
  const bus = q.get('bus') ?? TODOS;
  const anio = Number(q.get('anio')) || hoy.getFullYear();
  const mes = Number(q.get('mes')) || hoy.getMonth() + 1;
  const cambiar = (b: string, a: number, m: number) => ir(`/gastos?bus=${b}&anio=${a}&mes=${m}`);
  const [desde, hasta] = rangoMes(anio, mes);
  const { puedeEditar } = usePermisos();
  const [editar, setEditar] = useState<GastoGeneral | undefined>();

  const datos = useLiveQuery(async () => ({
    viajes: await db.viajes.where('fecha').between(desde, hasta, true, true).toArray(),
    generales: await db.gastos.where('fecha').between(desde, hasta, true, true).toArray(),
  }), [desde, hasta]);
  if (!datos) return null;

  const suma = (l: Fila[]) => l.reduce((s, g) => s + g.monto, 0);
  // «General» = gastos del monto total que no son de un bus (sueldos, impuestos…). Se ven con «Todos».
  const GENERAL = 'General';
  const filas = (bus === TODOS ? [...BUSES, GENERAL] : [bus]).map((b) => {
    const vs = datos.viajes.filter((v) => v.bus === b).sort((x, y) => x.fecha.localeCompare(y.fecha));
    const todos: Fila[] = [
      // Gastos del viaje sin el diésel: el diésel sale una sola vez, de la lista de cargas de abajo.
      ...vs.flatMap((v) => [...v.gastos, ...v.otrosGastos].filter((g) => !esDiesel(g.concepto)).map((g) => ({ ...g, fecha: v.fecha, obs: v.observaciones, viaje: v.id }))),
      ...cargasEfectivas(vs, datos.generales.filter((g) => (b === GENERAL ? !BUSES.includes(g.bus) : g.bus === b)))
        .map((g) => (datos.generales.includes(g)
          ? { concepto: `${g.categoria} (monto total)`, monto: g.monto, fecha: g.fecha, obs: g.observaciones, general: g }
          : { concepto: `${g.categoria} (anotado en el viaje)`, monto: g.monto, fecha: g.fecha, obs: g.observaciones, viaje: g.id.replace(/-dv-\d+$/, '') })),
    ].sort((x, y) => x.fecha.localeCompare(y.fecha));
    const combustible = todos.filter((g) => esDiesel(g.concepto));
    const normales = todos.filter((g) => !esDiesel(g.concepto));
    return { b, normales, combustible };
  }).filter((f) => f.b !== GENERAL || f.normales.length || f.combustible.length);

  return (
    <>
      <PestanasGastos vista="gastos" />
      <div className="encabezado">
        <h1>Gastos — {bus} · {MESES[mes - 1]} {anio}</h1>
        <button type="button" className="boton no-imprimir" onClick={() => print()}>🖨 Imprimir / PDF</button>
      </div>
      <div className="filtros no-imprimir">
        <SelectorBus opciones={[...BUSES, TODOS]} valor={bus} onChange={(b) => cambiar(b, anio, mes)} />
        <SelectorMes anio={anio} mes={mes} onChange={(a, m) => cambiar(bus, a, m)} />
      </div>
      {filas.map((f) => (
        <section className="panel borde-naranja" key={f.b}>
          <h2>{f.b === GENERAL ? 'General (sin bus)' : f.b}</h2>
          <section className="tarjetas">
            <Tarjeta titulo="Gastos combustible" valor={bs(suma(f.combustible))} color="naranja" nota="Solo diésel" />
            <Tarjeta titulo="Gastos normales" valor={bs(suma(f.normales))} color="naranja" nota="Viático, peaje, mantenimiento y otros" />
          </section>
          <TablaGastos titulo="Combustible (diésel)" lista={f.combustible} editar={puedeEditar ? setEditar : undefined} />
          <TablaGastos titulo="Normales" lista={f.normales} editar={puedeEditar ? setEditar : undefined} />
        </section>
      ))}
      <p className="no-imprimir"><small>Toca un gasto para corregirlo (los de un viaje se corrigen en el viaje).</small></p>
      {editar && <VentanaGasto base={editar} fecha={editar.fecha} soloDiesel={esDiesel(editar.categoria)} cerrar={() => setEditar(undefined)} />}
    </>
  );
}

function TablaGastos({ titulo, lista, editar }: { titulo: string; lista: Fila[]; editar?: (g: GastoGeneral) => void }) {
  return (
    <>
      <h3>{titulo} ({lista.length})</h3>
      {lista.length === 0 ? <p className="vacio">Sin gastos.</p> : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Observaciones</th></tr></thead>
            <tbody>
              {lista.map((g, i) => (
                <tr key={i} className={editar ? 'clic' : ''} title={editar ? 'Clic para editar' : undefined}
                  onClick={() => { if (!editar) return; if (g.general) editar(g.general); else if (g.viaje) ir(`/viaje/${g.viaje}`); }}><td>{fechaCorta(g.fecha)}</td><td>{g.concepto}</td><td className="num">{bs(g.monto)}</td><td className="obs">{g.obs}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
