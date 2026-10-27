import { useEffect, useState } from 'react';

// Navegación simple por «#/ruta» (funciona sin servidor y sin internet).
export function useRuta() {
  const [ruta, setRuta] = useState(() => location.hash.slice(1) || '/');
  useEffect(() => {
    const cambiar = () => { setRuta(location.hash.slice(1) || '/'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', cambiar);
    return () => window.removeEventListener('hashchange', cambiar);
  }, []);
  return ruta;
}

export const ir = (ruta: string) => { location.hash = ruta; };

// Lee «?bus=TDS&anio=2026&mes=10» de la ruta actual.
export const parametros = (ruta: string) => new URLSearchParams(ruta.split('?')[1] ?? '');

export const COLOR_BUS: Record<string, string> = { TDS: '#2e75b6', PIN: '#548235', PKS: '#c55a11' };
