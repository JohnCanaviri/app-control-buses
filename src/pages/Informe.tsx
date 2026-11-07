// Informe del mes para rendir cuentas: se imprime o se guarda como PDF y cualquiera lo entiende.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES, type GastoGeneral } from '../db';
import type { Viaje } from '../calc';
import { frase, informeMensual, notasDelDia, porBus, type Cuentas } from '../informe';
import { vueltasDe, esDiesel } from '../diesel';
import { bs, diaSemana, entero, fechaCorta, MESES, rangoMes } from '../format';
import { ir, parametros, useRuta } from '../router';
import { PestanasResumen, SelectorBus, SelectorMes, ViajesDelMes } from '../components';

const TODOS = 'Todos';
// El diésel va primero; después los demás gastos. Dentro de cada grupo, por fecha y bus.
const ordenGastos = (l: GastoGeneral[]) => [...l].sort((a, b) =>
  Number(esDiesel(b.categoria)) - Number(esDiesel(a.categoria)) || a.fecha.localeCompare(b.fecha) || a.bus.localeCompare(b.bus));
const OPCIONES = [...BUSES, TODOS];
const quien = (bus: string) => (bus === TODOS ? 'la empresa (todos los buses)' : `el bus ${bus}`);

export default function Informe() {
  const q = parametros(useRuta());
  const hoy = new Date();
  const bus = OPCIONES.includes(q.get('bus') ?? '') ? q.get('bus')! : TODOS;
  const anio = Number(q.get('anio')) || hoy.getFullYear();
  const mes = Number(q.get('mes')) || hoy.getMonth() + 1;
  const cambiar = (o: { bus?: string; anio?: number; mes?: number }) => ir(`/informe?bus=${o.bus ?? bus}&anio=${o.anio ?? anio}&mes=${o.mes ?? mes}`);

  const [desde, hasta] = rangoMes(anio, mes);
  const datos = useLiveQuery(async () => ({
    viajes: await db.viajes.where('fecha').between(desde, hasta, true, true).toArray(),
    grandes: await db.gastos.where('fecha').between(desde, hasta, true, true).toArray(),
  }), [desde, hasta]);

  return (
    <>
      <PestanasResumen vista="mes" bus={bus} anio={anio} mes={mes} />
      <div className="encabezado">
        <h1>Informe de {MESES[mes - 1]} {anio} — {bus === TODOS ? 'todos los buses' : bus}</h1>
        <button type="button" className="boton-imprimir no-imprimir" onClick={() => print()}>🖨 Imprimir informe</button>
      </div>
      <div className="filtros no-imprimir">
        <SelectorBus opciones={OPCIONES} valor={bus} onChange={(b) => cambiar({ bus: b })} />
        <SelectorMes anio={anio} mes={mes} onChange={(a, m) => cambiar({ anio: a, mes: m })} />
      </div>
      <p className="no-imprimir"><small>Pulsa «🖨 Imprimir informe» y elige tu impresora, o «Guardar como PDF» para enviarlo.</small></p>
      {datos && <Mensual viajes={datos.viajes} grandes={datos.grandes} bus={bus} anio={anio} mes={mes} />}
      <Firmas />
    </>
  );
}

// Lo esencial en tarjetas grandes: la ida en un grupo y la llegada en otro (nunca se juntan).
function Cuadro({ c }: { c: Cuentas }) {
  return (
    <div className="cuadro-grupos">
      <div className="cuadro-grupo">
        <span className="cuadro-titulo azul-txt">Ida</span>
        <div className="cuadro-informe ida">
          <div className="ci azul"><span>Boletos</span><b>{entero(c.boletosIda)}</b><small>de ida</small></div>
          <div className="ci azul"><span>Descuento</span><b>{bs(c.descuentoIda)}</b><small>de ida</small></div>
          <div className="ci azul total-ida"><span>Ida neto</span><b>{bs(c.idaNeto)}</b><small>boletos − descuento</small></div>
        </div>
      </div>
      <div className="cuadro-grupo">
        <span className="cuadro-titulo verde-txt">Llegada</span>
        <div className="cuadro-informe">
          <div className="ci verde"><span>Trajeron</span><b>{bs(c.trajeron)}</b><small>de la llegada</small></div>
          <div className="ci naranja"><span>Gastos del viaje</span><b>− {bs(c.gastosViaje)}</b><small>peaje, viático…</small></div>
          <div className="ci verde"><span>Llegada neto</span><b className={c.vueltaNeta < 0 ? 'negativo' : ''}>{bs(c.vueltaNeta)}</b><small>trajeron − gastos del viaje</small></div>
          <div className="ci naranja"><span>Diésel</span><b>− {bs(c.diesel)}</b><small>gastos del mes</small></div>
          <div className="ci naranja"><span>Otros gastos</span><b>− {bs(c.otrosGrandes)}</b><small>sueldos, mantenimiento…</small></div>
          <div className="ci total"><span>Llegada final</span><b className={c.queda < 0 ? 'negativo' : ''}>{bs(c.queda)}</b><small>llegada neto − diésel − otros</small></div>
        </div>
      </div>
    </div>
  );
}

