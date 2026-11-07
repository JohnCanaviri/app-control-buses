import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES, eliminar, guardar, type GastoGeneral } from '../db';
import { calcular, totalizar, type Viaje } from '../calc';
import { aNumero, bs, fechaCorta, hoyISO, MESES, rangoMes, uid } from '../format';
import { ir } from '../router';
import { usePermisos, useSync } from '../sync';
import { Autocompletar, Botones, SelectorBus, SelectorMes, ViajesDelMes } from '../components';
import {
  CATEGORIAS_GENERALES, controlDiesel, DIESEL, esDiesel, estadoDiesel, faltanVueltas, sobranteAnterior, vueltasDe, vueltasPorRango,
} from '../diesel';
import { porBus } from '../informe';
import { BotonEscanear } from './EditarFactura';

// Inicio: solo lo esencial del mes. El detalle está en Consulta, Gastos y Facturas.
export default function Inicio() {
  const { nombre } = useSync();
  const { puedeEditar } = usePermisos();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [ventana, setVentana] = useState<'' | 'gasto' | 'diesel' | 'control'>('');
  const [editar, setEditar] = useState<GastoGeneral | undefined>();
  const [desde, hasta] = rangoMes(anio, mes);
  const viajes = useLiveQuery(() => db.viajes.where('fecha').between(desde, hasta, true, true).toArray(), [desde, hasta]);
  const generales = useLiveQuery(() => db.gastos.where('fecha').between(desde, hasta, true, true).sortBy('fecha'), [desde, hasta]);
  // Para el tanque de hoy y los viajes sin boletos de ida pendientes hace falta todo lo anterior.
  const hoyTxt = hoyISO();
  const tanque = useLiveQuery(async () => {
    const vs = await db.viajes.where('fecha').belowOrEqual(hoyTxt).toArray();
    const gs = (await db.gastos.where('fecha').belowOrEqual(hoyTxt).toArray()).filter((g) => esDiesel(g.categoria));
    return BUSES.map((b) => estadoDiesel(b, vs, gs, hoyTxt));
  }, [hoyTxt]);
  const pendientesIda = useLiveQuery(async () => (await db.viajes.filter((v) => !!v.sinBoletoIda && calcular(v).idaPendiente).toArray())
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.bus.localeCompare(b.bus)), []);

  if (!viajes || !generales) return null;
  const t = totalizar(viajes);
  const mesTxt = `${anio}-${String(mes).padStart(2, '0')}`;
  const pb = porBus(viajes, generales, BUSES);
  const fechaNueva = hoyTxt.startsWith(mesTxt) ? hoyTxt : `${mesTxt}-01`;

  return (
    <div className="inicio">
      <div className="encabezado">
        <div>
          <p className="saludo">Hola{nombre ? `, ${nombre.split(' ')[0]}` : ''} 👋</p>
          <h1>{MESES[mes - 1]} {anio}</h1>
        </div>
        <SelectorMes anio={anio} mes={mes} onChange={(a, m) => { setAnio(a); setMes(m); }} />
      </div>

      {tanque && <AlertasDiesel estados={tanque} />}

      <div className="atajos">
        {puedeEditar && <a href="#/nuevo" className="atajo naranja">➕<span>Registrar viaje</span></a>}
        {puedeEditar && <button type="button" className="atajo rojo" onClick={() => { setEditar(undefined); setVentana('diesel'); }}>⛽<span>Echar diésel</span></button>}
        {puedeEditar && <BotonEscanear fecha={mesTxt} className="atajo morado">📷<span>Escanear factura</span></BotonEscanear>}
        {puedeEditar && <button type="button" className="atajo verde" onClick={() => { setEditar(undefined); setVentana('gasto'); }}>💵<span>Gasto del monto total</span></button>}
        <button type="button" className="atajo azul" onClick={() => setVentana('control')}>📋<span>Control de diésel</span></button>
        <a href="#/informe" className="atajo gris">🖨<span>Informe del mes</span></a>
      </div>

      <ViajesDelMes viajes={viajes} buses={BUSES} />

      <section className="panel principal">
        <div className="cifra"><span>Ida neto</span><b>{bs(t.idaNeto)}</b></div>
        <div className="cifra"><span>Llegada neto</span><b className={t.netoFinal < 0 ? 'negativo' : ''}>{bs(t.netoFinal)}</b></div>
        <div className="cifra"><span>Gastos de los viajes</span><b>{bs(t.totalGastos + t.totalOtrosGastos)}</b></div>
        <div className="cifra"><span>Diésel</span><b>{bs(pb.total.diesel)}</b></div>
        <div className="cifra"><span>Otros gastos grandes</span><b>{bs(pb.total.otrosGrandes)}</b></div>
        <div className="cifra destacada"><span>Llegada final</span><b className={pb.total.queda < 0 ? 'negativo' : ''}>{bs(pb.total.queda)}</b></div>
      </section>

      {t.viajes === 0 && <p className="vacio centro">No hay viajes en {MESES[mes - 1]}.{puedeEditar && ' Pulsa «Registrar viaje» para empezar.'}</p>}

      <section className="panel">
        <h2>Llegada de cada bus — {MESES[mes - 1]} {anio}</h2>
        <p><small>Solo la llegada: la ida no se suma. Todos los gastos se descuentan solo de la llegada neto.</small></p>
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Bus</th><th>Llegada neto</th><th>Diésel</th><th>Otros gastos</th><th>Llegada final</th></tr></thead>
            <tbody>
              {pb.filas.map(({ bus, c }) => (
                <tr key={bus} className="clic" onClick={() => ir(`/informe?bus=${bus}&anio=${anio}&mes=${mes}`)} title="Ver el informe día a día">
                  <td><b>{bus}</b></td>
                  <td className={`num ${c.vueltaNeta < 0 ? 'negativo' : 'verde-txt'}`}>{bs(c.vueltaNeta)}</td>
                  <td className="num naranja-txt">− {bs(c.diesel)}</td><td className="num naranja-txt">− {bs(c.otrosGrandes)}</td>
                  <td className={`num fuerte ${c.queda < 0 ? 'negativo' : ''}`}>{bs(c.queda)}</td>
                </tr>
              ))}
              {(pb.generales.diesel > 0 || pb.generales.otrosGrandes > 0) && (
                <tr>
                  <td><b>General</b> <small>(sin bus)</small></td><td></td>
                  <td className="num naranja-txt">− {bs(pb.generales.diesel)}</td><td className="num naranja-txt">− {bs(pb.generales.otrosGrandes)}</td>
                  <td className="num fuerte negativo">{bs(pb.generales.queda)}</td>
                </tr>
              )}
              <tr className="totales">
                <td>TOTAL</td>
                <td className="num">{bs(pb.total.vueltaNeta)}</td>
                <td className="num">− {bs(pb.total.diesel)}</td><td className="num">− {bs(pb.total.otrosGrandes)}</td>
                <td className={`num ${pb.total.queda < 0 ? 'negativo' : ''}`}>{bs(pb.total.queda)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {pendientesIda && pendientesIda.length > 0 && <PendientesIda viajes={pendientesIda} puedeEditar={puedeEditar} />}

      {ventana === 'gasto' && <VentanaGasto base={editar} fecha={fechaNueva} cerrar={() => setVentana('')} />}
      {ventana === 'diesel' && <VentanaGasto base={editar} fecha={fechaNueva} soloDiesel cerrar={() => setVentana('')} />}
      {ventana === 'control' && <VentanaDiesel viajes={viajes} generales={generales} mes={MESES[mes - 1]} desde={desde} cerrar={() => setVentana('')} />}
    </div>
  );
}

