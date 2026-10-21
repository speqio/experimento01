<?php
/**
 * Plugin Name: Spa Mándala — Panel de Promociones
 * Description: Pantalla en wp-admin (Marketing → Promociones) para aplicar un descuento (% o monto)
 *              a muchos productos a la vez, con vista previa, fechas de inicio/fin, historial y
 *              botón Revertir. Escribe el precio de oferta nativo de WooCommerce (con sus fechas),
 *              así el sitio (precio tachado, /promociones) funciona sin cambios en el frontend.
 */

if (!defined('ABSPATH')) exit;

const MANDALA_PROMO_SLUG = 'mandala-promociones';
const MANDALA_PROMO_LOG  = 'mandala_promotions_log';

add_action('admin_menu', function () {
    add_submenu_page(MANDALA_MARKETING_SLUG, 'Promociones', 'Promociones', 'manage_woocommerce', MANDALA_PROMO_SLUG, 'mandala_promo_render');
}, 10);

/** Parámetros del formulario ya saneados. */
function mandala_promo_params() {
    $p = wp_unslash($_POST);
    return [
        'scope'    => in_array($p['scope'] ?? '', ['all', 'category', 'products'], true) ? $p['scope'] : 'all',
        'cats'     => array_map('sanitize_title', (array) ($p['cats'] ?? [])),
        'products' => array_map('intval', (array) ($p['products'] ?? [])),
        'upsells'  => !empty($p['upsells']),
        'mode'     => ($p['mode'] ?? '') === 'amount' ? 'amount' : 'percent',
        'value'    => max(0, (float) ($p['value'] ?? 0)),
        'from'     => preg_match('/^\d{4}-\d{2}-\d{2}$/', $p['from'] ?? '') ? $p['from'] : '',
        'to'       => preg_match('/^\d{4}-\d{2}-\d{2}$/', $p['to'] ?? '') ? $p['to'] : '',
    ];
}

/** @return WC_Product[] productos simples y variaciones afectados por la selección. */
function mandala_promo_targets(array $a) {
    $args = ['status' => 'publish', 'limit' => -1, 'return' => 'objects'];
    if ($a['scope'] === 'category') $args['category'] = $a['cats'] ?: ['__ninguna__'];
    if ($a['scope'] === 'products') $args['include'] = $a['products'] ?: [0];
    $out = [];
    foreach (wc_get_products($args) as $p) {
        if (!$a['upsells'] && function_exists('mandala_ud_is_upsell') && mandala_ud_is_upsell($p->get_id())) continue;
        if ($p->is_type('variable')) {
            foreach ($p->get_children() as $vid) { if ($v = wc_get_product($vid)) $out[] = $v; }
        } else {
            $out[] = $p;
        }
    }
    return $out;
}

/** Precio de oferta resultante, en pesos enteros; null si no aplica (sin precio o descuento ≥ 100%). */
function mandala_promo_new_price(WC_Product $p, array $a) {
    $regular = (float) $p->get_regular_price();
    if ($regular <= 0 || $a['value'] <= 0) return null;
    $sale = $a['mode'] === 'percent' ? $regular * (1 - $a['value'] / 100) : $regular - $a['value'];
    $sale = round($sale);
    return ($sale >= 0 && $sale < $regular) ? $sale : null;
}

