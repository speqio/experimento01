<?php
/**
 * Plugin Name: Spa Mándala — Correo de Gift Card (template HTML)
 * Description: Template HTML (compatible con clientes de correo) del regalo, con mockup de
 *              tarjeta y botón "Agenda tu hora". Lo usa mandala-giftcards.php.
 *              Vista previa para administradores:
 *              /wp-admin/admin-post.php?action=mandala_gift_preview[&product=ID][&mode=buyer][&send=1]
 */

if (!defined('ABSPATH')) exit;

if (!defined('MANDALA_BRAND')) define('MANDALA_BRAND', 'Mándala Spa');
if (!defined('MANDALA_FROM_EMAIL')) define('MANDALA_FROM_EMAIL', 'no-reply@laboratorio.space');
// URL del logo (subirlo a Medios en cms.laboratorio.space). Vacío = wordmark en texto.
if (!defined('MANDALA_EMAIL_LOGO_URL')) define('MANDALA_EMAIL_LOGO_URL', '');
// Dominio del frontend Astro (no el del CMS).
if (!defined('MANDALA_FRONTEND_URL')) define('MANDALA_FRONTEND_URL', 'https://laboratorio.space');
// Contacto para reservar "a mano" (teléfono/WhatsApp/correo) — ver mandala_gift_email_html()
// sección "Cómo canjear". El canje manual lo confirma el administrador desde
// wp-admin → Gift Cards → Trazabilidad ("Marcar como usado").
if (!defined('MANDALA_CONTACT_PHONE')) define('MANDALA_CONTACT_PHONE', '+56 9 9224 2180');
if (!defined('MANDALA_CONTACT_WHATSAPP')) define('MANDALA_CONTACT_WHATSAPP', '56992242180');
if (!defined('MANDALA_CONTACT_EMAIL')) define('MANDALA_CONTACT_EMAIL', 'contacto@spamandala.cl');

/**
 * $d: mode ('recipient'|'buyer'), code, product_name, variant, image, message,
 *     from_name, recipient_email, expires, product_url, addons (nombres de
 *     complementos incluidos en el mismo regalo, si los hay — ver mandala-giftcards.php)
 */
