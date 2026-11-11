// Unlock plans: what is still to do before a level, Freezer, tower or sign opens up (viewer.md "Planning")
import type { BaseProgress } from './progress.ts';
import { requirementGraph } from './requirements.ts';
import type { Graph, PlanStep } from './requirements.ts';

/** The cheapest plan of every requirement of a campaign's graph; `steps` and `chosen` are null for one with no plan. */
export interface Plans {
    G: Graph;
    /** Per requirement, the parts its plan took. */
    chosen: Array<number[] | null>;
    /** Per requirement, the requirements with a step in its plan. */
    steps: Array<Set<number> | null>;
    /** Per requirement, the order it was settled in, -1 when it has no plan. */
    settled: Int32Array;
    /** Per requirement, the requirements that list it as a part. */
    parents: number[][];
}

/** A progress that may carry its plans already. */
export type PlanSource = BaseProgress & { plans?: Plans | undefined };

// A min-heap of [weight, id] pairs
class Heap {
    items: Array<[weight: number, id: number]> = [];

    get size(): number {
        return this.items.length;
    }

    push(weight: number, id: number): void {
        const items = this.items;
        items.push([weight, id]);

        let position = items.length - 1;

        while (position > 0) {
            const parent = (position - 1) >> 1;
            if (items[parent][0] <= weight) break;
            this.swap(parent, position);
            position = parent;
        }
    }

    pop(): [weight: number, id: number] {
        const items = this.items;
        const top = items[0];
        const last = items.pop()!;
        if (items.length) {
            items[0] = last;

            let position = 0;
            for (;;) {
                const left = 2 * position + 1;
                const right = left + 1;
                let smallest = position;
                if (left < items.length && items[left][0] < items[smallest][0]) smallest = left;
                if (right < items.length && items[right][0] < items[smallest][0]) smallest = right;
                if (smallest === position) break;
                this.swap(smallest, position);
                position = smallest;
            }
        }

        return top;
    }

    private swap(first: number, second: number): void {
        const held = this.items[first];
        this.items[first] = this.items[second];
        this.items[second] = held;
    }
}

/**
 * Every requirement's cheapest plan, worked out once for all of them (a Knuth-style shortest path over the AND/OR
 * graph): a plan's weight is its number of steps, then the levels in it the walk cannot reach yet. Requirements are
 * settled cheapest first; one gets a plan only from parts already settled, so a plan never runs through itself. An OR
 * takes its first settled part (the cheapest), a k of n its first k, an AND waits for all its parts. A plan is never
 * cheaper than a part of it, which keeps the order. A requirement left unsettled has no plan (its parts run in a cycle
 * or have none); one that may be a step of its own (a level no way-in gate leads into) becomes one at the end, and the
 * settling goes on from it.
 */
