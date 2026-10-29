<?php
/**
 * Plugin Name: Spa Mándala — Panel de Gift Cards
 * Description: Pantalla en wp-admin (Marketing → Gift Cards, ver mandala-admin-ui.php)
 *              para que el cliente administre gift cards sin tocar código:
 *              activar/desactivar por producto o globalmente, cambiar el diseño de la
 *              tarjeta, y ver la trazabilidad de compras (comprador, destinatario,
 *              código, estado) con opción de marcar un código como usado a mano
 *              (reservas por teléfono/correo). Usa las mismas opciones/meta que lee
 *              mandala-giftcards.php.
 */

if (!defined('ABSPATH')) exit;

const MANDALA_GIFT_ADMIN_SLUG = 'mandala-gift-cards';

add_action('admin_menu', function () {
    add_submenu_page(
        MANDALA_MARKETING_SLUG,
        'Gift Cards',
        'Gift Cards',
        'manage_woocommerce',
        MANDALA_GIFT_ADMIN_SLUG,
        'mandala_gift_admin_render'
    );
}, 10);

add_action('admin_enqueue_scripts', function () {
    if (empty($_GET['page']) || $_GET['page'] !== MANDALA_GIFT_ADMIN_SLUG) return;
    wp_enqueue_media();
});

const MANDALA_GIFT_LOG_OPTION = 'mandala_gift_log';

/** Registra un cambio hecho desde este panel (quién, cuándo, qué) para la pestaña Historial. */
function mandala_gift_log($detail, $type = 'general') {
    $log = (array) get_option(MANDALA_GIFT_LOG_OPTION, []);
    array_unshift($log, ['time' => time(), 'user' => wp_get_current_user()->user_login, 'detail' => $detail, 'type' => $type]);
    update_option(MANDALA_GIFT_LOG_OPTION, array_slice($log, 0, 100), false);
}

/** Guarda los formularios (ajustes globales / imagen / por producto). Corre antes de pintar la página. */
add_action('admin_init', function () {
    if (empty($_POST['mandala_gift_admin_nonce']) || !wp_verify_nonce($_POST['mandala_gift_admin_nonce'], 'mandala_gift_admin')) return;
    if (!current_user_can('manage_woocommerce')) return;

    if (isset($_POST['mandala_gift_save_settings'])) {
        $enabled = !empty($_POST['mandala_gift_enabled']) ? 1 : 0;
        $image = esc_url_raw(trim((string) ($_POST['mandala_gift_image_url'] ?? '')));
        if ((int) get_option('mandala_gift_enabled', 1) !== $enabled) {
            mandala_gift_log($enabled ? 'Activó las gift cards en todo el sitio' : 'Desactivó las gift cards en todo el sitio');
        }
        if (get_option(MANDALA_GIFT_IMAGE_OPTION, '') !== $image) {
            mandala_gift_log('Cambió el diseño de la tarjeta: ' . ($image ?: '(volvió al diseño por defecto)'));
        }
        update_option('mandala_gift_enabled', $enabled);
        update_option(MANDALA_GIFT_IMAGE_OPTION, $image);
        wp_safe_redirect(add_query_arg(['page' => MANDALA_GIFT_ADMIN_SLUG, 'tab' => 'ajustes', 'saved' => 1], admin_url('admin.php')));
        exit;
    }

    if (isset($_POST['mandala_gift_save_products']) && !empty($_POST['mandala_gift_product']) && is_array($_POST['mandala_gift_product'])) {
        $enabled_ids = array_map('intval', $_POST['mandala_gift_enabled_ids'] ?? []);
        foreach (array_map('intval', $_POST['mandala_gift_product']) as $product_id) {
            if ($product_id <= 0) continue;
            $was = mandala_gift_product_enabled($product_id);
            $now = in_array($product_id, $enabled_ids, true);
            update_post_meta($product_id, '_mandala_gift_enabled', $now ? 'yes' : 'no');
            if ($was !== $now) {
                mandala_gift_log(($now ? 'Permitió regalar: ' : 'Dejó de permitir regalar: ') . get_the_title($product_id), 'producto');
            }
        }
        wp_safe_redirect(add_query_arg(['page' => MANDALA_GIFT_ADMIN_SLUG, 'tab' => 'productos', 'saved' => 1], admin_url('admin.php')));
        exit;
    }
});

