window.__hideSharkPreloader = function () {
    const loader = document.getElementById('shark-preloader');
    if (!loader || loader.dataset.hidden === 'true') return;
    loader.dataset.hidden = 'true';
    loader.style.opacity = '0';
    setTimeout(() => {
        loader.style.visibility = 'hidden';
        loader.style.pointerEvents = 'none';
        loader.style.display = 'none';
        if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 140);
};
window.addEventListener('error', () => window.__hideSharkPreloader());
setTimeout(() => window.__hideSharkPreloader(), 1200);
