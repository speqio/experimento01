export interface FaqItem { question: string; answer: string }

export function extractFaqSection(html: string): string {
  const marker = /<h[2-4]\b[^>]*>\s*Preguntas frecuentes\s*<\/h[2-4]>/i.exec(html);
  if (!marker) return '';
  const content = html.slice(marker.index + marker[0].length);
  const end = /<h[2-4]\b[^>]*>\s*(?:Pueden interesarte|Ideas para regalar|Giftcard y regalos)\s*<\/h[2-4]>/i.exec(content);
  return (end ? content.slice(0, end.index) : content).trim();
}

// Editorial labels for migrated answers whose question was lost in the export.
const questions: Record<string, string[]> = {
  masajes: ['¿Qué beneficios tiene un masaje relajante?', '¿Cuándo elegir un masaje descontracturante?', '¿Qué diferencia hay entre un masaje relajante y uno mixto?', '¿Cómo se realizan los masajes en pareja?', '¿Hay masajes para embarazadas?', '¿Cómo elijo el masaje adecuado?'],
  productos: ['¿Qué productos puedo encontrar?', '¿Para qué sirve cada producto?', '¿Cómo se organiza una rutina de cuidado?', '¿Cómo elijo según mi tipo de piel?', '¿Dónde puedo comprar los productos?', '¿Cómo complementan los productos las sesiones de spa?'],
  'spa-day': ['¿Qué incluye un Spa Day individual?', '¿Cómo es un Spa Day para dos?', '¿Cuánto dura la experiencia?', '¿Puedo reservar durante el embarazo?', '¿Puedo regalar un Spa Day?', '¿Qué necesito llevar?'],
  'tratamientos-corporales': ['¿Cómo elijo un tratamiento corporal?', '¿Qué tratamiento ayuda con la retención de líquidos?', '¿En qué consiste el drenaje para embarazadas?', '¿Cómo actúan los tratamientos reductivos?', '¿Para qué sirve la limpieza de espalda?', '¿Qué cuidados debo seguir después?'],
  'tratamientos-faciales': ['¿Qué beneficios tiene un tratamiento facial?', '¿Con qué frecuencia se recomienda?', '¿Qué diferencia hay entre una limpieza y un tratamiento facial?', '¿Qué cuidados debo seguir después?', '¿Qué son los tratamientos sin aparatología?', '¿Puedo compartir un tratamiento facial para dos?'],
};
const drainageQuestions = ['¿El drenaje linfático duele?', '¿El drenaje linfático elimina grasa?', '¿Qué diferencia hay entre masaje reductivo y drenaje?', '¿Con qué frecuencia se realiza?', '¿Para quién está indicado?', '¿Cuándo se empiezan a notar los beneficios?', '¿Cuáles son sus contraindicaciones?', '¿Se puede realizar durante el embarazo?'];

export function parseFaq(html: string, path: string): FaqItem[] {
  const blocks = html.match(/<(h[2-4]|p|ul|ol)\b[^>]*>[\s\S]*?<\/\1>/g) ?? [];
  const textOf = (block: string) => block.replace(/<[^>]+>/g, '').trim();
  const hasQuestions = blocks.some((block) => /^<h[2-4]\b/i.test(block) && textOf(block).includes('¿'));
  if (hasQuestions) {
    const items: FaqItem[] = [];
    for (const block of blocks) {
      if (/^<h[2-4]\b/i.test(block) && textOf(block).includes('¿')) {
        items.push({ question: textOf(block).replace(/^\d+[.)\s]*/, ''), answer: '' });
      } else if (items.length) {
        items[items.length - 1].answer += block;
      }
    }
    return items;
  }
  // Some facial pages contain the same inherited drainage FAQ. Match its
  // actual content rather than assigning facial questions to unrelated answers.
  const labels = textOf(blocks[0] ?? '').startsWith('No, el drenaje linfático')
    ? drainageQuestions : questions[path];
  return blocks.map((block, index) => ({
    question: labels?.[index] ?? textOf(block).split(/(?<=[.!?])\s/)[0],
    answer: block.replace(/^<h[2-4]\b[^>]*>/i, '<p>').replace(/<\/h[2-4]>$/i, '</p>'),
  }));
}
