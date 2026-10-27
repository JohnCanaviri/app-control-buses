import { useEffect, useState } from 'react';
import { useRuta } from './router';
import Inicio from './pages/Inicio';
import EditarViaje from './pages/EditarViaje';
import Consulta from './pages/Consulta';
import ResumenAnual from './pages/ResumenAnual';
import ResumenDiario from './pages/ResumenDiario';
import Facturas from './pages/Facturas';
import EditarFactura from './pages/EditarFactura';
import Ajustes from './pages/Ajustes';
import Importar from './pages/Importar';

// «celular: false» = no va en la barra de abajo del celular (se llega por el botón de arriba).
const MENU = [
  { ruta: '/', texto: 'Inicio', icono: '🏠' },
  { ruta: '/nuevo', texto: 'Nuevo viaje', icono: '➕' },
  { ruta: '/consulta', texto: 'Consulta', icono: '🔎' },
  { ruta: '/resumen', texto: 'Resumen', icono: '📊' },
  { ruta: '/diario', texto: 'Diario', icono: '📅' },
  { ruta: '/facturas', texto: 'Facturas', icono: '🧾' },
  { ruta: '/ajustes', texto: 'Respaldo', icono: '💾', celular: false },
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
  const camino = ruta.split('?')[0];

  let pagina;
  if (camino === '/nuevo') pagina = <EditarViaje key="nuevo" />;
  else if (camino.startsWith('/viaje/')) pagina = <EditarViaje key={camino} id={decodeURIComponent(camino.slice(7))} />;
  else if (camino === '/consulta') pagina = <Consulta />;
  else if (camino === '/resumen') pagina = <ResumenAnual />;
  else if (camino === '/diario') pagina = <ResumenDiario />;
  else if (camino === '/facturas') pagina = <Facturas />;
  else if (camino === '/factura/nueva') pagina = <EditarFactura key={ruta} />;
  else if (camino.startsWith('/factura/')) pagina = <EditarFactura key={camino} id={decodeURIComponent(camino.slice(9))} />;
  else if (camino === '/ajustes') pagina = <Ajustes />;
  else if (camino === '/importar') pagina = <Importar />;
  else pagina = <Inicio />;

  const activo = (r: string) => camino === r || (r === '/ajustes' && camino === '/importar')
    || (r === '/facturas' && camino.startsWith('/factura/')) || (r === '/nuevo' && camino.startsWith('/viaje/'));
  const enlaces = (celular: boolean) => MENU.filter((m) => !celular || m.celular !== false).map((m) => (
    <a key={m.ruta} href={`#${m.ruta}`} className={activo(m.ruta) ? 'activo' : ''}>
      <span className="icono">{m.icono}</span>
      <span>{m.texto}</span>
    </a>
  ));

  return (
    <div className="app">
      <header className="barra">
        <a href="#/" className="marca"><img src="/icon.svg" alt="" /> Control de Buses</a>
        <nav className="menu-arriba">{enlaces(false)}</nav>
        <span className={`estado ${enLinea ? 'on' : 'off'}`}>{enLinea ? 'En línea' : 'Sin internet'}</span>
        <a href="#/ajustes" className="solo-cel-boton" aria-label="Respaldo">💾</a>
      </header>
      <main className="contenido">{pagina}</main>
      <nav className="menu-abajo">{enlaces(true)}</nav>
    </div>
  );
}