add_action('admin_init', function () {
    if (empty($_POST['mandala_promo_nonce']) || !wp_verify_nonce($_POST['mandala_promo_nonce'], 'mandala_promo')) return;
    if (!current_user_can('manage_woocommerce')) return;

    if (($_POST['op'] ?? '') === 'apply') {
        $a = mandala_promo_params();
        $changes = [];
        foreach (mandala_promo_targets($a) as $p) {
            $new = mandala_promo_new_price($p, $a);
            if ($new === null) continue;
            $changes[$p->get_id()] = [
                'name' => $p->get_name(), // se guarda aquí por si el producto se borra después
                'sale' => $p->get_sale_price(),
                'from' => $p->get_date_on_sale_from() ? $p->get_date_on_sale_from()->date('Y-m-d') : '',
                'to'   => $p->get_date_on_sale_to() ? $p->get_date_on_sale_to()->date('Y-m-d') : '',
            ];
            $p->set_sale_price((string) $new);
            $p->set_date_on_sale_from($a['from'] ?: '');
            $p->set_date_on_sale_to($a['to'] ?: '');
            $p->save();
        }
        $log = (array) get_option(MANDALA_PROMO_LOG, []);
        array_unshift($log, [
            'id' => uniqid(), 'time' => time(), 'user' => wp_get_current_user()->user_login,
            'desc' => ($a['mode'] === 'percent' ? $a['value'] . '%' : '$' . number_format_i18n($a['value'])) . ' · ' . $a['scope'] . ($a['from'] || $a['to'] ? " · {$a['from']} → {$a['to']}" : ''),
            'changes' => $changes, 'reverted' => false,
        ]);
        update_option(MANDALA_PROMO_LOG, array_slice($log, 0, 30), false);
        wp_safe_redirect(add_query_arg(['page' => MANDALA_PROMO_SLUG, 'applied' => count($changes)], admin_url('admin.php')));
        exit;
    }

    if (($_POST['op'] ?? '') === 'revert' && !empty($_POST['log_id'])) {
        $log = (array) get_option(MANDALA_PROMO_LOG, []);
        foreach ($log as &$entry) {
            if ($entry['id'] !== $_POST['log_id'] || $entry['reverted']) continue;
            foreach ($entry['changes'] as $pid => $prev) {
                $p = wc_get_product($pid);
                if (!$p) continue;
                $p->set_sale_price($prev['sale']);
                $p->set_date_on_sale_from($prev['from'] ?: '');
                $p->set_date_on_sale_to($prev['to'] ?: '');
                $p->save();
            }
            $entry['reverted'] = true;
        }
        unset($entry);
        update_option(MANDALA_PROMO_LOG, $log, false);
    }

    wp_safe_redirect(add_query_arg(['page' => MANDALA_PROMO_SLUG, 'done' => 1], admin_url('admin.php')));
    exit;
});

