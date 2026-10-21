<?php
/**
 * Plugin Name: Spa Mándala — Panel de Complementos (upsells)
 * Description: Pantalla en wp-admin (Marketing → Complementos) para ver y editar de un solo lugar
 *              qué complemento se ofrece con cada producto principal, su precio y el texto del
 *              popup. Usa el mismo campo ACF que mandala-upsells.php (`productos_principales_ids`,
 *              guardado en el complemento), así que no cambia cómo funciona el carrito.
 */

if (!defined('ABSPATH')) exit;

const MANDALA_UPSELLS_ADMIN_SLUG = 'mandala-complementos';
const MANDALA_UPSELL_FIELD_KEY   = 'field_69652d493c2c4';       // productos_principales_ids (ver mandala-upsells.php)
const MANDALA_UPSELL_POPUP_KEY   = 'field_mandala_popup_complemento';

add_action('admin_menu', function () {
    add_submenu_page(MANDALA_MARKETING_SLUG, 'Complementos', 'Complementos', 'manage_woocommerce', MANDALA_UPSELLS_ADMIN_SLUG, 'mandala_upsells_admin_render');
}, 10);

/** @return WC_Product[] todos los productos publicados, ordenados por nombre. */
function mandala_upsells_all_products() {
    return wc_get_products(['status' => 'publish', 'limit' => 500, 'orderby' => 'title', 'order' => 'ASC', 'return' => 'objects']);
}

function mandala_upsells_set_principales($upsell_id, array $ids) {
    update_field(MANDALA_UPSELL_FIELD_KEY, array_values(array_unique(array_filter(array_map('intval', $ids)))), $upsell_id);
}

add_action('admin_init', function () {
    if (empty($_POST['mandala_upsells_nonce']) || !wp_verify_nonce($_POST['mandala_upsells_nonce'], 'mandala_upsells')) return;
    if (!current_user_can('manage_woocommerce') || !function_exists('update_field')) return;

    $tab = 'complementos';

    // Edición de la tabla: principales, popup y precio de cada complemento.
    if (isset($_POST['mandala_upsells_save']) && !empty($_POST['row']) && is_array($_POST['row'])) {
        foreach ($_POST['row'] as $id => $row) {
            $id = (int) $id;
            $product = wc_get_product($id);
            if (!$product) continue;
            // "Quitar": deja de ser complemento (sigue siendo un producto normal).
            if (!empty($row['remove'])) {
                mandala_upsells_set_principales($id, []);
                continue;
            }
            mandala_upsells_set_principales($id, (array) ($row['principales'] ?? []));
            // Decodifica antes de limpiar: así un texto con HTML escapado (&lt;div&gt;…) queda en texto plano.
            update_field(MANDALA_UPSELL_POPUP_KEY, sanitize_textarea_field(html_entity_decode(wp_unslash($row['popup'] ?? ''), ENT_QUOTES, 'UTF-8')), $id);
            $product->set_regular_price(wc_format_decimal(wp_unslash($row['regular'] ?? '')));
            $product->set_sale_price(wc_format_decimal(wp_unslash($row['sale'] ?? '')));
            $product->save();
        }
    }

    // Convertir un producto existente en complemento.
    if (isset($_POST['mandala_upsells_add'])) {
        $id = (int) ($_POST['new_upsell'] ?? 0);
        $principales = array_map('intval', (array) ($_POST['new_principales'] ?? []));
        if ($id && $principales) mandala_upsells_set_principales($id, $principales);
    }

    // Vista por producto principal: qué complementos se ofrecen con él.
    if (isset($_POST['mandala_upsells_save_principal'])) {
        $tab = 'principal';
        $principal = (int) ($_POST['principal'] ?? 0);
        $chosen = array_map('intval', (array) ($_POST['offer'] ?? []));
        foreach (mandala_upsells_current() as $u) {
            $ids = mandala_ud_ids(get_field('productos_principales_ids', $u->get_id()));
            $ids = in_array($u->get_id(), $chosen, true) ? array_merge($ids, [$principal]) : array_diff($ids, [$principal]);
            mandala_upsells_set_principales($u->get_id(), $ids);
        }
    }

    wp_safe_redirect(add_query_arg(['page' => MANDALA_UPSELLS_ADMIN_SLUG, 'tab' => $tab, 'saved' => 1, 'principal' => (int) ($_POST['principal'] ?? 0)], admin_url('admin.php')));
    exit;
});

/** @return WC_Product[] productos que hoy son complementos. */
function mandala_upsells_current() {
    return array_values(array_filter(mandala_upsells_all_products(), function ($p) {
        return mandala_ud_is_upsell($p->get_id());
    }));
}

function mandala_upsells_admin_render() {
    if (!current_user_can('manage_woocommerce')) return;
    if (!function_exists('get_field')) {
        echo '<div class="wrap"><p>ACF PRO no está activo: sin él no se pueden gestionar complementos.</p></div>';
        return;
    }
    $tab = ($_GET['tab'] ?? 'complementos') === 'principal' ? 'principal' : 'complementos';
    $base = ['page' => MANDALA_UPSELLS_ADMIN_SLUG];
    ?>
    <div class="wrap mandala-admin">
      <?php mandala_admin_header('Complementos', 'Qué se ofrece junto a cada producto principal, y a qué precio. Los cambios se ven en el sitio en ~90 segundos.'); ?>
      <?php if (!empty($_GET['saved'])) : ?><div class="notice notice-success is-dismissible"><p>Guardado.</p></div><?php endif; ?>
      <h2 class="nav-tab-wrapper">
        <a class="nav-tab <?php echo $tab === 'complementos' ? 'nav-tab-active' : ''; ?>" href="<?php echo esc_url(add_query_arg($base + ['tab' => 'complementos'], admin_url('admin.php'))); ?>">Por complemento</a>
        <a class="nav-tab <?php echo $tab === 'principal' ? 'nav-tab-active' : ''; ?>" href="<?php echo esc_url(add_query_arg($base + ['tab' => 'principal'], admin_url('admin.php'))); ?>">Por producto principal</a>
      </h2>
      <?php $tab === 'principal' ? mandala_upsells_tab_principal() : mandala_upsells_tab_complementos(); ?>
    </div>
    <?php
}