function mandala_gift_email_html(array $d) {
    $site   = untrailingslashit(apply_filters('mandala_gift_site_url', MANDALA_FRONTEND_URL));
    $agenda = $site . '/agenda';
    $mode   = $d['mode'] ?? 'recipient';
    $from   = $d['from_name'] ?: 'Alguien especial';

    $title = $mode === 'buyer'
        ? 'Tu regalo fue enviado'
        : esc_html($from) . ' te regaló una experiencia';
    $intro = $mode === 'buyer'
        ? 'Enviamos la gift card a <strong>' . esc_html($d['recipient_email']) . '</strong>. Te dejamos una copia con el código.'
        : 'Preparamos este regalo para que te tomes un momento solo para ti.';
    $preheader = $mode === 'buyer'
        ? 'Copia de la gift card que enviaste'
        : $from . ' te regaló una experiencia en ' . MANDALA_BRAND;

    $brand_color = '#2C2724';
    $taupe       = '#8C7A6B';
    $sand        = '#EFECE4';
    $bg          = '#F8F6F0';
    $serif       = "Georgia,'Times New Roman',serif";
    $sans        = "Arial,Helvetica,sans-serif";

    ob_start();
    ?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?php echo esc_html(MANDALA_BRAND); ?></title>
</head>
<body style="margin:0;padding:0;background:<?php echo $bg; ?>;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:<?php echo $bg; ?>;"><?php echo esc_html($preheader); ?></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:<?php echo $bg; ?>;">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">

    <!-- Logo -->
    <tr><td align="center" style="padding:0 0 22px 0;">
      <?php if (MANDALA_EMAIL_LOGO_URL) : ?>
        <img src="<?php echo esc_url(MANDALA_EMAIL_LOGO_URL); ?>" alt="<?php echo esc_attr(MANDALA_BRAND); ?>" width="160" style="display:block;border:0;height:auto;max-width:160px;">
      <?php else : ?>
        <span style="font-family:<?php echo $serif; ?>;font-size:22px;letter-spacing:9px;color:<?php echo $brand_color; ?>;text-transform:uppercase;">Mándala</span>
        <div style="font-family:<?php echo $sans; ?>;font-size:10px;letter-spacing:4px;color:<?php echo $taupe; ?>;text-transform:uppercase;padding-top:4px;">Spa · Masajes · Terapias</div>
      <?php endif; ?>
    </td></tr>

    <!-- Título -->
    <tr><td align="center" style="padding:0 16px 8px 16px;">
      <h1 style="margin:0;font-family:<?php echo $serif; ?>;font-weight:normal;font-size:28px;line-height:1.25;color:<?php echo $brand_color; ?>;"><?php echo $title; ?></h1>
    </td></tr>
    <tr><td align="center" style="padding:0 24px 24px 24px;font-family:<?php echo $sans; ?>;font-size:14px;line-height:1.6;color:#675647;"><?php echo $intro; ?></td></tr>

    <!-- Tarjeta (imagen estática; el efecto 3D solo existe en el modal del sitio). Si el
         comprador subió su propia foto, mandala_gift_compose_card_image() ya la recortó
         al aspecto de tarjeta, le redondeó las esquinas y le superpuso el logo como UNA
         sola imagen (PHP/GD, en mandala-giftcards.php) — así se ve igual en todos los
         clientes de correo, sin depender de position:absolute/border-radius por CSS
         (que Outlook y varios clientes de correo ignoran). El arte de fábrica se
         administra en wp-admin → Gift Cards → Ajustes. -->
    <?php if (!empty($d['personal_image'])) : ?>
    <tr><td align="center" style="padding:0 0 22px 0;">
      <img src="<?php echo esc_url($d['personal_image']); ?>" alt="Gift Card <?php echo esc_attr(MANDALA_BRAND); ?>" width="480" style="display:block;width:100%;max-width:480px;height:auto;border:0;">
    </td></tr>
    <?php else : ?>
    <tr><td align="center" style="padding:0 0 22px 0;">
      <img src="<?php echo esc_url(mandala_gift_image_url()); ?>" alt="Gift Card <?php echo esc_attr(MANDALA_BRAND); ?>" width="480" style="display:block;width:100%;max-width:480px;height:auto;border:0;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.18);">
    </td></tr>
    <?php endif; ?>

    <!-- Detalle del regalo -->
    <tr><td style="padding:0 0 26px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #E2DDD3;border-radius:14px;">
        <tr><td style="padding:18px 20px 6px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <?php if (!empty($d['image'])) : ?>
            <td width="72" valign="middle" style="padding-right:14px;line-height:0;">
              <img src="<?php echo esc_url($d['image']); ?>" alt="<?php echo esc_attr($d['product_name']); ?>" width="72" height="72" style="display:block;width:72px;height:72px;border:0;border-radius:10px;object-fit:cover;">
            </td>
            <?php endif; ?>
            <td valign="middle">
              <div style="font-family:<?php echo $serif; ?>;font-size:19px;line-height:1.3;color:<?php echo $brand_color; ?>;"><?php echo esc_html($d['product_name']); ?></div>
              <?php if (!empty($d['variant'])) : ?>
              <div style="font-family:<?php echo $sans; ?>;font-size:13px;color:<?php echo $taupe; ?>;padding-top:3px;"><?php echo esc_html($d['variant']); ?></div>
              <?php endif; ?>
            </td>
          </tr></table>
        </td></tr>
        <?php if (!empty($d['addons'])) : ?>
        <tr><td style="padding:2px 20px 4px 20px;font-family:<?php echo $sans; ?>;font-size:13px;line-height:1.6;color:#675647;">
          <strong style="color:<?php echo $brand_color; ?>;">Incluye también:</strong> <?php echo esc_html(implode(', ', $d['addons'])); ?>
        </td></tr>
        <?php endif; ?>
        <?php if (!empty($d['message'])) : ?>
        <tr><td style="padding:10px 20px 4px 20px;font-family:<?php echo $serif; ?>;font-style:italic;font-size:15px;line-height:1.55;color:#675647;">“<?php echo esc_html($d['message']); ?>”</td></tr>
        <?php endif; ?>
        <tr><td style="padding:12px 20px 16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #EFECE4;"><tr>
            <td style="padding-top:10px;font-family:<?php echo $sans; ?>;font-size:11px;letter-spacing:2px;color:<?php echo $taupe; ?>;text-transform:uppercase;">Para</td>
            <td align="right" style="padding-top:10px;font-family:<?php echo $sans; ?>;font-size:12px;color:<?php echo $brand_color; ?>;"><?php echo esc_html($d['recipient_email']); ?></td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>

    <!-- Código -->
    <tr><td align="center" style="padding:0 0 8px 0;font-family:<?php echo $sans; ?>;font-size:11px;letter-spacing:3px;color:<?php echo $taupe; ?>;text-transform:uppercase;">Tu código de regalo</td></tr>
    <tr><td align="center" style="padding:0 0 10px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:2px dashed #D4C3B3;border-radius:12px;">
        <tr><td style="padding:16px 30px;font-family:'Courier New',Courier,monospace;font-size:28px;letter-spacing:6px;font-weight:bold;color:<?php echo $brand_color; ?>;"><?php echo esc_html($d['code']); ?></td></tr>
      </table>
    </td></tr>
    <?php if (!empty($d['expires'])) : ?>
    <tr><td align="center" style="padding:0 0 26px 0;font-family:<?php echo $sans; ?>;font-size:12px;color:<?php echo $taupe; ?>;">Válido hasta el <?php echo esc_html($d['expires']); ?> · un solo uso</td></tr>
    <?php else : ?>
    <tr><td style="padding:0 0 18px 0;"></td></tr>
    <?php endif; ?>

    <!-- Cómo canjearlo: dos formas -->
    <tr><td style="padding:0 0 26px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:<?php echo $sand; ?>;border-radius:14px;">
        <tr><td style="padding:22px 24px 6px 24px;font-family:<?php echo $serif; ?>;font-size:18px;color:<?php echo $brand_color; ?>;">Cómo canjear tu regalo</td></tr>

        <tr><td style="padding:6px 24px 2px 24px;font-family:<?php echo $sans; ?>;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:<?php echo $taupe; ?>;">Opción 1 — Reserva en línea</td></tr>
        <tr><td style="padding:4px 24px 4px 24px;font-family:<?php echo $sans; ?>;font-size:13px;line-height:1.7;color:#675647;">
          <strong style="color:<?php echo $brand_color; ?>;">1.</strong> Entra a <a href="<?php echo esc_url($site); ?>" style="color:<?php echo $brand_color; ?>;"><?php echo esc_html(preg_replace('#^https?://#', '', $site)); ?></a> y elige el mismo servicio<?php echo !empty($d['variant']) ? ' (' . esc_html($d['variant']) . ')' : ''; ?>.<br>
          <strong style="color:<?php echo $brand_color; ?>;">2.</strong> Agrégalo al carrito e ingresa el código en el checkout, usando <strong><?php echo esc_html($d['recipient_email']); ?></strong> como tu email.<br>
          <strong style="color:<?php echo $brand_color; ?>;">3.</strong> El total queda en $0. ¡Listo!
        </td></tr>

        <tr><td style="padding:14px 24px 0 24px;"><div style="border-top:1px solid #E2DBCE;"></div></td></tr>

        <tr><td style="padding:14px 24px 2px 24px;font-family:<?php echo $sans; ?>;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:<?php echo $taupe; ?>;">Opción 2 — Por teléfono, WhatsApp o correo</td></tr>
        <tr><td style="padding:4px 24px 20px 24px;font-family:<?php echo $sans; ?>;font-size:13px;line-height:1.7;color:#675647;">
          Si prefieres, escríbenos o llámanos para reservar directamente. Indícanos <strong>el correo en el que recibiste esta gift card</strong> (<strong><?php echo esc_html($d['recipient_email']); ?></strong>) y tu <strong>código de regalo</strong> (<strong><?php echo esc_html($d['code']); ?></strong>):<br><br>
          📞 Teléfono / WhatsApp: <a href="https://wa.me/<?php echo esc_attr(MANDALA_CONTACT_WHATSAPP); ?>" style="color:<?php echo $brand_color; ?>;"><?php echo esc_html(MANDALA_CONTACT_PHONE); ?></a><br>
          ✉️ Correo: <a href="mailto:<?php echo esc_attr(MANDALA_CONTACT_EMAIL); ?>" style="color:<?php echo $brand_color; ?>;"><?php echo esc_html(MANDALA_CONTACT_EMAIL); ?></a>
        </td></tr>
      </table>
    </td></tr>

    <!-- Botón Agenda -->
    <tr><td align="center" style="padding:0 0 8px 0;font-family:<?php echo $sans; ?>;font-size:13px;color:#675647;">¿Lista para reservar tu momento?</td></tr>
    <tr><td align="center" style="padding:0 0 30px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="<?php echo $brand_color; ?>" style="border-radius:999px;">
          <a href="<?php echo esc_url($agenda); ?>" style="display:inline-block;padding:14px 34px;font-family:<?php echo $sans; ?>;font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;border-radius:999px;">Agenda tu hora</a>
        </td>
      </tr></table>
    </td></tr>

    <!-- Footer -->
    <tr><td align="center" style="padding:22px 16px 0 16px;border-top:1px solid #E2DDD3;font-family:<?php echo $sans; ?>;font-size:12px;line-height:1.7;color:<?php echo $taupe; ?>;">
      <strong style="color:<?php echo $brand_color; ?>;"><?php echo esc_html(MANDALA_BRAND); ?></strong><br>
      Las Condes, Santiago, Chile · Lun a Sáb, 10:00 - 20:00 hrs<br>
      <a href="https://instagram.com/spamandala" style="color:<?php echo $taupe; ?>;">Instagram</a> ·
      <a href="https://facebook.com/spamandala" style="color:<?php echo $taupe; ?>;">Facebook</a> ·
      <a href="https://wa.me/56992242180" style="color:<?php echo $taupe; ?>;">WhatsApp</a>
      <div style="padding-top:12px;font-size:11px;color:#A89E95;">Este es un correo automático, por favor no respondas a esta dirección.</div>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>
    <?php
    return ob_get_clean();
}

