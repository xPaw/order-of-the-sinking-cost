// The page's entry (VIEWER.md "The page (viewer)"): loads the folder and page modules and wires the page-wide keys and
// clicks
import './folder.ts';
import './page.ts';
import { state } from './shared.ts';
import { addFiles, campaigns } from './files.ts';
import { activeMap } from './map/map-view.ts';
import { revealLevel } from './sidebar.ts';

// a fogged chip's first click reveals its level (and eats the click); the redrawn chip then works like any other
document.addEventListener(
    'click',
    (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const fogged = target.closest<HTMLElement>('.spoiler');
        if (!fogged) return;

        event.preventDefault();
        event.stopPropagation();
        const level = fogged.dataset.goto ?? fogged.dataset.pick;
        if (level != null) revealLevel(Number(level));
    },
    true,
);

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && event.defaultPrevented) return;

    // Escape closes the About dialog and leaves the map as it is
    if (event.key === 'Escape' && document.querySelector('#about[open]')) return;

    if (event.key === 'Escape' && activeMap?.open) {
        activeMap.select(null);
        return;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (event.key === 'Escape' && activeMap && !target?.closest('input, select')) activeMap.reset();
    if ((event.key === 'Enter' || event.key === ' ') && target?.matches('[role=button]:not(button)')) {
        event.preventDefault();
        if (target instanceof HTMLElement) target.click();
    }
});

// for the console and test pages
Object.assign(window, { addFiles, campaigns, state });
