<?php
/**
 * Plugin Name: Spa Mándala — Limpieza de gift cards (laboratorio)
 * Description: Pantalla en wp-admin (Marketing → Limpieza) para empezar las pruebas desde cero:
 *              cuenta las gift cards ya usadas o expiradas y las borra de una (cupón, imágenes,
 *              eventos de envío pendientes y, opcionalmente, el pedido), y borra las imágenes
 *              huérfanas que quedan en la Biblioteca de Medios. Borrado IRREVERSIBLE: solo
 *              funciona en laboratorio.space, o si wp-config.php define MANDALA_ALLOW_CLEANUP.
 */

if (!defined('ABSPATH')) exit;

const MANDALA_CLEANUP_SLUG = 'mandala-limpieza';

function mandala_cleanup_allowed() {
    return (defined('MANDALA_ALLOW_CLEANUP') && MANDALA_ALLOW_CLEANUP)
        || strpos((string) parse_url(home_url(), PHP_URL_HOST), 'laboratorio.space') !== false;
}

add_action('admin_menu', function () {
    add_submenu_page(MANDALA_MARKETING_SLUG, 'Limpieza', 'Limpieza', 'manage_woocommerce', MANDALA_CLEANUP_SLUG, 'mandala_cleanup_render');
}, 10);

function mandala_cleanup_attachment_id($url) {
    return $url ? (int) attachment_url_to_postid($url) : 0;
}

/** IDs de las imágenes compuestas en el servidor que guardaban los pedidos antiguos (antes de componerlas en el navegador). */
function mandala_cleanup_mockup_ids($item) {
    $ids = [];
    foreach ($item->get_meta_data() as $m) {
        $d = $m->get_data();
        if ($d['key'] === '_mandala_gift_mockup_id') $ids[] = (int) $d['value'];
    }
    return $ids;
}

/** @return array{used: array, expired: array} gift cards usadas y expiradas, con lo que hay que borrar de cada una. */
function mandala_cleanup_cards() {
    $out = ['used' => [], 'expired' => []];
    foreach (mandala_gift_query_orders(1, 100000, 'todos')['items'] as $row) {
        $kind = $row['used'] ? 'used' : (strpos($row['status'], 'Expirado') === 0 ? 'expired' : null);
        if (!$kind) continue;
        $out[$kind][] = [
            'order_id' => $row['order']->get_id(),
            'code'     => $row['code'],
            'product'  => $row['product'],
            'status'   => $row['status'],
            'images'   => array_values(array_filter(array_unique(array_merge(
                [mandala_cleanup_attachment_id($row['gift']['personalImage'] ?? '')],
                mandala_cleanup_mockup_ids($row['item'])
            )))),
        ];
    }
    return $out;
}

/** Eventos de WP-Cron de envío programado que pertenecen a esos pedidos. */
function mandala_cleanup_cron_events(array $order_ids) {
    $found = [];
    foreach ((array) _get_cron_array() as $ts => $hooks) {
        foreach (($hooks['mandala_gift_send_scheduled'] ?? []) as $ev) {
            if (in_array((int) ($ev['args'][0] ?? 0), $order_ids, true)) $found[] = [$ts, $ev['args']];
        }
    }
    return $found;
}

/** Adjuntos de gift cards que ningún pedido existente usa (y con más de 24 h, por si hay una compra en curso). */
function mandala_cleanup_orphans() {
    global $wpdb;
    $cutoff = gmdate('Y-m-d H:i:s', time() - DAY_IN_SECONDS);
    $ids = $wpdb->get_col($wpdb->prepare(
        "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'attachment' AND post_date_gmt < %s AND post_title = 'Gift card personalizada'", $cutoff
    ));
    $uploader = get_user_by('login', MANDALA_GIFT_UPLOADER_USER);
    if ($uploader) {
        $ids = array_merge($ids, $wpdb->get_col($wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'attachment' AND post_date_gmt < %s AND post_author = %d", $cutoff, $uploader->ID
        )));
    }
    $in_use = [];
    foreach (mandala_gift_query_orders(1, 100000, 'todos')['items'] as $row) {
        $in_use[] = mandala_cleanup_attachment_id($row['gift']['personalImage'] ?? '');
        $in_use = array_merge($in_use, mandala_cleanup_mockup_ids($row['item']));
    }
    return array_values(array_diff(array_unique(array_map('intval', $ids)), $in_use));
}

