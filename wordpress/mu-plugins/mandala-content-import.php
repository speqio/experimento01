<?php
/**
 * Plugin Name: Spa Mándala — Importador de contenido de productos
 * Description: Agrega a la descripción de cada servicio las secciones estándar que le faltan
 *              (Beneficios / Incluye / Indicado para / Contraindicaciones), leyendo
 *              mandala-content-data.json (generado desde docs/contenido-productos.md).
 *
 * Uso (solo administradores):
 *   /wp-admin/admin-post.php?action=mandala_content_import               → vista previa (no escribe)
 *   /wp-admin/admin-post.php?action=mandala_content_import&apply=1       → aplica
 *   /wp-admin/admin-post.php?action=mandala_content_import&restore=1     → vuelve al texto original
 * Es idempotente: un producto ya importado se omite, y la descripción original queda respaldada
 * en el meta `_mandala_desc_backup`.
 */

if (!defined('ABSPATH')) exit;

const MANDALA_CONTENT_MARKER = '<!-- mandala-std -->';

add_action('admin_post_mandala_content_import', function () {
    if (!current_user_can('manage_options')) wp_die('No autorizado', 403);

    $file = __DIR__ . '/mandala-content-data.json';
    $data = file_exists($file) ? json_decode(file_get_contents($file), true) : null;
    if (empty($data['products'])) wp_die('No se encontró mandala-content-data.json o está vacío.');

    $apply   = !empty($_GET['apply']);
    $restore = !empty($_GET['restore']);

    header('Content-Type: text/plain; charset=UTF-8');
    echo $restore ? "RESTAURANDO ORIGINALES\n\n" : ($apply ? "APLICANDO\n\n" : "VISTA PREVIA (agrega &apply=1 para aplicar)\n\n");

    $done = 0; $skipped = 0; $errors = 0;
    foreach ($data['products'] as $item) {
        $id   = (int) $item['id'];
        $post = get_post($id);
        if (!$post || $post->post_type !== 'product') {
            echo "[ERROR] #$id no es un producto de este sitio\n";
            $errors++;
            continue;
        }

        if ($restore) {
            $backup = get_post_meta($id, '_mandala_desc_backup', true);
            if ($backup === '' || $backup === false) {
                echo "[OMITIDO] #$id {$post->post_title}: sin respaldo\n";
                $skipped++;
                continue;
            }
            wp_update_post(['ID' => $id, 'post_content' => wp_slash($backup)]);
            delete_post_meta($id, '_mandala_desc_backup');
            echo "[RESTAURADO] #$id {$post->post_title}\n";
            $done++;
            continue;
        }

        if (strpos($post->post_content, MANDALA_CONTENT_MARKER) !== false) {
            echo "[OMITIDO] #$id {$post->post_title}: ya importado\n";
            $skipped++;
            continue;
        }

        $addition = "\n" . MANDALA_CONTENT_MARKER . "\n" . $item['html'];
        echo sprintf("[%s] #%d %s (+%d caracteres)\n", $apply ? 'OK' : 'PREVIA', $id, $post->post_title, strlen($addition));
        if ($apply) {
            update_post_meta($id, '_mandala_desc_backup', wp_slash($post->post_content));
            wp_update_post(['ID' => $id, 'post_content' => wp_slash($post->post_content . $addition)]);
        }
        $done++;
    }
    echo "\nProcesados: $done | omitidos: $skipped | errores: $errors\n";
    exit;
});
