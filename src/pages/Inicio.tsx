import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES } from '../db';
import { calcular, totalizar } from '../calc';
import { bs, entero, fechaCorta, MESES, rangoMes } from '../format';
import { Insignia, SelectorMes, Tarjeta } from '../components';

export default function Inicio() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [desde, hasta] = rangoMes(anio, mes);
  const viajes = useLiveQuery(() => db.viajes.where('fecha').between(desde, hasta, true, true).toArray(), [desde, hasta]);
  const ultimos = useLiveQuery(() => db.viajes.orderBy('fecha').reverse().limit(5).toArray(), []);

  if (!viajes) return null;
  const t = totalizar(viajes);

  return (
    <>
      <div className="encabezado">
        <h1>Resumen de {MESES[mes - 1]} {anio}</h1>
        <SelectorMes anio={anio} mes={mes} onChange={(a, m) => { setAnio(a); setMes(m); }} />
      </div>

      <a href="#/nuevo" className="boton-grande">➕ Registrar un viaje</a>

      <section className="tarjetas">
        <Tarjeta titulo="Viajes del mes" valor={entero(t.viajes)} nota={t.faltaBoletos ? `${t.faltaBoletos} con falta de boletos` : 'Todos los buses'} />
        <Tarjeta titulo="Ida normal" valor={bs(t.montoIda)} color="azul" />
        <Tarjeta titulo="Descuento" valor={bs(t.descuentoIda)} color="azul" />
        <Tarjeta titulo="Ida neto" valor={bs(t.idaNeto)} color="azul" />
        <Tarjeta titulo="Llegada (registrado)" valor={bs(t.montoRegistrado)} color="verde" />
        <Tarjeta titulo="Gastos + otros" valor={bs(t.totalGastos + t.totalOtrosGastos)} color="naranja" />
        <Tarjeta titulo="Neto final" valor={<span className={t.netoFinal < 0 ? 'negativo' : ''}>{bs(t.netoFinal)}</span>} />
      </section>

      <section className="panel">
        <h2>Por bus</h2>
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Bus</th><th>Viajes</th><th>Ida neto</th><th>Llegada</th><th>Gastos + otros</th><th>Neto final</th><th></th></tr></thead>
            <tbody>
              {BUSES.map((b) => {
                const tb = totalizar(viajes.filter((v) => v.bus === b));
                return (
                  <tr key={b}>
                    <td><b>{b}</b></td>
                    <td className="num">{tb.viajes}</td>
                    <td className="num azul-txt">{bs(tb.idaNeto)}</td>
                    <td className="num">{bs(tb.montoRegistrado)}</td>
                    <td className="num">{bs(tb.totalGastos + tb.totalOtrosGastos)}</td>
                    <td className={`num fuerte ${tb.netoFinal < 0 ? 'negativo' : ''}`}>{bs(tb.netoFinal)}</td>
                    <td><a href={`#/consulta?bus=${b}&anio=${anio}&mes=${mes}`}>Ver ›</a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Últimos viajes registrados</h2>
        {ultimos && ultimos.length === 0 && <p className="vacio">Todavía no hay viajes. Pulsa «Registrar un viaje» para empezar.</p>}
        <div className="lista">
          {ultimos?.map((v) => {
            const c = calcular(v);
            return (
              <a key={v.id} href={`#/viaje/${v.id}`} className="fila-lista">
                <span className="bus-chip">{v.bus}</span>
                <span className="fila-info"><b>{fechaCorta(v.fecha)}</b> · {v.destino || 'Sin destino'}</span>
                <Insignia v={c.verificacion} />
                <span className={`num fuerte ${c.netoFinal < 0 ? 'negativo' : ''}`}>{bs(c.netoFinal)}</span>
              </a>
            );
          })}
        </div>
      </section>
    </>
  );
}
