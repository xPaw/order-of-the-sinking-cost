// The page's redraw. page.ts gives it the drawing; the modules page.ts draws (the save files, the folder, the
// sidebar) call show() without importing page.ts (viewer.md "The page (viewer)").

/** How page.ts draws: the redraw, whether a redraw now is quick, and the note shown while a slow one waits. */
export interface PageDrawing {
    draw: () => void;
    quick: () => boolean;
    note: (text: string | null) => void;
}

let drawing: PageDrawing | null = null;
let waiting: Promise<void> | null = null;

export function setPageDrawing(pageDrawing: PageDrawing): void {
    drawing = pageDrawing;
}

export function show(): void {
    drawing?.draw();
}

// a page the browser does not paint (a background tab, a hidden frame) runs no animation frames
const PAINT_WAIT_MS = 100;

// resolves once the browser has painted, or after a short wait where it paints nothing
function afterPaint(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => setTimeout(resolve, 0));
        setTimeout(resolve, PAINT_WAIT_MS);
    });
}

async function drawAfterPaint(): Promise<void> {
    await afterPaint();

    try {
        show();
    } finally {
        waiting = null;
        drawing?.note(null);
    }
}

/**
 * Redraws the page for a new or changed save. Working out a save holds up the page for a moment, so a slow redraw
 * waits until the note saying so is painted; a call while one waits joins it.
 */
export function showSave(note: string): Promise<void> {
    if (waiting) return waiting;

    if (!drawing || drawing.quick()) {
        show();
        return Promise.resolve();
    }

    drawing.note(note);
    waiting = drawAfterPaint();
    return waiting;
}
