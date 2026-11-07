import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES, eliminar as borrarDatos, guardar as guardarDatos } from '../db';
import { calcular, type Viaje } from '../calc';
import { aNumero, bs, hoyISO, uid } from '../format';
import { ir } from '../router';
import { usePermisos } from '../sync';
import { Autocompletar, Botones, Flechas, Insignia } from '../components';
import { DESDE_VUELTAS_MANUALES, esDiesel, separarDiesel } from '../diesel';

// En el formulario los números se guardan como texto para poder escribir «50,5».
interface LineaD { cantidad: string; precio: string }
interface GastoD { concepto: string; monto: string }
interface Borrador {
  bus: string; fecha: string; destino: string; horaSalida: string; horaLlegada: string;
  boletosIda: LineaD[]; descuentoIda: string; sinBoletoIda: boolean; montoIdaSinBoleto: string;
  sinBoletoLlegada: boolean; boletosLlegada: LineaD[]; montoRegistrado: string;
  gastos: GastoD[]; otrosGastos: GastoD[]; observaciones: string;
}

const CONCEPTOS_GASTOS = ['Viático', 'Peaje', 'Mantenimiento'];
// Desde noviembre el diésel se anota aparte (⛽ en Inicio), nunca dentro del viaje.
const dieselAparte = (fecha: string) => !fecha || fecha >= DESDE_VUELTAS_MANUALES;
const BUS_GUARDADO = 'ultimo-bus';

function leerBus() {
  try { return localStorage.getItem(BUS_GUARDADO) || BUSES[0]; } catch { return BUSES[0]; }
}

function nuevoBorrador(): Borrador {
  return {
    bus: leerBus(), fecha: hoyISO(), destino: '', horaSalida: '', horaLlegada: '',
    boletosIda: [], descuentoIda: '', sinBoletoIda: false, montoIdaSinBoleto: '', sinBoletoLlegada: false, boletosLlegada: [], montoRegistrado: '',
    gastos: [], otrosGastos: [], observaciones: '',
  };
}

const txt = (n: number) => (n ? String(n) : '');

function aBorrador(v: Viaje): Borrador {
  return {
    ...v,
    boletosIda: v.boletosIda.map((l) => ({ cantidad: txt(l.cantidad), precio: txt(l.precio) })),
    descuentoIda: txt(v.descuentoIda),
    sinBoletoIda: !!v.sinBoletoIda,
    montoIdaSinBoleto: v.montoIdaSinBoleto === null || v.montoIdaSinBoleto === undefined ? '' : String(v.montoIdaSinBoleto),
    boletosLlegada: v.boletosLlegada.map((l) => ({ cantidad: txt(l.cantidad), precio: txt(l.precio) })),
    montoRegistrado: txt(v.montoRegistrado),
    gastos: v.gastos.map((g) => ({ concepto: g.concepto, monto: txt(g.monto) })),
    otrosGastos: v.otrosGastos.map((g) => ({ concepto: g.concepto, monto: txt(g.monto) })),
  };
}

function aViaje(b: Borrador, base?: Viaje): Viaje {
  const lineas = (ls: LineaD[]) => ls
    .map((l) => ({ cantidad: aNumero(l.cantidad), precio: aNumero(l.precio) }))
    .filter((l) => l.cantidad !== 0 || l.precio !== 0);
  const gastos = (gs: GastoD[]) => gs
    .map((g) => ({ concepto: g.concepto.trim(), monto: aNumero(g.monto) }))
    .filter((g) => g.monto !== 0 || g.concepto !== '');
  const ahora = Date.now();
  return {
    id: base?.id ?? uid(),
    bus: b.bus, fecha: b.fecha, destino: b.destino.trim(), horaSalida: b.horaSalida, horaLlegada: b.horaLlegada,
    boletosIda: b.sinBoletoIda ? [] : lineas(b.boletosIda), descuentoIda: aNumero(b.descuentoIda),
    ...(b.sinBoletoIda ? { sinBoletoIda: true, montoIdaSinBoleto: b.montoIdaSinBoleto.trim() === '' ? null : aNumero(b.montoIdaSinBoleto) } : {}),
    sinBoletoLlegada: b.sinBoletoLlegada, boletosLlegada: b.sinBoletoLlegada ? [] : lineas(b.boletosLlegada),
    montoRegistrado: aNumero(b.montoRegistrado),
    gastos: gastos(b.gastos), otrosGastos: gastos(b.otrosGastos), observaciones: b.observaciones.trim(),
    creado: base?.creado ?? ahora, actualizado: ahora,
  };
}

