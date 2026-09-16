// ACF (versión gratuita, sin Repeater) guarda listas como textarea con un
// ítem por línea — ver docs/wp-setup-guide.md §4. Esto las convierte al
// arreglo que espera SpaServiceACF.
export function parseLineList(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
