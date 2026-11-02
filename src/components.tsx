import { useId, useState, type ReactNode } from 'react';
import type { Verificacion } from './calc';
import { MESES } from './format';
import { filtrar, useSugerencias, type Fuente } from './sugerencias';

// Campo de texto que, al escribir, sugiere lo que ya se usó antes (como el buscador de Google).
export function Autocompletar({ fuente, extra, value, onChange, placeholder }: {
  fuente: Fuente; extra?: string[]; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const lista = useSugerencias(fuente, extra);
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(-1);
  const id = useId();
  const opciones = abierto ? filtrar(lista, value) : [];
  const elegir = (v: string) => { onChange(v); setAbierto(false); setMarcado(-1); };
  return (
    <div className="autocompletar">
      <input value={value} placeholder={placeholder} autoComplete="off" role="combobox"
        aria-expanded={opciones.length > 0} aria-controls={id} aria-autocomplete="list"
        onChange={(e) => { onChange(e.target.value); setAbierto(true); setMarcado(-1); }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={(e) => {
          if (!opciones.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setMarcado((m) => (m + 1) % opciones.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setMarcado((m) => (m <= 0 ? opciones.length : m) - 1); }
          else if (e.key === 'Enter' && marcado >= 0) { e.preventDefault(); elegir(opciones[marcado]); }
          else if (e.key === 'Escape') setAbierto(false);
        }} />
      {opciones.length > 0 && (
        <ul id={id} role="listbox" className="sugerencias">
          {opciones.map((o, i) => (
            // pointerdown para elegir antes de que el campo pierda el foco (también en el celular)
            <li key={o} role="option" aria-selected={i === marcado} className={i === marcado ? 'sel' : ''}
              onPointerDown={(e) => { e.preventDefault(); elegir(o); }}>{o}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Gastos, Mantenimientos y Facturas comparten una sola pestaña.
export function PestanasGastos({ vista }: { vista: 'gastos' | 'mantenimientos' | 'facturas' }) {
  const v = [['gastos', '💸 Gastos'], ['mantenimientos', '🔧 Mantenimientos'], ['facturas', '🧾 Facturas']];
  return (
    <div className="pestanas no-imprimir">
      {v.map(([r, t]) => <a key={r} href={`#/${r}`} className={vista === r ? 'sel' : ''}>{t}</a>)}
    </div>
  );
}

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
  // Si faltan boletos se considera normal; solo se marca en rojo cuando se pasa del límite.
  if (v === 'DIFERENCIA') return <span className="insignia mal">EXCEDE</span>;
  return <span className="insignia ok">CONFORME</span>;
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

