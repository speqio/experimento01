<?php
/**
 * Plugin Name: Spa Mándala — Formulario de contacto
 * Description: Endpoint REST (mandala/v1/contacto) que recibe el formulario de /contacto del sitio Astro y lo
 *              envía por correo a contacto@spamandala.cl (mismo asunto que el Contact Form 7 de producción).
 *              Solo lo llama el Worker, autenticado con la contraseña de aplicación del usuario de subidas.
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
    register_rest_route('mandala/v1', '/contacto', [
        'methods'  => 'POST',
        // El Worker usa la contraseña de aplicación de WP_MEDIA_APP_USER (la misma de la subida de fotos).
        'permission_callback' => fn () => current_user_can('upload_files'),
        'callback' => function (WP_REST_Request $req) {
            $name    = sanitize_text_field((string) $req->get_param('name'));
            $phone   = sanitize_text_field((string) $req->get_param('phone'));
            $email   = sanitize_email((string) $req->get_param('email'));
            $message = sanitize_textarea_field((string) $req->get_param('message'));
            if (!$name || !$phone || !is_email($email) || !$message || mb_strlen($message) > 5000) {
                return new WP_REST_Response(['ok' => false, 'error' => 'Faltan datos o el correo no es válido.'], 400);
            }

            $to = apply_filters('mandala_contact_recipient', 'contacto@spamandala.cl');
            $body = "Nombre: {$name}\nCelular: {$phone}\nCorreo: {$email}\n\nMensaje:\n{$message}\n\n--\nEnviado desde el formulario de contacto del sitio web.";
            $sent = wp_mail($to, "Contacto sitioweb {$name}", $body, ["Reply-To: {$name} <{$email}>"]);

            return new WP_REST_Response(['ok' => (bool) $sent], $sent ? 200 : 500);
        },
    ]);
});
