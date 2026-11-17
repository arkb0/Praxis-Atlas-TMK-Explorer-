/**
 * Deterministic force layout for the skill graph.
 *
 * Force-link clusters are anchored by entity kind, so tasks sit on the right,
 * methods in the middle and knowledge on the outside. Once the simulation has
 * ticked, positions are normalised into the SVG viewBox. The simulation is
 * stopped before returning, which keeps rendering pure and cheap.
 */

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import type { AtlasEntity, AtlasEdge } from './atlas';
import type { EntityKind } from '../types/tmk';

export interface Point {
  x: number;
  y: number;
}

export const LAYOUT_WIDTH = 980;
export const LAYOUT_HEIGHT = 640;

const ITERATIONS = 420;
const PADDING = 58;

const ANCHORS: Record<EntityKind, { x: number; y: number }> = {
  task: { x: 0.78, y: 0.4 },
  method: { x: 0.53, y: 0.34 },
  concept: { x: 0.25, y: 0.32 },
  instance: { x: 0.3, y: 0.73 },
};

const NODE_RADIUS: Record<EntityKind, number> = {
  task: 25,
  method: 23,
  concept: 20,
  instance: 16,
};

/** Portrait phones need larger nodes to keep labels legible. */
export const COMPACT_BREAKPOINT = 700;

const EDGE_DISTANCE: Record<EntityKind, number> = {
  task: 150,
  method: 135,
  concept: 128,
  instance: 92,
};

interface SimNode extends AtlasEntity, SimulationNodeDatum {
  radius: number;
}

type SimLink = SimulationLinkDatum<SimNode>;

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Radius used for hit targets, collision and edge clipping. */
export function radiusFor(kind: EntityKind, portrait = false): number {
  return NODE_RADIUS[kind] * (portrait ? 1.4 : 1);
}

export interface LayoutSize {
  width: number;
  height: number;
}

/**
 * Choose a portrait or landscape virtual canvas from the measured container
 * aspect ratio. A narrow phone gets a taller graph rather than a letterboxed
 * landscape drawing.
 */
export function layoutSizeFor(containerWidth: number, containerHeight: number): LayoutSize {
  const aspect = containerWidth > 0 && containerHeight > 0 ? containerHeight / containerWidth : 0.7;
  return aspect > 1
    ? { width: 640, height: 860 }
    : { width: LAYOUT_WIDTH, height: LAYOUT_HEIGHT };
}

/**
 * Compute a stable position for every entity.
 *
 * Passing the same atlas with the same links always yields the same map.
 */
export function computeLayout(
  entities: AtlasEntity[],
  edges: AtlasEdge[],
  size: LayoutSize = { width: LAYOUT_WIDTH, height: LAYOUT_HEIGHT },
): Map<string, Point> {
  const { width, height } = size;
  const portrait = width < COMPACT_BREAKPOINT;
  const random = mulberry32(20260901);
  const nodes: SimNode[] = entities.map((entity) => {
    const anchor = ANCHORS[entity.kind];
    return {
      ...entity,
      radius: radiusFor(entity.kind, portrait),
      x: anchor.x * width + (random() - 0.5) * 130,
      y: anchor.y * height + (random() - 0.5) * 130,
    };
  });

  const idToKind = new Map(nodes.map((node) => [node.id, node.kind]));
  const links: SimLink[] = edges.map((edge) => ({
    source: edge.sourceId,
    target: edge.targetId,
  }));

  const simulation = forceSimulation<SimNode>(nodes)
    .randomSource(mulberry32(7))
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((node) => node.id)
        .distance((link) => {
          const targetId =
            typeof link.target === 'string' ? link.target : (link.target as SimNode).id;
          const kind = idToKind.get(targetId) ?? 'concept';
          return EDGE_DISTANCE[kind] * (portrait ? 0.92 : 1);
        })
        .strength(0.22),
    )
    .force('charge', forceManyBody<SimNode>().strength(-480).distanceMax(420))
    .force(
      'collide',
      forceCollide<SimNode>()
        .radius((node) => node.radius + (portrait ? 42 : 34))
        .strength(0.95)
        .iterations(3),
    )
    .force(
      'x',
      forceX<SimNode>((node) => ANCHORS[node.kind].x * width).strength(0.075),
    )
    .force(
      'y',
      forceY<SimNode>((node) => ANCHORS[node.kind].y * height).strength(0.075),
    )
    .stop();

  for (let tick = 0; tick < ITERATIONS; tick += 1) {
    simulation.tick();
  }

  // Normalise to the padded viewBox so every imported model uses the space.
  const xs = nodes.map((node) => node.x ?? width / 2);
  const ys = nodes.map((node) => node.y ?? height / 2);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min(
    (width - PADDING * 2) / spanX,
    (height - PADDING * 2) / spanY,
    portrait ? 1.6 : 1.35,
  );
  const offsetX = (width - spanX * scale) / 2 - minX * scale;
  const offsetY = (height - spanY * scale) / 2 - minY * scale;

  const positions = new Map<string, Point>();
  for (const node of nodes) {
    positions.set(node.id, {
      x: (node.x ?? 0) * scale + offsetX,
      y: (node.y ?? 0) * scale + offsetY,
    });
  }
  return positions;
}

/**
 * A quadratic curve between two positioned nodes, clipped at the node edge.
 * The slight bend keeps reciprocal references from sitting on top of one
 * another and gives the graph a hand-drawn quality.
 */
export function edgePath(
  from: Point,
  to: Point,
  fromRadius: number,
  toRadius: number,
  bend = 0.14,
): { path: string; mid: Point } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const ux = dx / distance;
  const uy = dy / distance;
  const start = { x: from.x + ux * (fromRadius + 5), y: from.y + uy * (fromRadius + 5) };
  const end = { x: to.x - ux * (toRadius + 9), y: to.y - uy * (toRadius + 9) };
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const control = {
    x: mid.x - (end.y - start.y) * bend,
    y: mid.y + (end.x - start.x) * bend,
  };
  return {
    path: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
    mid: {
      x: (start.x + 2 * control.x + end.x) / 4,
      y: (start.y + 2 * control.y + end.y) / 4,
    },
  };
}

const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g;

function wordsFor(name: string): string[] {
  return name
    .replace(/-/g, ' ')
    .replace(CAMEL_BOUNDARY, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Wrap a name into at most two short graph-label lines. The full, exact name
 * is always available in the inspector and tooltip.
 */
export function labelLines(name: string, maxChars = 15): string[] {
  const words = wordsFor(name);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= 2) return lines;
  return [lines[0], `${lines.slice(1).join(' ').slice(0, maxChars - 1)}...`];
}
