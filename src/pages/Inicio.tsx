import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES, eliminar, guardar, type GastoGeneral } from '../db';
import { totalizar } from '../calc';
import { aNumero, bs, fechaCorta, hoyISO, MESES, rangoMes, uid } from '../format';
import { ir } from '../router';
import { usePermisos, useSync } from '../sync';
import { Botones, SelectorMes } from '../components';
import { CATEGORIAS_GENERALES, controlDiesel, DIESEL, esDiesel, sobranteAnterior, viajesQueCubre, vueltasPorMonto } from '../diesel';
import { BotonEscanear } from './EditarFactura';

// Inicio: solo lo esencial del mes. El detalle está en Consulta, Gastos y Facturas.
export default function Inicio() {
  const { nombre } = useSync();
  const { puedeEditar, puedeBorrar } = usePermisos();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [ventana, setVentana] = useState<'' | 'gasto' | 'diesel'>('');
  const [editar, setEditar] = useState<GastoGeneral | undefined>();
  const [desde, hasta] = rangoMes(anio, mes);
  const viajes = useLiveQuery(() => db.viajes.where('fecha').between(desde, hasta, true, true).toArray(), [desde, hasta]);
  const generales = useLiveQuery(() => db.gastos.where('fecha').between(desde, hasta, true, true).sortBy('fecha'), [desde, hasta]);

  if (!viajes || !generales) return null;
  const t = totalizar(viajes);
  const totalGenerales = generales.reduce((s, g) => s + g.monto, 0);
  const mesTxt = `${anio}-${String(mes).padStart(2, '0')}`;

  return (
    <div className="inicio">
      <div className="encabezado">
        <div>
          <p className="saludo">Hola{nombre ? `, ${nombre.split(' ')[0]}` : ''} 👋</p>
          <h1>{MESES[mes - 1]} {anio}</h1>
        </div>
        <SelectorMes anio={anio} mes={mes} onChange={(a, m) => { setAnio(a); setMes(m); }} />
      </div>

      <div className="atajos">
        {puedeEditar && <a href="#/nuevo" className="atajo naranja">➕<span>Registrar viaje</span></a>}
        {puedeEditar && <BotonEscanear fecha={mesTxt} className="atajo morado">📷<span>Escanear factura</span></BotonEscanear>}
        {puedeEditar && <button type="button" className="atajo verde" onClick={() => { setEditar(undefined); setVentana('gasto'); }}>💵<span>Gasto del monto total</span></button>}
        <button type="button" className="atajo azul" onClick={() => setVentana('diesel')}>⛽<span>Control de diésel</span></button>
      </div>

      <section className="panel principal">
        <div className="cifra"><span>Ida neto</span><b>{bs(t.idaNeto)}</b></div>
        <div className="cifra destacada"><span>Llegada neto</span><b className={t.netoFinal < 0 ? 'negativo' : ''}>{bs(t.netoFinal)}</b></div>
        <div className="cifra"><span>Gastos</span><b>{bs(t.totalGastos)}</b></div>
        <div className="cifra"><span>Otros</span><b>{bs(t.totalOtrosGastos)}</b></div>
      </section>

      <section className="panel borde-verde">
        <h2>Gastos del monto total — {MESES[mes - 1]}: {bs(totalGenerales)}</h2>
        {generales.length === 0 ? <p className="vacio">Sin gastos del monto total este mes.</p> : (
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Bus</th><th>Categoría</th><th>Monto</th><th>Observaciones</th>{puedeBorrar && <th></th>}</tr></thead>
              <tbody>
                {generales.map((g) => (
                  <tr key={g.id} className={puedeEditar ? 'clic' : ''} title={puedeEditar ? 'Clic para editar' : undefined}
                    onClick={() => { if (puedeEditar) { setEditar(g); setVentana('gasto'); } }}>
                    <td>{fechaCorta(g.fecha)}</td><td>{g.bus || '—'}</td><td>{g.categoria}{esDiesel(g.categoria) && <> · {viajesQueCubre(g.monto, g.vueltas)} vuelta(s)</>}</td>
                    <td className="num fuerte">{bs(g.monto)}</td><td className="obs">{g.observaciones}</td>
                    {puedeBorrar && <td><button type="button" className="quitar" aria-label="Eliminar"
                      onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar ${g.categoria} de ${bs(g.monto)}?`)) eliminar('gastos', [g.id]); }}>✕</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {t.viajes === 0 && <p className="vacio centro">No hay viajes en {MESES[mes - 1]}.{puedeEditar && ' Pulsa «Registrar viaje» para empezar.'}</p>}

      {ventana === 'gasto' && <VentanaGasto base={editar} fecha={hoyISO().startsWith(mesTxt) ? hoyISO() : `${mesTxt}-01`} cerrar={() => setVentana('')} />}
      {ventana === 'diesel' && <VentanaDiesel viajes={viajes} generales={generales} mes={MESES[mes - 1]} desde={desde} cerrar={() => setVentana('')} />}
    </div>
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

// Registro aparte: no se mezcla con los gastos de los viajes ni con la ida.
export function VentanaGasto({ base, fecha: inicial, cerrar }: { base?: GastoGeneral; fecha: string; cerrar: () => void }) {
  const conocida = !base || CATEGORIAS_GENERALES.includes(base.categoria);
  const [fecha, setFecha] = useState(base?.fecha ?? inicial);
  const [bus, setBus] = useState(base ? base.bus || 'General' : BUSES[0]);
  const [categoria, setCategoria] = useState(base ? (conocida ? base.categoria : 'Otro') : DIESEL);
  const [otra, setOtra] = useState(conocida ? '' : base!.categoria);
  const [monto, setMonto] = useState(base ? String(base.monto) : '');
  const [vueltas, setVueltas] = useState(base?.vueltas !== undefined ? String(base.vueltas) : '');
  const [obs, setObs] = useState(base?.observaciones ?? '');
  const [error, setError] = useState('');
  const m = aNumero(monto);
  const fueraDeRango = categoria === DIESEL && m > 0 && !vueltasPorMonto(m);

  async function guardarGasto() {
    if (!fecha || !m) { setError('Falta la fecha o el monto.'); return; }
    if (categoria === 'Otro' && !otra.trim()) { setError('Escribe qué gasto es.'); return; }
    if (fueraDeRango && vueltas === '') { setError('El monto no está en los rangos: indica de cuántas vueltas se trata.'); return; }
    const ahora = Date.now();
    await guardar('gastos', [{
      id: base?.id ?? uid(), fecha, bus: bus === 'General' ? '' : bus, categoria: categoria === 'Otro' ? otra.trim() : categoria,
      monto: m, ...(fueraDeRango ? { vueltas: Number(vueltas) } : {}), observaciones: obs.trim(), creado: base?.creado ?? ahora, actualizado: ahora,
    }]);
    cerrar();
  }

  return (
    <Ventana titulo={base ? 'Editar gasto del monto total' : 'Gasto del monto total'} cerrar={cerrar}>
      {error && <div className="aviso error">{error}</div>}
      <label>Bus</label>
      <Botones opciones={[...BUSES, 'General']} valor={bus} onChange={setBus} />
      <label>Categoría</label>
      <Botones opciones={CATEGORIAS_GENERALES} valor={categoria} onChange={setCategoria} />
      {categoria === 'Otro' && <input value={otra} placeholder="¿Qué gasto es? (ej.: lavado, multa…)" onChange={(e) => setOtra(e.target.value)} />}
      <div className="fila-campos">
        <div><label>Fecha</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
        <div><label>Monto (Bs)</label><input inputMode="decimal" value={monto} placeholder="0" onChange={(e) => setMonto(e.target.value)} /></div>
      </div>
      {categoria === DIESEL && m > 0 && !fueraDeRango && <small>Cubre {vueltasPorMonto(m)} vuelta(s).</small>}
      {fueraDeRango && <>
        <label>El monto no está en los rangos: ¿de cuántas vueltas se trata?</label>
        <Botones opciones={['0', '1', '2', '3', '4']} valor={vueltas} onChange={setVueltas} etiqueta={(v) => (v === '0' ? 'No cuenta' : `${v} vuelta${v === '1' ? '' : 's'}`)} />
      </>}
      <label>Observaciones</label>
      <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      <div className="acciones fila">
        <button type="button" className="boton primario" onClick={guardarGasto}>Guardar</button>
        <button type="button" className="boton suave" onClick={cerrar}>Cancelar</button>
      </div>
    </Ventana>
  );
}

const ticks = (n: number) => '☑'.repeat(n) + '☐'.repeat(Math.max(0, 3 - n));

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
  return (
    <Ventana titulo={`Control de diésel — ${mes}`} cerrar={cerrar}>
      <Botones opciones={BUSES} valor={bus} onChange={setBus} />
      <p><small>2000–4000 = 1 viaje · 4500–7000 = 2 · más de 7900 = 3 · fuera de rango: lo que se indicó al anotarlo</small></p>
      {arrastre > 0 && <p>⛽ Sobrante del mes anterior: <b>{arrastre} vuelta(s)</b></p>}
      <h3>Cargas de diésel ({d.cargas.length})</h3>
      {d.cargas.length === 0 ? <p className="vacio">No se cargó diésel este mes.</p> : (
        <table className="tabla">
          <thead><tr><th>Día</th><th>Monto</th><th>Viajes</th></tr></thead>
          <tbody>
            {d.cargas.map((c) => (
              <tr key={c.id}><td>{fechaCorta(c.fecha)}</td><td className="num">{bs(c.monto)}</td><td className="ticks">{ticks(viajesQueCubre(c.monto, c.vueltas))}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Viajes ({d.filas.length}) · cubiertos {Math.min(d.cubiertos, d.filas.length)}</h3>
      {d.filas.length === 0 ? <p className="vacio">Sin viajes.</p> : (
        <table className="tabla">
          <thead><tr><th>Día</th><th>Destino</th><th>Diésel</th></tr></thead>
          <tbody>
            {d.filas.map(({ viaje, cubierto }) => (
              <tr key={viaje.id} className="clic" onClick={() => ir(`/viaje/${viaje.id}`)}>
                <td>{fechaCorta(viaje.fecha)}</td><td>{viaje.destino}</td><td className="ticks">{cubierto ? '☑' : '☐'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {d.pasaAlSiguiente > 0 && <p>➡ Pasan al mes siguiente: <b>{d.pasaAlSiguiente} vuelta(s)</b></p>}
    </Ventana>
  );
}
