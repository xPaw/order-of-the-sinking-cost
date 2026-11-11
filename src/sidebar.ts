// The sidebar: the save with its progress, No spoilers and where the hero is, the goals with the areas under
// Completionist, the kinds of mark to find on the map and the save's stats (viewer.md "The page (viewer)")
import { PROG } from './data.ts';
import { $, apolloDate, apolloSeconds, duration, escapeHtml, setButtonPressed } from './util.ts';
import {
    fullChain,
    hooks,
    revealedOf,
    setFullChain,
    setPreference,
    setSpoilersHidden,
    spoilersHidden,
    state,
} from './shared.ts';
import type { ProgressFilters } from './shared.ts';
import { baseName, campaignOf, campaigns, campaignLabel, realFiles, statusEntry } from './files.ts';
import { isFindKind } from './model/find-kinds.ts';
import { RANKS } from './model/progress.ts';
import type { ProgressModel } from './model/progress-model.ts';
import { CHEVRON } from './map/icons.ts';
import { isOverlayKind, overlayOn } from './map/map-html.ts';
import type { DemoStatus, Status } from './status-file.ts';
import { show, showSave } from './view.ts';
import { dirHandle, dropsLive, pickFolder, refresh, savedTitle } from './folder.ts';
import { inLevelHtml, solvedHtml, statsHtml } from './sidebar/summary.ts';
import { goalFolds, pickArea, pickGoal, refreshSideGoals, sideGoalsHtml } from './sidebar/goals.ts';
import { toggleFinished, toggleLayerGroup } from './sidebar/areas.ts';
import { findListShown, overlayActionText, sideFindHtml } from './sidebar/find.ts';
import { findSectionOpen, isGoalOpen, setFindSectionOpen, setOpenGoal } from './sidebar/sections.ts';

/**
 * A fogged level the viewer clicked open stays shown for the rest of the visit; everything naming it is drawn again.
 */
export function revealLevel(level: number): void {
    if (state.camp !== null) revealedOf(state.camp).add(level);

    const model = hooks.side;
    if (!model || !model.progress.hidden[level]) return;

    model.progress.hidden[level] = false;
    hooks.reveal?.();
    renderSide(model);
}

const OPEN_OTHER = '\u0001open';

// the parse errors and warnings of the campaign's files
function fileErrorsHtml(): string {
    return [...state.files.values()]
        .filter((file) => (file.error || file.warning) && campaignOf(file.path) === state.camp)
        .map((file) => {
            let className = 'fwarn';
            if (file.error) className = 'err';
            const message = escapeHtml(file.error || file.warning);
            return `<div class="${className}">${escapeHtml(baseName(file.path))}: ${message}</div>`;
        })
        .join('');
}

// whether a status is a saved one, which tells when it was written; the example's is not
const isSavedStatus = (status: Status | DemoStatus): status is Status => status.savedLo !== undefined;

// rank and play time; the tooltip tells when the save was last written
function saveMetaHtml(status: Status): string {
    const savedTime = apolloDate(status.savedLo, status.savedHi).getTime();
    const rank = escapeHtml(RANKS[status.rank] ?? status.rank);
    const playTime = duration(apolloSeconds(status.playLo, status.playHi));

    const attributes = `id="saveMeta" data-t="${savedTime}" title="${escapeHtml(savedTitle(savedTime))}"`;
    return `<div class="muted meta" ${attributes}>${rank} · ${playTime}</div>`;
}

// the solved bar and the No spoilers switch, with a note when the build has no fog data to hide things by
function progressHtml(model: ProgressModel | null | undefined): string {
    if (!model) return '';

    const spoilTitle =
        'On: levels, areas, towers and achievements still under fog are left out. Off: everything is shown';
    const spoilSwitch = `<button class="spoil" id="pgSpoil" title="${spoilTitle}"><span class="knob"></span>No spoilers</button>`;

    let fogNote = '';
    if (model.noFog) {
        let message = 'This build has no fog data';
        if (PROG.fog) message = 'Fog needs overworld.history';
        let onlyEntered = '';
        if (model.hide) onlyEntered = '; only entered levels are shown';
        fogNote = `<div class="muted">${message}${onlyEntered}</div>`;
    }

    const chainTitle = 'A selected level draws its whole need chain to the hub, not its direct links';
    const chainAttributes = `class="spoil" id="pgChain" title="${chainTitle}"`;
    const chainSwitch = `<button ${chainAttributes}><span class="knob"></span>Full chain</button>`;

    return `${solvedHtml(model)}${spoilSwitch}${chainSwitch}${fogNote}`;
}

