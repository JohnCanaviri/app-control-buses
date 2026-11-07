// Lee una foto de factura: primero el código QR (sin internet), y si no hay QR o el QR no trae
// fecha y monto (factura electrónica), el texto impreso con OCR (Tesseract; la primera vez descarga
// el idioma, necesita internet).
// La foto queda solo en este equipo y se borra al día siguiente (no sube a internet).
import jsQR from 'jsqr';
import { datosDeTexto, leerQRFactura, type DatosQR } from './iva';

export interface Lectura {
  foto: string; // imagen reducida para mostrar mientras se revisa la factura
  datos: Partial<DatosQR>;
  fuente: 'qr' | 'texto' | 'qr+texto' | 'nada';
  mensaje: string;
}

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error('No se pudo abrir la imagen.'));
    img.src = URL.createObjectURL(archivo);
  });
}

type Recorte = { x: number; y: number; w: number; h: number }; // en fracciones de la imagen (0–1)
const ENTERA: Recorte = { x: 0, y: 0, w: 1, h: 1 };

// Dibuja (una parte de) la imagen con el lado más largo = «maximo» px (agranda si hace falta).
function lienzo(img: HTMLImageElement, maximo: number, r: Recorte = ENTERA, agrandar = false) {
  const sw = img.naturalWidth * r.w, sh = img.naturalHeight * r.h;
  const k = agrandar ? maximo / Math.max(sw, sh) : Math.min(1, maximo / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k));
  c.height = Math.max(1, Math.round(sh * k));
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, img.naturalWidth * r.x, img.naturalHeight * r.y, sw, sh, 0, 0, c.width, c.height);
  return c;
}

// Escala de grises con el contraste estirado (ignora el 1 % más claro y más oscuro): ayuda al QR y al OCR
// con fotos oscuras, con sombra o en papel térmico desteñido.
function realzar(c: HTMLCanvasElement) {
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const d = g.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < p.length; i += 4) {
    const y = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000 | 0;
    p[i] = y; hist[y]++;
  }
  const n = p.length / 4;
  let bajo = 0, alto = 255, acum = 0;
  for (let v = 0; v < 256; v++) { acum += hist[v]; if (acum > n * 0.01) { bajo = v; break; } }
  acum = 0;
  for (let v = 255; v >= 0; v--) { acum += hist[v]; if (acum > n * 0.01) { alto = v; break; } }
  const rango = Math.max(1, alto - bajo);
  for (let i = 0; i < p.length; i += 4) {
    const y = Math.max(0, Math.min(255, ((p[i] - bajo) * 255) / rango));
    p[i] = p[i + 1] = p[i + 2] = y;
  }
  g.putImageData(d, 0, 0);
  return c;
}

const leerJsQR = (c: HTMLCanvasElement) => {
  const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height);
  return jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
};

// El QR de las facturas suele estar abajo o en una esquina y salir pequeño: se prueba la foto entera
// y luego cada zona agrandada, normal y con más contraste.
const ZONAS: Recorte[] = [
  { x: 0, y: 0.5, w: 1, h: 0.5 }, { x: 0, y: 0, w: 1, h: 0.5 },
  { x: 0, y: 0.5, w: 0.6, h: 0.5 }, { x: 0.4, y: 0.5, w: 0.6, h: 0.5 },
  { x: 0, y: 0, w: 0.6, h: 0.5 }, { x: 0.4, y: 0, w: 0.6, h: 0.5 },
  { x: 0.2, y: 0.25, w: 0.6, h: 0.5 },
];

