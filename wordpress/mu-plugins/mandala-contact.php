<?php
/**
 * Plugin Name: Spa Mándala — Formulario de contacto
 * Description: Endpoint REST (mandala/v1/contacto) que recibe el formulario de /contacto del sitio Astro y lo
 *              envía por correo en HTML (mismos colores y remitente que los correos de gift card).
 *              Destino: contacto@spamandala.cl al lanzar; en pruebas, el correo de desarrollo.
 *              Solo lo llama el Worker, autenticado con la contraseña de aplicación del usuario de subidas.
 *              Vista previa para administradores: /wp-admin/admin-post.php?action=mandala_contact_preview
 */

if (!defined('ABSPATH')) exit;

/** HTML del aviso al administrador (tablas e estilos en línea: compatible con Gmail y Outlook). */
function mandala_contact_email_html(array $d) {
    $dark = '#2C2724'; $taupe = '#8C7A6B'; $sand = '#EFECE4'; $bg = '#F8F6F0'; $line = '#E8E2D7';
    $serif = "Georgia,'Times New Roman',serif"; $sans = 'Arial,Helvetica,sans-serif';
    $brand = defined('MANDALA_BRAND') ? MANDALA_BRAND : 'Mándala Spa';
    $wa = preg_replace('/\D/', '', $d['phone']);
    if (strlen($wa) === 9) $wa = '56' . $wa; // celular chileno sin código de país
    $reply = 'mailto:' . rawurlencode($d['email']) . '?subject=' . rawurlencode('Re: tu mensaje a ' . $brand);
    $btn = "display:inline-block;padding:12px 22px;border-radius:999px;font:bold 12px/1 $sans;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;";
    $row = function ($label, $value) use ($taupe, $dark, $sans, $line) {
        return "<tr><td style=\"padding:10px 0;border-bottom:1px solid $line;font:11px/1.4 $sans;letter-spacing:1.5px;text-transform:uppercase;color:$taupe;width:110px;vertical-align:top;\">$label</td>"
            . "<td style=\"padding:10px 0;border-bottom:1px solid $line;font:15px/1.5 $sans;color:$dark;\">$value</td></tr>";
    };
    ob_start();
    ?>
<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?php echo esc_html($brand); ?></title></head>
<body style="margin:0;padding:0;background:<?php echo $bg; ?>;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;"><?php echo esc_html(wp_trim_words($d['message'], 18)); ?></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:<?php echo $bg; ?>;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid <?php echo $line; ?>;border-radius:16px;overflow:hidden;">
    <tr><td style="background:<?php echo $dark; ?>;padding:22px 28px;">
      <div style="font:11px/1 <?php echo $sans; ?>;letter-spacing:3px;text-transform:uppercase;color:#D4C3B3;"><?php echo esc_html($brand); ?></div>
      <div style="font:24px/1.3 <?php echo $serif; ?>;color:#ffffff;margin-top:8px;">Nuevo mensaje de contacto</div>
    </td></tr>
    <tr><td style="padding:24px 28px 8px;">
      <p style="margin:0 0 18px;font:14px/1.6 <?php echo $sans; ?>;color:<?php echo $taupe; ?>;">Recibido el <?php echo esc_html($d['date']); ?> desde el formulario de contacto del sitio web.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <?php
        echo $row('Nombre', '<strong>' . esc_html($d['name']) . '</strong>');
        echo $row('Celular', '<a href="tel:+' . esc_attr($wa) . '" style="color:' . $dark . ';">' . esc_html($d['phone']) . '</a>');
        echo $row('Correo', '<a href="mailto:' . esc_attr($d['email']) . '" style="color:' . $dark . ';">' . esc_html($d['email']) . '</a>');
        ?>
      </table>
      <div style="margin:22px 0 6px;font:11px/1 <?php echo $sans; ?>;letter-spacing:1.5px;text-transform:uppercase;color:<?php echo $taupe; ?>;">Mensaje</div>
      <div style="background:<?php echo $sand; ?>;border-radius:12px;padding:16px 18px;font:15px/1.6 <?php echo $sans; ?>;color:<?php echo $dark; ?>;"><?php echo nl2br(esc_html($d['message'])); ?></div>
    </td></tr>
    <tr><td style="padding:20px 28px 28px;">
      <a href="<?php echo esc_attr($reply); ?>" style="<?php echo $btn; ?>background:<?php echo $dark; ?>;color:#ffffff;">Responder por correo</a>
      <?php if (strlen($wa) >= 11) : ?>
        &nbsp;<a href="https://wa.me/<?php echo esc_attr($wa); ?>" style="<?php echo $btn; ?>background:#25D366;color:#ffffff;">WhatsApp</a>
      <?php endif; ?>
    </td></tr>
  </table>
  <p style="margin:16px 0 0;font:11px/1.5 <?php echo $sans; ?>;color:<?php echo $taupe; ?>;">Al responder este correo le escribes directamente a <?php echo esc_html($d['name']); ?>.</p>
</td></tr>
</table>
</body></html>
    <?php
    return ob_get_clean();
}

