<?php
/**
 * Plugin Name: Spa Mándala — Gift Cards (headless)
 * Description: Reemplaza YITH Gift Cards. Un producto se compra "como regalo"
 *              (emails + mensaje vía addToCart extraData). Al confirmarse el pago
 *              se genera un cupón de 100% atado a ese producto. El correo con el
 *              código se envía de inmediato, o en la fecha que el comprador eligió
 *              (envío programado, vía WP-Cron). Ver docs/wp-setup-guide.md §5.
 *
 * Envío programado: requiere que WP-Cron corra a tiempo. La mayoría de los hosts
 * lo disparan solo con las visitas al sitio; si el envío programado llega tarde,
 * configura en cPanel un cron real que golpee wp-cron.php cada 15-30 min, ej.:
 *   wget -q -O /dev/null "https://cms.laboratorio.space/wp-cron.php?doing_wp_cron"
 */

if (!defined('ABSPATH')) exit;

const MANDALA_GIFT_KEY = '_mandala_gift';
const MANDALA_GIFT_IMAGE_OPTION = 'mandala_gift_image_url';
const MANDALA_GIFT_DEFAULT_IMAGE = 'https://spamandala.cl/wp-content/uploads/2026/07/Spa-mandala-Gift-card.webp';

/**
 * Interruptores administrables desde el panel (mandala-giftcards-admin.php):
 * global (mandala_gift_enabled) y por producto (meta _mandala_gift_enabled).
 * Se validan siempre del lado del servidor, no solo ocultando el botón en el
 * frontend, porque las fichas de producto son estáticas (prerender) y un
 * cambio en wp-admin no se refleja ahí hasta el próximo build/deploy.
 */
function mandala_gift_globally_enabled() {
    return (bool) get_option('mandala_gift_enabled', 1);
}
function mandala_gift_product_enabled($product_id) {
    return get_post_meta($product_id, '_mandala_gift_enabled', true) !== 'no';
}
function mandala_gift_is_enabled_for($product_id) {
    return $product_id > 0 ? (mandala_gift_globally_enabled() && mandala_gift_product_enabled($product_id)) : mandala_gift_globally_enabled();
}
function mandala_gift_image_url() {
    $url = get_option(MANDALA_GIFT_IMAGE_OPTION, '');
    return $url ?: MANDALA_GIFT_DEFAULT_IMAGE;
}

/**
 * Foto personalizada del comprador (api/gift-photo-upload.ts): sube a la Biblioteca
 * de Medios con un usuario de mínimo privilegio (solo `upload_files`, nada de
 * publicar/editar contenido), separado de las claves REST de WooCommerce.
 *
 * Cómo crearlo en wp-admin (una sola vez):
 *   1. Usuarios → Añadir nuevo → username "giftcard-uploader", rol Suscriptor.
 *   2. En su perfil → Application Passwords → generar una ("mandala-frontend").
 *   3. Esa clave va SOLO al panel de Cloudflare como secretos WP_MEDIA_APP_USER /
 *      WP_MEDIA_APP_PASSWORD — nunca al repo.
 * Este filtro es lo que le da permiso de subir archivos pese a ser Suscriptor.
 */
const MANDALA_GIFT_UPLOADER_USER = 'giftcard-uploader';
add_filter('user_has_cap', function ($allcaps, $caps, $args, $user) {
    if (in_array('upload_files', (array) $caps, true) && $user instanceof WP_User && $user->user_login === MANDALA_GIFT_UPLOADER_USER) {
        $allcaps['upload_files'] = true;
    }
    return $allcaps;
}, 10, 4);

/**
 * 1) Carrito: WooGraphQL vuelca el JSON de extraData directamente en
 *    $cart_item_data ({buyerEmail, recipientEmail, message}); lo normalizamos.
 */
