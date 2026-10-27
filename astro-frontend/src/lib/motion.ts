import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

// Llegada larga y sin rebote, la misma curva que cubic-bezier(0.16, 1, 0.3, 1) del CSS.
const EASE = 'expo.out';
// Al terminar se limpian los estilos inline: si no, el transform de GSAP pisa el hover:-translate-y de Tailwind.
const CLEAR = 'transform,opacity,transition';

/*
 * Marcadores en el HTML:
 *   data-hero (+ data-hero-media / -title / -tagline / -copy / -cta)  secuencia de entrada del home
 *   data-stagger  sus hijos entran como lista al hacer scroll
 *   data-reveal   el bloque sube y aparece al entrar en pantalla
 *   data-ripple   anillo decorativo que se expande con el scroll, como la onda del mándala
 *   data-spin     sello de texto circular que gira con el scroll
 * Además, el h1 de cada página y los h2 editoriales aparecen línea a línea.
 */

// Lo que hidrata React no se toca: SplitText reescribe el DOM y rompería la hidratación.
const own = (el: Element) => !el.closest('astro-island');
const all = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(selector)).filter(own);

function splitLines(el: HTMLElement, vars: gsap.TweenVars) {
  SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    autoSplit: true,
    onSplit(self) {
      gsap.set(el, { opacity: 1 });
      // Aire arriba y abajo de cada máscara para no cortar tildes ni descendentes (p, g) en títulos de interlineado 1.
      gsap.set(self.masks, { paddingBlock: '0.15em', marginBlock: '-0.15em' });
      return gsap.from(self.lines, { yPercent: 120, duration: 1.1, ease: EASE, stagger: 0.1, ...vars });
    },
  });
}

function fadeLoader(loader: HTMLElement) {
  loader.style.opacity = '0';
  loader.style.pointerEvents = 'none';
  setTimeout(() => loader.remove(), 700);
}

/** Deja la página en su estado inicial (oculta tras el loader) y devuelve la función que la revela. */
export function setupMotion(): () => void {
  const loader = document.getElementById('page-loader');
  let revealed = false;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => {
      if (revealed || !loader) return;
      revealed = true;
      fadeLoader(loader);
    };
  }

  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const heroPart = (name: string) => hero?.querySelector<HTMLElement>(`[data-hero-${name}]`) ?? null;
  const media = heroPart('media');
  const tagline = heroPart('tagline');
  // Se lee antes de tocarlo: la frase "respira" desde más espaciada hasta su espaciado real.
  const taglineSpacing = tagline ? getComputedStyle(tagline).letterSpacing : 'normal';
  const heroTitle = heroPart('title');
  const copy = heroPart('copy');
  const ctas = hero ? all('[data-hero-cta] > *', hero) : [];

  const pageTitles = all('main h1').filter((el) => el !== heroTitle);
  const sectionTitles = all('main h2.font-editorial').filter((el) => !el.closest('[data-stagger]'));
  const lists = all('[data-stagger]');
  const blocks = all('[data-reveal]');

  const ctx = gsap.context(() => {
    // Todo esto ocurre mientras el loader tapa la pantalla, así que no se ve el salto.
    gsap.set([heroTitle, ...pageTitles, ...sectionTitles].filter(Boolean), { opacity: 0 });
    if (media) gsap.set(media, { scale: 1.18 });
    if (tagline) gsap.set(tagline, { opacity: 0, letterSpacing: '0.3em' });
    if (copy) gsap.set(copy, { opacity: 0, y: 12 });
    gsap.set(ctas, { opacity: 0, y: 16, transition: 'none' });
    lists.forEach((list) => gsap.set(list.children, { opacity: 0, y: 28, transition: 'none' }));
    gsap.set(blocks, { opacity: 0, y: 24 });
  });

  function enter() {
    // 1. El loader se abre como una onda: los anillos del mándala se expanden y el panel se levanta.
    const intro = gsap.timeline();
    if (loader) {
      loader.style.pointerEvents = 'none';
      const mark = loader.querySelector('svg');
      if (mark) mark.style.overflow = 'visible';
      intro
        .to(loader.querySelectorAll('span'), { opacity: 0, y: -6, duration: 0.35, ease: 'power2.in', stagger: 0.04 }, 0)
        .to(
          loader.querySelectorAll('circle'),
          {
            scale: (i: number) => [2.2, 3, 5, 0][i] ?? 2,
            opacity: 0,
            svgOrigin: '50 50',
            duration: 1,
            ease: EASE,
            stagger: { each: 0.05, from: 'end' },
          },
          0,
        )
        .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut' }, 0.2)
        .add(() => loader.remove());
    }
    const start = loader ? 0.45 : 0;

    // 2. Hero del home: la foto se asienta, el titular sube línea a línea y la frase en itálica "respira".
    if (media) {
      intro.to(media, { scale: 1.1, duration: 2.4, ease: 'power2.out' }, start);
      gsap.to(media, {
        yPercent: 5,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
      });
    }
    if (tagline) intro.to(tagline, { opacity: 1, letterSpacing: taglineSpacing, duration: 1.4, ease: EASE }, start + 0.6);
    if (copy) intro.to(copy, { opacity: 1, y: 0, duration: 0.9, ease: EASE }, start + 0.75);
    if (ctas.length) intro.to(ctas, { opacity: 1, y: 0, duration: 0.8, ease: EASE, stagger: 0.08, clearProps: CLEAR }, start + 0.9);
    const heroContent = heroTitle?.parentElement;
    if (hero && heroContent) {
      gsap.to(heroContent, {
        y: -60,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
      });
    }

    // Los cortes de línea dependen de la tipografía: se divide recién cuando Cormorant cargó.
    document.fonts.ready.then(() => {
      ctx.add(() => {
        if (heroTitle) splitLines(heroTitle, { delay: start + 0.25 });
        pageTitles.forEach((el) => splitLines(el, { delay: start + 0.15 }));
        sectionTitles.forEach((el) =>
          splitLines(el, { scrollTrigger: { trigger: el, start: 'top 88%', once: true } }),
        );
      });
    });

    // 3. Al hacer scroll: listas en cascada, bloques que suben, anillos que se expanden.
    lists.forEach((list) => {
      ScrollTrigger.batch(Array.from(list.children), {
        start: 'top 90%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: EASE, stagger: 0.08, overwrite: true, clearProps: CLEAR }),
      });
    });
    blocks.forEach((el) =>
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: EASE,
        clearProps: CLEAR,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      }),
    );
    all('[data-spin]').forEach((seal) =>
      gsap.to(seal, {
        rotation: 180,
        transformOrigin: '50% 50%',
        ease: 'none',
        scrollTrigger: { trigger: seal, start: 'top bottom', end: 'bottom top', scrub: 1 },
      }),
    );
    all('[data-ripple]').forEach((ring, i) =>
      gsap.fromTo(
        ring,
        { scale: 0.7 },
        {
          scale: i % 2 ? 1.15 : 1.3,
          ease: 'none',
          scrollTrigger: { trigger: ring.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1 },
        },
      ),
    );
  }

  return () => {
    if (revealed) return;
    revealed = true;
    try {
      ctx.add(enter);
    } catch (err) {
      // Si algo falla, la página no puede quedar oculta: se deshace todo y se muestra tal cual.
      ctx.revert();
      if (loader) fadeLoader(loader);
      console.error(err);
    }
  };
}