function mandala_gift_email_headers() {
    return [
        'Content-Type: text/html; charset=UTF-8',
        'From: ' . MANDALA_BRAND . ' <' . MANDALA_FROM_EMAIL . '>',
    ];
}

/** Vista previa (solo administradores): HTML con datos de ejemplo o de un producto real. */
add_action('admin_post_mandala_gift_preview', function () {
    if (!current_user_can('manage_woocommerce')) wp_die('No autorizado', 403);

    $product = !empty($_GET['product']) ? wc_get_product((int) $_GET['product']) : null;
    $image = '';
    if ($product) {
        $image_id = $product->get_image_id();
        $image = $image_id ? wp_get_attachment_image_url($image_id, 'large') : '';
    }
    $data = [
        'mode'            => (isset($_GET['mode']) && $_GET['mode'] === 'buyer') ? 'buyer' : 'recipient',
        'code'            => 'A1B2C3D4E5F6',
        'product_name'    => $product ? $product->get_name() : 'Limpieza facial profunda con hidratación',
        'variant'         => '5 sesiones, 1 hora y 15 min',
        'image'           => $image,
        'message'         => 'Feliz cumpleaños, te mereces este momento para ti.',
        'from_name'       => 'Macarena',
        'recipient_email' => 'destinatario@email.com',
        'expires'         => date_i18n('j \d\e F \d\e Y', strtotime('+12 months')),
    ];
    $html = mandala_gift_email_html($data);

    if (!empty($_GET['send'])) {
        $me = wp_get_current_user();
        $subject = $data['mode'] === 'buyer'
            ? 'Tu gift card fue enviada — ' . MANDALA_BRAND
            : $data['from_name'] . ' te regaló una experiencia en ' . MANDALA_BRAND;
        $ok = wp_mail($me->user_email, '[PRUEBA] ' . $subject, $html, mandala_gift_email_headers());
        wp_die($ok ? 'Correo de prueba enviado a ' . esc_html($me->user_email) : 'No se pudo enviar el correo de prueba.');
    }

    header('Content-Type: text/html; charset=UTF-8');
    echo $html;
    exit;
});
