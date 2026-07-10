import React, { useEffect, useRef } from 'react';

const TIP_DURATION = 12000; // 12 segundos antes de auto-cerrar

export function TipToast({ tip, onClose }) {
    const timerRef = useRef(null);

    useEffect(() => {
        timerRef.current = setTimeout(onClose, TIP_DURATION);
        return () => clearTimeout(timerRef.current);
    }, [onClose]);

    return (
        <div
            className="tip-toast-card"
            role="status"
            aria-live="polite"
            aria-label="Consejo de SharkReader"
        >
            <div className="tip-toast-header">
                <span className="tip-toast-label">
                    <span style={{ fontSize: 14 }}>🦈</span>
                    <span>¿Sabías que?</span>
                </span>
                <button
                    className="tip-toast-close"
                    onClick={onClose}
                    aria-label="Cerrar consejo"
                >
                    ×
                </button>
            </div>
            <p className="tip-toast-body">{tip.text}</p>
            <div className="tip-toast-bar" />
        </div>
    );
}
