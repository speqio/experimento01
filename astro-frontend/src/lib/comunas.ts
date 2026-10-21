import comunas from '../data/comunas-cl.json';

export const REGIONES = comunas;

/** Valida región y comuna contra la lista de Chile (src/data/comunas-cl.json, del plugin MkRapel). */
export function validAddress(state: unknown, city: unknown) {
  return comunas.some((r) => r.code === state && r.comunas.includes(String(city)));
}
