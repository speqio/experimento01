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

add_action('admin_enqueue_scripts', function ($hook) {
    if (strpos($hook, MANDALA_GIFT_ADMIN_SLUG) === false) return;
    wp_enqueue_media();
});

/** Guarda los formularios (ajustes globales / imagen / por producto). Corre antes de pintar la página. */
add_action('admin_init', function () {
    if (empty($_POST['mandala_gift_admin_nonce']) || !wp_verify_nonce($_POST['mandala_gift_admin_nonce'], 'mandala_gift_admin')) return;
    if (!current_user_can('manage_woocommerce')) return;

    if (isset($_POST['mandala_gift_save_settings'])) {
        update_option('mandala_gift_enabled', !empty($_POST['mandala_gift_enabled']) ? 1 : 0);
        $image = esc_url_raw(trim((string) ($_POST['mandala_gift_image_url'] ?? '')));
        update_option(MANDALA_GIFT_IMAGE_OPTION, $image);
        wp_safe_redirect(add_query_arg(['page' => MANDALA_GIFT_ADMIN_SLUG, 'tab' => 'ajustes', 'saved' => 1], admin_url('admin.php')));
        exit;
    }

    if (isset($_POST['mandala_gift_save_products']) && !empty($_POST['mandala_gift_product']) && is_array($_POST['mandala_gift_product'])) {
        $enabled_ids = array_map('intval', $_POST['mandala_gift_enabled_ids'] ?? []);
        foreach (array_map('intval', $_POST['mandala_gift_product']) as $product_id) {
            if ($product_id <= 0) continue;
            update_post_meta($product_id, '_mandala_gift_enabled', in_array($product_id, $enabled_ids, true) ? 'yes' : 'no');
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

/**
 * Trae todas las órdenes con al menos un ítem regalado, más recientes primero.
 * $estado: 'todos' | 'usados' | 'no-usados' — filtra por si el código ya se canjeó.
 * Resuelve todo antes de paginar (el filtro depende del estado del cupón, que solo
 * se sabe al resolver cada ítem); volumen bajo, sin impacto real de performance.
 */
function mandala_gift_query_orders($page = 1, $per_page = 20, $estado = 'todos') {
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
    foreach ($rows as $row) {
        $order = wc_get_order($row->order_id);
        if (!$order) continue;
        $item = $order->get_item($row->order_item_id);
        if (!$item) continue;
        $gift = $item->get_meta(MANDALA_GIFT_KEY);
        if (empty($gift)) continue;

        $code = $item->get_meta('_mandala_gift_code');
        $sent = $item->get_meta('_mandala_gift_sent');
        $status = 'Pendiente de pago';
        $used = false;
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

        $items[] = [
            'order'  => $order,
            'item'   => $item,
            'gift'   => $gift,
            'code'   => $code,
            'status' => $status,
            'used'   => $used,
            'total'  => $order->get_formatted_order_total(),
        ];
    }

    if ($estado === 'usados') {
        $items = array_values(array_filter($items, fn($row) => $row['used']));
    } elseif ($estado === 'no-usados') {
        $items = array_values(array_filter($items, fn($row) => !$row['used']));
    }

    $total = count($items);
    $offset = ($page - 1) * $per_page;
    $items = array_slice($items, $offset, $per_page);

    return ['items' => $items, 'total' => $total, 'pages' => (int) ceil($total / $per_page)];
}

function mandala_gift_admin_render() {
    if (!current_user_can('manage_woocommerce')) return;
    $tab = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'trazabilidad';
    $tabs = ['trazabilidad' => 'Trazabilidad', 'productos' => 'Productos', 'ajustes' => 'Ajustes'];
    ?>
    <div class="wrap mandala-admin">
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
      <div style="max-width:1100px;margin-top:20px;">
        <?php
        if ($tab === 'productos') mandala_gift_admin_tab_productos();
        elseif ($tab === 'ajustes') mandala_gift_admin_tab_ajustes();
        else mandala_gift_admin_tab_trazabilidad();
        ?>
      </div>
    </div>
    <?php
}

function mandala_gift_admin_tab_trazabilidad() {
    $page = max(1, (int) ($_GET['paged'] ?? 1));
    $estado = isset($_GET['estado']) ? sanitize_key($_GET['estado']) : 'todos';
    $result = mandala_gift_query_orders($page, 20, $estado);
    ?>
    <?php if (!empty($_GET['marked'])) : ?>
      <div class="notice notice-success is-dismissible"><p>Código marcado como usado.</p></div>
    <?php endif; ?>
    <p>Todas las compras hechas "como regalo", con su código, para saber cuáles ya se canjearon y cuáles siguen disponibles. Si alguien reservó por teléfono o correo, márcalo manualmente para que no se pueda canjear de nuevo online.</p>
    <form method="get" style="margin-bottom:12px;">
      <input type="hidden" name="page" value="<?php echo esc_attr(MANDALA_GIFT_ADMIN_SLUG); ?>">
      <input type="hidden" name="tab" value="trazabilidad">
      <label for="mandala-gift-estado-filter">Estado:</label>
      <select name="estado" id="mandala-gift-estado-filter" onchange="this.form.submit()">
        <option value="todos" <?php selected($estado, 'todos'); ?>>Todos</option>
        <option value="usados" <?php selected($estado, 'usados'); ?>>Usados</option>
        <option value="no-usados" <?php selected($estado, 'no-usados'); ?>>No usados</option>
      </select>
      <noscript><button type="submit" class="button">Filtrar</button></noscript>
    </form>
    <div class="mandala-card">
    <table class="widefat striped">
      <thead><tr>
        <th>Fecha</th><th>Orden</th><th>Comprador</th><th>Destinatario</th><th>Producto</th><th>Monto</th><th>Código</th><th>Usado</th><th>Estado</th><th></th>
      </tr></thead>
      <tbody>
        <?php if (empty($result['items'])) : ?>
          <tr><td colspan="10">No hay gift cards que coincidan con este filtro.</td></tr>
        <?php endif; ?>
        <?php foreach ($result['items'] as $row) :
          $order = $row['order']; $item = $row['item']; $gift = $row['gift']; ?>
          <tr>
            <td><?php echo esc_html($order->get_date_created() ? $order->get_date_created()->date('d-m-Y H:i') : '—'); ?></td>
            <td><a href="<?php echo esc_url($order->get_edit_order_url()); ?>">#<?php echo esc_html($order->get_id()); ?></a></td>
            <td><?php echo esc_html($gift['buyerEmail'] ?? '—'); ?></td>
            <td><?php echo esc_html($gift['recipientEmail'] ?? '—'); ?></td>
            <td><?php echo esc_html($item->get_name()); ?></td>
            <td><?php echo wp_kses_post($row['total']); ?></td>
            <td><code><?php echo esc_html($row['code'] ?: '—'); ?></code></td>
            <td><?php echo $row['code'] ? ($row['used'] ? 'Sí' : 'No') : '—'; ?></td>
            <td><?php echo esc_html($row['status']); ?></td>
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
             href="<?php echo esc_url(add_query_arg(['page' => MANDALA_GIFT_ADMIN_SLUG, 'tab' => 'trazabilidad', 'estado' => $estado, 'paged' => $p], admin_url('admin.php'))); ?>"><?php echo $p; ?></a>
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
    <form method="post">
      <?php wp_nonce_field('mandala_gift_admin', 'mandala_gift_admin_nonce'); ?>
      <div class="mandala-card">
      <table class="widefat striped">
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
      if (!pickBtn || !window.wp || !wp.media) return;
      pickBtn.addEventListener('click', function (e) {
        e.preventDefault();
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
