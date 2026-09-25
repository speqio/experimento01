<?php
/**
 * Plugin Name: Spa Mándala — Gift Cards (headless)
 * Description: Reemplaza YITH Gift Cards. Un producto se compra "como regalo"
 *              (emails + mensaje vía addToCart extraData). Al confirmarse el pago
 *              se genera un cupón de 100% atado a ese producto y se envía por
 *              email al destinatario. Ver docs/wp-setup-guide.md §5.
 */

if (!defined('ABSPATH')) exit;

const MANDALA_GIFT_KEY = '_mandala_gift';

/**
 * 1) Carrito: WooGraphQL vuelca el JSON de extraData directamente en
 *    $cart_item_data ({buyerEmail, recipientEmail, message}); lo normalizamos.
 */
add_filter('woocommerce_add_cart_item_data', function ($cart_item_data, $product_id) {
    if (empty($cart_item_data['recipientEmail'])) return $cart_item_data;

    $gift = [
        'buyerEmail'     => sanitize_email($cart_item_data['buyerEmail'] ?? ''),
        'recipientEmail' => sanitize_email($cart_item_data['recipientEmail']),
        'message'        => sanitize_textarea_field(mb_substr($cart_item_data['message'] ?? '', 0, 300)),
    ];
    unset($cart_item_data['buyerEmail'], $cart_item_data['recipientEmail'], $cart_item_data['message']);
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
    }
    return $item_data;
}, 10, 2);

/** 2) Copia la info del regalo al item de la orden. */
add_action('woocommerce_checkout_create_order_line_item', function ($item, $cart_item_key, $values) {
    if (!empty($values[MANDALA_GIFT_KEY])) {
        $item->add_meta_data(MANDALA_GIFT_KEY, $values[MANDALA_GIFT_KEY], true);
    }
}, 10, 3);

/** 3) Pago confirmado → emitir cupones + emails. */
add_action('woocommerce_order_status_changed', function ($order_id, $from, $to) {
    if (!in_array($to, ['processing', 'completed'], true)) return;
    $order = wc_get_order($order_id);
    if (!$order) return;

    foreach ($order->get_items() as $item) {
        $gift = $item->get_meta(MANDALA_GIFT_KEY);
        if (empty($gift) || $item->get_meta('_mandala_gift_code')) continue;

        $product_id = $item->get_product_id();
        $code = mandala_gift_create_coupon($product_id, $gift, $order_id);
        if (!$code) continue;

        $item->add_meta_data('_mandala_gift_code', $code, true);
        $item->save();
        mandala_gift_send_email($code, $gift, $item->get_name());
    }
}, 10, 3);

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
    $coupon->set_individual_use(false);
    $months = (int) apply_filters('mandala_gift_validity_months', 12);
    if ($months > 0) {
        $coupon->set_date_expires(strtotime("+{$months} months"));
    }
    $coupon->set_description(sprintf('Gift card orden #%d para %s', $order_id, $gift['recipientEmail']));
    $coupon->update_meta_data('_mandala_gift_card', 1);
    $coupon->save();

    return $coupon->get_id() ? $code : null;
}

function mandala_gift_send_email($code, $gift, $product_name) {
    $site  = get_bloginfo('name');
    $url   = apply_filters('mandala_gift_site_url', home_url('/'));
    $msg   = $gift['message'] ? '<p style="font-style:italic">“' . esc_html($gift['message']) . '”</p>' : '';
    $body  = '<div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:32px;background:#F5F0E8;color:#3A332E">'
        . '<h2 style="font-weight:300">Tienes un regalo de ' . esc_html($site) . '</h2>'
        . $msg
        . '<p>Te regalaron: <strong>' . esc_html($product_name) . '</strong></p>'
        . '<p style="font-size:26px;letter-spacing:4px;background:#fff;padding:16px;text-align:center;border-radius:12px">' . esc_html($code) . '</p>'
        . '<p>Ingresa este código en el checkout al comprar ese producto y quedará sin costo.</p>'
        . '<p><a href="' . esc_url($url) . '">' . esc_html($url) . '</a></p></div>';
    $headers = ['Content-Type: text/html; charset=UTF-8'];

    wp_mail($gift['recipientEmail'], "Recibiste una gift card de $site", $body, $headers);
    if (!empty($gift['buyerEmail'])) {
        wp_mail($gift['buyerEmail'], "Tu gift card fue enviada — $site", $body, $headers);
    }
}

/** 4) GraphQL: CartItem.giftCardData para mostrar "Regalo para X". */
add_action('graphql_register_types', function () {
    if (!function_exists('register_graphql_field')) return;
    register_graphql_field('CartItem', 'giftCardRecipient', [
        'type'    => 'String',
        'resolve' => function ($item) {
            $cart_item = WC()->cart ? WC()->cart->get_cart_item($item['key']) : null;
            return $cart_item[MANDALA_GIFT_KEY]['recipientEmail'] ?? null;
        },
    ]);
});
