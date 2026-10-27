// Lee una foto de factura: primero el código QR (sin internet), y si no hay QR,
// el texto impreso con OCR (Tesseract; la primera vez descarga el idioma, necesita internet).
import jsQR from 'jsqr';
import { datosDeTexto, leerQRFactura, type DatosQR } from './iva';

export interface Lectura {
  foto: string; // imagen reducida para guardar con la factura
  datos: Partial<DatosQR>;
  fuente: 'qr' | 'texto' | 'nada';
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

function lienzo(img: HTMLImageElement, maximo: number) {
  const k = Math.min(1, maximo / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

async function buscarQR(img: HTMLImageElement): Promise<string | null> {
  // El lector del propio celular (Chrome en Android) es el más rápido si existe.
  const BD = (window as unknown as { BarcodeDetector?: new (o: object) => { detect: (i: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (BD) {
    try {
      const r = await new BD({ formats: ['qr_code'] }).detect(img);
      if (r[0]?.rawValue) return r[0].rawValue;
    } catch { /* se usa jsQR */ }
  }
  for (const tam of [1000, 1600, 700]) {
    const c = lienzo(img, tam);
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    const r = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
    if (r?.data) return r.data;
  }
  return null;
}

async function leerTexto(foto: string, progreso?: (p: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa', 1, {
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') progreso?.(m.progress); },
  });
  try {
    return (await worker.recognize(foto)).data.text;
  } finally {
    await worker.terminate();
  }
}

export async function leerFotoFactura(archivo: File, progreso?: (texto: string) => void): Promise<Lectura> {
  const img = await cargarImagen(archivo);
  const foto = lienzo(img, 1280).toDataURL('image/jpeg', 0.7);

  progreso?.('Buscando el código QR…');
  const qr = await buscarQR(img);
  URL.revokeObjectURL(img.src);
  if (qr) {
    const d = leerQRFactura(qr);
    if (d.tipo === 'computarizada') return { foto, datos: d, fuente: 'qr', mensaje: '✔ QR leído: NIT, número, fecha y monto completados.' };
    if (d.tipo === 'electronica') {
      return { foto, datos: d, fuente: 'qr', mensaje: '✔ QR de factura electrónica leído (NIT y número). Este QR no trae fecha ni monto: complétalos tú.' };
    }
  }

  if (!navigator.onLine) {
    return { foto, datos: {}, fuente: 'nada', mensaje: 'No encontré un QR legible. Sin internet no puedo leer el texto: completa los datos a mano (la foto queda guardada).' };
  }
  try {
    progreso?.('No hay QR legible. Leyendo el texto de la factura…');
    const texto = await leerTexto(foto, (p) => progreso?.(`Leyendo el texto… ${Math.round(p * 100)}%`));
    const datos = datosDeTexto(texto);
    const n = Object.keys(datos).length;
    return {
      foto, datos, fuente: n ? 'texto' : 'nada',
      mensaje: n ? '✔ Datos leídos del texto. Revísalos: la lectura de texto puede equivocarse.' : 'No pude reconocer los datos. Complétalos a mano (la foto queda guardada).',
    };
  } catch {
    return { foto, datos: {}, fuente: 'nada', mensaje: 'No se pudo leer el texto. Completa los datos a mano (la foto queda guardada).' };
  }
}
