import { useEffect, useState } from 'react';
import { useRuta } from './router';
import Inicio from './pages/Inicio';
import EditarViaje from './pages/EditarViaje';
import Consulta from './pages/Consulta';
import Ajustes from './pages/Ajustes';

const MENU = [
  { ruta: '/', texto: 'Inicio', icono: '🏠' },
  { ruta: '/nuevo', texto: 'Nuevo viaje', icono: '➕' },
  { ruta: '/consulta', texto: 'Consulta', icono: '🔎' },
  { ruta: '/ajustes', texto: 'Respaldo', icono: '💾' },
];

function useEnLinea() {
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setEnLinea(true), off = () => setEnLinea(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return enLinea;
}

export default function App() {
  const ruta = useRuta();
  const enLinea = useEnLinea();

  let pagina;
  if (ruta === '/nuevo') pagina = <EditarViaje key="nuevo" />;
  else if (ruta.startsWith('/viaje/')) pagina = <EditarViaje key={ruta} id={decodeURIComponent(ruta.slice(7))} />;
  else if (ruta.startsWith('/consulta')) pagina = <Consulta />;
  else if (ruta === '/ajustes') pagina = <Ajustes />;
  else pagina = <Inicio />;

  const activo = (r: string) => (r === '/' ? ruta === '/' : ruta.startsWith(r));
  const enlaces = MENU.map((m) => (
    <a key={m.ruta} href={`#${m.ruta}`} className={activo(m.ruta) ? 'activo' : ''}>
      <span className="icono">{m.icono}</span>
      <span>{m.texto}</span>
    </a>
  ));

  return (
    <div className="app">
      <header className="barra">
        <a href="#/" className="marca"><img src="/icon.svg" alt="" /> Control de Buses</a>
        <nav className="menu-arriba">{enlaces}</nav>
        <span className={`estado ${enLinea ? 'on' : 'off'}`}>{enLinea ? 'En línea' : 'Sin internet'}</span>
      </header>
      <main className="contenido">{pagina}</main>
      <nav className="menu-abajo">{enlaces}</nav>
    </div>
  );
}