/**
 * Marca un código como usado a mano (reservas por teléfono/correo que no pasan por
 * el checkout online). No borra el cupón: sube su usage_count para que WooCommerce
 * lo bloquee igual que un canje normal, y deja registro de quién/cuándo lo marcó.
 */
add_action('admin_post_mandala_gift_mark_used', function () {
    if (!current_user_can('manage_woocommerce')) wp_die('No autorizado', 403);
    if (empty($_POST['mandala_gift_mark_used_nonce']) || !wp_verify_nonce($_POST['mandala_gift_mark_used_nonce'], 'mandala_gift_mark_used')) {
        wp_die('Solicitud inválida', 400);
    }

    $code = sanitize_text_field((string) ($_POST['code'] ?? ''));
    $coupon_id = $code ? wc_get_coupon_id_by_code($code) : 0;
    if ($coupon_id) {
        $coupon = new WC_Coupon($coupon_id);
        if ($coupon->get_usage_count() < 1) {
            $coupon->set_usage_count(1);
        }
        $coupon->update_meta_data('_mandala_gift_manual_redeem', [
            'by' => wp_get_current_user()->display_name,
            'at' => current_time('mysql'),
        ]);
        $coupon->save();
        mandala_gift_log("Marcó como usado el código $code");
    }

    $redirect = add_query_arg(
        array_filter([
            'page'   => MANDALA_GIFT_ADMIN_SLUG,
            'tab'    => 'trazabilidad',
            'estado' => sanitize_key((string) ($_POST['estado'] ?? 'todos')),
            'paged'  => (int) ($_POST['paged'] ?? 1) ?: null,
            'marked' => 1,
        ]),
        admin_url('admin.php')
    );
    wp_safe_redirect($redirect);
    exit;
});

/** Exporta la trazabilidad (con los mismos filtros de la URL) como CSV. */
add_action('admin_post_mandala_gift_export_csv', function () {
    if (!current_user_can('manage_woocommerce')) wp_die('No autorizado', 403);

    $estado = isset($_GET['estado']) ? sanitize_key($_GET['estado']) : 'todos';
    $buyer = isset($_GET['comprador']) ? sanitize_text_field($_GET['comprador']) : '';
    $producto = isset($_GET['producto']) ? sanitize_text_field($_GET['producto']) : '';
    $campania = isset($_GET['campania']) ? sanitize_text_field($_GET['campania']) : '';
    $desde = isset($_GET['desde']) ? sanitize_text_field($_GET['desde']) : '';
    $hasta = isset($_GET['hasta']) ? sanitize_text_field($_GET['hasta']) : '';
    $q = isset($_GET['q']) ? sanitize_text_field($_GET['q']) : '';
    $result = mandala_gift_query_orders(1, 100000, $estado, $buyer, $producto, $campania, $desde, $hasta, $q);

    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="gift-cards.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['Fecha', 'Orden', 'Comprador', 'Destinatario', 'Producto', 'Monto', 'Código', 'Usado', 'Estado', 'Tipo de cupón', 'Importe del cupón', 'Descripción', 'IDs de Producto', 'Uso / Límite', 'Fecha de caducidad', 'Origen', 'Campaña']);
    foreach ($result['items'] as $row) {
        $order = $row['order']; $item = $row['item']; $gift = $row['gift'];
        fputcsv($out, [
            $order->get_date_created() ? $order->get_date_created()->date('d-m-Y H:i') : '',
            $order->get_id(),
            $gift['buyerEmail'] ?? '',
            $gift['recipientEmail'] ?? '',
            $row['product'],
            $order->get_total(),
            $row['code'] ?: '',
            $row['code'] ? ($row['used'] ? 'Sí' : 'No') : '',
            $row['status'],
            $row['coupon']['type'],
            wp_strip_all_tags(html_entity_decode($row['coupon']['amount'])),
            $row['coupon']['description'],
            $row['coupon']['product_ids'],
            $row['coupon']['usage'],
            $row['coupon']['expires'],
            $row['source'],
            $row['campaign'],
        ]);
    }
    fclose($out);
    exit;
});

