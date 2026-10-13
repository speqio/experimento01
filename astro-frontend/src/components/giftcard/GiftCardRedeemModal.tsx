import { useState } from 'react';
import { SITE_INFO } from '../../lib/siteInfo';

// Botón flotante + modal para que quien recibió una gift card verifique su
// código y agende por WhatsApp — sin pasar por el checkout. El canje real
// (marcar el código como usado) sigue siendo manual en wp-admin o automático
// al aplicarlo en checkout; ver wordpress/mu-plugins/mandala-giftcards.php.
export default function GiftCardRedeemModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/gift-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), email: email.trim() }),
      });
      const data: { valid: boolean; reason?: string } = await res.json();
      if (!data.valid) {
        setError(data.reason || 'No se pudo verificar el código.');
        return;
      }
      const text = `Hola, quiero agendar mi gift card.\nNombre: ${name}\nCorreo: ${email}\nCódigo: ${code.trim()}`;
      window.location.href = `https://wa.me/${SITE_INFO.whatsapp}?text=${encodeURIComponent(text)}`;
    } catch {
      setError('No se pudo verificar el código. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Verificar mi gift card"
        title="Verificar mi gift card"
        className="fixed bottom-24 right-6 z-40 bg-spa-charcoal hover:bg-[#433B36] text-white p-3.5 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 flex items-center justify-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-6 h-6">
          <rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8a2.5 2.5 0 1 1-2.5-2.5C11 5.5 12 8 12 8Zm0 0a2.5 2.5 0 1 0 2.5-2.5C13 5.5 12 8 12 8Z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-spa-bg rounded-2xl w-full max-w-md p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4 mb-5">
              <h2 className="font-editorial text-2xl text-spa-charcoal">Verifica tu gift card</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="text-spa-taupe text-3xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold tracking-wide uppercase text-spa-taupe mb-2">Tu nombre</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-[#DDD5CA] rounded-full px-5 py-3 text-sm bg-white focus:outline-none focus:border-spa-taupe" />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wide uppercase text-spa-taupe mb-2">Correo donde la recibiste</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-[#DDD5CA] rounded-full px-5 py-3 text-sm bg-white focus:outline-none focus:border-spa-taupe" />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wide uppercase text-spa-taupe mb-2">Código de regalo</label>
                <input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="w-full border border-[#DDD5CA] rounded-full px-5 py-3 text-sm bg-white focus:outline-none focus:border-spa-taupe font-mono tracking-widest" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-spa-charcoal hover:bg-[#433B36] text-white rounded-full py-3.5 text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase transition-all disabled:opacity-50"
              >
                {loading ? 'Verificando…' : 'Verificar y agendar por WhatsApp'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