add_filter('woocommerce_add_cart_item_data', function ($cart_item_data, $product_id) {
    if (empty($cart_item_data['recipientEmail'])) return $cart_item_data;

    if (!mandala_gift_is_enabled_for($product_id)) {
        wc_add_notice('Esta gift card no está disponible por el momento.', 'error');
        return $cart_item_data;
    }

    // Fecha de envío elegida por el comprador (YYYY-MM-DD); si es hoy, pasada o
    // inválida, se ignora y el correo sale apenas se confirme el pago.
    $delivery_date = '';
    $raw_date = (string) ($cart_item_data['deliveryDate'] ?? '');
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw_date) && $raw_date > current_time('Y-m-d')) {
        $delivery_date = $raw_date;
    }

    // Foto que el comprador subió para reemplazar el diseño (api/gift-photo-upload.ts,
    // ya reenviada a la Biblioteca de Medios de este mismo WordPress). Defensa en
    // profundidad: se descarta cualquier URL que no sea de este sitio, por si alguien
    // arma la mutación a mano con una imagen externa.
    $personal_image = esc_url_raw((string) ($cart_item_data['personalImageUrl'] ?? ''));
    if ($personal_image && parse_url($personal_image, PHP_URL_HOST) !== parse_url(home_url(), PHP_URL_HOST)) {
        $personal_image = '';
    }

    $gift = [
        'buyerEmail'      => sanitize_email($cart_item_data['buyerEmail'] ?? ''),
        'recipientEmail'  => sanitize_email($cart_item_data['recipientEmail']),
        'message'         => sanitize_textarea_field(mb_substr($cart_item_data['message'] ?? '', 0, 300)),
        'deliveryDate'    => $delivery_date,
        'personalImage'   => $personal_image,
    ];
    unset($cart_item_data['buyerEmail'], $cart_item_data['recipientEmail'], $cart_item_data['message'], $cart_item_data['deliveryDate'], $cart_item_data['personalImageUrl']);
    if (!is_email($gift['recipientEmail'])) return $cart_item_data;

    $cart_item_data[MANDALA_GIFT_KEY] = $gift;
    // Evita que un producto regalado se fusione con el mismo producto comprado normal.
    $cart_item_data['unique_key'] = md5(wp_json_encode($gift) . microtime());
    return $cart_item_data;
}, 10, 2);

add_filter('woocommerce_get_item_data', function ($item_data, $cart_item) {
    if (!empty($cart_item[MANDALA_GIFT_KEY])) {
        $item_data[] = [
            'key'   => 'Regalo para',
            'value' => $cart_item[MANDALA_GIFT_KEY]['recipientEmail'],
        ];
        if (!empty($cart_item[MANDALA_GIFT_KEY]['deliveryDate'])) {
            $item_data[] = [
                'key'   => 'Se envía el',
                'value' => date_i18n('j \d\e F \d\e Y', strtotime($cart_item[MANDALA_GIFT_KEY]['deliveryDate'])),
            ];
        }
    }
    return $item_data;
}, 10, 2);

/** 2) Copia la info del regalo al item de la orden. */
add_action('woocommerce_checkout_create_order_line_item', function ($item, $cart_item_key, $values) {
    if (!empty($values[MANDALA_GIFT_KEY])) {
        $item->add_meta_data(MANDALA_GIFT_KEY, $values[MANDALA_GIFT_KEY], true);
    }
}, 10, 3);