/** Datos del cupón tal como los muestra WooCommerce → Cupones; vacíos si el cupón aún no existe. */
function mandala_gift_coupon_details($coupon) {
    if (!$coupon) return ['type' => '', 'amount' => '', 'description' => '', 'product_ids' => '', 'usage' => '', 'expires' => ''];
    $types = wc_get_coupon_types();
    $limit = $coupon->get_usage_limit();
    return [
        'type'        => $types[$coupon->get_discount_type()] ?? $coupon->get_discount_type(),
        'amount'      => $coupon->get_discount_type() === 'percent' ? $coupon->get_amount() . '%' : wc_price($coupon->get_amount()),
        'description' => $coupon->get_description(),
        'product_ids' => implode(', ', $coupon->get_product_ids()),
        'usage'       => $coupon->get_usage_count() . ' / ' . ($limit ?: '∞'),
        'expires'     => $coupon->get_date_expires() ? $coupon->get_date_expires()->date('d-m-Y') : '—',
    ];
}

/**
 * Trae todas las órdenes con al menos un ítem regalado, más recientes primero.
 * $estado: 'todos' | 'usados' | 'no-usados' — filtra por si el código ya se canjeó.
 * Resuelve todo antes de paginar (el filtro depende del estado del cupón, que solo
 * se sabe al resolver cada ítem); volumen bajo, sin impacto real de performance.
 */
function mandala_gift_query_orders($page = 1, $per_page = 20, $estado = 'todos', $buyer = '', $producto = '', $campania = '', $desde = '', $hasta = '', $q = '') {
    global $wpdb;
    // wc_get_orders no filtra por meta de line item directamente; se busca por los
    // ítems (_mandala_gift) y se resuelve a la orden dueña de cada ítem.
    $rows = $wpdb->get_results($wpdb->prepare(
        "SELECT oi.order_item_id, oi.order_id
         FROM {$wpdb->prefix}woocommerce_order_items oi
         INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim ON oim.order_item_id = oi.order_item_id
         WHERE oim.meta_key = %s
         ORDER BY oi.order_item_id DESC",
        MANDALA_GIFT_KEY
    ));

    $items = [];
    $by_code = []; // "orden|código" → índice en $items: un regalo con complemento es UNA fila
    foreach ($rows as $row) {
        $order = wc_get_order($row->order_id);
        if (!$order) continue;
        $item = $order->get_item($row->order_item_id);
        if (!$item) continue;
        $gift = $item->get_meta(MANDALA_GIFT_KEY);
        if (empty($gift)) continue;

        $attribution = json_decode((string) $order->get_meta('_mandala_attribution'), true);
        $source = $attribution['source'] ?? '';
        $campaign = $attribution['campaign'] ?? '';

        $code = $item->get_meta('_mandala_gift_code');
        $key = $code ? $row->order_id . '|' . $code : '';
        if ($key && isset($by_code[$key])) {
            // Ítems en orden descendente: el de id menor (producto principal) va primero.
            $i = $by_code[$key];
            array_unshift($items[$i]['names'], $item->get_name());
            $items[$i]['item'] = $item;
            continue;
        }
        $sent = $item->get_meta('_mandala_gift_sent');
        $status = 'Pendiente de pago';
        $used = false;
        $coupon = null;
        if ($code) {
            if ($sent) {
                $status = 'Enviado';
            } elseif (!empty($gift['deliveryDate'])) {
                $status = 'Programado para ' . date_i18n('j \d\e F \d\e Y', strtotime($gift['deliveryDate']));
            } else {
                $status = 'Por enviar';
            }
            $coupon_id = wc_get_coupon_id_by_code($code);
            if ($coupon_id) {
                $coupon = new WC_Coupon($coupon_id);
                if ($coupon->get_usage_count() > 0) {
                    $used = true;
                    $manual = $coupon->get_meta('_mandala_gift_manual_redeem');
                    if (!empty($manual['at'])) {
                        $status = sprintf(
                            'Canjeado manualmente por %s el %s',
                            $manual['by'] ?: 'un administrador',
                            date_i18n('j \d\e F \d\e Y', strtotime($manual['at']))
                        );
                    } else {
                        $status = 'Canjeado';
                    }
                } elseif ($coupon->get_date_expires() && $coupon->get_date_expires()->getTimestamp() < time()) {
                    $status = 'Expirado';
                }
            }
        }

        if ($key) $by_code[$key] = count($items);
        $items[] = [
            'order'    => $order,
            'item'     => $item,
            'names'    => [$item->get_name()],
            'gift'     => $gift,
            'code'     => $code,
            'status'   => $status,
            'used'     => $used,
            'total'    => $order->get_formatted_order_total(),
            'source'   => $source,
            'campaign' => $campaign,
            'coupon'   => mandala_gift_coupon_details($coupon),
        ];
    }
    foreach ($items as &$it) $it['product'] = implode(' + ', $it['names']);
    unset($it);

    if ($estado === 'usados') {
        $items = array_values(array_filter($items, fn($row) => $row['used']));
    } elseif ($estado === 'no-usados') {
        $items = array_values(array_filter($items, fn($row) => !$row['used']));
    }
    if ($buyer !== '') {
        $items = array_values(array_filter($items, fn($row) => stripos($row['gift']['buyerEmail'] ?? '', $buyer) !== false));
    }
    if ($producto !== '') {
        $items = array_values(array_filter($items, fn($row) => in_array($producto, $row['names'], true)));
    }
    // Búsqueda libre: orden, comprador, destinatario, producto o código.
    if ($q !== '') {
        $items = array_values(array_filter($items, function ($row) use ($q) {
            $hay = implode(' ', [$row['order']->get_id(), $row['gift']['buyerEmail'] ?? '', $row['gift']['recipientEmail'] ?? '', $row['product'], $row['code']]);
            return stripos($hay, $q) !== false;
        }));
    }
    if ($campania !== '') {
        $items = array_values(array_filter($items, fn($row) => $row['campaign'] === $campania));
    }
    // Fecha de la orden (no de envío) — para ver tendencias: "¿qué se vendió en octubre?".
    if ($desde !== '') {
        $items = array_values(array_filter($items, fn($row) => $row['order']->get_date_created() && $row['order']->get_date_created()->date('Y-m-d') >= $desde));
    }
    if ($hasta !== '') {
        $items = array_values(array_filter($items, fn($row) => $row['order']->get_date_created() && $row['order']->get_date_created()->date('Y-m-d') <= $hasta));
    }

    $total = count($items);
    $offset = ($page - 1) * $per_page;
    $items = array_slice($items, $offset, $per_page);

    return ['items' => $items, 'total' => $total, 'pages' => (int) ceil($total / $per_page)];
}

