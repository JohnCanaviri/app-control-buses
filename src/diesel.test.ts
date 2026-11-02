import { describe, expect, it } from 'vitest';
import { viajesQueCubre } from './diesel';

describe('viajesQueCubre', () => {
  it('aplica los rangos de monto', () => {
    expect(viajesQueCubre(1500)).toBe(0);
    expect(viajesQueCubre(2000)).toBe(1);
    expect(viajesQueCubre(4000)).toBe(1);
    expect(viajesQueCubre(4200)).toBe(0);
    expect(viajesQueCubre(4500)).toBe(2);
    expect(viajesQueCubre(7000)).toBe(2);
    expect(viajesQueCubre(7500)).toBe(0);
    expect(viajesQueCubre(8000)).toBe(3);
  });
});
