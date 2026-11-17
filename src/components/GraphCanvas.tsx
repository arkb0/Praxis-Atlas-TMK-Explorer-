/**
 * The interactive skill graph.
 *
 * Rendering is plain SVG so nodes, edges and labels stay crisp at every zoom.
 * Pan and zoom are implemented by moving the viewBox, which keeps coordinate
 * maths in one place. Hover and selection highlight a node's neighbourhood;
 * nothing here mutates the atlas.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { cn } from '@/utils/cn';
import type { Atlas, AtlasEntity } from '@/lib/atlas';
import {
  computeLayout,
  edgePath,
  labelLines,
  layoutSizeFor,
  radiusFor,
  COMPACT_BREAKPOINT,
} from '@/lib/layout';
import { KIND_META } from '@/lib/kinds';
import type { EntityKind } from '@/types/tmk';
import Icon from './Icon';
import { KindBadge } from './ui';

interface GraphCanvasProps {
  atlas: Atlas;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  visibleKinds: Set<EntityKind>;
  query: string;
  className?: string;
}

interface Camera {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.6;

interface Bounds {
  width: number;
  height: number;
}

function clampCamera(camera: Camera, bounds: Bounds): Camera {
  const minX = -camera.w * 0.2;
  const maxX = bounds.width - camera.w * 0.8;
  const minY = -camera.h * 0.2;
  const maxY = bounds.height - camera.h * 0.8;
  return {
    ...camera,
    x: Math.min(Math.max(camera.x, minX), maxX),
    y: Math.min(Math.max(camera.y, minY), maxY),
  };
}

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) % 997;
  }
  return result;
}

export default function GraphCanvas({
  atlas,
  selectedId,
  onSelect,
  visibleKinds,
  query,
  className,
}: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    clientX: number;
    clientY: number;
    camera: Camera;
    moved: boolean;
  } | null>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const layout = useMemo(() => layoutSizeFor(size.width, size.height), [size.width, size.height]);
  const bounds: Bounds = { width: layout.width, height: layout.height };
  const portrait = layout.width < COMPACT_BREAKPOINT;
  const [camera, setCamera] = useState<Camera>({
    x: 0,
    y: 0,
    w: layout.width,
    h: layout.height,
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ entity: AtlasEntity; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const resetCamera = () =>
    setCamera({ x: 0, y: 0, w: layout.width, h: layout.height });

  // Measure the container so portrait phones get a taller virtual canvas.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Keep the camera framed when the layout flips between orientations.
  useEffect(() => {
    setCamera({ x: 0, y: 0, w: layout.width, h: layout.height });
  }, [layout.width, layout.height]);

  const positions = useMemo(
    () => computeLayout(atlas.entities, atlas.edges, layout),
    [atlas.entities, atlas.edges, layout],
  );
  const entityById = useMemo(
    () => new Map(atlas.entities.map((entity) => [entity.id, entity])),
    [atlas],
  );

  const visibleEntities = useMemo(
    () => atlas.entities.filter((entity) => visibleKinds.has(entity.kind)),
    [atlas.entities, visibleKinds],
  );

  const visibleEdges = useMemo(
    () =>
      atlas.edges.filter((edge) => {
        const source = entityById.get(edge.sourceId);
        const target = entityById.get(edge.targetId);
        return Boolean(
          source && target && visibleKinds.has(source.kind) && visibleKinds.has(target.kind),
        );
      }),
    [atlas.edges, entityById, visibleKinds],
  );

  const matches = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    if (!normalised) return null;
    return new Set(
      atlas.entities
        .filter((entity) =>
          `${entity.name} ${entity.description} ${entity.kind}`
            .toLowerCase()
            .includes(normalised),
        )
        .map((entity) => entity.id),
    );
  }, [atlas.entities, query]);

  // Hover drives focus and dimming; selection is a lighter emphasis so the
  // first view never opens with most of the graph washed out.
  const focusId = hoveredId ?? selectedId;
  const activeNeighbourhood = useMemo(() => {
    if (!hoveredId) return null;
    const set = new Set<string>([hoveredId, ...(atlas.adjacency.get(hoveredId) ?? [])]);
    return set;
  }, [hoveredId, atlas.adjacency]);

  const hoveredEdges = useMemo(
    () => (hoveredId ? [...(atlas.outgoing.get(hoveredId) ?? []), ...(atlas.incoming.get(hoveredId) ?? [])] : []),
    [atlas.incoming, atlas.outgoing, hoveredId],
  );

  const renderedEdges = useMemo(() => {
    return visibleEdges
      .map((edge) => {
        const source = entityById.get(edge.sourceId);
        const target = entityById.get(edge.targetId);
        const from = positions.get(edge.sourceId);
        const to = positions.get(edge.targetId);
        if (!source || !target || !from || !to) return null;
        const pair = [edge.sourceId, edge.targetId].sort();
        const direction = pair[0] === edge.sourceId ? 1 : -1;
        const bend = direction * (0.11 + (hash(edge.id) % 4) * 0.018);
        const geometry = edgePath(
          from,
          to,
          radiusFor(source.kind, portrait),
          radiusFor(target.kind, portrait),
          bend,
        );
        return { edge, source, geometry };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [entityById, portrait, positions, visibleEdges]);

  const isolated = visibleEdges.length === 0;

  function zoomTo(factor: number, anchor?: { x: number; y: number }) {
    setCamera((current) => {
      const minWidth = bounds.width * MIN_ZOOM;
      const maxWidth = bounds.width * MAX_ZOOM;
      const nextWidth = Math.min(Math.max(current.w * factor, minWidth), maxWidth);
      const ratio = nextWidth / current.w;
      const nextHeight = current.h * ratio;
      const centre = anchor ?? { x: current.x + current.w / 2, y: current.y + current.h / 2 };
      return clampCamera(
        {
          x: centre.x - (centre.x - current.x) * ratio,
          y: centre.y - (centre.y - current.y) * ratio,
          w: nextWidth,
          h: nextHeight,
        },
        bounds,
      );
    });
  }

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
      zoomTo(event.deltaY < 0 ? 0.88 : 1.14, point);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [bounds, camera]);

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      camera,
      moved: false,
    };
    setDragging(true);
    setTooltip(null);
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.clientX;
    const dy = event.clientY - drag.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      drag.moved = true;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / drag.camera.w, rect.height / drag.camera.h);
    setCamera(
      clampCamera(
        {
          ...drag.camera,
          x: drag.camera.x - dx / scale,
          y: drag.camera.y - dy / scale,
        },
        bounds,
      ),
    );
  }

  function endPointer(event: ReactPointerEvent<SVGSVGElement>) {
    // A background click without a drag clears the selection; node clicks
    // stop propagation before reaching this handler.
    const drag = dragRef.current;
    if (drag && !drag.moved) {
      onSelect(null);
    }
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function nodeEnter(event: ReactPointerEvent<SVGGElement>, entity: AtlasEntity) {
    if (dragRef.current?.moved) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredId(entity.id);
    setTooltip({
      entity,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  function nodeMove(event: ReactPointerEvent<SVGGElement>) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip((current) => (current ? { ...current, x: event.clientX - rect.left, y: event.clientY - rect.top } : null));
  }

  const showEdgeLabels = Boolean(hoveredId) && hoveredEdges.length <= 14;
  const visibleCount = visibleEntities.length;
  const linkCount = visibleEdges.length;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'relative isolate overflow-hidden bg-surface',
        dragging ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
    >
      <svg
        ref={svgRef}
        viewBox={`${camera.x} ${camera.y} ${camera.w} ${camera.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label={`Skill graph with ${visibleCount} entities and ${linkCount} links`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={resetCamera}
      >
        <defs>
          <pattern id="atlas-dots" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.75" fill="var(--faint)" opacity="0.32" />
          </pattern>
          {(['task', 'method', 'concept', 'instance'] as EntityKind[]).map((kind) => (
            <marker
              key={kind}
              id={`arrow-${kind}`}
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
          <radialGradient id="wash-gold">
            <stop offset="0%" stopColor="#F8D727" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#F8D727" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="wash-green">
            <stop offset="0%" stopColor="#005C45" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#005C45" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="wash-sky">
            <stop offset="0%" stopColor="#2F9FD9" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#2F9FD9" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x={-2000} y={-2000} width={6000} height={4600} fill="url(#atlas-dots)" />
        <circle cx={layout.width * 0.78} cy={layout.height * 0.4} r="210" fill="url(#wash-gold)" />
        <circle cx={layout.width * 0.53} cy={layout.height * 0.34} r="190" fill="url(#wash-sky)" />
        <circle cx={layout.width * 0.27} cy={layout.height * 0.55} r="270" fill="url(#wash-green)" />

        <g>
          {renderedEdges.map(({ edge, source, geometry }) => {
            const touchesFocus =
              focusId === edge.sourceId || focusId === edge.targetId;
            const touchesHover =
              hoveredId === edge.sourceId || hoveredId === edge.targetId;
            const inHoverNeighbourhood = activeNeighbourhood
              ? activeNeighbourhood.has(edge.sourceId) && activeNeighbourhood.has(edge.targetId)
              : true;
            const matchesQuery =
              !matches || (matches.has(edge.sourceId) && matches.has(edge.targetId));
            const opacity = touchesHover
              ? 0.85
              : activeNeighbourhood
                ? inHoverNeighbourhood
                  ? 0.55
                  : 0.07
                : touchesFocus
                  ? 0.6
                  : query.trim()
                    ? matchesQuery
                      ? 0.5
                      : 0.05
                    : 0.2;
            return (
              <path
                key={edge.id}
                d={geometry.path}
                fill="none"
                stroke={KIND_META[source.kind].edge}
                strokeWidth={touchesFocus ? 1.6 : 1}
                strokeOpacity={opacity}
                markerEnd={touchesFocus ? `url(#arrow-${source.kind})` : undefined}
                style={{ transition: 'stroke-opacity 160ms ease, stroke-width 160ms ease' }}
              />
            );
          })}
        </g>

        {showEdgeLabels && (
          <g pointerEvents="none">
            {renderedEdges
              .filter(({ edge }) => edge.sourceId === hoveredId || edge.targetId === hoveredId)
              .slice(0, 14)
              .map(({ edge, geometry }) => (
                <g key={`label-${edge.id}`}>
                  <rect
                    x={geometry.mid.x - edge.labels[0].length * 2.5 - 4}
                    y={geometry.mid.y - 7}
                    width={edge.labels[0].length * 5 + 8}
                    height={12}
                    rx={3}
                    fill="var(--surface)"
                    opacity="0.88"
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
              ))}
          </g>
        )}

        <g>
          {visibleEntities.map((entity) => {
              const point = positions.get(entity.id);
              if (!point) return null;
              const radius = radiusFor(entity.kind, portrait);
              const meta = KIND_META[entity.kind];
              const isSelected = entity.id === selectedId;
              const isHovered = entity.id === hoveredId;
              const isInstance = entity.kind === 'instance';
              const inNeighbourhood = activeNeighbourhood?.has(entity.id) ?? true;
              const matchesQuery = !matches || matches.has(entity.id);
              const opacity = activeNeighbourhood
                ? inNeighbourhood
                  ? 1
                  : 0.2
                : matchesQuery
                  ? 1
                  : 0.16;
              const iconSize = Math.round(radius * 0.92);
              const lines = labelLines(entity.name, portrait ? 12 : 15);

              return (
                <g
                  key={entity.id}
                  transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}
                  opacity={opacity}
                  className="cursor-pointer outline-none"
                  style={{ transition: 'opacity 160ms ease' }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${meta.label}: ${entity.name}`}
                  aria-pressed={isSelected}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerEnter={(event) => nodeEnter(event, entity)}
                  onPointerMove={nodeMove}
                  onPointerLeave={() => {
                    setHoveredId(null);
                    setTooltip(null);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(entity.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(entity.id);
                    }
                  }}
                  onFocus={() => setHoveredId(entity.id)}
                  onBlur={() => setHoveredId(null)}
                >
                  {(isSelected || isHovered) && (
                    <circle r={radius + 8} fill={meta.accent} opacity={isSelected ? 0.16 : 0.1} />
                  )}
                  {isSelected && (
                    <circle
                      r={radius + 4.5}
                      fill="none"
                      stroke={meta.edge}
                      strokeWidth={1.2}
                      strokeDasharray="2 2.5"
                    />
                  )}
                  <circle r={radius + 6} fill="transparent" />
                  <circle
                    r={radius}
                    fill={isInstance ? 'var(--surface-raised)' : meta.accent}
                    stroke={isInstance ? meta.edge : 'var(--surface)'}
                    strokeWidth={isInstance ? 1.4 : 2.5}
                    strokeDasharray={isInstance ? '3 2.5' : undefined}
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
                      color:
                        entity.kind === 'task'
                          ? '#3d3100'
                          : isInstance
                            ? 'var(--moss)'
                            : '#fbf8ec',
                    }}
                  />
                  <text
                    y={radius + (portrait ? 19 : 15)}
                    textAnchor="middle"
                    fontSize={portrait ? 13.5 : 10.5}
                    fontWeight={isSelected ? 650 : 550}
                    fill="var(--node-label)"
                    className="graph-label pointer-events-none"
                  >
                    {lines.map((line, index) => (
                      <tspan key={line} x={0} dy={index === 0 ? 0 : portrait ? 15 : 11}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
        </g>
      </svg>

      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[9.5px] font-medium text-muted backdrop-blur-sm">
          <span className="mono text-ink">{visibleCount}</span> nodes
          <span className="mx-1.5 text-line-strong">/</span>
          <span className="mono text-ink">{linkCount}</span> links
        </span>
        <span className="hidden rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[9.5px] text-faint backdrop-blur-sm sm:inline-flex">
          Drag to pan - scroll to zoom
        </span>
      </div>

      {(isolated || (matches && matches.size === 0)) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
          <div className="max-w-[260px] rounded-xl border border-line bg-surface/95 p-4 text-center shadow-sm backdrop-blur">
            <Icon name="filter" size={18} className="mx-auto mb-2 text-faint" />
            <p className="text-[12px] font-medium text-ink">
              {matches && matches.size === 0 ? 'No matching entities' : 'No layers visible'}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
              {matches && matches.size === 0
                ? 'Try a different name or clear the search.'
                : 'Turn a layer back on from the filters above the graph.'}
            </p>
          </div>
        </div>
      )}

      {tooltip && !dragging && (
        <button
          type="button"
          onClick={() => onSelect(tooltip.entity.id)}
          className="absolute z-20 w-[232px] cursor-pointer rounded-xl border border-line bg-surface-raised p-3 text-left shadow-[0_18px_45px_-20px_rgba(20,35,25,0.45)] animate-fade"
          style={{
            left: Math.min(Math.max(tooltip.x + 16, 8), (wrapperRef.current?.clientWidth ?? 320) - 244),
            top: Math.min(Math.max(tooltip.y + 16, 8), (wrapperRef.current?.clientHeight ?? 400) - 148),
          }}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <KindBadge kind={tooltip.entity.kind} />
            <span className="mono text-[9px] text-faint">
              {(atlas.adjacency.get(tooltip.entity.id)?.size ?? 0)} links
            </span>
          </div>
          <p className="text-[12.5px] font-semibold leading-snug text-ink">{tooltip.entity.name}</p>
          <p className="mt-1 line-clamp-3 text-[10.5px] leading-relaxed text-muted">
            {tooltip.entity.description}
          </p>
          <div className="mt-2 flex items-center gap-1 border-t border-line pt-2 text-[9px] font-medium uppercase tracking-[0.1em] text-faint">
            <Icon name="eye" size={10} />
            Click to inspect
          </div>
        </button>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-line bg-surface/95 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => zoomTo(1.18)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Icon name="plus" size={14} />
        </button>
        <button
          type="button"
          onClick={() => zoomTo(0.84)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Icon name="minus" size={14} />
        </button>
        <span className="mx-0.5 h-4 w-px bg-line" />
        <button
          type="button"
          onClick={resetCamera}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          aria-label="Reset view"
          title="Reset view"
        >
          <Icon name="reset" size={13} />
        </button>
      </div>
    </div>
  );
}
