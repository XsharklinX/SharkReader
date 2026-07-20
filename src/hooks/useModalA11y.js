import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
    'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

// Comportamiento mínimo de accesibilidad que todo modal debería tener:
// cerrar con Escape, atrapar el Tab dentro del propio diálogo, foco inicial
// al abrir y devolver el foco a quien lo abrió al cerrar. Antes de esto,
// ningún modal del proyecto excepto CommandPalette tenía Escape ni foco
// atrapado — Tab se escapaba al contenido de detrás.
//
// Uso: const dialogRef = useModalA11y(open, onClose);
//      <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
export function useModalA11y(open, onClose) {
    const containerRef = useRef(null);
    const previousFocusRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;

        previousFocusRef.current = document.activeElement;
        const container = containerRef.current;
        const focusInitial = () => {
            const target = container?.querySelector('[data-autofocus]') || container?.querySelector(FOCUSABLE_SELECTOR) || container;
            target?.focus?.();
        };
        // Espera un frame: el propio contenedor puede montarse recién ahora.
        const raf = requestAnimationFrame(focusInitial);

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose?.();
                return;
            }
            if (e.key !== 'Tab' || !container) return;
            const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => el.offsetParent !== null);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown, true);

        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener('keydown', onKeyDown, true);
            const toRestore = previousFocusRef.current;
            if (toRestore && typeof toRestore.focus === 'function') toRestore.focus();
        };
    }, [open, onClose]);

    return containerRef;
}
