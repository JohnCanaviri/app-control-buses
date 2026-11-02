import { describe, expect, it } from 'vitest';
import { contar, filtrar } from './sugerencias';

const lista = [...contar(['Cbba', 'Cbba', 'La Paz', 'Lp', 'Lp', 'Lp', 'Sucre', 'Diésel', 'Peaje Caracollo']).values()];

describe('filtrar', () => {
  it('ignora mayúsculas y tildes', () => {
    expect(filtrar(lista, 'CBB')).toEqual(['Cbba']);
    expect(filtrar(lista, 'dies')).toEqual(['Diésel']);
  });
  it('pone primero lo que empieza igual y lo más usado', () => {
    expect(filtrar(lista, 'p')).toEqual(['Peaje Caracollo', 'La Paz', 'Lp']);
  });
  it('encuentra palabras del medio', () => {
    expect(filtrar(lista, 'cara')).toEqual(['Peaje Caracollo']);
  });
  it('no sugiere lo que ya está escrito completo', () => {
    expect(filtrar(lista, 'sucre')).toEqual([]);
  });
  it('sin texto muestra lo más usado', () => {
    expect(filtrar(lista, '', 2)).toEqual(['Lp', 'Cbba']);
  });
});
