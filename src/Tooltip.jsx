import React, { useId } from 'react';

const SIDE_CLASSES = {
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
};

// Tooltip liviano y con tema — reemplaza el `title` nativo del navegador
// (sin estilo, con 1s de retraso fijo) por uno consistente con el resto
// de la UI. No usa JS de posicionamiento: se apoya en CSS + un `group/tooltip`
// con nombre para no chocar con los `group` normales que ya usan las cards.
//
// El texto visual NO basta para accesibilidad: un <span role="tooltip"> no
// forma parte del nombre accesible del botón que envuelve. Por eso, si el
// hijo es un único elemento sin aria-label/aria-labelledby propio, se lo
// clona para inyectárselo (y aria-describedby hacia el propio tooltip), de
// forma que un lector de pantalla anuncie lo mismo que ve un usuario vidente.
export default function Tooltip({ label, children, side = 'bottom', className = '' }) {
    const tooltipId = useId();
    if (!label) return children;

    let content = children;
    if (React.isValidElement(children) && !children.props['aria-label'] && !children.props['aria-labelledby']) {
        content = React.cloneElement(children, {
            'aria-label': typeof label === 'string' ? label : children.props['aria-label'],
            'aria-describedby': [children.props['aria-describedby'], tooltipId].filter(Boolean).join(' '),
        });
    }

    return (
        <span className={`group/tooltip relative inline-flex ${className}`}>
            {content}
            <span
                id={tooltipId}
                role="tooltip"
                className={`pointer-events-none absolute z-[900] whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-bold opacity-0 shadow-lg transition-opacity duration-150 delay-300 group-hover/tooltip:opacity-100 group-hover/tooltip:delay-300 group-focus-within/tooltip:opacity-100 ${SIDE_CLASSES[side] || SIDE_CLASSES.bottom}`}
                style={{ backgroundColor: 'var(--surface-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}>
                {label}
            </span>
        </span>
    );
}
