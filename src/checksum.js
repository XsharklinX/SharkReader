// SHA-256 de un string, usado para poder "verificar" un backup ZIP: se
// calcula al exportar y se recalcula al importar para detectar corrupción
// del archivo en el camino (descarga interrumpida, USB defectuoso, etc.).
// Usa Web Crypto (disponible tanto en el renderer de Electron como en Node
// moderno) — no añade ninguna dependencia nueva.
export async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}
