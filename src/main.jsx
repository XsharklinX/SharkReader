import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const hidePreloader = () => {
    if (typeof window !== 'undefined' && typeof window.__hideSharkPreloader === 'function') {
        window.__hideSharkPreloader();
    }
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

requestAnimationFrame(() => {
    requestAnimationFrame(hidePreloader);
});