function mandala_gift_admin_render() {
    if (!current_user_can('manage_woocommerce')) return;
    $tab = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'trazabilidad';
    $tabs = ['trazabilidad' => 'Trazabilidad', 'productos' => 'Productos', 'ajustes' => 'Ajustes', 'historial' => 'Historial'];
    ?>
    <div class="wrap mandala-admin<?php echo $tab === 'trazabilidad' ? ' mandala-wide' : ''; ?>">
      <?php mandala_admin_header('Gift Cards', 'Trazabilidad de compras, qué productos se pueden regalar y el diseño de la tarjeta.'); ?>
      <?php if (!empty($_GET['saved'])) : ?>
        <div class="notice notice-success is-dismissible"><p>Guardado.</p></div>
      <?php endif; ?>
      <h2 class="nav-tab-wrapper">
        <?php foreach ($tabs as $slug => $label) : ?>
          <a href="<?php echo esc_url(add_query_arg(['page' => MANDALA_GIFT_ADMIN_SLUG, 'tab' => $slug], admin_url('admin.php'))); ?>"
             class="nav-tab <?php echo $tab === $slug ? 'nav-tab-active' : ''; ?>"><?php echo esc_html($label); ?></a>
        <?php endforeach; ?>
      </h2>
      <div style="<?php echo $tab === 'trazabilidad' ? '' : 'max-width:1100px;'; ?>margin-top:20px;">
        <?php
        if ($tab === 'productos') mandala_gift_admin_tab_productos();
        elseif ($tab === 'ajustes') mandala_gift_admin_tab_ajustes();
        elseif ($tab === 'historial') mandala_gift_admin_tab_historial();
        else mandala_gift_admin_tab_trazabilidad();
        ?>
      </div>
    </div>
    <?php
}

