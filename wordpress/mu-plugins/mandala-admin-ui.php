<?php
/**
 * Plugin Name: Spa Mándala — Menú "Marketing" (estructura + estilo compartido)
 * Description: Agrupa los paneles de Gift Cards y Banners bajo un solo menú "Marketing"
 *              en wp-admin (en vez de uno colgando de WooCommerce y otro suelto en el
 *              menú principal), y encola el CSS de marca que ambos comparten
 *              (assets/admin-ui.css). No contiene lógica de negocio — eso sigue en
 *              mandala-giftcards-admin.php y mandala-banners.php, que ahora se registran
 *              como sub-páginas de este menú (mismos slugs, así que no se rompe ningún
 *              enlace/favorito existente).
 */

if (!defined('ABSPATH')) exit;

const MANDALA_MARKETING_SLUG = 'mandala-marketing';

add_action('admin_menu', function () {
    add_menu_page(
        'Marketing',
        'Marketing',
        'manage_woocommerce',
        MANDALA_MARKETING_SLUG,
        'mandala_marketing_admin_render',
        'dashicons-megaphone',
        58
    );
}, 5); // prioridad baja: corre antes que los submenús de gift cards/banners, que dependen de que este menú ya exista.

add_action('admin_enqueue_scripts', function ($hook) {
    if (strpos((string) $hook, 'mandala-') === false) return;
    wp_enqueue_style('mandala-admin-ui', plugins_url('assets/admin-ui.css', __FILE__), [], '1.2');
    wp_enqueue_script('mandala-admin-ui', plugins_url('assets/admin-ui.js', __FILE__), [], '1.1', true);
});

/** Encabezado compartido: título + bajada, mismo estilo en todas las pantallas de Marketing. */
function mandala_admin_header($title, $subtitle = '') {
    ?>
    <h1 class="wp-heading-inline"><?php echo esc_html($title); ?></h1>
    <?php if ($subtitle) : ?>
      <p class="mandala-subtitle"><?php echo esc_html($subtitle); ?></p>
    <?php endif;
}

/**
 * Lista de casillas con buscador y contador (reemplaza <select multiple>, que obliga a
 * Ctrl+clic y no se puede filtrar). Comportamiento en assets/admin-ui.js.
 * $items: valor => etiqueta. Los valores marcados se envían como $name[].
 */
function mandala_checklist($name, array $items, array $selected = [], $placeholder = 'Buscar…') {
    $id = 'chk-' . wp_unique_id();
    ?>
    <div class="mandala-check" id="<?php echo esc_attr($id); ?>">
      <div class="mandala-check-bar">
        <input type="search" class="mandala-check-search" placeholder="<?php echo esc_attr($placeholder); ?>" data-mandala-filter="#<?php echo esc_attr($id); ?> .mandala-check-item">
        <button type="button" class="button button-small" data-mandala-check="all">Marcar visibles</button>
        <button type="button" class="button button-small" data-mandala-check="none">Limpiar</button>
        <span class="mandala-check-count"></span>
      </div>
      <div class="mandala-check-list">
        <?php foreach ($items as $value => $label) : ?>
          <label class="mandala-check-item">
            <input type="checkbox" name="<?php echo esc_attr($name); ?>[]" value="<?php echo esc_attr($value); ?>" <?php checked(in_array((string) $value, array_map('strval', $selected), true)); ?>>
            <?php echo esc_html($label); ?>
          </label>
        <?php endforeach; ?>
      </div>
    </div>
    <?php
}

function mandala_marketing_admin_render() {
    if (!current_user_can('manage_woocommerce')) return;
    $link = function ($page, $tab = '') {
        return esc_url(add_query_arg(array_filter(['page' => $page, 'tab' => $tab]), admin_url('admin.php')));
    };
    // [sección => [[icono, título, descripción, página, tab], …]]
    $sections = [
        'Precios y catálogo' => [
            ['dashicons-tag', 'Promociones', 'Descuentos masivos con vista previa, fechas y opción de revertir.', 'mandala-promociones', ''],
            ['dashicons-plus-alt', 'Complementos', 'Qué se ofrece con cada producto, su precio y su texto.', 'mandala-complementos', ''],
        ],
        'Gift cards' => [
            ['dashicons-tickets-alt', 'Trazabilidad', 'Ver compras, códigos y estado de canje.', 'mandala-gift-cards', 'trazabilidad'],
            ['dashicons-cart', 'Productos regalables', 'Qué productos se pueden regalar.', 'mandala-gift-cards', 'productos'],
            ['dashicons-admin-generic', 'Ajustes', 'Activar/desactivar globalmente y diseño de la tarjeta.', 'mandala-gift-cards', 'ajustes'],
            ['dashicons-trash', 'Limpieza', 'Borrar gift cards usadas, sus imágenes y las que quedaron huérfanas (solo laboratorio).', 'mandala-limpieza', ''],
        ],
        'Banners' => [
            ['dashicons-images-alt2', 'Banner — Home', 'Imagen, título, texto y botones de la portada.', 'mandala-banners', 'home'],
            ['dashicons-megaphone', 'Banner — Promociones', 'Imagen, título, texto y botones de /promociones.', 'mandala-banners', 'promociones'],
        ],
    ];
    ?>
    <div class="wrap mandala-admin">
      <?php mandala_admin_header('Marketing', 'Promociones, complementos, gift cards y banners del sitio — todo en un solo lugar.'); ?>
      <p><input type="search" class="mandala-search" placeholder="Buscar una herramienta (ej. descuento, gift, banner)…" data-mandala-filter=".mandala-marketing-card"></p>
      <?php foreach ($sections as $title => $cards) : ?>
        <div class="mandala-marketing-section">
          <h2><?php echo esc_html($title); ?></h2>
          <div class="mandala-marketing-grid">
            <?php foreach ($cards as [$icon, $name, $desc, $page, $tab]) : ?>
              <a class="mandala-marketing-card" href="<?php echo $link($page, $tab); ?>">
                <span class="dashicons <?php echo esc_attr($icon); ?>"></span>
                <h3><?php echo esc_html($name); ?></h3>
                <p><?php echo esc_html($desc); ?></p>
              </a>
            <?php endforeach; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
    <?php
}
