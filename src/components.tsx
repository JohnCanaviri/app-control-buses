import type { ReactNode } from 'react';
import type { Verificacion } from './calc';
import { MESES } from './format';

export function Tarjeta({ titulo, valor, color = 'navy', nota }: { titulo: string; valor: ReactNode; color?: string; nota?: ReactNode }) {
  return (
    <div className={`tarjeta ${color}`}>
      <div className="tarjeta-titulo">{titulo}</div>
      <div className="tarjeta-valor">{valor}</div>
      {nota && <div className="tarjeta-nota">{nota}</div>}
    </div>
  );
}

export function Insignia({ v }: { v: Verificacion }) {
  if (!v) return <span className="insignia vacia">—</span>;
  const cls = v === 'CONFORME' ? 'ok' : v === 'FALTA BOLETOS' ? 'mal' : 'aviso';
  return <span className={`insignia ${cls}`}>{v}</span>;
}

export function Botones<T extends string | number>({ opciones, valor, onChange, etiqueta }: {
  opciones: T[]; valor: T; onChange: (v: T) => void; etiqueta?: (v: T) => string;
}) {
  return (
    <div className="botones">
      {opciones.map((o) => (
        <button type="button" key={o} className={o === valor ? 'sel' : ''} onClick={() => onChange(o)}>
          {etiqueta ? etiqueta(o) : o}
        </button>
      ))}
    </div>
  );
}

export function SelectorMes({ anio, mes, onChange }: { anio: number; mes: number; onChange: (anio: number, mes: number) => void }) {
  const mover = (d: number) => {
    const m = mes + d;
    if (m < 1) onChange(anio - 1, 12);
    else if (m > 12) onChange(anio + 1, 1);
    else onChange(anio, m);
  };
  return (
    <div className="selector-mes">
      <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
      <select value={mes} onChange={(e) => onChange(anio, Number(e.target.value))}>
        {MESES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <input type="number" value={anio} onChange={(e) => onChange(Number(e.target.value) || anio, mes)} />
      <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
    </div>
  );
}

// Las dos vistas de la pestaña «Resúmenes»; al cambiar se conservan bus, año y mes.
export function VistasResumen({ vista, bus, anio, mes }: { vista: 'anual' | 'diario'; bus: string; anio: number; mes: number }) {
  return (
    <div className="pestanas no-imprimir">
      <a href={`#/resumen?bus=${bus}&anio=${anio}&mes=${mes}`} className={vista === 'anual' ? 'sel' : ''}>📊 Mes por mes</a>
      <a href={`#/diario?bus=${bus}&anio=${anio}&mes=${mes}`} className={vista === 'diario' ? 'sel' : ''}>📅 Día por día</a>
    </div>
  );
}
