<?php
/**
 * Plugin Name: Spa Mándala — Panel de Gift Cards
 * Description: Pantalla en wp-admin (WooCommerce → Gift Cards) para que el cliente
 *              administre gift cards sin tocar código: activar/desactivar por producto
 *              o globalmente, cambiar el diseño de la tarjeta, y ver la trazabilidad
 *              de compras (comprador, destinatario, estado, origen). Usa las mismas
 *              opciones/meta que lee mandala-giftcards.php.
 */

if (!defined('ABSPATH')) exit;

const MANDALA_GIFT_ADMIN_SLUG = 'mandala-gift-cards';

add_action('admin_menu', function () {
    add_submenu_page(
        'woocommerce',
        'Gift Cards',
        'Gift Cards',
        'manage_woocommerce',
        MANDALA_GIFT_ADMIN_SLUG,
        'mandala_gift_admin_render'
    );
});

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

/** Clasifica el origen guardado por el frontend (ver astro-frontend/src/lib/attribution.ts). */
function mandala_gift_format_origin($order) {
    $raw = $order->get_meta('_mandala_attribution');
    if (empty($raw)) return 'Sin datos';
    $data = is_array($raw) ? $raw : json_decode($raw, true);
    if (!is_array($data)) return 'Sin datos';
    $source = trim((string) ($data['source'] ?? ''));
    if ($source === '' || strtolower($source) === 'direct') return 'Directo';
    return esc_html(ucfirst($source));
}

/** Trae todas las órdenes con al menos un ítem regalado, más recientes primero. */
function mandala_gift_query_orders($page = 1, $per_page = 20) {
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

    $total = count($rows);
    $offset = ($page - 1) * $per_page;
    $rows = array_slice($rows, $offset, $per_page);

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
        if ($code) {
            if ($sent) {
                $status = 'Enviado';
            } elseif (!empty($gift['deliveryDate'])) {
                $status = 'Programado para ' . date_i18n('j \d\e F \d\e Y', strtotime($gift['deliveryDate']));
            } else {
                $status = 'Por enviar';
            }
            if ($code) {
                $coupon_id = wc_get_coupon_id_by_code($code);
                if ($coupon_id) {
                    $coupon = new WC_Coupon($coupon_id);
                    if ($coupon->get_usage_count() > 0) $status = 'Canjeado';
                    elseif ($coupon->get_date_expires() && $coupon->get_date_expires()->getTimestamp() < time()) $status = 'Expirado';
                }
            }
        }

        $items[] = [
            'order'     => $order,
            'item'      => $item,
            'gift'      => $gift,
            'code'      => $code,
            'status'    => $status,
            'origin'    => mandala_gift_format_origin($order),
            'total'     => $order->get_formatted_order_total(),
        ];
    }

    return ['items' => $items, 'total' => $total, 'pages' => (int) ceil($total / $per_page)];
}

function mandala_gift_admin_render() {
    if (!current_user_can('manage_woocommerce')) return;
    $tab = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'trazabilidad';
    $tabs = ['trazabilidad' => 'Trazabilidad', 'productos' => 'Productos', 'ajustes' => 'Ajustes'];
    ?>
    <div class="wrap">
      <h1>Gift Cards — Spa Mándala</h1>
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
    $result = mandala_gift_query_orders($page);
    ?>
    <p>Todas las compras hechas "como regalo". El origen se completa solo cuando el frontend detecta utm_source/referencia (ver README).</p>
    <table class="widefat striped">
      <thead><tr>
        <th>Fecha</th><th>Orden</th><th>Comprador</th><th>Destinatario</th><th>Producto</th><th>Monto</th><th>Estado</th><th>Origen</th>
      </tr></thead>
      <tbody>
        <?php if (empty($result['items'])) : ?>
          <tr><td colspan="8">Aún no hay gift cards vendidas.</td></tr>
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
            <td><?php echo esc_html($row['status']); ?></td>
            <td><?php echo esc_html($row['origin']); ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php if ($result['pages'] > 1) : ?>
      <div class="tablenav"><div class="tablenav-pages">
        <?php for ($p = 1; $p <= $result['pages']; $p++) : ?>
          <a class="button <?php echo $p === $page ? 'button-primary' : ''; ?>" style="margin:2px;"
             href="<?php echo esc_url(add_query_arg(['page' => MANDALA_GIFT_ADMIN_SLUG, 'tab' => 'trazabilidad', 'paged' => $p], admin_url('admin.php'))); ?>"><?php echo $p; ?></a>
        <?php endfor; ?>
      </div></div>
    <?php endif; ?>
    <?php
}

function mandala_gift_admin_tab_productos() {
    $products = wc_get_products(['status' => 'publish', 'limit' => 300, 'orderby' => 'title', 'order' => 'ASC']);
    ?>
    <p>Desmarca un producto para que no se pueda regalar como gift card. WordPress lo bloquea de inmediato aunque el botón siga visible en el sitio hasta el próximo despliegue.</p>
    <form method="post">
      <?php wp_nonce_field('mandala_gift_admin', 'mandala_gift_admin_nonce'); ?>
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
