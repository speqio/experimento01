<?php
/**
 * Plugin Name: Spa Mándala — Grupos de campos ACF (headless)
 * Description: Reproduce EXACTO los grupos de campos ACF de producción
 *              (spamandala.cl), agregando solo exposición GraphQL
 *              (wpgraphql-acf) para el frontend headless. No se inventa
 *              ningún campo nuevo — ver export real en el historial del
 *              proyecto (acf-export-2026-09-21.json) y docs/wp-setup-guide.md §4.
 */

if (!defined('ABSPATH')) exit;

add_action('acf/init', function () {
    if (!function_exists('acf_add_local_field_group')) return;

    // ------------------------------------------------------------
    // Grupo "Gift Card" — producto marcable como regalo + código.
    // ------------------------------------------------------------
    acf_add_local_field_group([
        'key' => 'group_6967c9fedeaa2',
        'title' => 'Gift Card',
        'fields' => [
            [
                'key' => 'field_6967c9ff0db50',
                'label' => 'Gift Card',
                'name' => 'gift_card',
                'type' => 'checkbox',
                'choices' => ['Gift Card' => 'SI'],
                'return_format' => 'value',
                'layout' => 'vertical',
            ],
            [
                'key' => 'field_6967cccb1c002',
                'label' => 'codigo giftcard',
                'name' => 'codigo_giftcard',
                'type' => 'text',
                'conditional_logic' => [
                    [
                        ['field' => 'field_6967c9ff0db50', 'operator' => '==', 'value' => 'Gift Card'],
                    ],
                ],
                'default_value' => '[gift_product_url]',
            ],
        ],
        'location' => [
            [['param' => 'post_type', 'operator' => '==', 'value' => 'product']],
        ],
        // Exposición GraphQL (no existe en producción, es propia del headless).
        'show_in_graphql' => 1,
        'graphql_field_name' => 'giftCardFields',
    ]);

    // ------------------------------------------------------------
    // Grupo "Upseller" — complementos dependientes de un producto
    // (leídos por el plugin upsells-dependientes.php).
    // ------------------------------------------------------------
    acf_add_local_field_group([
        'key' => 'group_69652d12b25e6',
        'title' => 'Upseller',
        'fields' => [
            [
                'key' => 'field_69652d163c2c3',
                'label' => 'Nombre producto',
                'name' => 'nombre_producto',
                'type' => 'text',
            ],
            [
                'key' => 'field_69652d493c2c4',
                'label' => 'ID producto',
                'name' => 'productos_principales_ids',
                'type' => 'relationship',
                'post_type' => '',
                'taxonomy' => '',
                'filters' => ['search', 'post_type', 'taxonomy'],
                'return_format' => 'object',
            ],
        ],
        'location' => [
            [['param' => 'post_type', 'operator' => '==', 'value' => 'product']],
        ],
        'show_in_graphql' => 1,
        'graphql_field_name' => 'upsellerFields',
    ]);

    // ------------------------------------------------------------
    // Grupo "Pack Promos" — contenido editorial de blog (post).
    // Registrado por completitud; no se prioriza su uso en el
    // frontend headless hasta que exista una sección de blog/promos.
    // ------------------------------------------------------------
    acf_add_local_field_group([
        'key' => 'group_696fc5428375c',
        'title' => 'Pack Promos',
        'fields' => [
            [
                'key' => 'field_696fd282d9870',
                'label' => 'Foto',
                'name' => 'foto',
                'type' => 'image',
                'return_format' => 'array',
                'preview_size' => 'medium',
            ],
            [
                'key' => 'field_696fc57eb5b30',
                'label' => 'Nombre',
                'name' => 'nombre',
                'type' => 'text',
            ],
            [
                'key' => 'field_696fcdc43e527',
                'label' => 'Tratamiento',
                'name' => 'tratamiento',
                'type' => 'text',
            ],
            [
                'key' => 'field_696fd1bfd986f',
                'label' => 'Descripción',
                'name' => 'descripcion',
                'type' => 'textarea',
            ],
        ],
        'location' => [
            [['param' => 'post_type', 'operator' => '==', 'value' => 'post']],
        ],
        'show_in_graphql' => 1,
        'graphql_field_name' => 'packPromoFields',
    ]);
});