// Arriba de todo: cómo está el tanque de cada bus hoy.
function AlertasDiesel({ estados }: { estados: ReturnType<typeof estadoDiesel>[] }) {
  return (
    <div className="alertas-diesel">
      {estados.map((e) => (
        <div key={e.bus} className={`alerta-diesel ${e.nivel}`}>
          <b className="alerta-bus">{e.bus}</b>
          {e.nivel === 'sin' && <span><b>⛽ ECHAR DIÉSEL {e.bus}</b> · 0 vueltas — sin combustible</span>}
          {e.nivel === 'echar' && <span><b>⛽ ECHAR DIÉSEL {e.bus}</b> · nos queda 1 vuelta con combustible</span>}
          {e.nivel === 'ok' && <span>Nos quedan <b>{e.quedan} vueltas</b> con combustible</span>}
          {e.sinCubrir > 0 && <small> · {e.sinCubrir} viaje(s) de este mes sin diésel anotado</small>}
          {e.faltanVueltas > 0 && <small> · {e.faltanVueltas} carga(s) sin vueltas: corrígelas</small>}
        </div>
      ))}
    </div>
  );
}

// Viajes sin boletos de ida a los que falta anotar cuánto trajeron (se pregunta a fin de mes).
function PendientesIda({ viajes, puedeEditar }: { viajes: Viaje[]; puedeEditar: boolean }) {
  const [montos, setMontos] = useState<Record<string, string>>({});
  const finDeMes = new Date().getDate() >= 25;
  async function guardarUno(v: Viaje) {
    const txt = montos[v.id]?.trim();
    if (!txt) return;
    await guardar('viajes', [{ ...v, montoIdaSinBoleto: aNumero(txt), actualizado: Date.now() }]);
  }
  return (
    <section className={`panel borde-naranja ${finDeMes ? 'llamativo' : ''}`}>
      <h2>{finDeMes ? '📅 Fin de mes: ' : ''}¿Cuánto trajeron de la ida sin boletos? ({viajes.length})</h2>
      <p><small>Estos viajes se registraron «sin boletos de ida». Anota cuánto trajeron de la ida en esa fecha para que cuadren los totales.</small></p>
      <div className="tabla-wrap">
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Bus</th><th>Destino</th><th>Trajeron de la ida (Bs)</th>{puedeEditar && <th></th>}</tr></thead>
          <tbody>
            {viajes.map((v) => (
              <tr key={v.id}>
                <td className="clic" onClick={() => ir(`/viaje/${encodeURIComponent(v.id)}`)}>{fechaCorta(v.fecha)}</td><td><b>{v.bus}</b></td><td>{v.destino}</td>
                <td>{puedeEditar
                  ? <input inputMode="decimal" className="monto-celda" value={montos[v.id] ?? ''} placeholder="0"
                    onChange={(e) => setMontos({ ...montos, [v.id]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') guardarUno(v); }} />
                  : 'falta'}</td>
                {puedeEditar && <td><button type="button" className="boton primario" disabled={!montos[v.id]?.trim()} onClick={() => guardarUno(v)}>Guardar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Ventana({ titulo, cerrar, children }: { titulo: string; cerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-fondo" onClick={cerrar}>
      <div className="modal panel" role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="encabezado"><h2>{titulo}</h2><button type="button" className="quitar" aria-label="Cerrar" onClick={cerrar}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

const VUELTAS = ['1', '2', '3', '4', '5', '0'];

// Registro aparte: no se mezcla con los gastos de los viajes ni con la ida.
// «soloDiesel»: la ventana de «Echar diésel» (las vueltas se anotan siempre a mano).
export function VentanaGasto({ base, fecha: inicial, cerrar, soloDiesel }: { base?: GastoGeneral; fecha: string; cerrar: () => void; soloDiesel?: boolean }) {
  const { puedeBorrar } = usePermisos();
  const conocida = !base || CATEGORIAS_GENERALES.includes(base.categoria);
  const [fecha, setFecha] = useState(base?.fecha ?? (soloDiesel ? hoyISO() : inicial));
  const [bus, setBus] = useState(base ? base.bus || 'General' : BUSES[0]);
  const [categoria, setCategoria] = useState(base ? (conocida ? base.categoria : 'Otro') : soloDiesel ? DIESEL : 'Sueldos');
  const [otra, setOtra] = useState(conocida ? '' : base!.categoria);
  const [monto, setMonto] = useState(base ? String(base.monto) : '');
  const [vueltas, setVueltas] = useState(base?.vueltas !== undefined && base?.vueltas !== null ? String(base.vueltas) : '');
  const [obs, setObs] = useState(base?.observaciones ?? '');
  const [error, setError] = useState('');
  const m = aNumero(monto);
  const esCarga = categoria === DIESEL;

  async function guardarGasto() {
    if (!fecha || !m) { setError('Falta la fecha o el monto.'); return; }
    if (categoria === 'Otro' && !otra.trim()) { setError('Escribe qué gasto es.'); return; }
    if (esCarga && vueltas === '') { setError('Indica para cuántas vueltas (viajes) alcanza este diésel.'); return; }
    if (esCarga && bus === 'General') { setError('El diésel es de un bus: elige TDS, PIN o PKS.'); return; }
    const ahora = Date.now();
    await guardar('gastos', [{
      id: base?.id ?? uid(), fecha, bus: bus === 'General' ? '' : bus, categoria: categoria === 'Otro' ? otra.trim() : categoria,
      monto: m, ...(esCarga ? { vueltas: Number(vueltas) } : {}), observaciones: obs.trim(), creado: base?.creado ?? ahora, actualizado: ahora,
    }]);
    cerrar();
  }

  const antigua = base && vueltasPorRango(base) && vueltas === '';
  return (
    <Ventana titulo={soloDiesel ? (base ? 'Editar carga de diésel' : '⛽ Echar diésel') : base ? 'Editar gasto del monto total' : 'Gasto del monto total'} cerrar={cerrar}>
      {error && <div className="aviso error">{error}</div>}
      <label>Bus</label>
      <Botones opciones={esCarga ? BUSES : [...BUSES, 'General']} valor={bus} onChange={setBus} />
      {!soloDiesel && <>
        <label>Categoría</label>
        <Botones opciones={CATEGORIAS_GENERALES} valor={categoria} onChange={setCategoria} />
        {categoria === 'Otro' && <Autocompletar fuente="categoriasGasto" value={otra} placeholder="¿Qué gasto es? (ej.: lavado, multa…)" onChange={setOtra} />}
      </>}
      <div className="fila-campos">
        <div><label>Fecha</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
        <div><label>Monto (Bs)</label><input inputMode="decimal" value={monto} placeholder="0" onChange={(e) => setMonto(e.target.value)} /></div>
      </div>
      {esCarga && <>
        <label>¿Para cuántas vueltas (viajes) alcanza?</label>
        <Botones opciones={VUELTAS} valor={vueltas} onChange={setVueltas} etiqueta={(v) => (v === '0' ? 'No cuenta' : `${v} vuelta${v === '1' ? '' : 's'}`)} />
        {antigua && <small>Carga antigua: hasta ahora contaba {vueltasDe(base!)} vuelta(s) según el monto. Indica las vueltas para corregirla.</small>}
      </>}
      <label>Observaciones</label>
      <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      <div className="acciones fila">
        <button type="button" className="boton primario" onClick={guardarGasto}>Guardar</button>
        {base && puedeBorrar && <button type="button" className="boton peligro" onClick={async () => {
          if (!confirm(`¿Eliminar ${base.categoria} de ${bs(base.monto)} del ${fechaCorta(base.fecha)}? No se puede deshacer.`)) return;
          await eliminar('gastos', [base.id]);
          cerrar();
        }}>Eliminar</button>}
        <button type="button" className="boton suave" onClick={cerrar}>Cancelar</button>
      </div>
    </Ventana>
  );
}

const ticks = (n: number) => '☑'.repeat(Math.min(n, 6)) + '☐'.repeat(Math.max(0, 3 - n));

function VentanaDiesel({ viajes, generales, mes, desde, cerrar }: {
  viajes: Parameters<typeof controlDiesel>[0]; generales: Parameters<typeof controlDiesel>[1]; mes: string; desde: string; cerrar: () => void;
}) {
  const [bus, setBus] = useState(BUSES[0]);
  // Lo que sobró de diésel en los meses anteriores se suma a este mes.
  const arrastre = useLiveQuery(async () => sobranteAnterior(
    await db.viajes.where('[bus+fecha]').between([bus, ''], [bus, desde]).toArray(),
    (await db.gastos.where('fecha').below(desde).toArray()).filter((g) => g.bus === bus && esDiesel(g.categoria)),
  ), [bus, desde]) ?? 0;
  const d = controlDiesel(viajes.filter((v) => v.bus === bus), generales.filter((g) => g.bus === bus && esDiesel(g.categoria)), arrastre);
  const quedan = d.pasaAlSiguiente;
  return (
    <Ventana titulo={`Control de diésel — ${mes}`} cerrar={cerrar}>
      <SelectorBus opciones={BUSES} valor={bus} onChange={setBus} />
      <div className={`alerta-diesel ${quedan <= 0 ? 'sin' : quedan === 1 ? 'echar' : 'ok'}`}>
        <b className="alerta-bus">{bus}</b>
        {quedan <= 0 ? <span><b>0 vueltas — sin combustible · ECHAR DIÉSEL {bus}</b></span>
          : quedan === 1 ? <span><b>Nos queda 1 vuelta con combustible · ECHAR DIÉSEL {bus}</b></span>
            : <span>Nos quedan <b>{quedan} vueltas</b> con combustible</span>}
      </div>
      <p><small>Las vueltas de cada carga las indica quien echa el diésel. Cada viaje registrado usa una vuelta.</small></p>
      {arrastre > 0 && <p>⛽ Del mes anterior quedaban: <b>{arrastre} vuelta(s)</b></p>}
      <h3>Cargas de diésel ({d.cargas.length})</h3>
      {d.cargas.length === 0 ? <p className="vacio">No se cargó diésel este mes.</p> : (
        <table className="tabla">
          <thead><tr><th>Día</th><th>Monto</th><th>Vueltas</th></tr></thead>
          <tbody>
            {d.cargas.map((c) => (
              <tr key={c.id}><td>{fechaCorta(c.fecha)}</td><td className="num">{bs(c.monto)}</td>
                <td className="ticks">{faltanVueltas(c) ? <b className="negativo">faltan</b> : <>{ticks(vueltasDe(c))} {vueltasDe(c)}</>}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Viajes ({d.filas.length}) · con diésel {Math.min(d.cubiertos, d.filas.length)}</h3>
      {d.filas.length === 0 ? <p className="vacio">Sin viajes.</p> : (
        <table className="tabla">
          <thead><tr><th>Día</th><th>Destino</th><th>Diésel</th></tr></thead>
          <tbody>
            {d.filas.map(({ viaje, cubierto }) => (
              <tr key={viaje.id} className="clic" onClick={() => ir(`/viaje/${encodeURIComponent(viaje.id)}`)}>
                <td>{fechaCorta(viaje.fecha)}</td><td>{viaje.destino}</td><td className="ticks">{cubierto ? '☑' : <b className="negativo">☐ sin diésel</b>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Ventana>
  );
}
