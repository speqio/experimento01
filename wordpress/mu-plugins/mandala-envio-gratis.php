<?php
/**
 * Plugin Name: Spa Mándala — Envío gratis solo por productos físicos
 * Description: El mínimo de "Envío gratis" de WooCommerce se compara con todo el carrito, servicios
 *              incluidos. Este plugin lo compara solo con lo que se despacha (los productos que
 *              llevan envío), y quita la tarifa gratis si esa parte no llega al mínimo.
 */

if (!defined('ABSPATH')) exit;

add_filter('woocommerce_package_rates', function ($rates, $package) {
    // contents_cost ya excluye los ítems virtuales y descuenta cupones (sin impuestos).
    $fisico = (float) ($package['contents_cost'] ?? 0) + (float) ($package['contents_tax'] ?? 0);

    foreach ($rates as $id => $rate) {
        if ($rate->get_method_id() !== 'free_shipping') continue;

        $metodo = WC_Shipping_Zones::get_shipping_method($rate->get_instance_id());
        $minimo = $metodo ? (float) $metodo->get_option('min_amount') : 0;

        if ($minimo > 0 && $fisico < $minimo) unset($rates[$id]);
    }
    return $rates;
}, 100, 2);
