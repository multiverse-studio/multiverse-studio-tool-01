// Interface Scaling - scales entire UI to fit viewport

function scaleInterface() {
    const container = document.querySelector('.scalable-container');
    if (!container) return;

    const designHeight = 1080;
    const viewportHeight = document.documentElement.clientHeight;
    const viewportWidth = document.documentElement.clientWidth;

    const scale = viewportHeight / designHeight;

    container.style.transform = `scale(${scale})`;
    container.style.transformOrigin = 'top left';
    container.style.width = `${(viewportWidth / scale) + 2}px`;
}

window.addEventListener('load', scaleInterface);
window.addEventListener('resize', scaleInterface);
