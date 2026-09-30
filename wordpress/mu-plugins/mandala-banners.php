<?php
/**
 * Plugin Name: Spa Mándala — Panel de Banners
 * Description: Pantalla en wp-admin ("Banners") para editar los banners del sitio
 *              (imagen, texto, botones) sin tocar código — mismo patrón que el panel
 *              de Gift Cards (mandala-giftcards-admin.php). Cada banner se guarda como
 *              una opción (`mandala_banner_<key>`) y se expone por GraphQL como
 *              `siteBanner(key: "...")`, así se pueden agregar banners nuevos sin
 *              tocar el schema otra vez.
 */

if (!defined('ABSPATH')) exit;

const MANDALA_BANNERS_SLUG = 'mandala-banners';
// key => label en el panel. Agregar una fila acá para sumar un banner nuevo.
const MANDALA_BANNER_KEYS = [
    'home'        => 'Home',
    'promociones' => 'Promociones',
];
const MANDALA_BANNER_FIELDS = ['image', 'eyebrow', 'title', 'description', 'primary_text', 'primary_link', 'secondary_text', 'secondary_link'];

function mandala_banner_option_name($key) {
    return 'mandala_banner_' . $key;
}

function mandala_banner_get($key) {
    $data = get_option(mandala_banner_option_name($key), []);
    $data = is_array($data) ? $data : [];
    $out = [];
    foreach (MANDALA_BANNER_FIELDS as $field) {
        $out[$field] = $data[$field] ?? '';
    }
    return $out;
}

add_action('admin_menu', function () {
    add_menu_page(
        'Banners',
        'Banners',
        'manage_woocommerce',
        MANDALA_BANNERS_SLUG,
        'mandala_banners_admin_render',
        'dashicons-images-alt2',
        58
    );
});

add_action('admin_enqueue_scripts', function ($hook) {
    if (strpos($hook, MANDALA_BANNERS_SLUG) === false) return;
    wp_enqueue_media();
});

add_action('admin_init', function () {
    if (empty($_POST['mandala_banner_nonce']) || !wp_verify_nonce($_POST['mandala_banner_nonce'], 'mandala_banner_save')) return;
    if (!current_user_can('manage_woocommerce')) return;
    if (empty($_POST['mandala_banner_key']) || !array_key_exists($_POST['mandala_banner_key'], MANDALA_BANNER_KEYS)) return;

    $key = sanitize_key($_POST['mandala_banner_key']);
    $data = [];
    foreach (MANDALA_BANNER_FIELDS as $field) {
        $raw = (string) ($_POST['mandala_banner'][$field] ?? '');
        $data[$field] = in_array($field, ['image', 'primary_link', 'secondary_link'], true)
            ? esc_url_raw(trim($raw))
            : sanitize_text_field($raw);
    }
    update_option(mandala_banner_option_name($key), $data);

    wp_safe_redirect(add_query_arg(['page' => MANDALA_BANNERS_SLUG, 'tab' => $key, 'saved' => 1], admin_url('admin.php')));
    exit;
});

add_action('graphql_register_types', function () {
    if (!function_exists('register_graphql_object_type')) return;

    register_graphql_object_type('MandalaBanner', [
        'description' => 'Banner editable desde wp-admin → Banners.',
        'fields'       => [
            'image'          => ['type' => 'String'],
            'eyebrow'        => ['type' => 'String'],
            'title'          => ['type' => 'String'],
            'description'    => ['type' => 'String'],
            'primaryText'    => ['type' => 'String'],
            'primaryLink'    => ['type' => 'String'],
            'secondaryText'  => ['type' => 'String'],
            'secondaryLink'  => ['type' => 'String'],
        ],
    ]);
    register_graphql_field('RootQuery', 'siteBanner', [
        'type' => 'MandalaBanner',
        'args' => ['key' => ['type' => ['non_null' => 'String']]],
        'resolve' => function ($root, $args) {
            $key = sanitize_key($args['key']);
            if (!array_key_exists($key, MANDALA_BANNER_KEYS)) return null;
            $d = mandala_banner_get($key);
            return [
                'image'         => $d['image'],
                'eyebrow'       => $d['eyebrow'],
                'title'         => $d['title'],
                'description'   => $d['description'],
                'primaryText'   => $d['primary_text'],
                'primaryLink'   => $d['primary_link'],
                'secondaryText' => $d['secondary_text'],
                'secondaryLink' => $d['secondary_link'],
            ];
        },
    ]);
});