function mandala_gift_admin_tab_trazabilidad() {
    $page = max(1, (int) ($_GET['paged'] ?? 1));
    $estado = isset($_GET['estado']) ? sanitize_key($_GET['estado']) : 'todos';
    $buyer = isset($_GET['comprador']) ? sanitize_text_field($_GET['comprador']) : '';
    $producto = isset($_GET['producto']) ? sanitize_text_field($_GET['producto']) : '';
    $campania = isset($_GET['campania']) ? sanitize_text_field($_GET['campania']) : '';
    $desde = isset($_GET['desde']) ? sanitize_text_field($_GET['desde']) : '';
    $hasta = isset($_GET['hasta']) ? sanitize_text_field($_GET['hasta']) : '';
    $q = isset($_GET['q']) ? sanitize_text_field($_GET['q']) : '';
    $result = mandala_gift_query_orders($page, 20, $estado, $buyer, $producto, $campania, $desde, $hasta, $q);
    // Opciones de los selects: se sacan de todos los resultados sin filtrar (volumen bajo).
    $all = mandala_gift_query_orders(1, 100000, 'todos');
    $productos_opts = array_unique(array_merge(...array_map(fn($r) => $r['names'], $all['items'])));
    $campanias_opts = array_unique(array_filter(array_map(fn($r) => $r['campaign'], $all['items'])));
    sort($productos_opts); sort($campanias_opts);
    ?>
    <?php if (!empty($_GET['marked'])) : ?>
      <div class="notice notice-success is-dismissible"><p>Código marcado como usado.</p></div>
    <?php endif; ?>
    <p>Todas las compras hechas "como regalo", con su código, para saber cuáles ya se canjearon y cuáles siguen disponibles. Si alguien reservó por teléfono o correo, márcalo manualmente para que no se pueda canjear de nuevo online.</p>
    <form method="get" style="margin-bottom:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <input type="hidden" name="page" value="<?php echo esc_attr(MANDALA_GIFT_ADMIN_SLUG); ?>">
      <input type="hidden" name="tab" value="trazabilidad">
      <input type="search" name="q" class="mandala-search" value="<?php echo esc_attr($q); ?>" placeholder="Buscar orden, email, producto o código…">
      <label>Estado:
        <select name="estado" onchange="this.form.submit()">
          <option value="todos" <?php selected($estado, 'todos'); ?>>Todos</option>
          <option value="usados" <?php selected($estado, 'usados'); ?>>Usados</option>
          <option value="no-usados" <?php selected($estado, 'no-usados'); ?>>No usados</option>
        </select>
      </label>
      <label>Comprador: <input type="text" name="comprador" value="<?php echo esc_attr($buyer); ?>" placeholder="email"></label>
      <label>Producto:
        <select name="producto" onchange="this.form.submit()">
          <option value="">Todos</option>
          <?php foreach ($productos_opts as $p) : ?>
            <option value="<?php echo esc_attr($p); ?>" <?php selected($producto, $p); ?>><?php echo esc_html($p); ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Campaña:
        <select name="campania" onchange="this.form.submit()">
          <option value="">Todas</option>
          <?php foreach ($campanias_opts as $c) : ?>
            <option value="<?php echo esc_attr($c); ?>" <?php selected($campania, $c); ?>><?php echo esc_html($c); ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Desde: <input type="date" name="desde" value="<?php echo esc_attr($desde); ?>" onchange="this.form.submit()"></label>
      <label>Hasta: <input type="date" name="hasta" value="<?php echo esc_attr($hasta); ?>" onchange="this.form.submit()"></label>
      <button type="submit" class="button">Filtrar</button>
      <a class="button" href="<?php echo esc_url(add_query_arg(array_merge($_GET, ['action' => 'mandala_gift_export_csv']), admin_url('admin-post.php'))); ?>">Exportar CSV</a>
    </form>
    <div class="mandala-card" style="overflow-x:auto">
    <table class="widefat striped mandala-table-compact">
      <thead><tr>
        <th>Fecha</th><th>Orden</th><th>Comprador</th><th>Destinatario</th><th>Producto</th><th>Monto</th><th>Código</th><th>Usado</th><th>Estado</th>
        <th>Tipo de cupón</th><th>Importe del cupón</th><th>Descripción</th><th>IDs de Producto</th><th>Uso / Límite</th><th>Fecha de caducidad</th>
        <th>Origen</th><th>Campaña</th><th></th>
      </tr></thead>
      <tbody>
        <?php if (empty($result['items'])) : ?>
          <tr><td colspan="18">No hay gift cards que coincidan con este filtro.</td></tr>
        <?php endif; ?>
        <?php foreach ($result['items'] as $row) :
          $order = $row['order']; $item = $row['item']; $gift = $row['gift']; ?>
          <tr>
            <td><?php echo esc_html($order->get_date_created() ? $order->get_date_created()->date('d-m-Y H:i') : '—'); ?></td>
            <td><a href="<?php echo esc_url($order->get_edit_order_url()); ?>">#<?php echo esc_html($order->get_id()); ?></a></td>
            <td><?php echo esc_html($gift['buyerEmail'] ?? '—'); ?></td>
            <td><?php echo esc_html($gift['recipientEmail'] ?? '—'); ?></td>
            <td><?php echo esc_html($row['product']); ?></td>
            <td><?php echo wp_kses_post($row['total']); ?></td>
            <td><code><?php echo esc_html($row['code'] ?: '—'); ?></code></td>
            <td><?php echo $row['code'] ? ($row['used'] ? 'Sí' : 'No') : '—'; ?></td>
            <td><?php echo esc_html($row['status']); ?></td>
            <td><?php echo esc_html($row['coupon']['type'] ?: '—'); ?></td>
            <td><?php echo wp_kses_post($row['coupon']['amount'] ?: '—'); ?></td>
            <td><?php echo esc_html($row['coupon']['description'] ?: '—'); ?></td>
            <td><?php echo esc_html($row['coupon']['product_ids'] ?: '—'); ?></td>
            <td><?php echo esc_html($row['coupon']['usage'] ?: '—'); ?></td>
            <td><?php echo esc_html($row['coupon']['expires'] ?: '—'); ?></td>
            <td><?php echo esc_html($row['source'] ?: '—'); ?></td>
            <td><?php echo esc_html($row['campaign'] ?: '—'); ?></td>
            <td>
              <?php if ($row['code'] && !$row['used']) : ?>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" onsubmit="return confirm('¿Marcar <?php echo esc_js($row['code']); ?> como usado? No se podrá canjear online después.');">
                  <input type="hidden" name="action" value="mandala_gift_mark_used">
                  <input type="hidden" name="code" value="<?php echo esc_attr($row['code']); ?>">
                  <input type="hidden" name="estado" value="<?php echo esc_attr($estado); ?>">
                  <input type="hidden" name="paged" value="<?php echo esc_attr($page); ?>">
                  <?php wp_nonce_field('mandala_gift_mark_used', 'mandala_gift_mark_used_nonce'); ?>
                  <button type="submit" class="button button-small">Marcar como usado</button>
                </form>
              <?php endif; ?>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php if ($result['pages'] > 1) : ?>
      <div class="tablenav"><div class="tablenav-pages">
        <?php for ($p = 1; $p <= $result['pages']; $p++) : ?>
          <a class="button <?php echo $p === $page ? 'button-primary' : ''; ?>" style="margin:2px;"
             href="<?php echo esc_url(add_query_arg(['page' => MANDALA_GIFT_ADMIN_SLUG, 'tab' => 'trazabilidad', 'estado' => $estado, 'q' => $q, 'paged' => $p], admin_url('admin.php'))); ?>"><?php echo $p; ?></a>
        <?php endfor; ?>
      </div></div>
    <?php endif; ?>
    </div>
    <?php
}