function mandala_upsells_tab_complementos() {
    $all = mandala_upsells_all_products();
    $upsells = mandala_upsells_current();
    $principales = array_filter($all, function ($p) { return !mandala_ud_is_upsell($p->get_id()); });
    $principal_names = [];
    foreach ($principales as $p) $principal_names[$p->get_id()] = $p->get_name();
    ?>
    <p><input type="search" class="mandala-search" placeholder="Buscar complemento…" data-mandala-filter="#mandala-upsells-table tbody tr"></p>
    <form method="post">
      <?php wp_nonce_field('mandala_upsells', 'mandala_upsells_nonce'); ?>
      <div class="mandala-card">
      <table class="widefat striped" id="mandala-upsells-table">
        <thead><tr><th>Complemento</th><th>Precio normal</th><th>Precio oferta</th><th>Se ofrece con (Ctrl/Cmd para varios)</th><th>Texto del popup</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($upsells as $u) :
            $id = $u->get_id();
            $sel = mandala_ud_ids(get_field('productos_principales_ids', $id)); ?>
          <tr>
            <td><strong><?php echo esc_html($u->get_name()); ?></strong><br><a href="<?php echo esc_url(get_edit_post_link($id, '')); ?>">Editar ficha →</a></td>
            <td><input type="number" step="1" min="0" name="row[<?php echo $id; ?>][regular]" value="<?php echo esc_attr($u->get_regular_price()); ?>" style="width:90px"></td>
            <td><input type="number" step="1" min="0" name="row[<?php echo $id; ?>][sale]" value="<?php echo esc_attr($u->get_sale_price()); ?>" style="width:90px"></td>
            <td style="min-width:300px"><?php mandala_checklist("row[$id][principales]", $principal_names, $sel, 'Buscar producto…'); ?></td>
            <td><textarea name="row[<?php echo $id; ?>][popup]" rows="3" style="width:220px"><?php echo esc_textarea((string) get_field('popup_complemento_texto', $id)); ?></textarea></td>
            <td><label><input type="checkbox" name="row[<?php echo $id; ?>][remove]" value="1"> Quitar</label></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
      </div>
      <p class="submit"><button type="submit" name="mandala_upsells_save" class="button button-primary">Guardar cambios</button></p>
    </form>

    <form method="post" class="mandala-card">
      <h2>Convertir un producto en complemento</h2>
      <?php wp_nonce_field('mandala_upsells', 'mandala_upsells_nonce'); ?>
      <div class="mandala-field">
        <span class="mandala-label">Producto que será complemento</span>
        <select name="new_upsell" required>
          <option value="">Producto…</option>
          <?php foreach ($principal_names as $pid => $name) : ?><option value="<?php echo $pid; ?>"><?php echo esc_html($name); ?></option><?php endforeach; ?>
        </select>
      </div>
      <div class="mandala-field">
        <span class="mandala-label">Se ofrecerá con</span>
        <?php mandala_checklist('new_principales', $principal_names, [], 'Buscar producto…'); ?>
      </div>
      <button type="submit" name="mandala_upsells_add" class="button button-primary">Agregar complemento</button>
    </form>
    <?php
}

function mandala_upsells_tab_principal() {
    $principales = array_filter(mandala_upsells_all_products(), function ($p) { return !mandala_ud_is_upsell($p->get_id()); });
    $current = (int) ($_GET['principal'] ?? 0);
    ?>
    <form method="get" class="mandala-card">
      <input type="hidden" name="page" value="<?php echo esc_attr(MANDALA_UPSELLS_ADMIN_SLUG); ?>">
      <input type="hidden" name="tab" value="principal">
      <select name="principal" onchange="this.form.submit()">
        <option value="">Elige un producto principal…</option>
        <?php foreach ($principales as $p) : ?><option value="<?php echo $p->get_id(); ?>" <?php selected($current, $p->get_id()); ?>><?php echo esc_html($p->get_name()); ?></option><?php endforeach; ?>
      </select>
    </form>
    <?php if (!$current) return; ?>
    <form method="post">
      <?php wp_nonce_field('mandala_upsells', 'mandala_upsells_nonce'); ?>
      <input type="hidden" name="principal" value="<?php echo $current; ?>">
      <div class="mandala-card">
      <table class="widefat striped">
        <thead><tr><th style="width:40px">Ofrecer</th><th>Complemento</th><th>Precio</th></tr></thead>
        <tbody>
        <?php foreach (mandala_upsells_current() as $u) :
            $on = in_array($current, mandala_ud_ids(get_field('productos_principales_ids', $u->get_id())), true); ?>
          <tr>
            <td><input type="checkbox" name="offer[]" value="<?php echo $u->get_id(); ?>" <?php checked($on); ?>></td>
            <td><?php echo esc_html($u->get_name()); ?></td>
            <td><?php echo wp_kses_post($u->get_price_html()); ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
      </div>
      <p class="submit"><button type="submit" name="mandala_upsells_save_principal" class="button button-primary">Guardar</button></p>
    </form>
    <?php
}
