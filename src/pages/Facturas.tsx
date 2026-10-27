import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, guardarConfig, leerConfig } from '../db';
import { calcularIVA, TASA_IVA_POR_DEFECTO } from '../iva';
import { bs, fechaCorta, MESES, rangoMes } from '../format';
import { ir, parametros, useRuta } from '../router';
import { SelectorMes, Tarjeta } from '../components';

export default function Facturas() {
  const q = parametros(useRuta());
  const hoy = new Date();
  const anio = Number(q.get('anio')) || hoy.getFullYear();
  const mes = Number(q.get('mes')) || hoy.getMonth() + 1;
  const [desde, hasta] = rangoMes(anio, mes);

  const [tasa, setTasa] = useState(TASA_IVA_POR_DEFECTO);
  const [tasaTxt, setTasaTxt] = useState('13');
  useEffect(() => { leerConfig('tasaIVA', TASA_IVA_POR_DEFECTO).then((t) => { setTasa(t); setTasaTxt(String(Math.round(t * 1000) / 10)); }); }, []);
  const cambiarTasa = (txt: string) => {
    setTasaTxt(txt);
    const n = Number(txt.replace(',', '.'));
    if (Number.isFinite(n) && n >= 0 && n <= 100) { setTasa(n / 100); guardarConfig('tasaIVA', n / 100); }
  };

  const datos = useLiveQuery(async () => ({
    viajes: await db.viajes.where('fecha').between(desde, hasta, true, true).toArray(),
    facturas: (await db.facturas.where('fecha').between(desde, hasta, true, true).toArray()).sort((a, b) => a.fecha.localeCompare(b.fecha)),
  }), [desde, hasta]);
  if (!datos) return null;
  const iva = calcularIVA(datos.viajes, datos.facturas, tasa);
  const pct = `${Math.round(tasa * 1000) / 10}%`;

  async function exportar() {
    const { exportarMesContador } = await import('../exportar');
    exportarMesContador(anio, mes, datos!.viajes, datos!.facturas, tasa);
  }

  return (
    <>
      <div className="encabezado">
        <h1>Facturas e IVA — {MESES[mes - 1]} {anio}</h1>
        <div className="acciones fila no-imprimir">
          <button type="button" className="boton" onClick={exportar}>📤 Excel para el contador</button>
          <button type="button" className="boton" onClick={() => print()}>🖨 Imprimir / PDF</button>
        </div>
      </div>
      <div className="filtros no-imprimir">
        <SelectorMes anio={anio} mes={mes} onChange={(a, m) => ir(`/facturas?anio=${a}&mes=${m}`)} />
        <div className="tasa">
          <label>Tasa IVA (%)</label>
          <input inputMode="decimal" value={tasaTxt} onChange={(e) => cambiarTasa(e.target.value)} />
        </div>
      </div>

      <div className="acciones fila no-imprimir" style={{ marginBottom: 16 }}>
        <a href={`#/factura/nueva?foto=1&fecha=${anio}-${String(mes).padStart(2, '0')}`} className="boton-grande morado">📷 Escanear una factura</a>
        <a href={`#/factura/nueva?fecha=${anio}-${String(mes).padStart(2, '0')}`} className="boton">✍ Anotar a mano</a>
      </div>

      <div className="iva-grid">
        <section className="panel">
          <h2>Comparación del mes (los 3 buses)</h2>
          <div className="tabla-wrap">
          <table className="tabla tabla-iva">
            <thead><tr><th>Concepto</th><th>Monto</th><th>IVA ({pct})</th></tr></thead>
            <tbody>
              <tr className="fila-azul"><td>Ida neto del mes</td><td className="num">{bs(iva.idaNeto)}</td><td className="num">{bs(iva.ivaIda)}</td></tr>
              <tr className="fila-verde"><td>Llegada normal del mes</td><td className="num">{bs(iva.llegada)}</td><td className="num">{bs(iva.ivaLlegada)}</td></tr>
              <tr className="totales"><td>TOTAL VENTAS → IVA débito</td><td className="num">{bs(iva.ventas)}</td><td className="num">{bs(iva.debito)}</td></tr>
              <tr className="fila-morada"><td>Facturas del mes ({iva.cantidadFacturas}) → IVA crédito</td><td className="num">{bs(iva.facturas)}</td><td className="num fuerte">{bs(iva.credito)}</td></tr>
              <tr><td>Diferencia (ventas − facturas)</td><td className="num">{bs(iva.ventas - iva.facturas)}</td><td className="num">{bs(iva.diferencia)}</td></tr>
            </tbody>
          </table>
          </div>
        </section>
        <div className="iva-tarjetas">
          <Tarjeta titulo="IVA a pagar" valor={bs(iva.aPagar)} color="naranja" nota="IVA débito − IVA crédito" />
          <Tarjeta titulo="Saldo a favor" valor={bs(iva.saldoFavor)} color="verde" nota="Cuando las facturas superan a las ventas" />
        </div>
      </div>

      <section className="panel">
        <h2>Facturas de {MESES[mes - 1]} ({datos.facturas.length})</h2>
        {datos.facturas.length === 0 && <p className="vacio">No hay facturas en este mes. Pulsa «Escanear una factura» para agregar la primera.</p>}
        {datos.facturas.length > 0 && (
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>N° factura</th><th>Proveedor / NIT</th><th>Concepto</th><th>Monto</th><th>IVA crédito</th><th>Foto</th></tr></thead>
              <tbody>
                <tr className="totales"><td colSpan={4}>TOTAL</td><td className="num">{bs(iva.facturas)}</td><td className="num">{bs(iva.credito)}</td><td></td></tr>
                {datos.facturas.map((f) => (
                  <tr key={f.id} className="clic" onClick={() => ir(`/factura/${f.id}`)}>
                    <td>{fechaCorta(f.fecha)}</td><td>{f.numero}</td><td>{f.proveedor}</td><td>{f.concepto}</td>
                    <td className="num fuerte">{bs(f.monto)}</td><td className="num morado-txt">{bs(f.monto * tasa)}</td>
                    <td>{f.foto ? '📷' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
