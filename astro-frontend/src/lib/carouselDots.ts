// Paginación de carruseles con el lenguaje del hero (puntos; el activo se alarga), sin botón de pausa.
// Con muchos elementos (p. ej. 64 testimonios) muestra una ventana de MAX puntos que sigue al activo.
const MAX = 7;

export function paginate(container: HTMLElement, count: number, active: number, go: (index: number) => void) {
  if (container.childElementCount !== count) {
    container.replaceChildren(...Array.from({ length: count }, (_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', `Ir al elemento ${i + 1} de ${count}`);
      dot.append(document.createElement('span'));
      dot.addEventListener('click', () => go(i));
      return dot;
    }));
  }
  container.hidden = count < 2;
  const start = Math.min(Math.max(0, active - Math.floor(MAX / 2)), Math.max(0, count - MAX));
  const end = Math.min(count, start + MAX);
  Array.from(container.children).forEach((dot, i) => {
    (dot as HTMLElement).hidden = i < start || i >= end;
    dot.setAttribute('aria-current', String(i === active));
    // Los puntos del borde de la ventana se achican para indicar que hay más.
    dot.toggleAttribute('data-edge', (i === start && start > 0) || (i === end - 1 && end < count));
  });
}

// Difumina solo el borde por el que queda contenido; la máscara se funde con cualquier fondo.
export function syncFade(track: HTMLElement) {
  track.toggleAttribute('data-more-start', track.scrollLeft > 2);
  track.toggleAttribute('data-more-end', track.scrollLeft < track.scrollWidth - track.clientWidth - 2);
}
