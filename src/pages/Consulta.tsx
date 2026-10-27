import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES } from '../db';
import { calcular, totalizar } from '../calc';
import { bs, diaSemana, entero, fechaCorta, MESES, rangoMes } from '../format';
import { ir, useRuta } from '../router';
import { Botones, Insignia, SelectorMes, Tarjeta } from '../components';

const TODOS = 'Todos';

export default function Consulta() {
  // Los filtros viven en la dirección (#/consulta?bus=TDS&anio=2026&mes=10) para que «Atrás» los recuerde.
  const ruta = useRuta();
  const q = new URLSearchParams(ruta.split('?')[1] ?? '');
  const hoy = new Date();
  const bus = q.get('bus') ?? BUSES[0];
  const anio = Number(q.get('anio')) || hoy.getFullYear();
  const mes = Number(q.get('mes')) || hoy.getMonth() + 1;
  const cambiar = (b: string, a: number, m: number) => ir(`/consulta?bus=${b}&anio=${a}&mes=${m}`);

  const [desde, hasta] = rangoMes(anio, mes);
  const viajes = useLiveQuery(async () => {
    const lista = bus === TODOS
      ? await db.viajes.where('fecha').between(desde, hasta, true, true).toArray()
      : await db.viajes.where('[bus+fecha]').between([bus, desde], [bus, hasta], true, true).toArray();
    return lista.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado - b.creado);
  }, [bus, desde, hasta]);

  if (!viajes) return null;
  const t = totalizar(viajes);
  const filas = viajes.map((v) => ({ v, c: calcular(v) }));

  return (
    <>
      <div className="encabezado">
        <h1>Consulta — {bus} · {MESES[mes - 1]} {anio}</h1>
      </div>
      <div className="filtros">
        <Botones opciones={[...BUSES, TODOS]} valor={bus} onChange={(b) => cambiar(b, anio, mes)} />
        <SelectorMes anio={anio} mes={mes} onChange={(a, m) => cambiar(bus, a, m)} />
      </div>

      <section className="tarjetas">
        <Tarjeta titulo="Viajes" valor={entero(t.viajes)} nota={`${entero(t.boletosIda)} boletos de ida`} />
        <Tarjeta titulo="Ida normal" valor={bs(t.montoIda)} color="azul" />
        <Tarjeta titulo="Descuento" valor={bs(t.descuentoIda)} color="azul" />
        <Tarjeta titulo="Ida neto" valor={bs(t.idaNeto)} color="azul" />
        <Tarjeta titulo="Llegada (registrado)" valor={bs(t.montoRegistrado)} color="verde" nota={t.faltaBoletos ? `⚠ ${t.faltaBoletos} con falta de boletos` : undefined} />
        <Tarjeta titulo="Gastos" valor={bs(t.totalGastos)} color="naranja" />
        <Tarjeta titulo="Otros gastos" valor={bs(t.totalOtrosGastos)} color="naranja" />
        <Tarjeta titulo="Neto final" valor={<span className={t.netoFinal < 0 ? 'negativo' : ''}>{bs(t.netoFinal)}</span>} />
      </section>

      {filas.length === 0 && <p className="vacio panel">No hay viajes de {bus} en {MESES[mes - 1]} {anio}.</p>}

      {filas.length > 0 && (
        <>
          {/* Computadora: tabla completa como en el Excel */}
          <div className="tabla-wrap solo-pc">
            <table className="tabla tabla-consulta">
              <thead>
                <tr className="grupos">
                  <th colSpan={bus === TODOS ? 4 : 3} className="g-navy">Viaje</th>
                  <th colSpan={4} className="g-azul">Ida</th>
                  <th colSpan={3} className="g-verde">Llegada</th>
                  <th colSpan={4} className="g-naranja">Gastos y neto</th>
                </tr>
                <tr>
                  <th>Fecha</th>{bus === TODOS && <th>Bus</th>}<th>Destino</th><th>Horario</th>
                  <th>Boletos</th><th>Monto ida</th><th>Desc.</th><th>Ida neto</th>
                  <th>Calculado</th><th>Verificación</th><th>Trajeron</th>
                  <th>Gastos</th><th>Total − gastos</th><th>Otros gastos</th><th>Neto final</th>
                </tr>
              </thead>
              <tbody>
                <tr className="totales">
                  <td colSpan={bus === TODOS ? 4 : 3}>TOTALES ({t.viajes} viajes)</td>
                  <td className="num">{entero(t.boletosIda)}</td><td className="num">{bs(t.montoIda)}</td><td className="num">{bs(t.descuentoIda)}</td>
                  <td className="num azul-txt">{bs(t.idaNeto)}</td>
                  <td className="num">{bs(t.montoCalculadoLlegada)}</td><td></td><td className="num">{bs(t.montoRegistrado)}</td>
                  <td className="num">{bs(t.totalGastos)}</td><td className="num">{bs(t.totalMenosGastos)}</td><td className="num">{bs(t.totalOtrosGastos)}</td>
                  <td className={`num ${t.netoFinal < 0 ? 'negativo' : ''}`}>{bs(t.netoFinal)}</td>
                </tr>
                {filas.map(({ v, c }) => (
                  <tr key={v.id} className="clic" onClick={() => ir(`/viaje/${v.id}`)} title={v.observaciones || 'Clic para editar'}>
                    <td>{fechaCorta(v.fecha)}</td>{bus === TODOS && <td><b>{v.bus}</b></td>}<td>{v.destino}</td>
                    <td>{[v.horaSalida, v.horaLlegada].filter(Boolean).join(' - ')}</td>
                    <td className="num">{c.boletosIda}</td><td className="num">{bs(c.montoIda)}</td>
                    <td className="num">{c.descuentoIda ? bs(c.descuentoIda) : '-'}</td><td className="num azul-txt fuerte">{bs(c.idaNeto)}</td>
                    <td className="num">{bs(c.montoCalculadoLlegada)}</td><td><Insignia v={c.verificacion} /></td><td className="num">{bs(c.montoRegistrado)}</td>
                    <td className="num" title={v.gastos.map((g) => `${g.concepto} ${g.monto}`).join('; ')}>{bs(c.totalGastos)}</td>
                    <td className="num">{bs(c.totalMenosGastos)}</td>
                    <td className="num" title={v.otrosGastos.map((g) => `${g.concepto} ${g.monto}`).join('; ')}>{c.totalOtrosGastos ? bs(c.totalOtrosGastos) : '-'}</td>
                    <td className={`num fuerte ${c.netoFinal < 0 ? 'negativo' : ''}`}>{bs(c.netoFinal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: una tarjeta por viaje */}
          <div className="lista solo-cel">
            {filas.map(({ v, c }) => (
              <a key={v.id} href={`#/viaje/${v.id}`} className="viaje-cel">
                <div className="viaje-cel-cab">
                  <b>{diaSemana(v.fecha)} {fechaCorta(v.fecha)}</b>
                  {bus === TODOS && <span className="bus-chip">{v.bus}</span>}
                  <span>{v.destino}</span>
                  <Insignia v={c.verificacion} />
                </div>
                <div className="viaje-cel-datos">
                  <span>Ida neto<b className="azul-txt">{bs(c.idaNeto)}</b></span>
                  <span>Trajeron<b>{bs(c.montoRegistrado)}</b></span>
                  <span>Gastos<b>{bs(c.totalGastos + c.totalOtrosGastos)}</b></span>
                  <span>Neto<b className={c.netoFinal < 0 ? 'negativo' : ''}>{bs(c.netoFinal)}</b></span>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}