/** 3) Pago confirmado → emitir cupón (siempre) + email (de inmediato o programado). */
add_action('woocommerce_order_status_changed', function ($order_id, $from, $to) {
    if (!in_array($to, ['processing', 'completed'], true)) return;
    $order = wc_get_order($order_id);
    if (!$order) return;

    foreach ($order->get_items() as $item) {
        $gift = $item->get_meta(MANDALA_GIFT_KEY);
        if (empty($gift) || $item->get_meta('_mandala_gift_code')) continue;

        // Si es variable, el cupón queda atado a la variante exacta (p. ej. "5 sesiones, 1 hora").
        $product_id = $item->get_variation_id() ?: $item->get_product_id();
        $code = mandala_gift_create_coupon($product_id, $gift, $order_id);
        if (!$code) continue;

        $item->add_meta_data('_mandala_gift_code', $code, true);
        $item->save();

        $send_at = mandala_gift_scheduled_timestamp($gift['deliveryDate'] ?? '');
        if ($send_at) {
            // Envío programado: el correo se despacha en la fecha elegida (ver acción abajo).
            wp_schedule_single_event($send_at, 'mandala_gift_send_scheduled', [$order_id, $item->get_id()]);
        } else {
            mandala_gift_send_email($code, $gift, $item, $order);
            $item->add_meta_data('_mandala_gift_sent', 1, true);
            $item->save();
        }
    }
}, 10, 3);

/** Timestamp (hora del sitio, 09:00) para el envío programado; 0 = enviar ya. */
function mandala_gift_scheduled_timestamp($date) {
    if (empty($date) || $date <= current_time('Y-m-d')) return 0;
    $dt = DateTime::createFromFormat('Y-m-d H:i:s', "$date 09:00:00", wp_timezone());
    return $dt ? $dt->getTimestamp() : 0;
}

/** Despacha el email programado (WP-Cron). Idempotente: si ya se envió, no repite. */
add_action('mandala_gift_send_scheduled', function ($order_id, $item_id) {
    $order = wc_get_order($order_id);
    if (!$order) return;
    $item = $order->get_item($item_id);
    if (!$item) return;

    $gift = $item->get_meta(MANDALA_GIFT_KEY);
    $code = $item->get_meta('_mandala_gift_code');
    if (empty($gift) || empty($code) || $item->get_meta('_mandala_gift_sent')) return;

    mandala_gift_send_email($code, $gift, $item, $order);
    $item->add_meta_data('_mandala_gift_sent', 1, true);
    $item->save();
}, 10, 2);

function mandala_gift_create_coupon($product_id, $gift, $order_id) {
    do {
        $code = strtoupper(wp_generate_password(12, false, false));
    } while (wc_get_coupon_id_by_code($code));

    $coupon = new WC_Coupon();
    $coupon->set_code($code);
    $coupon->set_discount_type('percent');
    $coupon->set_amount(100);
    $coupon->set_product_ids([$product_id]);
    $coupon->set_usage_limit(1);
    $coupon->set_usage_limit_per_user(1);
    $coupon->set_individual_use(false);
    // Antifraude: si alguien reenvía o intercepta el código, no lo puede canjear con
    // otro email — WooCommerce valida esto contra el email de facturación al pagar.
    // Se puede desactivar con el filtro si genera fricción real (ej. alguien agenda
    // por otra persona con su propio email).
    if (apply_filters('mandala_gift_lock_to_recipient_email', true) && is_email($gift['recipientEmail'])) {
        $coupon->set_email_restrictions([$gift['recipientEmail']]);
    }
    $months = (int) apply_filters('mandala_gift_validity_months', 12);
    if ($months > 0) {
        $coupon->set_date_expires(strtotime("+{$months} months"));
    }
    $coupon->set_description(sprintf('Gift card orden #%d para %s', $order_id, $gift['recipientEmail']));
    $coupon->update_meta_data('_mandala_gift_card', 1);
    $coupon->save();

    return $coupon->get_id() ? $code : null;
}

/**
 * Convierte la foto que subió el comprador en una única imagen ya compuesta como
 * "tarjeta de regalo" (recortada al mismo aspecto que el mockup 3D del sitio,
 * esquinas redondeadas y logo superpuesto), en vez de dejar que el correo intente
 * lograr ese efecto con CSS (position:absolute/border-radius, que la mayoría de
 * clientes de correo ignora y muestra la foto suelta). Se guarda como un adjunto
 * nuevo en la Biblioteca de Medios; si algo falla (GD no disponible, descarga
 * fallida), retorna la URL original sin componer.
 */
