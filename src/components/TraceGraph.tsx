/**
 * Compact TMK graph for one Ivy trace.
 *
 * The graph receives an already filtered `TraceGraph`: trace items first, and
 * optionally their direct in/out neighbours. Trace nodes are pinned on an
 * inner ring; neighbours settle around them with a short force simulation.
 * Nothing here traverses beyond the supplied edges.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { cn } from '@/utils/cn';
import { KIND_META } from '@/lib/kinds';
import { labelLines, edgePath } from '@/lib/layout';
import type { EntityKind } from '@/types/tmk';
import type { TraceGraph as TraceGraphData, TraceNode, TraceNodeKind } from '@/lib/traces';
import Icon from './Icon';

/** Which lineage an edge belongs to, used only for the legend. */
export type TraceEdgeOrigin = 'trace' | 'model';

interface TraceGraphProps {
  graph: TraceGraphData;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

const WIDTH = 760;
const HEIGHT = 610;
const MIN_WIDTH = 300;
const MAX_WIDTH = 1700;

const ENTITY_KIND: Record<TraceNodeKind, EntityKind> = {
  task: 'task',
  method: 'method',
  concept: 'concept',
  operation: 'instance',
  unknown: 'instance',
};

const NODE_RADIUS: Record<'trace' | 'out' | 'in', number> = {
  trace: 26,
  out: 20,
  in: 20,
};

interface SimNode extends TraceNode, SimulationNodeDatum {
  radius: number;
  role: 'trace' | 'out' | 'in' | 'both';
}

type SimLink = SimulationLinkDatum<SimNode>;

function roleFor(node: TraceNode): 'trace' | 'out' | 'in' | 'both' {
  if (node.inTrace) return 'trace';
  if (node.outgoing && node.incoming) return 'both';
  return node.outgoing ? 'out' : 'in';
}

interface Camera {
  x: number;
  y: number;
  w: number;
  h: number;
}

const INITIAL_CAMERA: Camera = { x: 0, y: 0, w: WIDTH, h: HEIGHT };

function clamp(camera: Camera): Camera {
  return {
    ...camera,
    x: Math.min(Math.max(camera.x, -camera.w * 0.2), WIDTH - camera.w * 0.8),
    y: Math.min(Math.max(camera.y, -camera.h * 0.2), HEIGHT - camera.h * 0.8),
  };
}

function layout(graph: TraceGraphData): Map<string, { x: number; y: number }> {
  const traceNodes = graph.nodes.filter((node) => node.inTrace);
  const centreX = WIDTH / 2;
  const centreY = HEIGHT / 2;
  const ring = Math.min(150, Math.max(62, traceNodes.length * 26));

  const nodes: SimNode[] = graph.nodes.map((node, index) => {
    const role = roleFor(node);
    const traceIndex = traceNodes.findIndex((item) => item.id === node.id);
    const angle = -Math.PI / 2 + (traceIndex / Math.max(traceNodes.length, 1)) * Math.PI * 2;
    const neighbourAngle = (index / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
    const radius = role === 'trace' ? NODE_RADIUS.trace : NODE_RADIUS.out;
    return {
      ...node,
      radius,
      role,
      fx: role === 'trace' ? centreX + Math.cos(angle) * ring : undefined,
      fy: role === 'trace' ? centreY + Math.sin(angle) * ring : undefined,
      x:
        role === 'trace'
          ? centreX + Math.cos(angle) * ring
          : centreX + Math.cos(neighbourAngle) * Math.min(WIDTH, HEIGHT) * 0.44,
      y:
        role === 'trace'
          ? centreY + Math.sin(angle) * ring
          : centreY + Math.sin(neighbourAngle) * Math.min(WIDTH, HEIGHT) * 0.44,
    };
  });

  const links: SimLink[] = graph.edges.map((edge) => ({
    source: edge.sourceId,
    target: edge.targetId,
  }));

  if (nodes.length > 0) {
    const simulation = forceSimulation<SimNode>(nodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((node) => node.id)
          .distance((link) => {
            const target = link.target as SimNode;
            return target.role === 'trace' ? 132 : 150;
          })
          .strength(0.25),
      )
      .force('charge', forceManyBody<SimNode>().strength(-420).distanceMax(400))
      .force(
        'collide',
        forceCollide<SimNode>()
          .radius((node) => node.radius + 34)
          .strength(0.95)
          .iterations(3),
      )
      .force('center', forceCenter(centreX, centreY))
      .force('x', forceX<SimNode>(centreX).strength(0.055))
      .force('y', forceY<SimNode>(centreY).strength(0.055))
      .stop();

    for (let tick = 0; tick < 360; tick += 1) simulation.tick();

    const xs = nodes.map((node) => node.x ?? centreX);
    const ys = nodes.map((node) => node.y ?? centreY);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const padding = 66;
    const scale = Math.min((WIDTH - padding * 2) / spanX, (HEIGHT - padding * 2) / spanY, 1.6);
    const offsetX = (WIDTH - spanX * scale) / 2 - minX * scale;
    const offsetY = (HEIGHT - spanY * scale) / 2 - minY * scale;
    const positions = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      positions.set(node.id, {
        x: (node.x ?? 0) * scale + offsetX,
        y: (node.y ?? 0) * scale + offsetY,
      });
    }
    return positions;
  }
  return new Map();
}

export default function TraceGraph({
  graph,
  selectedId,
  onSelect,
  className,
}: TraceGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ clientX: number; clientY: number; camera: Camera } | null>(null);
  const [camera, setCamera] = useState<Camera>(INITIAL_CAMERA);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ node: TraceNode; x: number; y: number } | null>(null);

  const positions = useMemo(() => layout(graph), [graph]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);

  const focusId = hoveredId ?? selectedId;
  const focusNeighbours = useMemo(() => {
    if (!focusId) return null;
    const ids = new Set<string>([focusId]);
    for (const edge of graph.edges) {
      if (edge.sourceId === focusId) ids.add(edge.targetId);
      if (edge.targetId === focusId) ids.add(edge.sourceId);
    }
    return ids;
  }, [graph.edges, focusId]);

  const incident = useMemo(
    () => new Set(graph.edges.filter((edge) => edge.sourceId === focusId || edge.targetId === focusId).map((edge) => edge.id)),
    [focusId, graph.edges],
  );

  useEffect(() => {
    setCamera(INITIAL_CAMERA);
  }, [graph.nodes.length]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const scale = Math.min(rect.width / camera.w, rect.height / camera.h);
      const offsetX = (rect.width - camera.w * scale) / 2;
      const offsetY = (rect.height - camera.h * scale) / 2;
      const point = {
        x: camera.x + (event.clientX - rect.left - offsetX) / scale,
        y: camera.y + (event.clientY - rect.top - offsetY) / scale,
      };
      setCamera((current) => {
        const nextWidth = Math.min(Math.max(current.w * (event.deltaY < 0 ? 0.88 : 1.14), MIN_WIDTH), MAX_WIDTH);
        const ratio = nextWidth / current.w;
        return clamp({
          x: point.x - (point.x - current.x) * ratio,
          y: point.y - (point.y - current.y) * ratio,
          w: nextWidth,
          h: current.h * ratio,
        });
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [camera]);

  function zoom(factor: number) {
    setCamera((current) => {
      const nextWidth = Math.min(Math.max(current.w * factor, MIN_WIDTH), MAX_WIDTH);
      const ratio = nextWidth / current.w;
      return clamp({
        x: current.x + (current.w - nextWidth) / 2,
        y: current.y + (current.h - current.h * ratio) / 2,
        w: nextWidth,
        h: current.h * ratio,
      });
    });
  }

  function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { clientX: event.clientX, clientY: event.clientY, camera };
  }

  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / drag.camera.w, rect.height / drag.camera.h);
    setCamera(
      clamp({
        ...drag.camera,
        x: drag.camera.x - (event.clientX - drag.clientX) / scale,
        y: drag.camera.y - (event.clientY - drag.clientY) / scale,
      }),
    );
  }

  function pointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function nodeHover(event: ReactPointerEvent<SVGGElement>, node: TraceNode) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredId(node.id);
    setTooltip({ node, x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  function nodeMove(event: ReactPointerEvent<SVGGElement>) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip((current) => (current ? { ...current, x: event.clientX - rect.left, y: event.clientY - rect.top } : null));
  }

  return (
    <div
      ref={wrapperRef}
      className={cn('relative isolate overflow-hidden rounded-lg border border-line bg-surface', className)}
    >
      <svg
        ref={svgRef}
        viewBox={`${camera.x} ${camera.y} ${camera.w} ${camera.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label={`Trace TMK graph with ${graph.nodes.length} nodes and ${graph.edges.length} links`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onDoubleClick={() => setCamera(INITIAL_CAMERA)}
        onClick={() => onSelect(null)}
      >
        <defs>
          <pattern id="trace-dots" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.75" fill="var(--faint)" opacity="0.28" />
          </pattern>
          {(Object.keys(KIND_META) as EntityKind[]).map((kind) => (
            <marker
              key={kind}
              id={`trace-arrow-${kind}`}
              viewBox="0 0 8 8"
              refX="6"
              refY="4"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill={KIND_META[kind].edge} />
            </marker>
          ))}
          <radialGradient id="trace-gold">
            <stop offset="0%" stopColor="#F8D727" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#F8D727" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x={-2000} y={-2000} width={6000} height={4600} fill="url(#trace-dots)" />
        <circle cx={WIDTH / 2} cy={HEIGHT / 2} r="250" fill="url(#trace-gold)" />

        {graph.edges.map((edge) => {
          const from = positions.get(edge.sourceId);
          const to = positions.get(edge.targetId);
          const source = nodeById.get(edge.sourceId);
          const target = nodeById.get(edge.targetId);
          if (!from || !to || !source || !target) return null;
          const geometry = edgePath(
            from,
            to,
            NODE_RADIUS.trace,
            NODE_RADIUS.out,
            edge.sourceId < edge.targetId ? 0.12 : -0.12,
          );
          const touched = incident.has(edge.id);
          const dim = focusNeighbours ? !touched : false;
          const modelOnly = edge.origins.length === 1 && edge.origins[0] === 'model';
          return (
            <g key={edge.id}>
              <path
                d={geometry.path}
                fill="none"
                stroke={KIND_META[ENTITY_KIND[source.kind]].edge}
                strokeWidth={touched ? 1.8 : 1}
                strokeOpacity={dim ? 0.08 : touched ? 0.85 : 0.36}
                strokeDasharray={modelOnly ? '3 3' : undefined}
                markerEnd={`url(#trace-arrow-${ENTITY_KIND[source.kind]})`}
                style={{ transition: 'stroke-opacity 150ms ease' }}
              />
              {touched && (
                <g pointerEvents="none">
                  <rect
                    x={geometry.mid.x - edge.labels[0].length * 2.6 - 4}
                    y={geometry.mid.y - 7}
                    width={edge.labels[0].length * 5.2 + 8}
                    height={12}
                    rx={3}
                    fill="var(--surface)"
                    opacity="0.92"
                  />
                  <text
                    x={geometry.mid.x}
                    y={geometry.mid.y + 2}
                    textAnchor="middle"
                    fontSize="7.5"
                    fill="var(--muted)"
                    className="font-mono"
                  >
                    {edge.labels[0]}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {graph.nodes.map((node) => {
          const point = positions.get(node.id);
          if (!point) return null;
          const entityKind = ENTITY_KIND[node.kind];
          const meta = KIND_META[entityKind];
          const role = roleFor(node);
          const isTrace = role === 'trace';
          const radius = isTrace ? NODE_RADIUS.trace : NODE_RADIUS.out;
          const isSelected = node.id === selectedId;
          const isHovered = node.id === hoveredId;
          const dim = focusNeighbours ? !focusNeighbours.has(node.id) : false;
          const iconSize = Math.round(radius * 0.92);
          const lines = labelLines(node.name, 15);
          return (
            <g
              key={node.id}
              transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}
              opacity={dim ? 0.22 : 1}
              className="cursor-pointer outline-none"
              role="button"
              tabIndex={0}
              aria-label={`${node.kind}: ${node.name}${isTrace ? ', in trace' : ''}`}
              aria-pressed={isSelected}
              onPointerEnter={(event) => nodeHover(event, node)}
              onPointerMove={nodeMove}
              onPointerLeave={() => {
                setHoveredId(null);
                setTooltip(null);
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(node.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(node.id);
                }
              }}
              onFocus={() => setHoveredId(node.id)}
              onBlur={() => setHoveredId(null)}
            >
              {(isSelected || isHovered) && (
                <circle r={radius + 8} fill={meta.accent} opacity={isSelected ? 0.16 : 0.1} />
              )}
              {isTrace && (
                <circle
                  r={radius + 4}
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth={isSelected ? 2.4 : 1.6}
                  strokeOpacity={0.9}
                />
              )}
              {isSelected && (
                <circle
                  r={radius + 9}
                  fill="none"
                  stroke={meta.edge}
                  strokeWidth={1.1}
                  strokeDasharray="2 2.5"
                />
              )}
              <circle r={radius + 6} fill="transparent" />
              <circle
                r={radius}
                fill={isTrace ? meta.accent : 'var(--surface-raised)'}
                stroke={isTrace ? 'var(--surface)' : meta.edge}
                strokeWidth={isTrace ? 2.5 : 1.4}
                strokeDasharray={!isTrace && role !== 'in' ? '3 2.5' : undefined}
              />
              <Icon
                name={meta.icon}
                x={-iconSize / 2}
                y={-iconSize / 2}
                width={iconSize}
                height={iconSize}
                size={iconSize}
                strokeWidth={2}
                style={{
                  color: isTrace
                    ? entityKind === 'task'
                      ? '#3d3100'
                      : '#fbf8ec'
                    : meta.edge,
                }}
              />
              <text
                y={radius + 15}
                textAnchor="middle"
                fontSize="10"
                fontWeight={isTrace ? 600 : 500}
                fill="var(--node-label)"
                className="graph-label pointer-events-none"
              >
                {lines.map((line, index) => (
                  <tspan key={line} x={0} dy={index === 0 ? 0 : 10.5}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>

      {graph.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div>
            <Icon name="compass" size={20} className="mx-auto mb-2 text-faint" />
            <p className="text-[11px] font-medium text-ink">No trace items to plot</p>
            <p className="mt-1 text-[9.5px] text-muted">
              Add a 6-tuple trace block to see its TMK elements.
            </p>
          </div>
        </div>
      )}

      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 w-[210px] rounded-lg border border-line bg-surface-raised p-2.5 shadow-[0_16px_40px_-20px_rgba(20,35,25,0.45)] animate-fade"
          style={{
            left: Math.min(Math.max(tooltip.x + 14, 8), (wrapperRef.current?.clientWidth ?? 320) - 222),
            top: Math.min(Math.max(tooltip.y + 14, 8), (wrapperRef.current?.clientHeight ?? 300) - 108),
          }}
        >
          <p className="eyebrow mb-1 text-[8px] text-faint">{tooltip.node.kind}</p>
          <p className="text-[11.5px] font-semibold leading-snug text-ink">{tooltip.node.name}</p>
          <p className="mt-0.5 text-[9px] text-muted">
            {tooltip.node.inTrace
              ? tooltip.node.score !== null
                ? `trace score ${tooltip.node.score.toFixed(4)}`
                : 'in the 6-tuple trace'
              : tooltip.node.outgoing && tooltip.node.incoming
                ? 'direct in and out connection'
                : tooltip.node.outgoing
                  ? 'direct outgoing connection'
                  : 'direct incoming connection'}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md border border-line bg-surface/90 px-2 py-1 text-[8px] uppercase tracking-[0.08em] text-faint backdrop-blur">
        <span className="inline-flex items-center gap-1">
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{ backgroundColor: KIND_META.task.accent }}
          />
          task
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{ backgroundColor: KIND_META.method.accent }}
          />
          method
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{ backgroundColor: KIND_META.concept.accent }}
          />
          concept
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="h-[7px] w-[7px] rounded-full border border-dashed"
            style={{ borderColor: KIND_META.instance.accent }}
          />
          other
        </span>
        <span className="inline-flex items-center gap-1 normal-case tracking-normal">
          <span className="h-px w-4 border-t border-dashed border-muted" /> model edge
        </span>
      </div>

      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md border border-line bg-surface/95 p-0.5 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => zoom(1.18)}
          className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          aria-label="Zoom in trace graph"
        >
          <Icon name="plus" size={12} />
        </button>
        <button
          type="button"
          onClick={() => zoom(0.84)}
          className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          aria-label="Zoom out trace graph"
        >
          <Icon name="minus" size={12} />
        </button>
        <button
          type="button"
          onClick={() => setCamera(INITIAL_CAMERA)}
          className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          aria-label="Reset trace graph view"
        >
          <Icon name="reset" size={11} />
        </button>
      </div>
    </div>
  );
}
