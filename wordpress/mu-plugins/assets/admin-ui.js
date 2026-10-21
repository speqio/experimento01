/* Spa Mándala — comportamiento compartido de los paneles de Marketing:
 * buscadores, listas de casillas con contador y paneles según opción elegida. */
(function () {
  // Buscador: <input data-mandala-filter="selector"> oculta lo que no coincide con el texto.
  document.addEventListener('input', function (e) {
    var input = e.target;
    if (!input.matches || !input.matches('[data-mandala-filter]')) return;
    var q = input.value.trim().toLowerCase();
    document.querySelectorAll(input.getAttribute('data-mandala-filter')).forEach(function (el) {
      el.hidden = q !== '' && el.textContent.toLowerCase().indexOf(q) === -1;
    });
    // Oculta secciones de la portada que se quedaron sin tarjetas visibles.
    document.querySelectorAll('.mandala-marketing-section').forEach(function (s) {
      s.hidden = !s.querySelector('.mandala-marketing-card:not([hidden])');
    });
  });

  function updateCount(box) {
    var n = box.querySelectorAll('input[type=checkbox]:checked').length;
    var out = box.querySelector('.mandala-check-count');
    if (out) out.textContent = n + ' seleccionado' + (n === 1 ? '' : 's');
  }

  document.addEventListener('change', function (e) {
    var box = e.target.closest && e.target.closest('.mandala-check');
    if (box) updateCount(box);
    if (e.target.name === 'scope') syncScope(e.target.form);
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-mandala-check]');
    if (!btn) return;
    var box = btn.closest('.mandala-check');
    var on = btn.getAttribute('data-mandala-check') === 'all';
    box.querySelectorAll('.mandala-check-item').forEach(function (label) {
      var cb = label.querySelector('input');
      if (on) { if (!label.hidden) cb.checked = true; } else { cb.checked = false; }
    });
    updateCount(box);
  });

  // Muestra solo el panel de la opción elegida (data-scope-panel="valor").
  function syncScope(form) {
    if (!form) return;
    var checked = form.querySelector('input[name=scope]:checked');
    form.querySelectorAll('[data-scope-panel]').forEach(function (p) {
      p.hidden = !checked || p.getAttribute('data-scope-panel') !== checked.value;
    });
  }

  document.querySelectorAll('.mandala-check').forEach(updateCount);
  document.querySelectorAll('form').forEach(syncScope);
})();