function mandala_gift_compose_card_image($photo_url) {
    if (!function_exists('imagecreatetruecolor')) return $photo_url;

    $attachment_id = attachment_url_to_postid($photo_url);
    $path = $attachment_id ? get_attached_file($attachment_id) : null;
    if (!$path || !file_exists($path)) {
        if (!function_exists('download_url')) require_once ABSPATH . 'wp-admin/includes/file.php';
        $tmp = download_url($photo_url);
        $path = is_wp_error($tmp) ? null : $tmp;
    }
    if (!$path) return $photo_url;

    $info = @getimagesize($path);
    $src = null;
    if ($info) {
        if ($info['mime'] === 'image/jpeg') $src = @imagecreatefromjpeg($path);
        elseif ($info['mime'] === 'image/png') $src = @imagecreatefrompng($path);
        elseif ($info['mime'] === 'image/webp' && function_exists('imagecreatefromwebp')) $src = @imagecreatefromwebp($path);
    }
    if (!$src) return $photo_url;

    $sw = imagesx($src);
    $sh = imagesy($src);
    $target_w = 1200;
    $ratio = 1748 / 1240; // mismo aspecto que GiftCardPreview.tsx en el sitio
    $target_h = (int) round($target_w / $ratio);

    // Recorte centrado al aspecto de la tarjeta (evita deformar la foto).
    if (($sw / $sh) > $ratio) {
        $crop_h = $sh;
        $crop_w = (int) round($sh * $ratio);
        $crop_x = (int) round(($sw - $crop_w) / 2);
        $crop_y = 0;
    } else {
        $crop_w = $sw;
        $crop_h = (int) round($sw / $ratio);
        $crop_x = 0;
        $crop_y = (int) round(($sh - $crop_h) / 2);
    }

    $card = imagecreatetruecolor($target_w, $target_h);
    imagealphablending($card, false);
    imagesavealpha($card, true);
    $transparent = imagecolorallocatealpha($card, 0, 0, 0, 127);
    imagefill($card, 0, 0, $transparent);
    imagecopyresampled($card, $src, 0, 0, $crop_x, $crop_y, $target_w, $target_h, $crop_w, $crop_h);
    imagedestroy($src);

    // Esquinas redondeadas: solo recorre los 4 cuadrados de esquina (barato), no toda la imagen.
    $radius = (int) round($target_w * 0.045);
    $corners = [[0, 0], [1, 0], [0, 1], [1, 1]];
    foreach ($corners as [$right, $bottom]) {
        $ox = $right ? ($target_w - $radius) : $radius;
        $oy = $bottom ? ($target_h - $radius) : $radius;
        for ($x = 0; $x < $radius; $x++) {
            for ($y = 0; $y < $radius; $y++) {
                $px = $right ? ($target_w - 1 - $x) : $x;
                $py = $bottom ? ($target_h - 1 - $y) : $y;
                $dx = $px - $ox;
                $dy = $py - $oy;
                if (($dx * $dx + $dy * $dy) > ($radius * $radius)) {
                    imagesetpixel($card, $px, $py, $transparent);
                }
            }
        }
    }

    // Logo superpuesto (esquina inferior derecha) sobre una placa oscura translúcida,
    // igual que en el mockup del sitio.
    $logo_path = __DIR__ . '/assets/gift-card-logo.png';
    if (file_exists($logo_path) && ($logo = @imagecreatefrompng($logo_path))) {
        $logo_w = (int) round($target_w * 0.26);
        $lw = imagesx($logo);
        $lh = imagesy($logo);
        $logo_h = (int) round($lh * ($logo_w / $lw));

        // Redimensiona el logo en su propio lienzo con alphablending apagado —
        // hacerlo directo sobre $card con blending encendido produce un "fantasma"
        // duplicado en los bordes semi-transparentes (bug conocido de GD al
        // remuestrear PNGs con alpha con blending activo).
        $logo_resized = imagecreatetruecolor($logo_w, $logo_h);
        imagealphablending($logo_resized, false);
        imagesavealpha($logo_resized, true);
        $logo_transparent = imagecolorallocatealpha($logo_resized, 0, 0, 0, 127);
        imagefill($logo_resized, 0, 0, $logo_transparent);
        imagecopyresampled($logo_resized, $logo, 0, 0, 0, 0, $logo_w, $logo_h, $lw, $lh);
        imagedestroy($logo);

        $margin = (int) round($target_w * 0.035);
        $logo_x = $target_w - $margin - $logo_w;
        $logo_y = $target_h - $margin - $logo_h;

        imagealphablending($card, true);
        // imagecopy (no resampled) preserva el alpha ya resuelto arriba sin volver a interpolar.
        imagecopy($card, $logo_resized, $logo_x, $logo_y, 0, 0, $logo_w, $logo_h);
        imagedestroy($logo_resized);
    }

    $upload = wp_upload_dir();
    $filename = 'gift-card-mockup-' . uniqid() . '.png';
    $filepath = trailingslashit($upload['path']) . $filename;
    if (!imagepng($card, $filepath, 6)) {
        imagedestroy($card);
        return $photo_url;
    }
    imagedestroy($card);

    $filetype = wp_check_filetype($filename, null);
    $attachment_id = wp_insert_attachment([
        'post_mime_type' => $filetype['type'],
        'post_title'     => 'Gift card personalizada',
        'post_status'    => 'inherit',
    ], $filepath);
    if (is_wp_error($attachment_id) || !$attachment_id) return $photo_url;

    if (!function_exists('wp_generate_attachment_metadata')) require_once ABSPATH . 'wp-admin/includes/image.php';
    wp_update_attachment_metadata($attachment_id, wp_generate_attachment_metadata($attachment_id, $filepath));
    return wp_get_attachment_url($attachment_id);
}

