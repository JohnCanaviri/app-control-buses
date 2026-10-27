import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES } from '../db';
import { totalizar } from '../calc';
import { filtrarBus, porMes } from '../resumen';
import { bs, entero, MESES } from '../format';
import { COLOR_BUS, ir, parametros, useRuta } from '../router';
import { Botones, Tarjeta, VistasResumen } from '../components';
import Grafico from '../Grafico';

const TODOS = 'Todos';
const CORTOS = MESES.map((m) => m.slice(0, 3));

export default function ResumenAnual() {
  const q = parametros(useRuta());
  const anio = Number(q.get('anio')) || new Date().getFullYear();
  const bus = q.get('bus') ?? TODOS;
  const mes = Number(q.get('mes')) || new Date().getMonth() + 1; // se recuerda para la vista «Día por día»
  const cambiar = (b: string, a: number) => ir(`/resumen?bus=${b}&anio=${a}&mes=${mes}`);

  const delAnio = useLiveQuery(() => db.viajes.where('fecha').between(`${anio}-01-01`, `${anio}-12-31`, true, true).toArray(), [anio]);
  if (!delAnio) return null;

  const viajes = filtrarBus(delAnio, bus);
  const meses = porMes(viajes, anio);
  const t = totalizar(viajes);
  const netoPorBus = BUSES.map((b) => ({ nombre: b, color: COLOR_BUS[b], valores: porMes(filtrarBus(delAnio, b), anio).map((m) => m.netoFinal) }));

  return (
    <>
      <VistasResumen vista="anual" bus={bus} anio={anio} mes={mes} />
      <div className="encabezado">
        <h1>{anio} mes por mes — {bus === TODOS ? 'todos los buses' : bus}</h1>
        <div className="acciones fila no-imprimir">
          <div className="selector-mes">
            <button type="button" onClick={() => cambiar(bus, anio - 1)} aria-label="Año anterior">‹</button>
            <input type="number" value={anio} onChange={(e) => cambiar(bus, Number(e.target.value) || anio)} />
            <button type="button" onClick={() => cambiar(bus, anio + 1)} aria-label="Año siguiente">›</button>
          </div>
          <button type="button" className="boton" onClick={() => print()}>🖨 Imprimir / PDF</button>
        </div>
      </div>
      <div className="filtros no-imprimir">
        <Botones opciones={[...BUSES, TODOS]} valor={bus} onChange={(b) => cambiar(b, anio)} />
      </div>

      <section className="tarjetas">
        <Tarjeta titulo="Viajes del año" valor={entero(t.viajes)} nota={`${entero(t.boletosIda)} boletos de ida`} />
        <Tarjeta titulo="Ida normal" valor={bs(t.montoIda)} color="azul" />
        <Tarjeta titulo="Descuento" valor={bs(t.descuentoIda)} color="azul" />
        <Tarjeta titulo="Ida neto" valor={bs(t.idaNeto)} color="azul" />
        <Tarjeta titulo="Llegada (registrado)" valor={bs(t.montoRegistrado)} color="verde" />
        <Tarjeta titulo="Gastos + otros" valor={bs(t.totalGastos + t.totalOtrosGastos)} color="naranja" />
        <Tarjeta titulo="Neto final" valor={<span className={t.netoFinal < 0 ? 'negativo' : ''}>{bs(t.netoFinal)}</span>} />
      </section>

      <section className="panel">
        <h2>Mes por mes <small>(toca un mes para ver cada día)</small></h2>
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr className="grupos">
                <th colSpan={3} className="g-navy">Mes</th>
                <th colSpan={3} className="g-azul">Ida</th>
                <th colSpan={1} className="g-verde">Llegada</th>
                <th colSpan={3} className="g-naranja">Gastos y neto</th>
              </tr>
              <tr>
                <th>Mes</th><th>Viajes</th><th>Boletos</th>
                <th>Monto ida</th><th>Descuento</th><th>Ida neto</th>
                <th>Registrado</th>
                <th>Gastos</th><th>Otros gastos</th><th>Neto final</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m, i) => (
                <tr key={i} className={`clic ${m.viajes ? '' : 'apagada'}`} onClick={() => ir(`/diario?bus=${bus}&anio=${anio}&mes=${i + 1}`)}>
                  <td><b>{MESES[i]}</b></td>
                  <td className="num">{m.viajes || '-'}</td>
                  <td className="num">{m.boletosIda ? entero(m.boletosIda) : '-'}</td>
                  <td className="num">{cero(m.montoIda)}</td>
                  <td className="num">{cero(m.descuentoIda)}</td>
                  <td className="num azul-txt fuerte">{cero(m.idaNeto)}</td>
                  <td className="num">{cero(m.montoRegistrado)}</td>
                  <td className="num">{cero(m.totalGastos)}</td>
                  <td className="num">{cero(m.totalOtrosGastos)}</td>
                  <td className={`num fuerte ${m.netoFinal < 0 ? 'negativo' : ''}`}>{cero(m.netoFinal)}</td>
                </tr>
              ))}
              <tr className="totales">
                <td>TOTAL AÑO</td>
                <td className="num">{t.viajes}</td><td className="num">{entero(t.boletosIda)}</td>
                <td className="num">{bs(t.montoIda)}</td><td className="num">{bs(t.descuentoIda)}</td><td className="num">{bs(t.idaNeto)}</td>
                <td className="num">{bs(t.montoRegistrado)}</td>
                <td className="num">{bs(t.totalGastos)}</td><td className="num">{bs(t.totalOtrosGastos)}</td>
                <td className={`num ${t.netoFinal < 0 ? 'negativo' : ''}`}>{bs(t.netoFinal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="graficos">
        <div className="panel">
          <Grafico titulo={`Ida neto, llegada y neto final por mes — ${bus === TODOS ? 'todos' : bus}`} categorias={CORTOS}
            onClic={(i) => ir(`/diario?bus=${bus}&anio=${anio}&mes=${i + 1}`)}
            series={[
              { nombre: 'Ida neto', color: '#2e75b6', valores: meses.map((m) => m.idaNeto) },
              { nombre: 'Llegada', color: '#548235', valores: meses.map((m) => m.montoRegistrado) },
              { nombre: 'Neto final', color: '#1f3864', valores: meses.map((m) => m.netoFinal) },
            ]} />
        </div>
        <div className="panel">
          <Grafico titulo="Neto final por mes — comparación de buses" categorias={CORTOS} series={netoPorBus} />
        </div>
      </section>
    </>
  );
}

const cero = (n: number) => (n ? bs(n) : '-');
