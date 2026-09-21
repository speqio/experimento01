<?php
/**
 * Plugin Name: Upsells Dependientes WooCommerce (Código Limpio)
 * Description: Sistema de complementos con validación de carrito y botones blindados contra estiramiento.
 * Version: 2.3.2
 */

if (!defined('ABSPATH')) exit;

/* ==================================================
 * 1. LÓGICA DE FONDO Y CARRITO (INTACTA)
 * ================================================== */
if (!function_exists('ud_get_ids')) {
    function ud_get_ids($v) {
        if (empty($v)) return [];
        $ids = [];
        foreach ((array) $v as $x) {
            $ids[] = (is_object($x) && isset($x->ID)) ? (int) $x->ID : (int) $x;
        }
        return array_unique(array_filter($ids));
    }
}

if (!function_exists('ud_is_upsell')) {
    function ud_is_upsell($id) {
        return !empty(ud_get_ids(get_field('productos_principales_ids', $id)));
    }
}

if (!function_exists('ud_principales_en_carrito')) {
    function ud_principales_en_carrito() {
        if (!WC()->cart) return [];
        $ids = [];
        foreach (WC()->cart->get_cart() as $i) {
            $id = (!empty($i['parent_id'])) ? (int) $i['parent_id'] : (int) $i['product_id'];
            if ($id && !ud_is_upsell($id)) $ids[] = $id;
        }
        return array_unique($ids);
    }
}

/* VALIDACIONES EN CARRITO */
add_filter('woocommerce_add_to_cart_validation', function ($passed, $product_id) {
    if (!ud_is_upsell($product_id)) return $passed;
    if (!array_intersect(ud_get_ids(get_field('productos_principales_ids', $product_id)), ud_principales_en_carrito())) {
        wc_add_notice('Este producto solo puede comprarse como complemento.', 'error');
        return false;
    }
    return $passed;
}, 10, 2);

add_action('woocommerce_cart_updated', function () {
    if (!WC()->cart || is_admin()) return;
    $p = ud_principales_en_carrito();
    foreach (WC()->cart->get_cart() as $k => $i) {
        $id = (int) $i['product_id'];
        if (ud_is_upsell($id)) {
            if (!array_intersect(ud_get_ids(get_field('productos_principales_ids', $id)), $p)) {
                WC()->cart->remove_cart_item($k);
            }
        }
    }
});


/* ==================================================
 * 2. CARGA DE ESTILOS LIMPIOS POR ESPECIFICIDAD
 * ================================================== */
add_action('wp_enqueue_scripts', function() {
    if (is_product()) {
        wp_register_style('ud-custom-styles', false);
        wp_enqueue_style('ud-custom-styles');

        $custom_css = "
        /* 1. Reset de maquetación: Permite salto de línea en el form de Elementor */
        body.single-product form.cart {
            display: flex;
            flex-wrap: wrap;
        }

        /* 2. Caja Contenedora: Forzamos a ocupar el 100% de la fila */
        body.single-product form.cart .ud-container {
            flex: 0 0 100%;
            box-sizing: border-box;
            width: 100%;
            margin: 15px 0 25px 0;
            padding: 16px;
            background-color: #ffffff;
            border: 1px solid #e2e2e2;
            border-radius: 8px;
            clear: both;
        }

        body.single-product .ud-container .ud-title {
            margin: 0 0 12px 0;
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #111111;
        }

        /* 3. Filas de Complementos */
        body.single-product .ud-container .ud-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px dashed #eee;
            width: 100%;
        }

        body.single-product .ud-container .ud-item:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
        }

        body.single-product .ud-container .ud-left {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            cursor: pointer;
            flex: 1; /* Permite que el texto empuje al botón */
        }

        body.single-product .ud-container .ud-left input[type='checkbox'] {
            margin-top: 2px;
        }

        body.single-product .ud-container .ud-info {
            display: flex;
            flex-direction: column;
        }

        body.single-product .ud-container .ud-name {
            font-size: 13px;
            line-height: 1.3;
            color: #222;
            font-weight: 600;
            text-transform: uppercase;
        }

        body.single-product .ud-container .ud-price {
            font-size: 13px;
            font-weight: bold;
            color: #725D4C;
            margin-top: 2px;
        }

        /* 4. Botón Ver Detalles (Estilo Café Blindado) */
        body.single-product .ud-container button.ud-btn-details {
            background-color: #725D4C !important;
            border: 1px solid #725D4C !important;
            color: #ffffff !important;
            padding: 5px 12px !important;
            font-size: 11px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            white-space: nowrap !important;
            transition: background 0.2s ease !important;

            /* REGLAS PARA EVITAR ESTIRAMIENTO */
            flex: 0 0 auto !important;
            width: auto !important;
            max-width: max-content !important;
            margin: 0 !important;
        }

        body.single-product .ud-container button.ud-btn-details:hover {
            background-color: #5c4a3c !important;
            border-color: #5c4a3c !important;
        }

        /* 5. Modal HTML5 */
        dialog.ud-modal {
            border: none;
            border-radius: 12px;
            padding: 24px;
            max-width: 480px;
            width: 90%;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }

        dialog.ud-modal::backdrop {
            background: rgba(0, 0, 0, 0.55);
        }

        .ud-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 14px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            gap: 10px;
        }

        .ud-modal-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 700;
            text-transform: uppercase;
            color: #222;
            flex: 1;
        }

        /* AISLAMIENTO ABSOLUTO DEL BOTÓN CERRAR (FIX MÓVIL) */
        dialog.ud-modal .ud-modal-header button.ud-modal-close,
        body.single-product dialog.ud-modal .ud-modal-header button.ud-modal-close {
            all: unset !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 30px !important;
            height: 30px !important;
            min-width: 30px !important;
            max-width: 30px !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: #725D4C !important;
            font-size: 26px !important;
            line-height: 1 !important;
            cursor: pointer !important;
            flex: 0 0 30px !important; /* Impide que el flexbox móvil lo ensanche */
        }

        dialog.ud-modal .ud-modal-header button.ud-modal-close:hover {
            color: #000000 !important;
            background: transparent !important;
        }

        .ud-modal-body {
            font-size: 13.5px;
            line-height: 1.6;
            color: #444;
        }
        ";

        wp_add_inline_style('ud-custom-styles', $custom_css);
    }
}, 999);


