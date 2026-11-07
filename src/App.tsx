import { useRuta } from './router';
import { EstadoNube } from './Cuenta';
import { Cargando, PantallaEspera, PantallaLogin, PantallaNuevaClave } from './Acceso';
import { useEffect } from 'react';
import { marcarActividad, MINUTOS_INACTIVIDAD, salir, useSync } from './sync';
import Inicio from './pages/Inicio';
import EditarViaje from './pages/EditarViaje';
import Consulta from './pages/Consulta';
import ResumenAnual from './pages/ResumenAnual';
import Gastos from './pages/Gastos';
import Mantenimientos from './pages/Mantenimientos';
import Facturas from './pages/Facturas';
import EditarFactura from './pages/EditarFactura';
import Ajustes from './pages/Ajustes';
import Importar from './pages/Importar';
import Usuarios from './pages/Usuarios';
import Informe from './pages/Informe';

// «celular: false» = no va en la barra de abajo del celular (se llega por el botón de arriba).
const MENU = [
  { ruta: '/', texto: 'Inicio', icono: '🏠' },
  { ruta: '/consulta', texto: 'Consulta', icono: '🔎' },
  { ruta: '/resumen', texto: 'Resúmenes', icono: '📊' },
  { ruta: '/gastos', texto: 'Gastos', icono: '💸' },
  { ruta: '/ajustes', texto: 'Cuenta', icono: '👤', celular: false },
];

// Qué opción del menú se marca para cada pantalla.
function seccion(camino: string) {
  if (camino === '/nuevo' || camino.startsWith('/viaje/')) return '/';
  if (camino === '/mantenimientos' || camino === '/facturas' || camino.startsWith('/factura/')) return '/gastos';
  if (camino === '/importar' || camino === '/usuarios') return '/ajustes';
  if (camino === '/informe') return '/resumen';
  return camino;
}

export default function App() {
  const s = useSync();
  const ruta = useRuta();
  const camino = ruta.split('?')[0];

  // Sin actividad durante un rato se cierra la sesión y hay que volver a entrar.
  const conSesion = !!s.correo;
  useEffect(() => {
    if (!conSesion) return;
    let t: ReturnType<typeof setTimeout>;
    // Sin internet no se cierra (no se podría volver a entrar); se vuelve a contar.
    const cerrar = () => { if (navigator.onLine) salir({ automatico: true }); else t = setTimeout(cerrar, MINUTOS_INACTIVIDAD * 60_000); };
    const reiniciar = () => { marcarActividad(); clearTimeout(t); t = setTimeout(cerrar, MINUTOS_INACTIVIDAD * 60_000); };
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    reiniciar();
    return () => { clearTimeout(t); eventos.forEach((e) => window.removeEventListener(e, reiniciar)); };
  }, [conSesion]);

  // Vista previa solo para desarrollo (localhost/?demo): no existe en la app publicada.
  const demo = import.meta.env.DEV && location.search.includes('demo');

  // Primero se entra: sin sesión no se ve nada de la empresa.
  if (!demo) {
    if (!s.sesionLista) return <Cargando />;
    if (s.recuperar) return <PantallaNuevaClave />;
    if (!s.correo) return <PantallaLogin />;
    if (s.rol === null) return s.fase === 'sin-internet' ? <PantallaEspera /> : <Cargando texto="Revisando tu cuenta…" />;
    if (s.rol === 'pendiente' || s.rol === 'rechazado') return <PantallaEspera />;
  }

  // El observador solo mira: las pantallas para crear lo llevan al inicio.
  const soloVer = s.rol === 'observador' && ['/nuevo', '/importar', '/factura/nueva'].includes(camino);
  let pagina;
  if (soloVer) pagina = <Inicio />;
  else if (camino === '/nuevo') pagina = <EditarViaje key="nuevo" />;
  else if (camino.startsWith('/viaje/')) pagina = <EditarViaje key={camino} id={decodeURIComponent(camino.slice(7))} />;
  else if (camino === '/consulta') pagina = <Consulta />;
  else if (camino === '/resumen') pagina = <ResumenAnual />;
  else if (camino === '/informe') pagina = <Informe />;
  else if (camino === '/gastos') pagina = <Gastos />;
  else if (camino === '/mantenimientos') pagina = <Mantenimientos />;
  else if (camino === '/facturas') pagina = <Facturas />;
  else if (camino === '/factura/nueva') pagina = <EditarFactura key={ruta} />;
  else if (camino.startsWith('/factura/')) pagina = <EditarFactura key={camino} id={decodeURIComponent(camino.slice(9))} />;
  else if (camino === '/ajustes') pagina = <Ajustes />;
  else if (camino === '/importar') pagina = <Importar />;
  else if (camino === '/usuarios') pagina = <Usuarios />;
  else pagina = <Inicio />;

  const activa = seccion(camino);
  const enlaces = (celular: boolean) => MENU.filter((m) => !celular || m.celular !== false).map((m) => (
    <a key={m.ruta} href={`#${m.ruta}`} className={activa === m.ruta ? 'activo' : ''}>
      <span className="icono">{m.icono}</span>
      <span>{m.texto}</span>
    </a>
  ));

  return (
    <div className="app">
      <header className="barra">
        <a href="#/" className="marca"><img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" /> Control de Buses</a>
        <nav className="menu-arriba">{enlaces(false)}</nav>
        <EstadoNube />
        <a href="#/ajustes" className="solo-cel-boton" aria-label="Cuenta">👤</a>
      </header>
      <main className="contenido">{pagina}</main>
      <nav className="menu-abajo">{enlaces(true)}</nav>
    </div>
  );
}