function mandala_gift_admin_tab_productos() {
    $products = wc_get_products(['status' => 'publish', 'limit' => 300, 'orderby' => 'title', 'order' => 'ASC']);
    ?>
    <p>Desmarca un producto para que no se pueda regalar como gift card. El botón "Regalar" desaparece del sitio al instante (sin esperar un despliegue), y WordPress igual bloquea la compra del lado del servidor por si acaso.</p>
    <p><input type="search" class="mandala-search" placeholder="Buscar producto…" data-mandala-filter="#mandala-gift-products tbody tr"></p>
    <form method="post">
      <?php wp_nonce_field('mandala_gift_admin', 'mandala_gift_admin_nonce'); ?>
      <div class="mandala-card">
      <table class="widefat striped" id="mandala-gift-products">
        <thead><tr><th style="width:40px;">Permitir</th><th>Producto</th><th>Precio</th><th></th></tr></thead>
        <tbody>
          <?php foreach ($products as $product) :
            $pid = $product->get_id();
            $enabled = get_post_meta($pid, '_mandala_gift_enabled', true) !== 'no'; ?>
            <tr>
              <td>
                <input type="hidden" name="mandala_gift_product[]" value="<?php echo esc_attr($pid); ?>">
                <input type="checkbox" name="mandala_gift_enabled_ids[]" value="<?php echo esc_attr($pid); ?>" <?php checked($enabled); ?>>
              </td>
              <td><?php echo esc_html($product->get_name()); ?></td>
              <td><?php echo wp_kses_post($product->get_price_html()); ?></td>
              <td><a href="<?php echo esc_url(get_edit_post_link($pid, '')); ?>">Editar precio →</a></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
      </div>
      <p class="submit"><button type="submit" name="mandala_gift_save_products" class="button button-primary">Guardar</button></p>
    </form>

    <h2>Historial de cambios en productos</h2>
    <?php
    $product_log = array_values(array_filter((array) get_option(MANDALA_GIFT_LOG_OPTION, []), function ($e) {
        return ($e['type'] ?? '') === 'producto';
    }));
    mandala_gift_log_table('mandala-gift-products-log', array_slice($product_log, 0, 30));
}

