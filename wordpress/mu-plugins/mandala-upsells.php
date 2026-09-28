<?php
/**
 * Plugin Name: Spa Mándala — Upsells dependientes (headless)
 * Description: Reglas de carrito de los complementos ("Complementa tu experiencia") portadas de
 *              upsells-dependientes.php (producción) y herramienta de importación de la relación
 *              complemento → productos principales desde mandala-upsells-data.json.
 *
 * Modelo (igual que producción): el complemento es un producto con el campo ACF
 * `productos_principales_ids` (relación hacia los principales) y `popup_complemento_texto`.
 */

if (!defined('ABSPATH')) exit;

function mandala_ud_ids($v) {
    if (empty($v)) return [];
    $ids = [];
    foreach ((array) $v as $x) {
        $ids[] = (is_object($x) && isset($x->ID)) ? (int) $x->ID : (int) $x;
    }
    return array_values(array_unique(array_filter($ids)));
}

function mandala_ud_is_upsell($id) {
    return function_exists('get_field') && !empty(mandala_ud_ids(get_field('productos_principales_ids', $id)));
}

function mandala_ud_principales_en_carrito() {
    if (!WC()->cart) return [];
    $ids = [];
    foreach (WC()->cart->get_cart() as $i) {
        $id = !empty($i['parent_id']) ? (int) $i['parent_id'] : (int) $i['product_id'];
        if ($id && !mandala_ud_is_upsell($id)) $ids[] = $id;
    }
    return array_values(array_unique($ids));
}

/** Un complemento solo se puede comprar junto a uno de sus productos principales. */
add_filter('woocommerce_add_to_cart_validation', function ($passed, $product_id) {
    if (!mandala_ud_is_upsell($product_id)) return $passed;
    $principales = mandala_ud_ids(get_field('productos_principales_ids', $product_id));
    if (!array_intersect($principales, mandala_ud_principales_en_carrito())) {
        wc_add_notice('Este producto solo puede comprarse como complemento.', 'error');
        return false;
    }
    return $passed;
}, 10, 2);

/** Si el principal sale del carrito, se quitan sus complementos. */
add_action('woocommerce_cart_updated', function () {
    if (!WC()->cart || is_admin()) return;
    $principales = mandala_ud_principales_en_carrito();
    foreach (WC()->cart->get_cart() as $key => $item) {
        $id = (int) $item['product_id'];
        if (mandala_ud_is_upsell($id)) {
            if (!array_intersect(mandala_ud_ids(get_field('productos_principales_ids', $id)), $principales)) {
                WC()->cart->remove_cart_item($key);
            }
        }
    }
});

/**
 * Importación (solo administradores, idempotente):
 *   /wp-admin/admin-post.php?action=mandala_upsells_import            → vista previa (no escribe)
 *   /wp-admin/admin-post.php?action=mandala_upsells_import&apply=1    → aplica los cambios
 * Lee mandala-upsells-data.json (misma carpeta) con IDs de ESTE sitio.
 */
add_action('admin_post_mandala_upsells_import', function () {
    if (!current_user_can('manage_options')) wp_die('No autorizado', 403);
    if (!function_exists('update_field')) wp_die('ACF PRO no está activo.');

    $file = __DIR__ . '/mandala-upsells-data.json';
    $data = file_exists($file) ? json_decode(file_get_contents($file), true) : null;
    if (empty($data['upsells'])) wp_die('No se encontró mandala-upsells-data.json o está vacío.');

    $apply = !empty($_GET['apply']);
    header('Content-Type: text/plain; charset=UTF-8');
    echo $apply ? "APLICANDO\n\n" : "VISTA PREVIA (agrega &apply=1 para aplicar)\n\n";

    foreach ($data['upsells'] as $u) {
        $id = (int) $u['staging_id'];
        $post = get_post($id);
        if (!$post || $post->post_type !== 'product') {
            echo "[ERROR] #$id no es un producto\n";
            continue;
        }
        $principales = array_values(array_filter(array_map('intval', $u['principales']), function ($pid) {
            return get_post_type($pid) === 'product';
        }));
        echo sprintf("#%d %s → %d principales, popup: %s\n", $id, $post->post_title, count($principales), mb_substr($u['popup'], 0, 60));
        if ($apply) {
            update_field('field_69652d493c2c4', $principales, $id);
            update_field('field_mandala_popup_complemento', $u['popup'], $id);
        }
    }
    echo "\nListo.\n";
    exit;
});
