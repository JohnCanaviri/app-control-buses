import { useEffect, useRef, useState } from 'react';
import { db, eliminar as borrarDatos, guardar as guardarDatos, leerConfig, type Factura } from '../db';
import { TASA_IVA_POR_DEFECTO } from '../iva';
import { usePermisos } from '../sync';
import { aNumero, bs, hoyISO, uid } from '../format';
import { ir, parametros, useRuta } from '../router';

interface Borrador { fecha: string; numero: string; proveedor: string; concepto: string; monto: string; observaciones: string; foto?: string }

const CONCEPTOS = ['Diésel', 'Repuestos', 'Llantas', 'Mantenimiento', 'Lubricantes', 'Peaje'];

export default function EditarFactura({ id }: { id?: string }) {
  const { puedeBorrar } = usePermisos();
  const q = parametros(useRuta());
  const mesSugerido = q.get('fecha'); // aaaa-mm del mes que se estaba mirando
  const [base, setBase] = useState<Factura | undefined>();
  const [b, setB] = useState<Borrador | null>(id ? null : {
    fecha: mesSugerido && !hoyISO().startsWith(mesSugerido) ? `${mesSugerido}-01` : hoyISO(),
    numero: '', proveedor: '', concepto: '', monto: '', observaciones: '',
  });
  const [estado, setEstado] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [fotoGrande, setFotoGrande] = useState(false);
  const camara = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    db.facturas.get(id).then((f) => {
      if (!f) { setEstado('No se encontró esa factura.'); return; }
      setBase(f);
      setB({ ...f, monto: String(f.monto) });
    });
  }, [id]);

  const [tasa, setTasa] = useState(TASA_IVA_POR_DEFECTO);
  useEffect(() => { leerConfig('tasaIVA', TASA_IVA_POR_DEFECTO).then(setTasa); }, []);

  // «Escanear una factura» abre la cámara apenas se entra (si el navegador lo permite).
  const abrirCamara = !id && q.get('foto') === '1';
  useEffect(() => { if (abrirCamara) camara.current?.click(); }, [abrirCamara]);

  if (!b) return <p className="vacio">{estado || 'Cargando…'}</p>;
  const set = (k: keyof Borrador, v: string) => setB({ ...b, [k]: v });

  async function foto(archivo: File | undefined) {
    if (!archivo || !b) return;
    setLeyendo(true);
    try {
      const { leerFotoFactura } = await import('../lectorFoto');
      const r = await leerFotoFactura(archivo, setEstado);
      const d = r.datos;
      setB((ant) => ant && {
        ...ant, foto: r.foto,
        fecha: d.fecha ?? ant.fecha,
        numero: d.numero ?? ant.numero,
        proveedor: d.nit ? (ant.proveedor && !ant.proveedor.includes(d.nit) ? `${ant.proveedor} / NIT ${d.nit}` : `NIT ${d.nit}`) : ant.proveedor,
        monto: d.monto !== undefined ? String(d.monto) : ant.monto,
        observaciones: d.autorizacion && !ant.observaciones ? `Autorización ${d.autorizacion}` : d.cuf && !ant.observaciones ? `CUF ${d.cuf}` : ant.observaciones,
      });
      setEstado(r.mensaje);
    } catch (e) {
      setEstado(`No se pudo leer la foto: ${(e as Error).message}`);
    } finally {
      setLeyendo(false);
    }
  }

  async function guardar(otra: boolean) {
    if (!b) return;
    const monto = aNumero(b.monto);
    if (!b.fecha) { setEstado('Falta la fecha.'); return; }
    if (!monto) { setEstado('Falta el monto de la factura.'); return; }
    const ahora = Date.now();
    await guardarDatos('facturas', [{
      id: base?.id ?? uid(), fecha: b.fecha, numero: b.numero.trim(), proveedor: b.proveedor.trim(),
      concepto: b.concepto.trim(), monto, observaciones: b.observaciones.trim(), foto: b.foto,
      creado: base?.creado ?? ahora, actualizado: ahora,
    }]);
    if (otra) {
      setB({ fecha: b.fecha, numero: '', proveedor: '', concepto: '', monto: '', observaciones: '' });
      setEstado('✔ Factura guardada. Puedes escanear otra.');
      window.scrollTo(0, 0);
    } else ir(`/facturas?anio=${b.fecha.slice(0, 4)}&mes=${Number(b.fecha.slice(5, 7))}`);
  }

  async function eliminar() {
    if (!base || !confirm(`¿Eliminar la factura N° ${base.numero || '(sin número)'} de ${bs(base.monto)}? No se puede deshacer.`)) return;
    await borrarDatos('facturas', [base.id]);
    history.back();
  }

  return (
    <>
      <div className="encabezado">
        <h1>{base ? 'Editar factura' : 'Nueva factura'}</h1>
        {base && puedeBorrar && <button type="button" className="boton peligro" onClick={eliminar}>Eliminar</button>}
      </div>
      {estado && <div className={`aviso ${estado.startsWith('✔') ? '' : 'error'}`}>{leyendo && '⏳ '}{estado}</div>}

      <div className="formulario">
        <div className="columna-form">
          <section className="panel borde-morado">
            <h2>1. Foto de la factura</h2>
            <p><small>Se lee el código QR de la factura (funciona sin internet). Si no tiene QR, se intenta leer el texto (necesita internet).</small></p>
            <div className="acciones fila">
              <label className="boton primario">
                📷 Tomar foto
                <input ref={camara} type="file" accept="image/*" capture="environment" hidden disabled={leyendo}
                  onChange={(e) => { foto(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <label className="boton">
                🖼 Elegir de la galería
                <input type="file" accept="image/*" hidden disabled={leyendo} onChange={(e) => { foto(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {b.foto && <button type="button" className="boton suave" onClick={() => setB({ ...b, foto: undefined })}>Quitar foto</button>}
            </div>
            {b.foto && <img src={b.foto} alt="Foto de la factura" className={`foto-factura ${fotoGrande ? 'grande' : ''}`} onClick={() => setFotoGrande(!fotoGrande)} />}
          </section>

          <section className="panel">
            <h2>2. Datos de la factura</h2>
            <div className="fila-campos">
              <div><label>Fecha</label><input type="date" value={b.fecha} onChange={(e) => set('fecha', e.target.value)} /></div>
              <div><label>N° de factura</label><input inputMode="numeric" value={b.numero} onChange={(e) => set('numero', e.target.value)} /></div>
            </div>
            <label>Proveedor / NIT</label>
            <input value={b.proveedor} placeholder="Ej.: YPFB / NIT 1020703023" onChange={(e) => set('proveedor', e.target.value)} />
            <label>Concepto</label>
            <input value={b.concepto} placeholder="¿Qué se compró?" onChange={(e) => set('concepto', e.target.value)} />
            <div className="chips">
              {CONCEPTOS.map((c) => <button type="button" key={c} onClick={() => set('concepto', c)}>{c}</button>)}
            </div>
            <div className="fila-campos">
              <div><label>Monto de la factura (Bs)</label><input inputMode="decimal" className="monto-grande" value={b.monto} placeholder="0" onChange={(e) => set('monto', e.target.value)} /></div>
            </div>
            <label>Observaciones</label>
            <textarea rows={2} value={b.observaciones} onChange={(e) => set('observaciones', e.target.value)} />
          </section>
        </div>

        <aside className="resumen-lateral">
          <div className="panel">
            <h2>Resumen</h2>
            <dl className="resultado">
              <dt>Monto</dt><dd className="fuerte grande">{bs(aNumero(b.monto))}</dd>
              <dt>IVA crédito ({Math.round(tasa * 1000) / 10}%)</dt><dd className="morado-txt fuerte">{bs(aNumero(b.monto) * tasa)}</dd>
            </dl>
            <div className="acciones">
              <button type="button" className="boton primario" disabled={leyendo} onClick={() => guardar(false)}>Guardar</button>
              {!base && <button type="button" className="boton" disabled={leyendo} onClick={() => guardar(true)}>Guardar y escanear otra</button>}
              <button type="button" className="boton suave" onClick={() => history.back()}>Cancelar</button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