function mandala_promo_render() {
    if (!current_user_can('manage_woocommerce')) return;
    $a = mandala_promo_params();
    $cats = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
    $product_names = [];
    foreach (wc_get_products(['status' => 'publish', 'limit' => 500, 'orderby' => 'title', 'order' => 'ASC']) as $p) {
        $product_names[$p->get_id()] = $p->get_name();
    }
    ?>
    <div class="wrap mandala-admin">
      <?php mandala_admin_header('Promociones', 'Descuentos masivos con fechas y opción de revertir desde el historial.'); ?>
      <?php if (isset($_GET['applied'])) : ?>
        <div class="notice notice-<?php echo (int) $_GET['applied'] ? 'success' : 'warning'; ?> is-dismissible"><p>
          <?php echo (int) $_GET['applied']
              ? sprintf('Descuento guardado en %d producto(s). Si te equivocaste, usa "Revertir" en el historial.', (int) $_GET['applied'])
              : 'No se cambió ningún producto: revisa la selección y que el descuento sea menor al precio.'; ?>
        </p></div>
      <?php endif; ?>
      <?php if (!empty($_GET['done'])) : ?><div class="notice notice-success is-dismissible"><p>Listo.</p></div><?php endif; ?>

      <form method="post" class="mandala-card">
        <?php wp_nonce_field('mandala_promo', 'mandala_promo_nonce'); ?>
        <div class="mandala-cols">
          <div>
            <h2>1 · A qué productos</h2>
            <div class="mandala-segmented">
              <label><input type="radio" name="scope" value="all" <?php checked($a['scope'], 'all'); ?>> Todos</label>
              <label><input type="radio" name="scope" value="category" <?php checked($a['scope'], 'category'); ?>> Por categoría</label>
              <label><input type="radio" name="scope" value="products" <?php checked($a['scope'], 'products'); ?>> Productos elegidos</label>
            </div>
            <div data-scope-panel="all"><p class="description">El descuento se aplica a todo el catálogo publicado.</p></div>
            <div data-scope-panel="category">
              <?php mandala_checklist('cats', wp_list_pluck($cats, 'name', 'slug'), $a['cats'], 'Buscar categoría…'); ?>
            </div>
            <div data-scope-panel="products">
              <?php mandala_checklist('products', $product_names, $a['products'], 'Buscar producto…'); ?>
            </div>
            <p style="margin-top:14px"><label><input type="checkbox" name="upsells" value="1" <?php checked($a['upsells']); ?>> Incluir también los complementos (upsells)</label></p>
          </div>
          <div>
            <h2>2 · Cuánto y cuándo</h2>
            <div class="mandala-field">
              <span class="mandala-label">Descuento</span>
              <input type="number" step="1" min="0" name="value" value="<?php echo esc_attr($a['value'] ?: ''); ?>" style="width:100px" required>
              <select name="mode"><option value="percent" <?php selected($a['mode'], 'percent'); ?>>%</option><option value="amount" <?php selected($a['mode'], 'amount'); ?>>$ (monto fijo)</option></select>
            </div>
            <div class="mandala-field">
              <span class="mandala-label">Vigencia</span>
              Desde <input type="date" name="from" value="<?php echo esc_attr($a['from']); ?>"> hasta <input type="date" name="to" value="<?php echo esc_attr($a['to']); ?>">
              <p class="description">Vacío = sin fecha (queda activa hasta que la reviertas).</p>
            </div>
            <button type="submit" name="op" value="apply" class="button button-primary" onclick="return confirm('¿Guardar este descuento en los productos seleccionados?');">3 · Guardar</button>
          </div>
        </div>
      </form>

      <h2>Historial</h2>
      <div class="mandala-card">
      <table class="widefat striped"><thead><tr><th>Fecha</th><th>Usuario</th><th>Descuento</th><th>Productos</th><th></th></tr></thead><tbody>
      <?php foreach ((array) get_option(MANDALA_PROMO_LOG, []) as $e) : ?>
        <tr>
          <td><?php echo esc_html(wp_date('d-m-Y H:i', $e['time'])); ?></td>
          <td><?php echo esc_html($e['user']); ?></td>
          <td><?php echo esc_html($e['desc']); ?></td>
          <td>
            <details>
              <summary><?php echo count($e['changes']); ?> producto(s)</summary>
              <ul style="margin:6px 0 0 16px;list-style:disc">
                <?php foreach ($e['changes'] as $pid => $c) :
                    $prod = wc_get_product($pid);
                    $name = $c['name'] ?? ($prod ? $prod->get_name() : "#$pid (borrado)");
                    // Las variaciones no tienen página propia: se enlaza la del producto padre.
                    $page_id = $prod ? ($prod->get_parent_id() ?: $prod->get_id()) : 0; ?>
                  <li>
                    <?php if ($page_id) : ?>
                      <a href="<?php echo esc_url(untrailingslashit(MANDALA_FRONTEND_URL) . '/producto/' . get_post_field('post_name', $page_id)); ?>" target="_blank" rel="noopener"><?php echo esc_html($name); ?></a>
                      · <a href="<?php echo esc_url(get_edit_post_link($page_id, '')); ?>">editar</a>
                    <?php else : ?>
                      <?php echo esc_html($name); ?>
                    <?php endif; ?>
                  </li>
                <?php endforeach; ?>
              </ul>
            </details>
          </td>
          <td>
            <?php if ($e['reverted']) : ?>Revertida<?php else : ?>
              <form method="post" onsubmit="return confirm('¿Volver los precios al estado anterior?');">
                <?php wp_nonce_field('mandala_promo', 'mandala_promo_nonce'); ?>
                <input type="hidden" name="log_id" value="<?php echo esc_attr($e['id']); ?>">
                <button type="submit" name="op" value="revert" class="button button-small">Revertir</button>
              </form>
            <?php endif; ?>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody></table>
      </div>
    </div>
    <?php
}