export default function EditarViaje({ id }: { id?: string }) {
  const { puedeBorrar, puedeEditar } = usePermisos();
  const [base, setBase] = useState<Viaje | undefined>();
  const [b, setB] = useState<Borrador | null>(id ? null : nuevoBorrador());
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (!id) return;
    db.viajes.get(id).then((v) => {
      if (v) { setBase(v); setB(aBorrador(v)); } else setAviso('No se encontró ese viaje.');
    });
  }, [id]);

  const viaje = useMemo(() => (b ? aViaje(b, base) : null), [b, base]);
  // Viajes antiguos con diésel: al guardar, el diésel pasa a «gastos del monto total». El resultado que se ve
  // es el que se guarda (sin el diésel).
  const separado = useMemo(() => (viaje ? separarDiesel(viaje) : null), [viaje]);
  const c = useMemo(() => (viaje ? calcular(separado?.viaje ?? viaje) : null), [viaje, separado]);

  // Viajes del mismo bus y mes, para las flechas ‹ ›.
  const mesBus = base ? `${base.bus}|${base.fecha.slice(0, 7)}` : '';
  const hermanos = useLiveQuery(async () => {
    if (!base) return [];
    const m = base.fecha.slice(0, 7);
    return (await db.viajes.where('[bus+fecha]').between([base.bus, `${m}-01`], [base.bus, `${m}-31`], true, true).toArray())
      .sort((x, y) => x.fecha.localeCompare(y.fecha) || x.creado - y.creado).map((x) => x.id);
  }, [mesBus]) ?? [];

  if (!b || !viaje || !c) return <p className="vacio">{aviso || 'Cargando…'}</p>;
  const aparte = dieselAparte(b.fecha);
  const conDiesel = [...b.gastos, ...b.otrosGastos].some((g) => esDiesel(g.concepto));

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB({ ...b, [k]: v });

  async function guardar(otro: boolean) {
    if (!b || !viaje) return;
    if (!b.fecha) { setAviso('Falta la fecha.'); return; }
    if (!viaje.boletosIda.length && !b.sinBoletoIda && !viaje.montoRegistrado && !viaje.gastos.length) {
      setAviso('Anota los boletos de ida (o marca «Sin boletos de ida») o el monto que trajeron.'); return;
    }
    if (aparte && conDiesel) {
      setAviso('✖ Desde noviembre el diésel se anota con «⛽ Echar diésel» en Inicio (ahí se indican las vueltas). Quita el diésel de los gastos del viaje.');
      window.scrollTo(0, 0);
      return;
    }
    // Viajes antiguos: el diésel que tenían pasa a «gastos del monto total» del mes.
    const d = separado;
    if (d) await guardarDatos('gastos', d.cargas.map((c) => ({ ...c, id: uid() })));
    await guardarDatos('viajes', [d ? d.viaje : viaje]);
    try { localStorage.setItem(BUS_GUARDADO, b.bus); } catch { /* sin almacenamiento */ }
    if (otro) { setBase(undefined); setB({ ...nuevoBorrador(), bus: b.bus, fecha: b.fecha }); setAviso('✔ Viaje guardado. Puedes registrar otro.'); window.scrollTo(0, 0); }
    else ir(`/consulta?bus=${b.bus}&anio=${b.fecha.slice(0, 4)}&mes=${Number(b.fecha.slice(5, 7))}`);
  }

  async function eliminar() {
    if (!base) return;
    if (!confirm(`¿Eliminar el viaje de ${base.bus} del ${base.fecha}? No se puede deshacer.`)) return;
    await borrarDatos('viajes', [base.id]);
    history.back();
  }

  return (
    <>
      <div className="encabezado">
        <h1>{base ? 'Editar viaje' : 'Nuevo viaje'}</h1>
        {base && <Flechas ids={hermanos} actual={base.id} ruta={(x) => `/viaje/${encodeURIComponent(x)}`} texto={`Viaje de ${base.bus}`} />}
        {base && puedeBorrar && <button type="button" className="boton peligro" onClick={eliminar}>Eliminar</button>}
      </div>
      {aviso && <div className="aviso" onClick={() => setAviso('')}>{aviso}</div>}

      <div className="formulario">
        <div className="columna-form">
          <section className="panel">
            <h2>1. Información del viaje</h2>
            <label>Bus</label>
            <Botones opciones={BUSES} valor={b.bus} onChange={(v) => set('bus', v)} />
            <div className="fila-campos">
              <div><label>Fecha</label><input type="date" value={b.fecha} onChange={(e) => set('fecha', e.target.value)} /></div>
              <div>
                <label>Destino</label>
                <Autocompletar fuente="destinos" value={b.destino} placeholder="Lp, Cbba…" onChange={(v) => set('destino', v)} />
              </div>
            </div>
            <div className="fila-campos">
              <div><label>Hora de salida</label><input type="time" value={b.horaSalida} onChange={(e) => set('horaSalida', e.target.value)} /></div>
              <div><label>Hora de llegada</label><input type="time" value={b.horaLlegada} onChange={(e) => set('horaLlegada', e.target.value)} /></div>
            </div>
          </section>

          <section className="panel borde-azul">
            <h2>2. Ida</h2>
            <label className="check">
              <input type="checkbox" checked={b.sinBoletoIda} onChange={(e) => set('sinBoletoIda', e.target.checked)} />
              Sin boletos de ida (no trajeron boletos)
            </label>
            {b.sinBoletoIda ? (
              <div className="fila-campos">
                <div>
                  <label>¿Cuánto trajeron de la ida? (Bs)</label>
                  <input inputMode="decimal" value={b.montoIdaSinBoleto} placeholder="Déjalo vacío si aún no se sabe" onChange={(e) => set('montoIdaSinBoleto', e.target.value)} />
                  <small>Si lo dejas vacío, a fin de mes la app te preguntará cuánto trajeron ese día.</small>
                </div>
              </div>
            ) : <EditorBoletos lineas={b.boletosIda} onChange={(l) => set('boletosIda', l)} precios={[]} />}
            <div className="fila-campos">
              <div>
                <label>Descuento de ida (Bs)</label>
                <input inputMode="decimal" value={b.descuentoIda} placeholder="0" onChange={(e) => set('descuentoIda', e.target.value)} />
                <small>Se resta solo al monto de ida.</small>
              </div>
            </div>
            <div className="subtotales">
              <span>{b.sinBoletoIda ? (c.idaPendiente ? <b className="naranja-txt">Sin boletos · falta el monto</b> : 'Sin boletos') : `${c.boletosIda} boletos`}</span>
              <span>Ida: <b>{bs(c.montoIda)}</b></span>
              <span>Ida neto: <b className="azul-txt">{bs(c.idaNeto)}</b></span>
            </div>
          </section>

          <section className="panel borde-verde">
            <h2>3. Llegada</h2>
            <label className="check">
              <input type="checkbox" checked={b.sinBoletoLlegada} onChange={(e) => set('sinBoletoLlegada', e.target.checked)} />
              Sin boleto (el monto calculado será igual al que trajeron)
            </label>
            {!b.sinBoletoLlegada && <EditorBoletos lineas={b.boletosLlegada} onChange={(l) => set('boletosLlegada', l)} precios={[]} />}
            <div className="fila-campos">
              <div>
                <label>Monto que trajeron (Bs)</label>
                <input inputMode="decimal" value={b.montoRegistrado} placeholder="0" onChange={(e) => set('montoRegistrado', e.target.value)} />
              </div>
              {!b.sinBoletoLlegada && c.montoCalculadoLlegada !== null && (
                <div className="al-fondo">
                  <button type="button" className="boton suave" onClick={() => set('montoRegistrado', String(c.montoCalculadoLlegada))}>
                    Usar el calculado ({bs(c.montoCalculadoLlegada)})
                  </button>
                </div>
              )}
            </div>
            <div className="subtotales">
              <span>Calculado: <b>{bs(c.montoCalculadoLlegada)}</b></span>
              <Insignia v={c.verificacion} />
            </div>
          </section>

          <section className="panel borde-naranja">
            <h2>4. Gastos</h2>
            <EditorGastos gastos={b.gastos} onChange={(g) => set('gastos', g)} conceptos={CONCEPTOS_GASTOS} />
            {aparte
              ? <p><small>⛽ El diésel <b>no</b> se anota aquí: usa «Echar diésel» en Inicio, donde se indican las vueltas.</small></p>
              : separado && <p className="naranja-txt"><small>Este viaje antiguo tiene diésel: al guardar pasa a «gastos del monto total» de {b.bus} (el resultado de la derecha ya lo muestra sin el diésel).</small></p>}
            {aparte && conDiesel && <div className="aviso error">Quita el diésel de los gastos del viaje: se anota con «⛽ Echar diésel» en Inicio.</div>}
            {b.otrosGastos.length > 0 && <>
              <h3>Otros gastos <small>(de registros antiguos)</small></h3>
              <EditorGastos gastos={b.otrosGastos} onChange={(g) => set('otrosGastos', g)} conceptos={[]} />
            </>}
          </section>

          <section className="panel">
            <h2>5. Observaciones</h2>
            <textarea rows={2} placeholder="Notas del viaje (se ven en consultas y reportes)" value={b.observaciones} onChange={(e) => set('observaciones', e.target.value)} />
          </section>
        </div>

        <aside className="resumen-lateral">
          <div className="panel">
            <h2>Resultado</h2>
            <dl className="resultado">
              <dt>Monto ida{b.sinBoletoIda ? ' (sin boletos)' : ''}</dt><dd>{c.idaPendiente ? <span className="naranja-txt">falta</span> : bs(c.montoIda)}</dd>
              <dt>Descuento</dt><dd>− {bs(c.descuentoIda)}</dd>
              <dt className="fuerte">Ida neto</dt><dd className="fuerte azul-txt">{bs(c.idaNeto)}</dd>
              <dt className="sep">Monto que trajeron</dt><dd className="sep">{bs(c.montoRegistrado)}</dd>
              <dt>Gastos</dt><dd>− {bs(c.totalGastos)}</dd>
              <dt>Total menos gastos</dt><dd>{bs(c.totalMenosGastos)}</dd>
              {c.totalOtrosGastos !== 0 && <><dt>Otros gastos</dt><dd>− {bs(c.totalOtrosGastos)}</dd></>}
              <dt className="fuerte">Llegada neto</dt><dd className={`fuerte grande ${c.netoFinal < 0 ? 'negativo' : ''}`}>{bs(c.netoFinal)}</dd>
            </dl>
            <div className="acciones">
              {puedeEditar && <button type="button" className="boton primario" onClick={() => guardar(false)}>Guardar</button>}
              {!base && puedeEditar && <button type="button" className="boton" onClick={() => guardar(true)}>Guardar y registrar otro</button>}
              <button type="button" className="boton suave" onClick={() => history.back()}>Cancelar</button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function EditorBoletos({ lineas, onChange, precios }: { lineas: LineaD[]; onChange: (l: LineaD[]) => void; precios: number[] }) {
  const cambiar = (i: number, k: keyof LineaD, v: string) => onChange(lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const agregar = (precio = '') => {
    // Tocar un precio que ya está suma un boleto a esa línea.
    const i = precio ? lineas.findIndex((l) => l.precio === precio) : -1;
    if (i >= 0) cambiar(i, 'cantidad', String(aNumero(lineas[i].cantidad) + 1));
    else onChange([...lineas, { cantidad: precio ? '1' : '', precio }]);
  };
  return (
    <div className="editor">
      {lineas.length > 0 && (
        <div className="editor-cab"><span>Cantidad</span><span></span><span>Precio (Bs)</span><span>Subtotal</span><span></span></div>
      )}
      {lineas.map((l, i) => (
        <div className="editor-fila" key={i}>
          <input inputMode="numeric" value={l.cantidad} placeholder="0" onChange={(e) => cambiar(i, 'cantidad', e.target.value)} />
          <span className="x">×</span>
          <input inputMode="decimal" value={l.precio} placeholder="0" onChange={(e) => cambiar(i, 'precio', e.target.value)} />
          <span className="num">{bs(aNumero(l.cantidad) * aNumero(l.precio))}</span>
          <button type="button" className="quitar" aria-label="Quitar" onClick={() => onChange(lineas.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="chips">
        {precios.map((p) => <button type="button" key={p} onClick={() => agregar(String(p))}>+ {p}</button>)}
        <button type="button" className="otro" onClick={() => agregar()}>+ Otra línea</button>
      </div>
    </div>
  );
}

function EditorGastos({ gastos, onChange, conceptos }: { gastos: GastoD[]; onChange: (g: GastoD[]) => void; conceptos: string[] }) {
  const cambiar = (i: number, k: keyof GastoD, v: string) => onChange(gastos.map((g, j) => (j === i ? { ...g, [k]: v } : g)));
  return (
    <div className="editor">
      {gastos.map((g, i) => (
        <div className="editor-fila gasto" key={i}>
          <Autocompletar fuente="conceptosGasto" extra={conceptos} value={g.concepto} placeholder="Concepto" onChange={(v) => cambiar(i, 'concepto', v)} />
          <input inputMode="decimal" value={g.monto} placeholder="Monto" onChange={(e) => cambiar(i, 'monto', e.target.value)} />
          <button type="button" className="quitar" aria-label="Quitar" onClick={() => onChange(gastos.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="chips">
        {conceptos.map((cpt) => <button type="button" key={cpt} onClick={() => onChange([...gastos, { concepto: cpt, monto: '' }])}>+ {cpt}</button>)}
        <button type="button" className="otro" onClick={() => onChange([...gastos, { concepto: '', monto: '' }])}>+ Otro (escribir)</button>
      </div>
    </div>
  );
}