function mandala_gift_send_email($code, $gift, $item, $order) {
    $brand   = defined('MANDALA_BRAND') ? MANDALA_BRAND : 'Mándala Spa';
    $product = $item->get_product();
    $parent  = wc_get_product($item->get_product_id());

    // Foto: la de la variante o, si no tiene, la del producto padre.
    $image_id = $product ? $product->get_image_id() : 0;
    if (!$image_id && $parent) $image_id = $parent->get_image_id();
    $image = $image_id ? wp_get_attachment_image_url($image_id, 'large') : '';

    $variant = ($product && $product->is_type('variation'))
        ? wc_get_formatted_variation($product, true, false)
        : '';

    $coupon  = new WC_Coupon($code);
    $expires = $coupon->get_date_expires()
        ? date_i18n('j \d\e F \d\e Y', $coupon->get_date_expires()->getTimestamp())
        : '';

    $from_name = trim($order->get_billing_first_name());

    // Se compone UNA sola vez y se reusa para el correo del destinatario y la
    // copia del comprador — así se ve igual en ambos y no se duplica el trabajo.
    $personal_image = $gift['personalImage'] ?? '';
    if ($personal_image) {
        $personal_image = mandala_gift_compose_card_image($personal_image);
    }

    $data = [
        'code'            => $code,
        'product_name'    => $parent ? $parent->get_name() : $item->get_name(),
        'variant'         => $variant,
        'image'           => $image,
        'personal_image'  => $personal_image,
        'message'         => $gift['message'] ?? '',
        'from_name'       => $from_name,
        'recipient_email' => $gift['recipientEmail'],
        'expires'         => $expires,
    ];
    $headers = function_exists('mandala_gift_email_headers')
        ? mandala_gift_email_headers()
        : ['Content-Type: text/html; charset=UTF-8'];

    $who = $from_name ?: 'Alguien especial';
    wp_mail(
        $gift['recipientEmail'],
        "$who te regaló una experiencia en $brand",
        mandala_gift_email_html($data + ['mode' => 'recipient']),
        $headers
    );
    if (!empty($gift['buyerEmail'])) {
        wp_mail(
            $gift['buyerEmail'],
            "Tu gift card fue enviada — $brand",
            mandala_gift_email_html($data + ['mode' => 'buyer']),
            $headers
        );
    }
}

