/**
 * A read-only organiser state machine.
 *
 * States are ranked by transition depth (a small longest-path pass). The
 * compact variant flows top to bottom, which stays legible inside a narrow
 * inspector; the full variant flows left to right and widens with its rank
 * count. Failure states are anchored separately so they do not distort the
 * happy path. No external graph library is required.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/utils/cn';
import type { Atlas } from '@/lib/atlas';
import { lookup } from '@/lib/atlas';
import { labelLines } from '@/lib/layout';
import type { Organizer, OrganizerState } from '@/types/tmk';
import Icon from './Icon';

interface FsmDiagramProps {
  organizer: Organizer;
  atlas: Atlas;
  onSelectName?: (name: string) => void;
  variant?: 'compact' | 'full';
  className?: string;
}

interface StateBox {
  state: OrganizerState;
  x: number;
  y: number;
  role: 'start' | 'success' | 'failure' | 'normal';
}

/** Longest-path ranking over the non-failure subgraph. */
function rankStates(organizer: Organizer): Map<string, number> {
  const normal = organizer.states.filter((state) => state.name !== organizer.failureState);
  const levels = new Map<string, number>(normal.map((state) => [state.name, 0]));
  levels.set(organizer.startState, 0);

  for (let pass = 0; pass < normal.length; pass += 1) {
    let changed = false;
    for (const transition of organizer.transitions) {
      if (
        !levels.has(transition.sourceState) ||
        !levels.has(transition.targetState) ||
        transition.targetState === organizer.startState
      ) {
        continue;
      }
      const proposed = (levels.get(transition.sourceState) ?? 0) + 1;
      if ((levels.get(transition.targetState) ?? 0) < proposed) {
        levels.set(transition.targetState, proposed);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return levels;
}

/** Clip a line at a rectangle edge, used to keep arrowheads outside boxes. */
function rectIntersection(
  from: { x: number; y: number },
  to: { x: number; y: number },
  halfWidth: number,
  halfHeight: number,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const ux = dx / length;
  const uy = dy / length;
  const ratio = Math.min(
    Math.abs(ux) > 0.0001 ? halfWidth / Math.abs(ux) : Number.POSITIVE_INFINITY,
    Math.abs(uy) > 0.0001 ? halfHeight / Math.abs(uy) : Number.POSITIVE_INFINITY,
  );
  return { x: from.x + ux * ratio, y: from.y + uy * ratio };
}

export default function FsmDiagram({
  organizer,
  atlas,
  onSelectName,
  variant = 'full',
  className,
}: FsmDiagramProps) {
  const compact = variant === 'compact';
  const levels = useMemo(() => rankStates(organizer), [organizer]);
  const normalStates = useMemo(
    () => organizer.states.filter((state) => state.name !== organizer.failureState),
    [organizer],
  );
  const maxLevel = Math.max(...normalStates.map((state) => levels.get(state.name) ?? 0), 1);

  // Geometry is derived from rank count so a six-state chain never overlaps.
  const nodeWidth = compact ? 142 : 128;
  const nodeHeight = compact ? 30 : 38;
  const width = compact ? 430 : Math.max(720, 140 + maxLevel * 150);
  const rowGap = 50;
  const columnGap = compact ? 14 : 22;
  const padding = compact ? 26 : 44;
  const failureGap = 60;
  const bottomReserve = compact ? 44 : 54;
  const hasFailure = organizer.states.some((state) => state.name === organizer.failureState);
  const height = compact
    ? padding + maxLevel * rowGap + nodeHeight / 2 + (hasFailure ? failureGap + 18 : 12) + 18
    : 320;

  const boxes = useMemo<StateBox[]>(() => {
    const byLevel = new Map<number, OrganizerState[]>();
    for (const state of normalStates) {
      const level = levels.get(state.name) ?? 0;
      const bucket = byLevel.get(level) ?? [];
      bucket.push(state);
      byLevel.set(level, bucket);
    }

    const result: StateBox[] = [];
    const usableWidth = width - padding * 2;

    for (const [level, states] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
      const maxPerRow = Math.max(1, Math.floor(usableWidth / (nodeWidth + columnGap)));
      const rows = Math.ceil(states.length / maxPerRow);
      states.forEach((state, index) => {
        const row = Math.floor(index / maxPerRow);
        const inRow = Math.min(maxPerRow, states.length - row * maxPerRow);
        const position = index % maxPerRow;
        const role: StateBox['role'] =
          state.name === organizer.startState
            ? 'start'
            : state.name === organizer.successState
              ? 'success'
              : 'normal';

        if (compact) {
          result.push({
            state,
            x: width / 2 + (position - (inRow - 1) / 2) * (nodeWidth + columnGap),
            y: padding + nodeHeight / 2 + (level + row * 0.9) * rowGap,
            role,
          });
        } else {
          const contentWidth = Math.max(usableWidth, 1);
          const x =
            padding + nodeWidth / 2 + (level / Math.max(maxLevel, 1)) * (contentWidth - nodeWidth);
          const gap = containerGap(nodeHeight);
          result.push({
            state,
            x,
            y: (height - bottomReserve) / 2 + 8 + (row - (rows - 1) / 2) * gap + (position - (inRow - 1) / 2) * 0,
            role,
          });
        }
      });
    }

    // Normal states at the same level are side by side in compact mode.
    const failure = organizer.states.find((state) => state.name === organizer.failureState);
    if (failure) {
      result.push({
        state: failure,
        x: width / 2,
        y: height - 18 - (compact ? 6 : bottomReserve / 2),
        role: 'failure',
      });
    }
    return result;
  }, [
    bottomReserve,
    columnGap,
    compact,
    height,
    levels,
    maxLevel,
    nodeHeight,
    nodeWidth,
    normalStates,
    organizer,
    padding,
    width,
  ]);

  const positions = new Map(boxes.map((box) => [box.state.name, box]));
  const [selectedState, setSelectedState] = useState(organizer.startState);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const selected =
    organizer.states.find((state) => state.name === selectedState) ?? organizer.states[0];
  const selectedLookup = selected ? lookup(atlas, selected.goalInvocation.goalReference) : undefined;
  const activeState = hoveredState ?? selectedState;

  return (
    <div className={cn('w-full', className)}>
      <div className="overflow-hidden rounded-lg border border-line bg-surface-muted/60">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Organiser with ${organizer.states.length} states and ${organizer.transitions.length} transitions`}
        >
          <defs>
            <pattern id={`fsm-dots-${variant}`} width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.7" fill="var(--faint)" opacity="0.25" />
            </pattern>
            <marker
              id={`fsm-arrow-${variant}`}
              viewBox="0 0 8 8"
              refX="6.4"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--muted)" />
            </marker>
          </defs>
          <rect x={0} y={0} width={width} height={height} fill={`url(#fsm-dots-${variant})`} />

          <g>
            {organizer.transitions.map((transition, index) => {
              const source = positions.get(transition.sourceState);
              const target = positions.get(transition.targetState);
              if (!source || !target) return null;
              const start = rectIntersection(source, target, nodeWidth / 2, nodeHeight / 2);
              const end = rectIntersection(target, source, nodeWidth / 2, nodeHeight / 2);
              const dx = end.x - start.x;
              const dy = end.y - start.y;
              const length = Math.max(Math.hypot(dx, dy), 1);
              const spacing = Math.abs(dx) < 12 ? 16 : 10;
              const bend = (index % 2 === 0 ? 1 : -1) * spacing;
              const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
              const control = {
                x: mid.x - (dy / length) * bend,
                y: mid.y + (dx / length) * bend,
              };
              const touched =
                transition.sourceState === activeState ||
                transition.targetState === activeState;
              const isFailurePath = transition.targetState === organizer.failureState;
              const label = transition.dataCondition;
              const shortLabel = label.length > 28 ? `${label.slice(0, 27)}...` : label;

              return (
                <g key={`${transition.sourceState}-${transition.targetState}-${index}`}>
                  <path
                    d={`M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`}
                    fill="none"
                    stroke={isFailurePath ? 'var(--rust)' : touched ? 'var(--moss)' : 'var(--faint)'}
                    strokeWidth={touched ? 1.5 : 1}
                    strokeOpacity={touched ? 0.9 : 0.4}
                    markerEnd={`url(#fsm-arrow-${variant})`}
                  />
                  {!compact && (
                    <text
                      x={(start.x + 2 * control.x + end.x) / 4}
                      y={(start.y + 2 * control.y + end.y) / 4 - 3}
                      textAnchor="middle"
                      fontSize={label.length > 30 ? 6.6 : 7.4}
                      fill="var(--muted)"
                      className="font-mono"
                    >
                      {shortLabel}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {(() => {
            const startBox = positions.get(organizer.startState);
            if (!startBox) return null;
            const start = compact
              ? { x: startBox.x, y: startBox.y - nodeHeight / 2 - 18 }
              : { x: startBox.x - nodeWidth / 2 - 24, y: startBox.y };
            const end = compact
              ? { x: startBox.x, y: startBox.y - nodeHeight / 2 - 3 }
              : { x: startBox.x - nodeWidth / 2 - 3, y: startBox.y };
            if (start.x < 4 || start.y < 2) return null;
            return (
              <g>
                <path
                  d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
                  stroke="var(--gold)"
                  strokeWidth="1.5"
                  markerEnd={`url(#fsm-arrow-${variant})`}
                />
                <text
                  x={compact ? start.x + 6 : start.x}
                  y={compact ? start.y + 2.5 : start.y - 6}
                  textAnchor={compact ? 'start' : 'middle'}
                  fontSize="6.5"
                  fill="var(--faint)"
                  className="font-mono uppercase tracking-[0.12em]"
                >
                  start
                </text>
              </g>
            );
          })()}

          {boxes.map((box) => {
            const isSelected = box.state.name === selectedState;
            const isHovered = box.state.name === hoveredState;
            const roleColour =
              box.role === 'start'
                ? 'var(--gold)'
                : box.role === 'success'
                  ? 'var(--moss)'
                  : box.role === 'failure'
                    ? 'var(--rust)'
                    : 'var(--line-strong)';
            const lines = labelLines(box.state.name, compact ? 18 : 16);
            const goal = lookup(atlas, box.state.goalInvocation.goalReference);
            return (
              <g
                key={box.state.name}
                transform={`translate(${box.x} ${box.y})`}
                role="button"
                tabIndex={0}
                aria-label={`State ${box.state.name}, invokes ${box.state.goalInvocation.goalReference}`}
                aria-pressed={isSelected}
                className="cursor-pointer outline-none"
                onClick={() => setSelectedState(box.state.name)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedState(box.state.name);
                  }
                }}
                onPointerEnter={() => setHoveredState(box.state.name)}
                onPointerLeave={() => setHoveredState(null)}
                onFocus={() => setHoveredState(box.state.name)}
                onBlur={() => setHoveredState(null)}
              >
                <rect
                  x={-nodeWidth / 2 - 3}
                  y={-nodeHeight / 2 - 3}
                  width={nodeWidth + 6}
                  height={nodeHeight + 6}
                  rx={9}
                  fill="none"
                  stroke={isSelected ? 'var(--agrarian-sky)' : 'transparent'}
                  strokeWidth={1.3}
                  strokeDasharray={isSelected ? '3 2' : undefined}
                />
                <rect
                  x={-nodeWidth / 2}
                  y={-nodeHeight / 2}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={7}
                  fill="var(--surface-raised)"
                  stroke={isHovered ? roleColour : box.role === 'normal' ? 'var(--line-strong)' : roleColour}
                  strokeWidth={box.role === 'normal' ? 1 : 1.3}
                />
                <rect
                  x={-nodeWidth / 2}
                  y={-nodeHeight / 2}
                  width={3.5}
                  height={nodeHeight}
                  rx={1.75}
                  fill={roleColour}
                />
                {goal && goal.kind !== 'relation' && goal.kind !== 'assertion' && (
                  <circle
                    cx={nodeWidth / 2 - 7}
                    cy={-nodeHeight / 2 + 7}
                    r={2.2}
                    fill={
                      goal.kind === 'task'
                        ? '#C6A800'
                        : goal.kind === 'method'
                          ? 'var(--agrarian-sky)'
                          : 'var(--moss)'
                    }
                  />
                )}
                <text
                  x={0}
                  y={lines.length === 2 ? -2 : 2.5}
                  textAnchor="middle"
                  fontSize={compact ? 8.5 : 8.8}
                  fontWeight={box.role === 'normal' ? 500 : 600}
                  fill="var(--ink)"
                  className="font-mono"
                >
                  {lines.map((line, index) => (
                    <tspan key={line} x={0} dy={index === 0 ? 0 : 9.5}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-[8.5px] uppercase tracking-[0.1em] text-faint">
        <span className="inline-flex items-center gap-1">
          <span className="h-[5px] w-[5px] rounded-full bg-gold" /> start
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-[5px] w-[5px] rounded-full bg-moss" /> success
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-[5px] w-[5px] rounded-full bg-rust" /> failure
        </span>
        {compact && (
          <span className="normal-case tracking-normal text-faint">
            Select a state to read its invocation
          </span>
        )}
      </div>

      {selected && (
        <div className="mt-2.5 rounded-lg border border-line bg-surface px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="eyebrow text-faint">state</span>
            <span className="mono text-[10.5px] font-medium text-ink">{selected.name}</span>
            <span className="text-line-strong">/</span>
            {selectedLookup && selectedLookup.kind !== 'relation' && selectedLookup.kind !== 'assertion' ? (
              <button
                type="button"
                onClick={() => onSelectName?.(selectedLookup.name)}
                className="group inline-flex items-center gap-1 text-[10.5px] font-medium text-ink transition-colors hover:text-moss"
                title={`Inspect ${selectedLookup.name}`}
              >
                {selected.goalInvocation.goalReference}
                <Icon
                  name="arrow-up-right"
                  size={10}
                  className="text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </button>
            ) : (
              <span className="mono text-[10.5px] text-muted">
                {selected.goalInvocation.goalReference}
              </span>
            )}
            <span className="rounded-full border border-line bg-surface-muted px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.1em] text-muted">
              {selected.goalInvocation.type}
            </span>
          </div>
          {selected.goalInvocation.actualArguments.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="eyebrow mr-0.5 text-faint">args</span>
              {selected.goalInvocation.actualArguments.map((argument) => (
                <span
                  key={argument}
                  className="mono rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[9px] text-muted"
                >
                  {argument}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!compact && (
        <div className="mt-2 grid gap-1.5">
          {organizer.transitions.map((transition, index) => (
            <div
              key={`${transition.sourceState}-${index}`}
              className="flex items-start gap-2 rounded border border-transparent px-1 py-0.5 text-[9.5px] leading-relaxed text-muted transition-colors hover:border-line hover:bg-surface"
            >
              <span className="mono mt-[1px] shrink-0 text-[8.5px] text-faint">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="mono shrink-0 text-ink">
                {transition.sourceState} <span className="text-faint">to</span> {transition.targetState}
              </span>
              <span className="text-faint">when</span>
              <span className="mono min-w-0 break-words text-muted">{transition.dataCondition}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function containerGap(nodeHeight: number): number {
  return nodeHeight + 30;
}
