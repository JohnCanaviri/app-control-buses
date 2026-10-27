import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BUSES, leerConfig } from '../db';
import { calcularIVA, TASA_IVA_POR_DEFECTO } from '../iva';
import { totalizar } from '../calc';
import { bs, MESES, rangoMes } from '../format';
import { COLOR_BUS } from '../router';
import { useSync } from '../sync';
import { SelectorMes } from '../components';

// Inicio: solo lo esencial del mes. El detalle está en Consulta, Resúmenes y Facturas.
export default function Inicio() {
  const { nombre } = useSync();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [desde, hasta] = rangoMes(anio, mes);
  const viajes = useLiveQuery(() => db.viajes.where('fecha').between(desde, hasta, true, true).toArray(), [desde, hasta]);
  const facturas = useLiveQuery(() => db.facturas.where('fecha').between(desde, hasta, true, true).toArray(), [desde, hasta]);
  const tasa = useLiveQuery(() => leerConfig('tasaIVA', TASA_IVA_POR_DEFECTO), []);

  if (!viajes) return null;
  const t = totalizar(viajes);
  const iva = calcularIVA(viajes, facturas ?? [], tasa ?? TASA_IVA_POR_DEFECTO);
  const q = `anio=${anio}&mes=${mes}`;

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
        <a href="#/nuevo" className="atajo naranja">➕<span>Registrar viaje</span></a>
        <a href={`#/factura/nueva?foto=1&fecha=${anio}-${String(mes).padStart(2, '0')}`} className="atajo morado">📷<span>Escanear factura</span></a>
      </div>

      <section className="panel principal">
        <div className="cifra">
          <span>Ida neto</span>
          <b className="azul-txt">{bs(t.idaNeto)}</b>
        </div>
        <div className="cifra">
          <span>Llegada</span>
          <b className="verde-txt">{bs(t.montoRegistrado)}</b>
        </div>
        <div className="cifra destacada">
          <span>Neto final</span>
          <b className={t.netoFinal < 0 ? 'negativo' : ''}>{bs(t.netoFinal)}</b>
        </div>
        <p className="pie">
          {t.viajes} viajes · gastos {bs(t.totalGastos + t.totalOtrosGastos)}
          {t.faltaBoletos > 0 && <> · <span className="naranja-txt">⚠ {t.faltaBoletos} con falta de boletos</span></>}
          {' · '}<a href={`#/resumen?bus=Todos&${q}`}>Ver resúmenes ›</a>
        </p>
      </section>

      <section className="buses">
        {BUSES.map((b) => {
          const tb = totalizar(viajes.filter((v) => v.bus === b));
          return (
            <a key={b} href={`#/consulta?bus=${b}&${q}`} className="bus" style={{ borderTopColor: COLOR_BUS[b] }}>
              <span className="bus-nombre">{b}</span>
              <b className={tb.netoFinal < 0 ? 'negativo' : ''}>{bs(tb.netoFinal)}</b>
              <small>{tb.viajes} viajes ›</small>
            </a>
          );
        })}
      </section>

      <a href={`#/facturas?${q}`} className="fila-iva">
        <span>🧾 {iva.saldoFavor ? 'IVA: saldo a favor' : 'IVA a pagar'} · {iva.cantidadFacturas} facturas</span>
        <b>{bs(iva.saldoFavor || iva.aPagar)} ›</b>
      </a>

      {t.viajes === 0 && <p className="vacio centro">No hay viajes en {MESES[mes - 1]}. Pulsa «Registrar viaje» para empezar.</p>}
    </div>
  );
}