/**
 * 4) GraphQL: CartItem.giftCardData para mostrar "Regalo para X"; Product.giftCardEnabled
 *    para ocultar el botón "Regalar" (panel wp-admin, ver mandala-giftcards-admin.php);
 *    giftCardSettings para el arte de la tarjeta 3D del modal/correo.
 */
add_action('graphql_register_types', function () {
    if (!function_exists('register_graphql_field')) return;

    register_graphql_field('CartItem', 'giftCardRecipient', [
        'type'    => 'String',
        'resolve' => function ($item) {
            $cart_item = WC()->cart ? WC()->cart->get_cart_item($item['key']) : null;
            return $cart_item[MANDALA_GIFT_KEY]['recipientEmail'] ?? null;
        },
    ]);

    $gift_card_enabled_field = [
        'type'        => 'Boolean',
        'description' => 'Falso si el dueño desactivó esta gift card (global o solo este producto) desde wp-admin → Gift Cards.',
        'resolve'     => function ($source) {
            $id = 0;
            if (is_object($source)) {
                if (!empty($source->ID)) $id = (int) $source->ID;
                elseif (!empty($source->databaseId)) $id = (int) $source->databaseId;
                elseif (method_exists($source, 'get_id')) $id = (int) $source->get_id();
            }
            return mandala_gift_is_enabled_for($id);
        },
    ];
    // `products(...).nodes` expone la interfaz "Product", pero la query singular
    // `product(id, idType: SLUG)` devuelve "ProductUnion" (tipo distinto en esta
    // versión de WooGraphQL) — se registra en ambos para que funcione en las dos.
    register_graphql_field('Product', 'giftCardEnabled', $gift_card_enabled_field);
    register_graphql_field('ProductUnion', 'giftCardEnabled', $gift_card_enabled_field);

    register_graphql_object_type('MandalaGiftCardSettings', [
        'description' => 'Ajustes globales de gift cards (wp-admin → Gift Cards → Ajustes).',
        'fields'       => [
            'enabled'  => ['type' => 'Boolean'],
            'imageUrl' => ['type' => 'String'],
        ],
    ]);
    register_graphql_field('RootQuery', 'giftCardSettings', [
        'type'    => 'MandalaGiftCardSettings',
        'resolve' => function () {
            return [
                'enabled'  => mandala_gift_globally_enabled(),
                'imageUrl' => mandala_gift_image_url(),
            ];
        },
    ]);
});

/**
 * 5) Gateway mínimo "webpay": el pago real lo hace Astro con Transbank; esto solo
 *    permite que WooGraphQL `checkout` cree la orden (queda pendiente de pago).
 */
add_action('plugins_loaded', function () {
    if (!class_exists('WC_Payment_Gateway')) return;

    class Mandala_Webpay_Gateway extends WC_Payment_Gateway {
        public function __construct() {
            $this->id                 = 'webpay';
            $this->method_title       = 'Webpay Plus (headless)';
            $this->method_description = 'Pago procesado por el frontend Astro con Transbank.';
            $this->has_fields         = false;
            $this->enabled            = 'yes';
            $this->title              = 'Webpay Plus';
        }
        public function process_payment($order_id) {
            return ['result' => 'success', 'redirect' => ''];
        }
    }
}, 20);

add_filter('woocommerce_payment_gateways', function ($gateways) {
    if (class_exists('Mandala_Webpay_Gateway')) $gateways[] = 'Mandala_Webpay_Gateway';
    return $gateways;
});