// the campaign block: the example's note, or the campaign list with the refresh button and the save's summary
function campaignHtml(model: ProgressModel | null | undefined, campaignList: string[]): string {
    const entry = state.camp === null ? undefined : statusEntry(state.camp);
    const status = entry?.parsed;
    const errors = fileErrorsHtml();
    const progress = progressHtml(model);

    // with saves open the campaign list takes the open button's place; its last entry opens another folder
    const opened = realFiles().length > 0;
    if (!opened) {
        const note = '<div class="muted meta">Example: a new game</div>';
        return `<div class="camp empty">${note}${progress}${inLevelHtml()}</div>${errors}`;
    }

    // a connected folder gets the refresh button, its dot showing the folder is watched
    let live = '';
    if (dirHandle) {
        const folderName = escapeHtml(dirHandle.name);
        const watched = '(it is re-read every few seconds while this page is visible)';
        const title = `Re-read the save folder “${folderName}” ${watched}`;
        const attributes = `id="refreshBtn" class="plain live" title="${title}" aria-label="Re-read the save folder"`;
        live = `<button ${attributes}><span class="dot"></span>↻</button>`;
    }

    // saves read once say so, and how to make them live
    if (!dirHandle) {
        let howToKeepLive = '';
        if (dropsLive) howToKeepLive = ' · drop the folder here to keep it live';

        const title = `These files were read once; new progress shows after the folder is opened again${howToKeepLive}`;
        live = `<span class="muted snap" title="${title}">snapshot</span>`;
    }

    let meta = '';
    if (status && isSavedStatus(status) && !entry?.demo) meta = saveMetaHtml(status);

    const inLevel = inLevelHtml(status, model);
    const campaign = `<div class="cr">${campaignPickerHtml(campaignList)}${live}</div>`;
    return `<div class="camp">${campaign}${meta}${progress}${inLevel}</div>${errors}`;
}

// the campaign's name as a quiet button that opens the menu of campaigns, whose last entry opens another folder
function campaignPickerHtml(campaignList: string[]): string {
    const items = campaignList
        .map((camp) => {
            let current = '';
            if (camp === state.camp) current = ' aria-current="true"';
            return `<button class="plain"${current} role="menuitem" data-camp="${escapeHtml(camp)}">${escapeHtml(campaignLabel(camp))}</button>`;
        })
        .join('');

    const openOther = `<button class="plain" role="menuitem" data-camp="${OPEN_OTHER}">Open another folder…</button>`;
    const menu = `<div class="cmenu" id="campMenu" role="menu" hidden>${items}<hr>${openOther}</div>`;

    const name = escapeHtml(campaignLabel(state.camp ?? ''));
    const attributes = 'id="campBtn" aria-haspopup="menu" aria-expanded="false" title="Switch campaign"';
    const button = `<button class="plain" ${attributes}><span class="n">${name}</span>${CHEVRON}</button>`;
    return `<div class="cpick">${button}${menu}</div>`;
}

function setCampaignMenuOpen(open: boolean): void {
    const button = $('#campBtn');
    const menu = $('#campMenu');
    if (!button || !menu) return;

    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
}

function onCampaignMenuClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const item = target.closest<HTMLElement>('[data-camp]');
    if (!item) return;

    setCampaignMenuOpen(false);
    const camp = item.dataset.camp ?? '';
    if (camp === OPEN_OTHER) {
        void pickFolder();
        return;
    }

    if (camp === state.camp) return;

    state.camp = camp;
    state.campPicked = true;
    void showSave('Working out your save…');
}

// a click anywhere else, or Escape, closes the campaign menu
document.addEventListener('click', (event) => {
    if (event.target instanceof Element && !event.target.closest('.cpick')) setCampaignMenuOpen(false);
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || $('#campMenu')?.hidden !== false) return;

    // the key is spent on the menu: the page's other Escape handlers see it as handled
    event.preventDefault();
    setCampaignMenuOpen(false);
});

// the section of the kinds of mark to find, with the class of an open one
function findSectionHtml(model: ProgressModel): string {
    const rows = sideFindHtml(model);
    if (!rows) return '';

    let openClass = '';
    if (findSectionOpen()) openClass = ' open';
    return `<div class="np find${openClass}" id="sideFind">${rows}</div>`;
}

// the panels under the campaign: the goals with the areas under Completionist, the kinds of mark to find and the stats
function panelsHtml(model: ProgressModel): string {
    let html = `<div class="np goals" id="sideGoals">${sideGoalsHtml(model)}</div>`;
    html += findSectionHtml(model);

    if (!model.demo) html += statsHtml(model);
    return html;
}

function onStatsToggle(event: Event): void {
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) return;

    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));

    $('#statsRows').hidden = !open;
    $('#sideStats').classList.toggle('open', open);
    setPreference('statsOpen', open ? '1' : '0');
}

// a change of the open sections (see sections.ts) draws the sections again
function refreshSections(): void {
    refreshSideGoals();
    refreshSideFind();
}

