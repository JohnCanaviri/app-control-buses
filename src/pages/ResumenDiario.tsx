import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES } from '../db';
import { totalizar } from '../calc';
import { filtrarBus, porDia } from '../resumen';
import { bs, diaSemana, entero, fechaCorta, MESES, rangoMes } from '../format';
import { ir, parametros, useRuta } from '../router';
import { Botones, SelectorMes, Tarjeta, VistasResumen } from '../components';
import Grafico from '../Grafico';

const TODOS = 'Todos';
const cero = (n: number) => (n ? bs(n) : '-');

export default function ResumenDiario() {
  const q = parametros(useRuta());
  const hoy = new Date();
  const bus = q.get('bus') ?? TODOS;
  const anio = Number(q.get('anio')) || hoy.getFullYear();
  const mes = Number(q.get('mes')) || hoy.getMonth() + 1;
  const cambiar = (b: string, a: number, m: number) => ir(`/diario?bus=${b}&anio=${a}&mes=${m}`);

  const [desde, hasta] = rangoMes(anio, mes);
  const delMes = useLiveQuery(() => db.viajes.where('fecha').between(desde, hasta, true, true).toArray(), [desde, hasta]);
  if (!delMes) return null;

  const viajes = filtrarBus(delMes, bus);
  const dias = porDia(viajes, anio, mes);
  const t = totalizar(viajes);
  const finDeSemana = (f: string) => ['Sábado', 'Domingo'].includes(diaSemana(f));

  return (
    <>
      <VistasResumen vista="diario" bus={bus} anio={anio} mes={mes} />
      <div className="encabezado">
        <h1>Día por día — {bus === TODOS ? 'todos los buses' : bus} · {MESES[mes - 1]} {anio}</h1>
        <button type="button" className="boton no-imprimir" onClick={() => print()}>🖨 Imprimir / PDF</button>
      </div>
      <div className="filtros no-imprimir">
        <Botones opciones={[...BUSES, TODOS]} valor={bus} onChange={(b) => cambiar(b, anio, mes)} />
        <SelectorMes anio={anio} mes={mes} onChange={(a, m) => cambiar(bus, a, m)} />
      </div>

      <section className="tarjetas">
        <Tarjeta titulo="Viajes del mes" valor={entero(t.viajes)} />
        <Tarjeta titulo="Ida normal" valor={bs(t.montoIda)} color="azul" />
        <Tarjeta titulo="Descuento" valor={bs(t.descuentoIda)} color="azul" />
        <Tarjeta titulo="Ida neto" valor={bs(t.idaNeto)} color="azul" />
        <Tarjeta titulo="Llegada normal" valor={bs(t.montoRegistrado)} color="verde" />
        <Tarjeta titulo="Gastos" valor={bs(t.totalGastos)} color="naranja" />
        <Tarjeta titulo="Otros gastos" valor={bs(t.totalOtrosGastos)} color="naranja" />
        <Tarjeta titulo="Llegada neta" valor={<span className={t.netoFinal < 0 ? 'negativo' : ''}>{bs(t.netoFinal)}</span>} color="verde" />
      </section>

      <section className="panel">
        <Grafico titulo="Ida neto y llegada neta por día" categorias={dias.map((d) => d.fecha.slice(8))}
          onClic={(i) => { if (dias[i].t.viajes) ir(`/consulta?bus=${bus}&anio=${anio}&mes=${mes}`); }}
          series={[
            { nombre: 'Ida neto', color: '#2453c9', valores: dias.map((d) => d.t.idaNeto) },
            { nombre: 'Llegada neta', color: '#1d7a52', valores: dias.map((d) => d.t.netoFinal) },
          ]} />
      </section>

      <section className="panel">
        <h2>Día por día</h2>
        <div className="tabla-wrap">
          <table className="tabla tabla-diario">
            <thead>
              <tr className="grupos">
                <th colSpan={3} className="g-navy">Día</th>
                <th colSpan={3} className="g-azul">Ida</th>
                <th colSpan={4} className="g-verde">Llegada</th>
              </tr>
              <tr>
                <th>Fecha</th><th>Día</th><th>Viajes</th>
                <th>Ida normal</th><th>Descuento</th><th>Ida neto</th>
                <th>Llegada normal</th><th>Gastos</th><th>Otros gastos</th><th>Llegada neta</th>
              </tr>
            </thead>
            <tbody>
              <tr className="totales">
                <td colSpan={2}>TOTAL MES</td><td className="num">{t.viajes}</td>
                <td className="num">{bs(t.montoIda)}</td><td className="num">{bs(t.descuentoIda)}</td><td className="num">{bs(t.idaNeto)}</td>
                <td className="num">{bs(t.montoRegistrado)}</td><td className="num">{bs(t.totalGastos)}</td><td className="num">{bs(t.totalOtrosGastos)}</td>
                <td className={`num ${t.netoFinal < 0 ? 'negativo' : ''}`}>{bs(t.netoFinal)}</td>
              </tr>
              {dias.map(({ fecha, t: d }) => (
                <tr key={fecha} className={`${d.viajes ? '' : 'apagada'} ${finDeSemana(fecha) ? 'finde' : ''}`}>
                  <td>{fechaCorta(fecha)}</td><td>{diaSemana(fecha)}</td><td className="num">{d.viajes || '-'}</td>
                  <td className="num">{cero(d.montoIda)}</td><td className="num">{cero(d.descuentoIda)}</td>
                  <td className="num azul-txt fuerte">{cero(d.idaNeto)}</td>
                  <td className="num">{cero(d.montoRegistrado)}</td><td className="num">{cero(d.totalGastos)}</td><td className="num">{cero(d.totalOtrosGastos)}</td>
                  <td className={`num fuerte ${d.netoFinal < 0 ? 'negativo' : ''}`}>{d.viajes ? bs(d.netoFinal) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
