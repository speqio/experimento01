import { useEffect, useState } from 'react';

// false en el servidor y en el primer render del cliente: así lo que se pinta desde stores
// (localStorage, fetchCart que ya corrió) no difiere del HTML del servidor y no rompe la hidratación.
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
