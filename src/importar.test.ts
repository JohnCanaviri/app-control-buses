import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fechaExcel, horario, importarLibro } from './importar';

describe('conversiones', () => {
  it('fechas de Excel', () => {
    expect(fechaExcel(46296)).toBe('2026-10-01');
    expect(fechaExcel('24-10-26')).toBe('2026-10-24');
    expect(fechaExcel('5/1/2027')).toBe('2027-01-05');
    expect(fechaExcel('hola')).toBeNull();
  });
  it('horarios', () => {
    expect(horario('08:30 - 15:30')).toEqual({ salida: '08:30', llegada: '15:30', resto: '' });
    expect(horario('15:30-4:00')).toEqual({ salida: '15:30', llegada: '04:00', resto: '' });
    expect(horario(0.25).salida).toBe('06:00');
    expect(horario('mañana').resto).toBe('mañana');
  });
});

// Con un archivo real: EXCEL="C:\ruta\control_buses.xlsx" npx vitest run src/importar.test.ts
const archivo = process.env.EXCEL;
describe.skipIf(!archivo)('importar el Excel real', () => {
  it('los totales de cada bus y mes cuadran con la hoja Resumen', () => {
    const r = importarLibro(readFileSync(archivo!));
    console.log(`viajes: ${r.viajes.length} · facturas: ${r.facturas.length} · meses comparados: ${r.comparacion.length}`);
    for (const p of r.problemas) console.log(`  aviso ${p.hoja} fila ${p.fila}: ${p.mensaje}`);
    for (const c of r.comparacion) {
      console.log(`  ${c.cuadra ? 'OK ' : 'MAL'} ${c.bus} ${c.anio}-${c.mes}: ida ${c.app.montoIda}/${c.montoIda} · llegada ${c.app.montoLlegada}/${c.montoLlegada} · neto ${c.app.netoFinal}/${c.netoFinal}`);
    }
    expect(r.viajes.length).toBeGreaterThan(0);
    expect(r.comparacion.length).toBeGreaterThan(0);
    expect(r.comparacion.filter((c) => !c.cuadra)).toEqual([]);
  });
});