function onGoalsClick(event: Event, model: ProgressModel): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const group = target.closest<HTMLElement>('[data-grp]');
    if (group) {
        const layerKey = group.dataset.grp ?? '';
        toggleLayerGroup(layerKey);
        refreshSideGoals();
        $(`#sideGoals [data-grp="${layerKey}"]`)?.focus({ preventScroll: true });
        return;
    }

    const finished = target.closest<HTMLElement>('[data-fin]');
    if (finished) {
        toggleFinished();
        refreshSideGoals();
        $(`#sideGoals [data-fin="${finished.dataset.fin}"]`)?.focus({ preventScroll: true });
        return;
    }

    const area = target.closest<HTMLElement>('[data-area]');
    if (area) {
        pickArea(model, area.dataset.area ?? '');
        return;
    }

    const goalKey = target.closest<HTMLElement>('[data-goal]')?.dataset.goal;
    if (goalKey === undefined) return;

    // a goal that folds opens its list, and closes it when it was the pick and its list was open
    const goal = model.goalByKey(goalKey);
    if (goal && goalFolds(model, goal)) {
        const wasPicked = model.goalFor(model.F.goal)?.key === goalKey;
        if (!isGoalOpen(goalKey)) {
            setOpenGoal(goalKey);
            refreshSections();
        } else if (wasPicked) {
            setOpenGoal(null);
            refreshSections();
        }
    }

    pickGoal(model, goalKey);
}

function onFindClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('[data-fold]')) {
        setFindSectionOpen(!findSectionOpen());
        refreshSections();
        $('#sideFind [data-fold]')?.focus({ preventScroll: true });
        return;
    }

    const overlayKind = target.closest<HTMLElement>('[data-overlay]')?.dataset.overlay;
    if (overlayKind !== undefined && isOverlayKind(overlayKind)) {
        hooks.overlay?.(overlayKind);
        return;
    }

    const findKind = target.closest<HTMLElement>('[data-find]')?.dataset.find;
    if (findKind !== undefined && isFindKind(findKind)) hooks.find?.(findKind);
}

export function renderSide(model?: ProgressModel | null): void {
    const side = $('#sidePanels');
    const campaignList = campaigns();
    if (!campaignList.length) {
        side.innerHTML = '';
        $('#sideCamp').innerHTML = '';
        $('#sidebar .btns').style.display = '';
        return;
    }

    // the example view has the banner's own open button
    $('#sidebar .btns').style.display = 'none';
    $('#sideCamp').innerHTML = campaignHtml(model, campaignList);

    let html = '';
    if (model) html = panelsHtml(model);
    side.innerHTML = html;

    $('#campBtn')?.addEventListener('click', () => setCampaignMenuOpen($('#campMenu').hidden === true));
    $('#campMenu')?.addEventListener('click', onCampaignMenuClick);
    $('#refreshBtn')?.addEventListener('click', () => void refresh(true));
    if (!model) return;

    const inLevel = model.inLevel;
    $('#inLevel')?.addEventListener('click', () => {
        if (inLevel !== null) hooks.open?.(inLevel);
    });

    $('#heroLine')?.addEventListener('click', () => hooks.hero?.());

    const filters = model.F;
    hooks.side = model;
    setButtonPressed($('#pgSpoil'), model.hide);
    $('#pgSpoil').addEventListener('click', () => {
        setSpoilersHidden(!spoilersHidden);
        setPreference('hideSpoilers', spoilersHidden ? '1' : '0');
        show();
    });

    setButtonPressed($('#pgChain'), fullChain);
    $('#pgChain').addEventListener('click', () => {
        setFullChain(!fullChain);
        setPreference('fullChain', fullChain ? '1' : '0');
        show();
    });

    $('#statsTog')?.addEventListener('click', onStatsToggle);
    $('#sideGoals').addEventListener('click', (event) => onGoalsClick(event, model));
    $('#sideFind')?.addEventListener('click', onFindClick);
    syncSide(filters);
}

/** Draws Find on the map again, with the controls showing the filters. */
export function refreshSideFind(): void {
    const element = $('#sideFind');
    if (!element || !hooks.side) return;

    element.innerHTML = sideFindHtml(hooks.side);
    element.classList.toggle('open', findSectionOpen());
    syncSide(hooks.side.F);
}

/**
 * The page's controls show the filters and switches: the search text, the Find on the map rows (the kinds shown on the
 * map, the one listed) and the picked area.
 */
export function syncSide(filters: ProgressFilters): void {
    const search = $('#fQ');
    if (document.activeElement !== search && search instanceof HTMLInputElement) search.value = filters.q;

    $('#sidebar')
        .querySelectorAll<HTMLElement>('[data-overlay]')
        .forEach((button) => {
            const kind = button.dataset.overlay;
            if (kind === undefined || !isOverlayKind(kind)) return;

            setButtonPressed(button, overlayOn[kind]);
            button.closest('.sr')?.classList.toggle('on', overlayOn[kind]);
            if (isFindKind(kind)) {
                const action = overlayActionText(kind, overlayOn[kind]);
                button.setAttribute('aria-label', action);
                button.title = action;
            }
        });
    $('#sidebar')
        .querySelectorAll<HTMLElement>('[data-find]')
        .forEach((button) => setButtonPressed(button, findListShown(filters, button.dataset.find ?? '')));
    $('#sideGoals')
        ?.querySelectorAll<HTMLElement>('[data-area]')
        .forEach((area) => setButtonPressed(area, area.dataset.area === filters.area));
}