function mandala_contact_send(array $d) {
    // ponytail: entorno de pruebas — al lanzar (Fase B) volver a 'contacto@spamandala.cl'.
    $to = apply_filters('mandala_contact_recipient', 'paolomoridesign@gmail.com');
    $headers = function_exists('mandala_gift_email_headers') ? mandala_gift_email_headers() : ['Content-Type: text/html; charset=UTF-8'];
    // El nombre puede llevar tildes: va codificado (RFC 2047) para que la cabecera no se corrompa.
    $headers[] = 'Reply-To: =?UTF-8?B?' . base64_encode($d['name']) . '?= <' . $d['email'] . '>';
    $subject = 'Nuevo contacto recibido - ' . $d['name'];
    // Tildes y ñ como entidades HTML: el cuerpo queda en ASCII puro y ningún servidor de correo puede romperlas (el "�").
    $html = mb_encode_numericentity(mandala_contact_email_html($d), [0x80, 0x10FFFF, 0, 0x1FFFFF], 'UTF-8');
    return wp_mail($to, $subject, $html, $headers);
}

add_action('rest_api_init', function () {
    register_rest_route('mandala/v1', '/contacto', [
        'methods'  => 'POST',
        // El Worker usa la contraseña de aplicación de WP_MEDIA_APP_USER (la misma de la subida de fotos).
        'permission_callback' => fn () => current_user_can('upload_files'),
        'callback' => function (WP_REST_Request $req) {
            $d = [
                'name'    => sanitize_text_field((string) $req->get_param('name')),
                'phone'   => sanitize_text_field((string) $req->get_param('phone')),
                'email'   => sanitize_email((string) $req->get_param('email')),
                'message' => sanitize_textarea_field((string) $req->get_param('message')),
                'date'    => wp_date('j \d\e F \d\e Y, H:i'),
            ];
            if (!$d['name'] || !$d['phone'] || !is_email($d['email']) || !$d['message'] || mb_strlen($d['message']) > 5000) {
                return new WP_REST_Response(['ok' => false, 'error' => 'Faltan datos o el correo no es válido.'], 400);
            }
            $sent = mandala_contact_send($d);
            return new WP_REST_Response(['ok' => (bool) $sent], $sent ? 200 : 500);
        },
    ]);
});

/** Vista previa con datos de ejemplo (solo administradores). */
add_action('admin_post_mandala_contact_preview', function () {
    if (!current_user_can('manage_options')) wp_die('No autorizado', 403);
    echo mandala_contact_email_html([
        'name' => 'Camila Rojas', 'phone' => '+56 9 1234 5678', 'email' => 'camila@ejemplo.cl',
        'message' => "Hola, quisiera saber si tienen disponibilidad para un masaje para dos este sábado.\n¡Gracias!",
        'date' => wp_date('j \d\e F \d\e Y, H:i'),
    ]);
    exit;
});