export function planAll(progress: BaseProgress): Plans {
    const graph = requirementGraph(progress);
    const nodeCount = graph.keys.length;
    const blocked = (id: number) => {
        const node = graph.node[id];
        return node?.t === 'l' && progress.state[node.id] === 'blocked';
    };

    const parents = Array.from({ length: nodeCount }, (): number[] => []);
    const waiting = new Int32Array(nodeCount);
    const chosen = Array.from({ length: nodeCount }, (): number[] | null => null);
    const steps = Array.from({ length: nodeCount }, (): Set<number> | null => null);
    const settled = new Int32Array(nodeCount).fill(-1);
    let order = 0;
    const heap = new Heap();

    // the plan of a requirement from the parts it took: the union of their steps, and itself when it is a step
    const offer = (id: number, parts: number[]) => {
        const planSteps = new Set<number>();
        let blockedCount = 0;
        for (const part of parts) {
            for (const step of steps[part]!) {
                if (planSteps.has(step)) continue;
                planSteps.add(step);
                if (blocked(step)) blockedCount++;
            }
        }
        if (graph.node[id] && !planSteps.has(id)) {
            planSteps.add(id);
            if (blocked(id)) blockedCount++;
        }
        chosen[id] = parts;
        steps[id] = planSteps;
        heap.push(planSteps.size * 1e4 + blockedCount, id);
    };

    for (let id = 0; id < nodeCount; id++) {
        if (graph.met[id]) {
            settled[id] = order++;
            steps[id] = new Set();
            chosen[id] = [];
            continue;
        }
        const parts = graph.parts[id];
        for (const part of parts) parents[part].push(id);
        if (graph.kind[id] === 'or') {
            waiting[id] = 1;
        } else if (graph.kind[id] === 'k') {
            waiting[id] = Math.min(graph.k[id], parts.length);
        } else {
            waiting[id] = parts.length;
        }
    }

    // the requirements whose parts are settled already (met ones), parts settled in id order
    const taken = Array.from({ length: nodeCount }, (): number[] => []);
    const partSettled = (part: number) => {
        for (const id of parents[part]) {
            if (settled[id] >= 0 || waiting[id] <= 0) continue;
            taken[id].push(part);
            waiting[id]--;
            if (waiting[id] === 0) offer(id, taken[id]);
        }
    };

    for (let id = 0; id < nodeCount; id++) {
        if (settled[id] < 0 && waiting[id] === 0) offer(id, []);
    }

    for (let id = 0; id < nodeCount; id++) {
        if (graph.met[id]) partSettled(id);
    }

    // each requirement is offered once, when its parts are settled
    const settle = () => {
        while (heap.size) {
            const id = heap.pop()[1];
            // a late step of its own can be offered again from a part settled before it
            if (settled[id] >= 0) continue;
            settled[id] = order++;
            partSettled(id);
        }
    };

    settle();

    for (;;) {
        const late: number[] = [];
        for (let id = 0; id < nodeCount; id++) {
            if (settled[id] < 0 && graph.fallback[id] && chosen[id] === null) late.push(id);
        }
        if (!late.length) break;
        for (const id of late) offer(id, []);
        settle();
    }

    return { G: graph, chosen, steps, settled, parents };
}

/** What a level, Freezer, sign or tower still needs: its steps by key and the edges [a, b] where a comes before b. */
export interface UnlockPlan {
    nodes: Map<string, PlanStep>;
    edges: Array<[before: string, after: string]>;
    rootKey: string;
    steps: number;
}

const EMPTY_PLAN: Omit<UnlockPlan, 'rootKey'> = { nodes: new Map(), edges: [], steps: 0 };

/**
 * The plan of a level, Freezer, sign or tower (root [kind, index]) as nodes and edges: an edge [a, b] means a comes
 * before b. null when it has none.
 */
export function unlockPlan(
    progress: PlanSource,
    root: [kind: 'level' | 'gate' | 'sign' | 'tower', index: number],
): UnlockPlan | null {
    const plans = progress.plans || planAll(progress);
    const { G: graph, chosen, steps, settled } = plans;
    const prefix = { level: 'l', gate: 'g', sign: 's', tower: 't' }[root[0]];
    const rootKey = prefix + root[1];
    const id = graph.index.get(rootKey);
    if (id === undefined || settled[id] < 0) return null;
    if (graph.met[id]) return { ...EMPTY_PLAN, rootKey };

    const ids = [...steps[id]!].toSorted((first, second) => settled[first] - settled[second]);
    const nodes = new Map(ids.map((step): [string, PlanStep] => [graph.keys[step], graph.node[step]!]));

    // a step comes after the steps its parts lead with: a part's own step, or the steps a part with none took
    const heads = (part: number, out: number[]): number[] => {
        if (graph.met[part]) return out;
        if (graph.node[part]) {
            out.push(part);
            return out;
        }

        for (const taken of chosen[part]!) heads(taken, out);
        return out;
    };

    const edges: Array<[string, string]> = [];
    const seen = new Set<string>();

    for (const step of ids) {
        for (const part of chosen[step]!) {
            for (const head of heads(part, [])) {
                const edge = graph.keys[head] + '>' + graph.keys[step];
                if (seen.has(edge)) continue;
                seen.add(edge);
                edges.push([graph.keys[head], graph.keys[step]]);
            }
        }
    }

    const stepCount = nodes.has(rootKey) ? nodes.size - 1 : nodes.size;
    return { nodes, edges, rootKey, steps: stepCount };
}
