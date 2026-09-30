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
    wp_enqueue_style('mandala-admin-ui', plugins_url('assets/admin-ui.css', __FILE__), [], '1.0');
});

/** Encabezado compartido: título + bajada, mismo estilo en todas las pantallas de Marketing. */
function mandala_admin_header($title, $subtitle = '') {
    ?>
    <h1 class="wp-heading-inline"><?php echo esc_html($title); ?></h1>
    <?php if ($subtitle) : ?>
      <p class="mandala-subtitle"><?php echo esc_html($subtitle); ?></p>
    <?php endif;
}

function mandala_marketing_admin_render() {
    if (!current_user_can('manage_woocommerce')) return;
    ?>
    <div class="wrap mandala-admin">
      <?php mandala_admin_header('Marketing', 'Gift cards y banners del sitio — todo en un solo lugar.'); ?>
      <div class="mandala-marketing-grid">
        <a class="mandala-marketing-card" href="<?php echo esc_url(add_query_arg(['page' => 'mandala-gift-cards', 'tab' => 'trazabilidad'], admin_url('admin.php'))); ?>">
          <span class="dashicons dashicons-tickets-alt"></span>
          <h3>Gift Cards — Trazabilidad</h3>
          <p>Ver compras, códigos y estado de canje.</p>
        </a>
        <a class="mandala-marketing-card" href="<?php echo esc_url(add_query_arg(['page' => 'mandala-gift-cards', 'tab' => 'productos'], admin_url('admin.php'))); ?>">
          <span class="dashicons dashicons-cart"></span>
          <h3>Gift Cards — Productos</h3>
          <p>Qué productos se pueden regalar.</p>
        </a>
        <a class="mandala-marketing-card" href="<?php echo esc_url(add_query_arg(['page' => 'mandala-gift-cards', 'tab' => 'ajustes'], admin_url('admin.php'))); ?>">
          <span class="dashicons dashicons-admin-generic"></span>
          <h3>Gift Cards — Ajustes</h3>
          <p>Activar/desactivar globalmente y diseño de la tarjeta.</p>
        </a>
        <a class="mandala-marketing-card" href="<?php echo esc_url(add_query_arg(['page' => 'mandala-banners', 'tab' => 'home'], admin_url('admin.php'))); ?>">
          <span class="dashicons dashicons-images-alt2"></span>
          <h3>Banner — Home</h3>
          <p>Imagen, título, texto y botones de la portada.</p>
        </a>
        <a class="mandala-marketing-card" href="<?php echo esc_url(add_query_arg(['page' => 'mandala-banners', 'tab' => 'promociones'], admin_url('admin.php'))); ?>">
          <span class="dashicons dashicons-megaphone"></span>
          <h3>Banner — Promociones</h3>
          <p>Imagen, título, texto y botones de /promociones.</p>
        </a>
      </div>
    </div>
    <?php
}