add_action('admin_init', function () {
    if (empty($_POST['mandala_cleanup_nonce']) || !wp_verify_nonce($_POST['mandala_cleanup_nonce'], 'mandala_cleanup')) return;
    if (!current_user_can('manage_woocommerce') || !mandala_cleanup_allowed()) return;

    $back = ['page' => MANDALA_CLEANUP_SLUG, 'tab' => ($_POST['op'] ?? '') === 'orphans' ? 'huerfanas' : 'usadas'];
    if (($_POST['confirm'] ?? '') !== 'BORRAR') {
        wp_safe_redirect(add_query_arg($back + ['error' => 1], admin_url('admin.php')));
        exit;
    }

    $n = ['cupones' => 0, 'imagenes' => 0, 'pedidos' => 0, 'eventos' => 0];

    if (($_POST['op'] ?? '') === 'orphans') {
        foreach (mandala_cleanup_orphans() as $id) {
            if (wp_delete_attachment($id, true)) $n['imagenes']++;
        }
    } else {
        $cards = mandala_cleanup_cards();
        $rows = array_merge(!empty($_POST['incl_used']) ? $cards['used'] : [], !empty($_POST['incl_expired']) ? $cards['expired'] : []);
        $order_ids = array_values(array_unique(array_column($rows, 'order_id')));
        foreach ($rows as $r) {
            $coupon_id = $r['code'] ? wc_get_coupon_id_by_code($r['code']) : 0;
            if ($coupon_id && wp_delete_post($coupon_id, true)) $n['cupones']++;
            if (!empty($_POST['incl_images'])) {
                foreach ($r['images'] as $img) { if (wp_delete_attachment($img, true)) $n['imagenes']++; }
            }
        }
        foreach (mandala_cleanup_cron_events($order_ids) as [$ts, $args]) {
            wp_unschedule_event($ts, 'mandala_gift_send_scheduled', $args);
            $n['eventos']++;
        }
        if (!empty($_POST['incl_orders'])) {
            foreach ($order_ids as $oid) {
                $order = wc_get_order($oid);
                if ($order && $order->delete(true)) $n['pedidos']++;
            }
        }
    }

    mandala_gift_log(sprintf('Limpieza: borró %d cupones, %d imágenes, %d pedidos y %d eventos de envío', $n['cupones'], $n['imagenes'], $n['pedidos'], $n['eventos']), 'limpieza');
    wp_safe_redirect(add_query_arg($back + ['done' => 1], admin_url('admin.php')));
    exit;
});

function mandala_cleanup_render() {
    if (!current_user_can('manage_woocommerce')) return;
    $tab = ($_GET['tab'] ?? 'usadas') === 'huerfanas' ? 'huerfanas' : 'usadas';
    ?>
    <div class="wrap mandala-admin">
      <?php mandala_admin_header('Limpieza', 'Borra gift cards usadas e imágenes sobrantes para empezar las pruebas desde cero.'); ?>
      <?php if (!mandala_cleanup_allowed()) : ?>
        <div class="notice notice-warning"><p>Esta herramienta está desactivada en este sitio porque el borrado es irreversible. Solo funciona en laboratorio.space, o si <code>MANDALA_ALLOW_CLEANUP</code> está definido en wp-config.php.</p></div>
        </div>
        <?php return;
      endif; ?>
      <div class="notice notice-info"><p><strong>Irreversible.</strong> Haz un respaldo de la base de datos antes de borrar.</p></div>
      <?php if (!empty($_GET['done'])) : ?><div class="notice notice-success is-dismissible"><p>Limpieza hecha. El detalle quedó en el historial de abajo.</p></div><?php endif; ?>
      <?php if (!empty($_GET['error'])) : ?><div class="notice notice-error is-dismissible"><p>No se borró nada: escribe BORRAR para confirmar.</p></div><?php endif; ?>
      <h2 class="nav-tab-wrapper">
        <a class="nav-tab <?php echo $tab === 'usadas' ? 'nav-tab-active' : ''; ?>" href="<?php echo esc_url(add_query_arg(['page' => MANDALA_CLEANUP_SLUG, 'tab' => 'usadas'], admin_url('admin.php'))); ?>">Gift cards usadas</a>
        <a class="nav-tab <?php echo $tab === 'huerfanas' ? 'nav-tab-active' : ''; ?>" href="<?php echo esc_url(add_query_arg(['page' => MANDALA_CLEANUP_SLUG, 'tab' => 'huerfanas'], admin_url('admin.php'))); ?>">Imágenes huérfanas</a>
      </h2>
      <?php $tab === 'huerfanas' ? mandala_cleanup_tab_orphans() : mandala_cleanup_tab_cards(); ?>

      <h2>Historial de limpiezas</h2>
      <?php
      $log = array_values(array_filter((array) get_option(MANDALA_GIFT_LOG_OPTION, []), function ($e) { return ($e['type'] ?? '') === 'limpieza'; }));
      mandala_gift_log_table('mandala-cleanup-log', array_slice($log, 0, 30));
      ?>
    </div>
    <?php
}