/* ==================================================
 * 3. INTERFAZ EN PRODUCTO + JAVASCRIPT
 * ================================================== */
add_action('woocommerce_before_add_to_cart_button', 'ud_checkbox_upsells_en_producto', 15);
function ud_checkbox_upsells_en_producto() {
    global $product;
    if (!$product) return;

    $query = new WP_Query([
        'post_type'      => 'product',
        'posts_per_page' => -1,
        'post_status'    => 'publish',
        'meta_query'     => [['key' => 'productos_principales_ids', 'value' => '"' . $product->get_id() . '"', 'compare' => 'LIKE']]
    ]);

    if (!$query->have_posts()) return;
    ?>

    <div class="ud-container">
        <h4 class="ud-title">Complementa tu experiencia</h4>

        <?php
        while ($query->have_posts()) {
            $query->the_post();
            $upsell = wc_get_product(get_the_ID());
            if (!$upsell) continue;

            $popup_desc = get_field('popup_complemento_texto', $upsell->get_id());
            if (empty($popup_desc)) {
                $popup_desc = $upsell->get_short_description();
            }
            if (empty($popup_desc)) {
                $popup_desc = wp_trim_words($upsell->get_description(), 30);
            }
            if (empty($popup_desc)) {
                $popup_desc = 'No hay detalles adicionales para este complemento.';
            }
            ?>
            <div class="ud-item">
                <label class="ud-left">
                    <input type="checkbox" name="ud_upsells[]" class="ud-upsell-checkbox" value="<?php echo esc_attr($upsell->get_id()); ?>" data-price="<?php echo esc_attr($upsell->get_price()); ?>">
                    <div class="ud-info">
                        <span class="ud-name"><?php echo esc_html($upsell->get_name()); ?></span>
                        <span class="ud-price"><?php echo wc_price($upsell->get_price()); ?></span>
                    </div>
                </label>

                <button type="button"
                        class="ud-btn-details"
                        data-title="<?php echo esc_attr($upsell->get_name()); ?>"
                        data-content="<?php echo esc_attr(wp_kses_post($popup_desc)); ?>">
                    Ver detalles
                </button>
            </div>
            <?php
        }
        ?>

        <!-- Modal Nativo HTML5 -->
        <dialog class="ud-modal" id="ud-details-modal">
            <div class="ud-modal-header">
                <h3 id="ud-modal-title">Detalles</h3>
                <button type="button" class="ud-modal-close" id="ud-modal-close-btn" aria-label="Cerrar">&times;</button>
            </div>
            <div class="ud-modal-body" id="ud-modal-body-content"></div>
        </dialog>
    </div>

    <?php
    wp_reset_postdata();

    // SCRIPT JS
    ?>
    <script type="text/javascript">
    jQuery(document).ready(function($) {

        function posicionalEstructura() {
            var $container = $('.ud-container');
            if (!$container.length) return;

            var $variationWrap = $('.woocommerce-variation-add-to-cart');
            var $quantityWrap = $('form.cart .quantity');
            var $button = $('.single_add_to_cart_button');

            if ($variationWrap.length) {
                $container.insertBefore($variationWrap);
            } else if ($quantityWrap.length) {
                $container.insertBefore($quantityWrap);
            } else if ($button.length) {
                $container.insertBefore($button);
            }
        }

        posicionalEstructura();

        $(window).on('found_variation check_variations_html', function() {
            setTimeout(posicionalEstructura, 100);
        });

        // CONTROL POP-UP
        const modal = document.getElementById('ud-details-modal');
        const modalTitle = document.getElementById('ud-modal-title');
        const modalBody = document.getElementById('ud-modal-body-content');
        const closeBtn = document.getElementById('ud-modal-close-btn');

        $(document).on('click', '.ud-btn-details', function(e) {
            e.preventDefault();
            modalTitle.innerText = $(this).attr('data-title');
            modalBody.innerHTML = $(this).attr('data-content');

            if (modal && typeof modal.showModal === 'function') {
                modal.showModal();
            }
        });

        if (closeBtn && modal) {
            closeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                modal.close();
            });

            modal.addEventListener('click', function(e) {
                const rect = modal.getBoundingClientRect();
                if (e.clientY < rect.top || e.clientY > rect.bottom || e.clientX < rect.left || e.clientX > rect.right) {
                    modal.close();
                }
            });
        }
    });
    </script>
    <?php
}

/* ==================================================
 * 4. PROCESAMIENTO DE COMPRA (INTACTO)
 * ================================================== */
add_action('woocommerce_add_to_cart', function($cart_item_key, $product_id, $quantity, $variation_id, $variation, $cart_item_data){
    if (is_admin() || empty($_POST['ud_upsells']) || !is_array($_POST['ud_upsells'])) return;
    foreach ($_POST['ud_upsells'] as $upsell_id) {
        $upsell_id = (int) $upsell_id;
        if (in_array((int)$product_id, ud_get_ids(get_field('productos_principales_ids', $upsell_id)), true)) {
            if (!WC()->cart->find_product_in_cart(WC()->cart->generate_cart_id($upsell_id))) {
                WC()->cart->add_to_cart($upsell_id, 1);
            }
        }
    }
}, 20, 6);