function mandala_banners_admin_render() {
    if (!current_user_can('manage_woocommerce')) return;
    $tab = isset($_GET['tab']) && array_key_exists($_GET['tab'], MANDALA_BANNER_KEYS) ? $_GET['tab'] : 'home';
    $banner = mandala_banner_get($tab);
    ?>
    <div class="wrap">
      <h1>Banners — Spa Mándala</h1>
      <?php if (!empty($_GET['saved'])) : ?>
        <div class="notice notice-success is-dismissible"><p>Guardado.</p></div>
      <?php endif; ?>
      <h2 class="nav-tab-wrapper">
        <?php foreach (MANDALA_BANNER_KEYS as $slug => $label) : ?>
          <a href="<?php echo esc_url(add_query_arg(['page' => MANDALA_BANNERS_SLUG, 'tab' => $slug], admin_url('admin.php'))); ?>"
             class="nav-tab <?php echo $tab === $slug ? 'nav-tab-active' : ''; ?>"><?php echo esc_html($label); ?></a>
        <?php endforeach; ?>
      </h2>

      <div style="max-width:760px;margin-top:20px;">
        <p>Deja un campo vacío para que el sitio use el texto/imagen de fábrica.
           <?php echo $tab === 'home' ? 'Este banner es parte de una página estática: los cambios se ven recién en el próximo despliegue.' : 'Esta página no es estática: los cambios se ven de inmediato al recargar.'; ?>
        </p>
        <form method="post">
          <?php wp_nonce_field('mandala_banner_save', 'mandala_banner_nonce'); ?>
          <input type="hidden" name="mandala_banner_key" value="<?php echo esc_attr($tab); ?>">

          <table class="form-table">
            <tr>
              <th scope="row">Imagen de fondo</th>
              <td>
                <?php if ($banner['image']) : ?>
                  <img id="mandala-banner-image-preview" src="<?php echo esc_url($banner['image']); ?>" style="max-width:320px;display:block;border-radius:12px;margin-bottom:10px;">
                <?php else : ?>
                  <img id="mandala-banner-image-preview" src="" style="max-width:320px;display:none;border-radius:12px;margin-bottom:10px;">
                <?php endif; ?>
                <input type="text" id="mandala-banner-image-url" name="mandala_banner[image]" value="<?php echo esc_attr($banner['image']); ?>" class="regular-text" style="width:420px;">
                <button type="button" class="button" id="mandala-banner-image-pick">Elegir de la biblioteca de medios</button>
                <?php if ($banner['image']) : ?>
                  <button type="button" class="button" id="mandala-banner-image-clear">Quitar</button>
                <?php endif; ?>
              </td>
            </tr>
            <tr><th scope="row">Texto superior (eyebrow)</th><td><input type="text" name="mandala_banner[eyebrow]" value="<?php echo esc_attr($banner['eyebrow']); ?>" class="regular-text"></td></tr>
            <tr><th scope="row">Título</th><td><input type="text" name="mandala_banner[title]" value="<?php echo esc_attr($banner['title']); ?>" class="large-text"></td></tr>
            <tr><th scope="row">Descripción</th><td><textarea name="mandala_banner[description]" rows="3" class="large-text"><?php echo esc_textarea($banner['description']); ?></textarea></td></tr>
            <tr><th scope="row">Botón principal</th><td>
              <input type="text" name="mandala_banner[primary_text]" value="<?php echo esc_attr($banner['primary_text']); ?>" placeholder="Texto del botón" class="regular-text" style="margin-bottom:6px;"><br>
              <input type="text" name="mandala_banner[primary_link]" value="<?php echo esc_attr($banner['primary_link']); ?>" placeholder="/tienda o https://..." class="regular-text">
            </td></tr>
            <tr><th scope="row">Botón secundario</th><td>
              <input type="text" name="mandala_banner[secondary_text]" value="<?php echo esc_attr($banner['secondary_text']); ?>" placeholder="Texto del botón" class="regular-text" style="margin-bottom:6px;"><br>
              <input type="text" name="mandala_banner[secondary_link]" value="<?php echo esc_attr($banner['secondary_link']); ?>" placeholder="/gift-cards o https://..." class="regular-text">
            </td></tr>
          </table>
          <p class="submit"><button type="submit" class="button button-primary">Guardar banner</button></p>
        </form>
      </div>
    </div>
    <script>
    (function () {
      var pickBtn = document.getElementById('mandala-banner-image-pick');
      var clearBtn = document.getElementById('mandala-banner-image-clear');
      var input = document.getElementById('mandala-banner-image-url');
      var preview = document.getElementById('mandala-banner-image-preview');
      if (pickBtn && window.wp && wp.media) {
        pickBtn.addEventListener('click', function (e) {
          e.preventDefault();
          var frame = wp.media({ title: 'Elegir imagen del banner', multiple: false, library: { type: 'image' } });
          frame.on('select', function () {
            var att = frame.state().get('selection').first().toJSON();
            input.value = att.url;
            preview.src = att.url;
            preview.style.display = 'block';
          });
          frame.open();
        });
      }
      if (clearBtn) {
        clearBtn.addEventListener('click', function (e) {
          e.preventDefault();
          input.value = '';
          preview.style.display = 'none';
        });
      }
    })();
    </script>
    <?php
}