function Mensual({ viajes, grandes, bus, anio, mes }: {
  viajes: Viaje[]; grandes: GastoGeneral[]; bus: string; anio: number; mes: number;
}) {
  const [todosLosDias, setTodosLosDias] = useState(false);
  const r = informeMensual(viajes, grandes, bus, anio, mes);
  const pb = bus === TODOS ? porBus(viajes, grandes, BUSES) : null;
  const t = r.total;

  return (
    <>
      <p className="frase-informe">{frase(t, quien(bus), `En ${MESES[mes - 1].toLowerCase()} de ${anio}`, bs)}</p>
      <ViajesDelMes viajes={viajes} buses={bus === TODOS ? BUSES : [bus]} />
      <Cuadro c={t} />

      {pb && (
        <section className="panel borde-azul">
          <h2>Ida de cada bus</h2>
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th>Bus</th><th>Boletos</th><th>Descuento</th><th>Ida neto</th></tr></thead>
              <tbody>
                {pb.filas.map(({ bus: b, c }) => (
                  <tr key={b}><td><b>{b}</b></td><td className="num">{entero(c.boletosIda)}</td>
                    <td className="num">{bs(c.descuentoIda)}</td><td className="num fuerte azul-txt">{bs(c.idaNeto)}</td></tr>
                ))}
                <tr className="totales"><td>TOTAL</td><td className="num">{entero(pb.total.boletosIda)}</td>
                  <td className="num">{bs(pb.total.descuentoIda)}</td><td className="num">{bs(pb.total.idaNeto)}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
      {pb && (
        <section className="panel borde-verde">
          <h2>Llegada de cada bus <small>(todos los gastos se descuentan de la llegada)</small></h2>
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th>Bus</th><th>Llegada neto</th><th>Diésel</th><th>Otros gastos</th><th>Llegada final</th></tr></thead>
              <tbody>
                {pb.filas.map(({ bus: b, c }) => (
                  <tr key={b}><td><b>{b}</b></td><td className="num verde-txt">{bs(c.vueltaNeta)}</td>
                    <td className="num naranja-txt">− {bs(c.diesel)}</td><td className="num naranja-txt">− {bs(c.otrosGrandes)}</td>
                    <td className={`num fuerte ${c.queda < 0 ? 'negativo' : ''}`}>{bs(c.queda)}</td></tr>
                ))}
                {(pb.generales.diesel > 0 || pb.generales.otrosGrandes > 0) && (
                  <tr><td><b>General</b> <small>(sin bus)</small></td><td></td><td className="num naranja-txt">− {bs(pb.generales.diesel)}</td>
                    <td className="num naranja-txt">− {bs(pb.generales.otrosGrandes)}</td><td className="num fuerte negativo">{bs(pb.generales.queda)}</td></tr>
                )}
                <tr className="totales"><td>TOTAL</td><td className="num">{bs(pb.total.vueltaNeta)}</td>
                  <td className="num">− {bs(pb.total.diesel)}</td><td className="num">− {bs(pb.total.otrosGrandes)}</td>
                  <td className={`num ${pb.total.queda < 0 ? 'negativo' : ''}`}>{bs(pb.total.queda)}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <label className="check no-imprimir"><input type="checkbox" checked={todosLosDias} onChange={(e) => setTodosLosDias(e.target.checked)} /> Mostrar también los días sin viajes</label>

      {(bus === TODOS ? BUSES : [bus]).map((b) => {
        const rb = informeMensual(viajes, [], b, anio, mes);
        const filas = todosLosDias ? rb.dias : rb.dias.filter((d) => d.c.viajes > 0);
        const tb = rb.total;
        return (
          <section className="panel" key={b}>
            <h2><span className="bus-chip">{b}</span> por día <small>(llegada neto = lo que trajeron − gastos del viaje)</small></h2>
            {filas.length === 0 ? <p className="vacio">Sin viajes este mes.</p> : (
              <div className="tabla-wrap">
                <table className="tabla tabla-informe">
                  <thead><tr><th>Día</th><th>Ida neto</th><th>Llegada neto</th><th>Observaciones</th></tr></thead>
                  <tbody>
                    {filas.map((d) => (
                      <tr key={d.fecha} className={d.c.viajes ? '' : 'apagada'}>
                        <td>{diaSemana(d.fecha).slice(0, 3)} {fechaCorta(d.fecha)}</td>
                        <td className="num azul-txt">{d.c.viajes ? <>{bs(d.c.idaNeto)}{d.c.idaPendientes ? ' ⚠' : ''}</> : '-'}</td>
                        <td className={`num ${d.c.vueltaNeta < 0 ? 'negativo' : 'verde-txt'}`}>{d.c.viajes ? bs(d.c.vueltaNeta) : '-'}</td>
                        <td className="obs-informe">{notasDelDia(d.viajes, [], false).join(' · ')}</td>
                      </tr>
                    ))}
                    <tr className="totales"><td>TOTAL {b}</td><td className="num">{bs(tb.idaNeto)}</td>
                      <td className="num">{bs(tb.vueltaNeta)}</td><td></td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
      {t.idaPendientes > 0 && <p className="naranja-txt"><small>⚠ {t.idaPendientes} viaje(s) sin boletos de ida todavía no tienen anotado cuánto trajeron (se anota en Inicio).</small></p>}

      <GastosDelMes grandes={bus === TODOS ? grandes : grandes.filter((g) => g.bus === bus)} t={t} />
    </>
  );
}

// Los gastos grandes (diésel, sueldos, mantenimiento…) van en su propia tabla y se restan al final del mes, no cada día.
function GastosDelMes({ grandes, t }: { grandes: GastoGeneral[]; t: Cuentas }) {
  const lista = ordenGastos(grandes);
  return (
    <>
      <section className="panel borde-naranja">
        <h2>Gastos del mes ({lista.length}) <small>(diésel y demás gastos: se descuentan solo de la llegada, al final)</small></h2>
        {lista.length === 0 ? <p className="vacio">No hay gastos registrados este mes.</p> : (
          <div className="tabla-wrap">
            <table className="tabla tabla-informe">
              <thead><tr><th>Fecha</th><th>Bus</th><th>Gasto</th><th>Monto</th><th>Observaciones</th></tr></thead>
              <tbody>
                {lista.map((g) => (
                  <tr key={g.id}>
                    <td>{fechaCorta(g.fecha)}</td><td><b>{g.bus || 'General'}</b></td>
                    <td>{g.categoria}{esDiesel(g.categoria) ? ` (${vueltasDe(g)} vuelta${vueltasDe(g) === 1 ? '' : 's'})` : ''}</td>
                    <td className="num fuerte">{bs(g.monto)}</td><td className="obs-informe">{g.observaciones}</td>
                  </tr>
                ))}
                <tr><td colSpan={3}>Diésel</td><td className="num">{bs(t.diesel)}</td><td></td></tr>
                <tr><td colSpan={3}>Otros gastos</td><td className="num">{bs(t.otrosGrandes)}</td><td></td></tr>
                <tr className="totales"><td colSpan={3}>TOTAL GASTOS</td><td className="num">{bs(t.diesel + t.otrosGrandes)}</td><td></td></tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel cuenta-final">
        <h2>Cuenta final de la llegada</h2>
        <table className="tabla tabla-cuenta">
          <tbody>
            <tr><td>Llegada neto</td><td className="num">{bs(t.vueltaNeta)}</td></tr>
            <tr><td>− Gastos del mes (diésel y demás)</td><td className="num naranja-txt">{bs(t.diesel + t.otrosGrandes)}</td></tr>
            <tr className="totales"><td>LLEGADA FINAL</td><td className={`num ${t.queda < 0 ? 'negativo' : ''}`}>{bs(t.queda)}</td></tr>
          </tbody>
        </table>
      </section>
    </>
  );
}

// Para firmar el informe impreso.
function Firmas() {
  return (
    <div className="firmas solo-imprimir">
      <div><span>Entregué conforme</span></div>
      <div><span>Recibí conforme</span></div>
      <p>Impreso el {new Date().toLocaleString('es-BO')} · Control de Buses</p>
    </div>
  );
}
