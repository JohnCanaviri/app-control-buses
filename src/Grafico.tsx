// Gráfico de barras agrupadas en SVG (sin librerías: funciona sin internet).
import { useEffect, useRef, useState } from 'react';
import { bs } from './format';

// Ancho real del contenedor, para dibujar en píxeles y que las letras no se achiquen.
function useAncho() {
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho] as const;
}

export interface Serie { nombre: string; color: string; valores: number[] }

const compacto = new Intl.NumberFormat('es-BO', { notation: 'compact', maximumFractionDigits: 1 });

function escala(min: number, max: number) {
  const rango = max - min || 1;
  const paso0 = rango / 4;
  const mag = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= paso0) ?? paso0;
  const desde = Math.floor(min / paso) * paso, hasta = Math.ceil(max / paso) * paso;
  const marcas: number[] = [];
  for (let y = desde; y <= hasta + paso / 2; y += paso) marcas.push(Math.round(y * 100) / 100);
  return { desde, hasta, marcas };
}

export default function Grafico({ titulo, categorias, series, alto = 260, onClic }: {
  titulo: string; categorias: string[]; series: Serie[]; alto?: number; onClic?: (i: number) => void;
}) {
  const todos = series.flatMap((s) => s.valores);
  const hayDatos = todos.some((v) => v !== 0);
  const { desde, hasta, marcas } = escala(Math.min(0, ...todos), Math.max(0, ...todos));

  const [caja, ancho] = useAncho();
  const izq = 52, der = 6, arriba = 12, abajo = 26;
  const w = ancho - izq - der, h = alto - arriba - abajo;
  const y = (v: number) => arriba + ((hasta - v) / (hasta - desde || 1)) * h;
  const grupo = w / Math.max(categorias.length, 1);
  const barra = Math.max(2, (grupo * 0.78) / Math.max(series.length, 1));
  const cada = Math.ceil(categorias.length / Math.max(4, Math.floor(w / 34))); // no amontonar etiquetas

  return (
    <figure className="grafico">
      <figcaption>
        <b>{titulo}</b>
        <span className="leyenda">{series.map((s) => <span key={s.nombre}><i style={{ background: s.color }} />{s.nombre}</span>)}</span>
      </figcaption>
      <div ref={caja}>
      {!hayDatos ? <p className="vacio">Sin datos para mostrar.</p> : (
        <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={titulo}>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={izq} x2={ancho - der} y1={y(m)} y2={y(m)} className={m === 0 ? 'eje0' : 'guia'} />
              <text x={izq - 6} y={y(m) + 4} textAnchor="end" className="marca">{compacto.format(m)}</text>
            </g>
          ))}
          {categorias.map((c, i) => {
            const x0 = izq + i * grupo + grupo * 0.11;
            return (
              <g key={c} className={onClic ? 'clic' : ''} onClick={onClic ? () => onClic(i) : undefined}>
                <rect x={izq + i * grupo} y={arriba} width={grupo} height={h} className="zona" />
                {series.map((s, j) => {
                  const v = s.valores[i] ?? 0;
                  return (
                    <rect key={s.nombre} x={x0 + j * barra} y={Math.min(y(v), y(0))} width={barra - 1}
                      height={Math.max(Math.abs(y(v) - y(0)), v ? 1 : 0)} fill={s.color} opacity={v < 0 ? 0.75 : 1}>
                      <title>{`${c} · ${s.nombre}: ${bs(v)}`}</title>
                    </rect>
                  );
                })}
                {i % cada === 0 && <text x={izq + i * grupo + grupo / 2} y={alto - 10} textAnchor="middle" className="marca">{c}</text>}
              </g>
            );
          })}
        </svg>
      )}
      </div>
    </figure>
  );
}
