import { useEffect, useRef } from 'react';

// Efecto 3D (tilt + glare + sheen) compartido por la tarjeta del modal de compra
// (GiftCardPreview.tsx) y el botón flotante de verificación (GiftCardRedeemModal.tsx).
export const REST_SHADOW = '0 15px 35px rgba(0,0,0,0.25), 0 5px 15px rgba(0,0,0,0.2)';
const MAX_ROT = 18;

export function useCardTilt() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  function move(x: number, y: number, w: number, h: number) {
    const card = cardRef.current;
    const glare = glareRef.current;
    const sheen = sheenRef.current;
    if (!card || !glare || !sheen || reducedMotion.current) return;

    const xPct = (x / w - 0.5) * 2;
    const yPct = (y / h - 0.5) * 2;

    wrapperRef.current?.classList.remove('gc-float');
    card.style.transition = 'none';
    card.style.transform = `rotateX(${yPct * -MAX_ROT}deg) rotateY(${xPct * MAX_ROT}deg) scale3d(1.04,1.04,1.04)`;
    card.style.boxShadow = `${xPct * -25}px ${yPct * -25 + 15}px 40px rgba(0,0,0,0.4)`;

    glare.style.transition = 'opacity 0.2s ease';
    glare.style.opacity = '1';
    glare.style.background = `radial-gradient(circle at ${(x / w) * 100}% ${(y / h) * 100}%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 65%)`;

    sheen.style.transition = 'none';
    sheen.style.transform = `translateX(${xPct * 100}%)`;
  }

  function leave() {
    const card = cardRef.current;
    const glare = glareRef.current;
    const sheen = sheenRef.current;
    if (!card || !glare || !sheen) return;

    card.style.transition = 'transform 0.6s cubic-bezier(0.23,1,0.32,1), box-shadow 0.6s cubic-bezier(0.23,1,0.32,1)';
    card.style.transform = 'rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
    card.style.boxShadow = REST_SHADOW;
    glare.style.transition = 'opacity 0.6s ease';
    glare.style.opacity = '0';
    sheen.style.transition = 'transform 0.6s ease';
    sheen.style.transform = 'translateX(-100%)';

    window.setTimeout(() => {
      if (!reducedMotion.current) wrapperRef.current?.classList.add('gc-float');
    }, 600);
  }

  function onMouse(e: React.MouseEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    move(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
  }

  function onTouch(e: React.TouchEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    const t = e.touches[0];
    move(t.clientX - r.left, t.clientY - r.top, r.width, r.height);
  }

  return { wrapperRef, cardRef, glareRef, sheenRef, onMouse, onTouch, leave };
}
