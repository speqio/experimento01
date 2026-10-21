<?php
/**
 * Plugin Name: Spa Mándala — REST sin reescritura
 * Description: El hosting de cms.spamandala.cl responde 404 a los POST en URLs reescritas (/wp-json/...).
 *              Esto hace que wp-admin (contraseñas de aplicación, editor de bloques, etc.) llame a la API REST
 *              por index.php?rest_route=, igual que el frontend. Se puede quitar si el hosting corrige la regla.
 */

if (!defined('ABSPATH')) exit;

add_filter('rest_url', function ($url, $path) {
    return add_query_arg('rest_route', '/' . ltrim((string) $path, '/'), home_url('/index.php'));
}, 10, 2);