async function buscarQR(img: HTMLImageElement): Promise<string | null> {
  // El lector del propio celular (Chrome en Android) es el más rápido y el mejor si existe.
  const BD = (window as unknown as { BarcodeDetector?: new (o: object) => { detect: (i: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (BD) {
    try {
      const det = new BD({ formats: ['qr_code'] });
      for (const fuente of [img, realzar(lienzo(img, 2000))]) {
        const r = await det.detect(fuente);
        if (r[0]?.rawValue) return r[0].rawValue;
      }
    } catch { /* se usa jsQR */ }
  }
  for (const tam of [1000, 1600, 700]) {
    const q = leerJsQR(lienzo(img, tam));
    if (q) return q;
  }
  for (const z of ZONAS) {
    const c = lienzo(img, 1200, z, true);
    const q = leerJsQR(c) ?? leerJsQR(realzar(c));
    if (q) return q;
    await new Promise((r) => setTimeout(r, 0)); // deja respirar a la pantalla
  }
  return null;
}

// Un solo «lector de texto» para todas las fotos de la sesión: la segunda factura se lee mucho más rápido.
type Lector = { recognize: (i: HTMLCanvasElement) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };
let lector: Promise<Lector> | null = null;
let alAvanzar: ((p: number) => void) | undefined;
function obtenerLector(): Promise<Lector> {
  lector ??= (async () => {
    const { createWorker } = await import('tesseract.js');
    const w = await createWorker('spa', 1, {
      logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') alAvanzar?.(m.progress); },
    });
    // 4 = una columna de texto de varios tamaños (como un ticket o una factura).
    await w.setParameters({ tessedit_pageseg_mode: '4' as never, preserve_interword_spaces: '1' });
    return w as unknown as Lector;
  })().catch((e) => { lector = null; throw e; });
  return lector;
}

async function leerTexto(img: HTMLImageElement, progreso?: (p: number) => void): Promise<string> {
  const w = await obtenerLector();
  alAvanzar = progreso;
  try {
    // Letra pequeña de ticket: se agranda a ~2000 px y se le sube el contraste.
    return (await w.recognize(realzar(lienzo(img, 2000, ENTERA, true)))).data.text;
  } finally {
    alAvanzar = undefined;
  }
}

export async function leerFotoFactura(archivo: File, progreso?: (texto: string) => void): Promise<Lectura> {
  const img = await cargarImagen(archivo);
  try {
    const foto = lienzo(img, 1280).toDataURL('image/jpeg', 0.7);

    progreso?.('Buscando el código QR…');
    const qr = await buscarQR(img);
    const d: Partial<DatosQR> = qr ? leerQRFactura(qr) : {};
    if (d.tipo === 'computarizada') return { foto, datos: d, fuente: 'qr', mensaje: '✔ QR leído: NIT, número, fecha y monto completados. Revísalos antes de guardar.' };
    const qrElectronico = d.tipo === 'electronica';

    if (!navigator.onLine) {
      return qrElectronico
        ? { foto, datos: d, fuente: 'qr', mensaje: '✔ QR de factura electrónica leído (NIT y número). Este QR no trae fecha ni monto y sin internet no puedo leer el texto: complétalos tú.' }
        : { foto, datos: {}, fuente: 'nada', mensaje: 'No encontré un QR legible. Sin internet no puedo leer el texto: completa los datos a mano.' };
    }
    try {
      progreso?.(qrElectronico ? 'QR electrónico leído. Leyendo la fecha y el monto del texto…' : 'No hay QR legible. Leyendo el texto de la factura…');
      const texto = await leerTexto(img, (p) => progreso?.(`Leyendo el texto… ${Math.round(p * 100)}%`));
      const deTexto = datosDeTexto(texto);
      // Lo del QR es más seguro que lo leído del texto: el texto solo completa lo que falta.
      const datos = { ...deTexto, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) };
      const n = Object.keys(deTexto).length;
      if (qrElectronico) return { foto, datos, fuente: 'qr+texto', mensaje: `✔ QR electrónico leído (NIT y número)${n ? ' y la fecha y el monto del texto' : ''}. Revisa los datos: la lectura de texto puede equivocarse.` };
      return {
        foto, datos, fuente: n ? 'texto' : 'nada',
        mensaje: n ? '✔ Datos leídos del texto. Revísalos: la lectura de texto puede equivocarse.' : 'No pude reconocer los datos. Complétalos a mano.',
      };
    } catch {
      return qrElectronico
        ? { foto, datos: d, fuente: 'qr', mensaje: '✔ QR electrónico leído (NIT y número). No se pudo leer el texto: completa la fecha y el monto.' }
        : { foto, datos: {}, fuente: 'nada', mensaje: 'No se pudo leer el texto. Completa los datos a mano.' };
    }
  } finally {
    URL.revokeObjectURL(img.src);
  }
}