/** Registro de cambios hechos desde este panel (ajustes, productos regalables, códigos marcados). */
function mandala_gift_admin_tab_historial() {
    ?>
    <p>Últimos 100 cambios hechos desde este panel: quién los hizo y cuándo.</p>
    <?php mandala_gift_log_table('mandala-gift-log', (array) get_option(MANDALA_GIFT_LOG_OPTION, []));
}

/** Tabla de historial con buscador; $id debe ser único en la página. */
function mandala_gift_log_table($id, array $log) {
    ?>
    <p><input type="search" class="mandala-search" placeholder="Buscar en el historial…" data-mandala-filter="#<?php echo esc_attr($id); ?> tbody tr"></p>
    <div class="mandala-card">
    <table class="widefat striped" id="<?php echo esc_attr($id); ?>">
      <thead><tr><th style="width:150px;">Fecha</th><th style="width:140px;">Usuario</th><th>Cambio</th></tr></thead>
      <tbody>
        <?php if (!$log) : ?><tr><td colspan="3">Todavía no hay cambios registrados.</td></tr><?php endif; ?>
        <?php foreach ($log as $e) : ?>
          <tr>
            <td><?php echo esc_html(wp_date('d-m-Y H:i', $e['time'])); ?></td>
            <td><?php echo esc_html($e['user']); ?></td>
            <td><?php echo esc_html($e['detail']); ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    </div>
    <?php
}

function mandala_gift_admin_tab_ajustes() {
    $enabled = mandala_gift_globally_enabled();
    $image = get_option(MANDALA_GIFT_IMAGE_OPTION, '') ?: MANDALA_GIFT_DEFAULT_IMAGE;
    ?>
    <form method="post">
      <?php wp_nonce_field('mandala_gift_admin', 'mandala_gift_admin_nonce'); ?>
      <div class="mandala-card">
      <table class="form-table">
        <tr>
          <th scope="row">Gift cards activas</th>
          <td>
            <label><input type="checkbox" name="mandala_gift_enabled" value="1" <?php checked($enabled); ?>> Permitir regalar productos en todo el sitio</label>
            <p class="description">Si se desactiva, ningún producto se puede regalar (aunque esté permitido individualmente) hasta que se vuelva a activar aquí.</p>
          </td>
        </tr>
        <tr>
          <th scope="row">Diseño de la tarjeta</th>
          <td>
            <img id="mandala-gift-image-preview" src="<?php echo esc_url($image); ?>" style="max-width:320px;display:block;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.15);margin-bottom:10px;">
            <input type="text" id="mandala-gift-image-url" name="mandala_gift_image_url" value="<?php echo esc_attr($image); ?>" class="regular-text" style="width:420px;">
            <button type="button" class="button" id="mandala-gift-image-pick">Elegir de la biblioteca de medios</button>
            <p class="description">Se usa en el modal del sitio (tarjeta 3D) y en el correo de la gift card.</p>
          </td>
        </tr>
      </table>
      </div>
      <p class="submit"><button type="submit" name="mandala_gift_save_settings" class="button button-primary">Guardar ajustes</button></p>
    </form>
    <script>
    (function () {
      var pickBtn = document.getElementById('mandala-gift-image-pick');
      var input = document.getElementById('mandala-gift-image-url');
      var preview = document.getElementById('mandala-gift-image-preview');
      if (!pickBtn) { console.error('Mandala: no se encontró el botón mandala-gift-image-pick'); return; }
      pickBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (!window.wp || !wp.media) { console.error('Mandala: wp.media no está cargado (falta wp_enqueue_media())'); return; }
        var frame = wp.media({ title: 'Elegir imagen de la gift card', multiple: false, library: { type: 'image' } });
        frame.on('select', function () {
          var att = frame.state().get('selection').first().toJSON();
          input.value = att.url;
          preview.src = att.url;
        });
        frame.open();
      });
    })();
    </script>
    <?php
}
