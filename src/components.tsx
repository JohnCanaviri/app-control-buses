import { useEffect, useId, useState, type ReactNode } from 'react';
import { ir } from './router';
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


// Flechas ‹ › para ir al registro anterior o siguiente (viajes, facturas…), también con las teclas ← →.
export function Flechas({ ids, actual, ruta, texto = 'registro' }: { ids: string[]; actual?: string; ruta: (id: string) => string; texto?: string }) {
  const i = actual ? ids.indexOf(actual) : -1;
  const ant = i > 0 ? ids[i - 1] : undefined;
  const sig = i >= 0 && i < ids.length - 1 ? ids[i + 1] : undefined;
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowLeft' && ant) ir(ruta(ant));
      if (e.key === 'ArrowRight' && sig) ir(ruta(sig));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [ant, sig, ruta]);
  if (i < 0 || ids.length < 2) return null;
  return (
    <div className="flechas no-imprimir">
      <button type="button" disabled={!ant} onClick={() => ant && ir(ruta(ant))} aria-label={`${texto} anterior`}>‹</button>
      <span>{texto} {i + 1} de {ids.length}</span>
      <button type="button" disabled={!sig} onClick={() => sig && ir(ruta(sig))} aria-label={`${texto} siguiente`}>›</button>
    </div>
  );
}

// Flechas ‹ › para moverse por días (informe diario).
export function SelectorDia({ fecha, onChange }: { fecha: string; onChange: (f: string) => void }) {
  const mover = (d: number) => {
    const x = new Date(`${fecha}T12:00:00`);
    x.setDate(x.getDate() + d);
    onChange(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`);
  };
  return (
    <div className="selector-mes">
      <button type="button" onClick={() => mover(-1)} aria-label="Día anterior">‹</button>
      <input type="date" value={fecha} onChange={(e) => e.target.value && onChange(e.target.value)} className="fecha-dia" />
      <button type="button" onClick={() => mover(1)} aria-label="Día siguiente">›</button>
    </div>
  );
}

// Flechas ‹ › para cambiar de bus.
export function SelectorBus({ opciones, valor, onChange }: { opciones: string[]; valor: string; onChange: (b: string) => void }) {
  const i = Math.max(0, opciones.indexOf(valor));
  const mover = (d: number) => onChange(opciones[(i + d + opciones.length) % opciones.length]);
  return (
    <div className="selector-bus">
      <button type="button" onClick={() => mover(-1)} aria-label="Bus anterior">‹</button>
      <Botones opciones={opciones} valor={valor} onChange={onChange} />
      <button type="button" onClick={() => mover(1)} aria-label="Bus siguiente">›</button>
    </div>
  );
}

// Resúmenes: el año mes por mes y el informe del mes para imprimir.
export function PestanasResumen({ vista, bus, anio, mes }: { vista: 'anio' | 'mes'; bus: string; anio: number; mes: number }) {
  const v: [string, string, string][] = [
    ['anio', '📊 Año', `#/resumen?bus=${bus}&anio=${anio}`],
    ['mes', '🖨 Informe del mes (imprimir)', `#/informe?bus=${bus}&anio=${anio}&mes=${mes}`],
  ];
  return (
    <div className="pestanas no-imprimir">
      {v.map(([k, t, h]) => <a key={k} href={h} className={vista === k ? 'sel' : ''}>{t}</a>)}
    </div>
  );
}

// Cantidad de viajes del mes de cada bus y el total (solo aquí, al principio).
export function ViajesDelMes({ viajes, buses }: { viajes: { bus: string }[]; buses: string[] }) {
  const n = (b: string) => viajes.filter((v) => v.bus === b).length;
  const total = buses.reduce((s, b) => s + n(b), 0);
  return (
    <div className="viajes-mes">
      <span className="viajes-mes-titulo">Viajes del mes</span>
      {buses.map((b) => <span key={b} className="viajes-mes-bus"><b className="bus-chip">{b}</b> {n(b)}</span>)}
      {buses.length > 1 && <span className="viajes-mes-bus total">Total <b>{total}</b></span>}
    </div>
  );
}