function mandala_cleanup_confirm_fields($button) {
    ?>
    <p>
      <input type="text" name="confirm" placeholder="Escribe BORRAR" autocomplete="off" style="width:160px">
      <button type="submit" class="button button-primary"><?php echo esc_html($button); ?></button>
    </p>
    <?php
}

function mandala_cleanup_tab_cards() {
    $cards = mandala_cleanup_cards();
    $rows = array_merge($cards['used'], $cards['expired']);
    $events = mandala_cleanup_cron_events(array_column($rows, 'order_id'));
    ?>
    <div class="mandala-card">
      <strong><?php echo count($cards['used']); ?></strong> usadas ·
      <strong><?php echo count($cards['expired']); ?></strong> expiradas ·
      <strong><?php echo count($events); ?></strong> envíos programados pendientes de esas gift cards
    </div>
    <p><input type="search" class="mandala-search" placeholder="Buscar por código, orden o producto…" data-mandala-filter="#mandala-cleanup-cards tbody tr"></p>
    <div class="mandala-card">
    <table class="widefat striped" id="mandala-cleanup-cards">
      <thead><tr><th>Orden</th><th>Código</th><th>Producto</th><th>Estado</th><th>Imágenes</th></tr></thead>
      <tbody>
        <?php if (!$rows) : ?><tr><td colspan="5">No hay gift cards usadas ni expiradas.</td></tr><?php endif; ?>
        <?php foreach ($rows as $r) : ?>
          <tr>
            <td>#<?php echo esc_html($r['order_id']); ?></td>
            <td><code><?php echo esc_html($r['code'] ?: '—'); ?></code></td>
            <td><?php echo esc_html($r['product']); ?></td>
            <td><?php echo esc_html($r['status']); ?></td>
            <td><?php echo count($r['images']); ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    </div>
    <?php if ($rows) : ?>
    <form method="post" class="mandala-card" onsubmit="return confirm('Esto borra de forma permanente. ¿Continuar?');">
      <?php wp_nonce_field('mandala_cleanup', 'mandala_cleanup_nonce'); ?>
      <input type="hidden" name="op" value="cards">
      <p><label><input type="checkbox" name="incl_used" value="1" checked> Gift cards usadas</label><br>
         <label><input type="checkbox" name="incl_expired" value="1"> Gift cards expiradas</label></p>
      <p><label><input type="checkbox" name="incl_images" value="1" checked> Borrar también sus imágenes (foto original y tarjeta compuesta)</label><br>
         <label><input type="checkbox" name="incl_orders" value="1"> Borrar también el pedido completo</label></p>
      <p class="description">Siempre se borran el cupón y los envíos programados pendientes de esas gift cards.</p>
      <?php mandala_cleanup_confirm_fields('Borrar gift cards seleccionadas'); ?>
    </form>
    <?php endif;
}

function mandala_cleanup_tab_orphans() {
    $ids = mandala_cleanup_orphans();
    ?>
    <div class="mandala-card"><strong><?php echo count($ids); ?></strong> imágenes de gift cards sin pedido (más de 24 horas de antigüedad).</div>
    <?php if ($ids) : ?>
    <p><input type="search" class="mandala-search" placeholder="Buscar imagen…" data-mandala-filter="#mandala-cleanup-orphans tbody tr"></p>
    <div class="mandala-card">
    <table class="widefat striped" id="mandala-cleanup-orphans">
      <thead><tr><th>ID</th><th>Archivo</th><th>Subida</th></tr></thead>
      <tbody>
        <?php foreach ($ids as $id) : ?>
          <tr>
            <td><?php echo (int) $id; ?></td>
            <td><a href="<?php echo esc_url(wp_get_attachment_url($id)); ?>" target="_blank" rel="noopener"><?php echo esc_html(basename((string) get_attached_file($id))); ?></a></td>
            <td><?php echo esc_html(get_the_date('d-m-Y H:i', $id)); ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    </div>
    <form method="post" class="mandala-card" onsubmit="return confirm('Esto borra de forma permanente. ¿Continuar?');">
      <?php wp_nonce_field('mandala_cleanup', 'mandala_cleanup_nonce'); ?>
      <input type="hidden" name="op" value="orphans">
      <?php mandala_cleanup_confirm_fields('Borrar imágenes huérfanas'); ?>
    </form>
    <?php endif;
}
