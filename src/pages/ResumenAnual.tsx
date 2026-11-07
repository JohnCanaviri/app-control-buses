import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES } from '../db';
import { filtrarBus } from '../resumen';
import { cuentas } from '../informe';
import { bs, entero, MESES } from '../format';
import { ir, parametros, useRuta } from '../router';
import { SelectorBus, PestanasResumen, Tarjeta } from '../components';

const TODOS = 'Todos';

export default function ResumenAnual() {
  const q = parametros(useRuta());
  const anio = Number(q.get('anio')) || new Date().getFullYear();
  const bus = q.get('bus') ?? TODOS;
  const cambiar = (b: string, a: number) => ir(`/resumen?bus=${b}&anio=${a}`);

  const datos = useLiveQuery(async () => ({
    viajes: await db.viajes.where('fecha').between(`${anio}-01-01`, `${anio}-12-31`, true, true).toArray(),
    grandes: await db.gastos.where('fecha').between(`${anio}-01-01`, `${anio}-12-31`, true, true).toArray(),
  }), [anio]);
  if (!datos) return null;

  const viajes = filtrarBus(datos.viajes, bus);
  // Con «Todos» entran también los gastos grandes sin bus (sueldos, impuestos…).
  const grandes = bus === TODOS ? datos.grandes : datos.grandes.filter((g) => g.bus === bus);
  const meses = Array.from({ length: 12 }, (_, i) => {
    const pref = `${anio}-${String(i + 1).padStart(2, '0')}`;
    return cuentas(viajes.filter((v) => v.fecha.startsWith(pref)), grandes.filter((g) => g.fecha.startsWith(pref)));
  });
  const t = cuentas(viajes, grandes);
  const mesHoy = new Date().getFullYear() === anio ? new Date().getMonth() + 1 : 1;

  return (
    <>
      <PestanasResumen vista="anio" bus={bus} anio={anio} mes={mesHoy} />
      <div className="encabezado">
        <h1>{anio} mes por mes — {bus === TODOS ? 'todos los buses' : bus}</h1>
        <div className="acciones fila no-imprimir">
          <div className="selector-mes">
            <button type="button" onClick={() => cambiar(bus, anio - 1)} aria-label="Año anterior">‹</button>
            <input type="number" value={anio} onChange={(e) => cambiar(bus, Number(e.target.value) || anio)} />
            <button type="button" onClick={() => cambiar(bus, anio + 1)} aria-label="Año siguiente">›</button>
          </div>
          <a className="boton-imprimir" href={`#/informe?bus=${bus}&anio=${anio}&mes=${mesHoy}`}>🖨 Imprimir informe del mes</a>
          <button type="button" className="boton" onClick={() => print()}>🖨 Imprimir el año</button>
        </div>
      </div>
      <div className="filtros no-imprimir">
        <SelectorBus opciones={[...BUSES, TODOS]} valor={bus} onChange={(b) => cambiar(b, anio)} />
      </div>

      <section className="tarjetas">
        <Tarjeta titulo="Viajes del año" valor={entero(t.viajes)} nota={`${entero(t.boletosIda)} boletos de ida`} />
        <Tarjeta titulo="Ida neto" valor={bs(t.idaNeto)} color="azul" nota={t.descuentoIda ? `Descuento: ${bs(t.descuentoIda)}` : undefined} />
        <Tarjeta titulo="Llegada (trajeron)" valor={bs(t.trajeron)} color="verde" />
        <Tarjeta titulo="Gastos de los viajes" valor={bs(t.gastosViaje)} color="naranja" />
        <Tarjeta titulo="Llegada neto" valor={<span className={t.vueltaNeta < 0 ? 'negativo' : ''}>{bs(t.vueltaNeta)}</span>} color="verde" />
        <Tarjeta titulo="Diésel" valor={bs(t.diesel)} color="naranja" />
        <Tarjeta titulo="Otros gastos grandes" valor={bs(t.otrosGrandes)} color="naranja" nota="Sueldos, impuestos, mantenimiento…" />
        <Tarjeta titulo="Llegada final" valor={<span className={t.queda < 0 ? 'negativo' : ''}>{bs(t.queda)}</span>} nota="Llegada neto − diésel − otros gastos grandes (la ida no se suma)" />
      </section>

      <section className="panel">
        <h2>Mes por mes <small>(toca un mes para verlo día a día)</small></h2>
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr className="grupos">
                <th colSpan={3} className="g-navy">Mes</th>
                <th colSpan={2} className="g-azul">Ida</th>
                <th colSpan={3} className="g-verde">Llegada (vuelta)</th>
                <th colSpan={3} className="g-naranja">Gastos (se descuentan de la llegada)</th>
              </tr>
              <tr>
                <th>Mes</th><th>Viajes</th><th>Boletos</th>
                <th>Descuento</th><th>Ida neto</th>
                <th>Trajeron</th><th>Gastos viaje</th><th>Llegada neto</th>
                <th>Diésel</th><th>Otros grandes</th><th>Llegada final</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m, i) => (
                <tr key={i} className={`clic ${m.viajes || m.diesel || m.otrosGrandes ? '' : 'apagada'}`} onClick={() => ir(`/informe?modo=mes&bus=${bus}&anio=${anio}&mes=${i + 1}`)}>
                  <td><b>{MESES[i]}</b></td>
                  <td className="num">{m.viajes || '-'}</td>
                  <td className="num">{m.boletosIda ? entero(m.boletosIda) : '-'}</td>
                  <td className="num">{cero(m.descuentoIda)}</td>
                  <td className="num azul-txt fuerte">{cero(m.idaNeto)}</td>
                  <td className="num">{cero(m.trajeron)}</td>
                  <td className="num">{cero(m.gastosViaje)}</td>
                  <td className={`num ${m.vueltaNeta < 0 ? 'negativo' : 'verde-txt'}`}>{cero(m.vueltaNeta)}</td>
                  <td className="num naranja-txt">{cero(m.diesel)}</td>
                  <td className="num naranja-txt">{cero(m.otrosGrandes)}</td>
                  <td className={`num fuerte ${m.queda < 0 ? 'negativo' : ''}`}>{cero(m.queda)}</td>
                </tr>
              ))}
              <tr className="totales">
                <td>TOTAL AÑO</td>
                <td className="num">{t.viajes}</td><td className="num">{entero(t.boletosIda)}</td>
                <td className="num">{bs(t.descuentoIda)}</td><td className="num">{bs(t.idaNeto)}</td>
                <td className="num">{bs(t.trajeron)}</td><td className="num">{bs(t.gastosViaje)}</td><td className="num">{bs(t.vueltaNeta)}</td>
                <td className="num">{bs(t.diesel)}</td><td className="num">{bs(t.otrosGrandes)}</td>
                <td className={`num ${t.queda < 0 ? 'negativo' : ''}`}>{bs(t.queda)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

const cero = (n: number) => (n ? bs(n) : '-');
