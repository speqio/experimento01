"""Capa de red compartida vía Playwright (navegador real) para extraer_wp.py y rastrear.py.

El hosting de spamandala.cl corta la conexión a clientes sin huella de navegador real
(librerías como `requests`, aunque lleven User-Agent de Chrome). Un Chromium real sin
interfaz pasa esa protección igual que cualquier visitante normal — no es una técnica de
evasión, es la misma que usan Google y Screaming Frog cuando un sitio exige JS/fingerprint
de navegador.

Requiere: pip install -r requirements.txt && playwright install chromium
"""
import time

from playwright.sync_api import sync_playwright

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")


class Navegador:
    def __init__(self, pausa_s=0.5, timeout_ms=20000):
        self.pausa_s = pausa_s
        self.timeout_ms = timeout_ms
        self._pw = sync_playwright().start()
        self.browser = self._pw.chromium.launch()
        self.page = self.browser.new_page(user_agent=USER_AGENT)

    def obtener(self, url):
        """Navega a `url` y devuelve (status_code, texto, content_type, url_final).

        status_code es None si la navegación falló por completo (timeout, DNS, etc.).
        Si la respuesta es JSON, Chromium la envuelve en un <pre>: se extrae ese texto.
        """
        try:
            resp = self.page.goto(url, wait_until="domcontentloaded", timeout=self.timeout_ms)
        except Exception as e:
            return None, "", "", str(e)
        finally:
            time.sleep(self.pausa_s)

        if resp is None:
            return None, "", "", url

        status = resp.status
        content_type = resp.header_value("content-type") or ""
        if "html" in content_type:
            # el DOM ya renderizado (JS incluido) — lo que de verdad ve un visitante
            texto = self.page.content()
        else:
            # JSON/XML: el cuerpo crudo de la respuesta — Chromium envuelve ambos en su
            # propio visor interno (un <pre> para JSON, un shadow DOM para XML) y
            # page.content() no refleja ese cuerpo de forma confiable para ninguno de los dos
            try:
                texto = resp.text()
            except Exception:
                texto = self.page.content()
        return status, texto, content_type, self.page.url

    def cerrar(self):
        self.browser.close()
        self._pw.stop()
