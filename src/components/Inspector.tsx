/**
 * Read-only entity inspector.
 *
 * Sections are derived from the entity kind, but every cross-reference is
 * resolved through the atlas name index rather than through hard-coded field
 * names. A raw record drawer is included for fidelity and future editing work.
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import {
  lookup,
  type Atlas,
  type AtlasEdge,
  type AtlasEntity,
  type NamedThing,
} from '@/lib/atlas';
import { KIND_META } from '@/lib/kinds';
import type {
  Assertion,
  Concept,
  Instance,
  Method,
  Organizer,
  Task,
} from '@/types/tmk';
import Icon from './Icon';
import FsmDiagram from './FsmDiagram';
import { CopyButton, EntityGlyph, KindBadge, ReadOnlyNote } from './ui';

interface InspectorProps {
  atlas: Atlas;
  entity: AtlasEntity | null;
  onClose: () => void;
  onSelectName: (name: string) => void;
  className?: string;
}

function isGraphNode(thing: NamedThing | undefined): boolean {
  return Boolean(
    thing && thing.kind !== 'relation' && thing.kind !== 'assertion',
  );
}

function Section({
  label,
  count,
  children,
  action,
}: {
  label: string;
  count?: number;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border-t border-line px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="eyebrow text-faint">{label}</h3>
          {typeof count === 'number' && (
            <span className="mono rounded-full border border-line bg-surface-muted px-1.5 py-[1px] text-[8px] text-faint">
              {count}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RefChip({
  name,
  atlas,
  onSelectName,
  emphasis = false,
}: {
  name: string;
  atlas: Atlas;
  onSelectName: (name: string) => void;
  emphasis?: boolean;
}) {
  const thing = lookup(atlas, name);
  const clickable = isGraphNode(thing);
  const colour = thing && thing.kind !== 'relation' && thing.kind !== 'assertion'
    ? KIND_META[thing.kind].accent
    : 'var(--faint)';
  const content = (
    <>
      <span
        className="h-[5px] w-[5px] shrink-0 rounded-full"
        style={{ backgroundColor: colour }}
      />
      <span className="truncate">{name}</span>
      {clickable && (
        <Icon
          name="arrow-up-right"
          size={9}
          className="shrink-0 text-faint transition-colors group-hover:text-ink"
        />
      )}
    </>
  );
  const base = cn(
    'inline-flex max-w-full items-center gap-1.5 rounded-md border px-1.5 py-[3px] text-left font-mono text-[9.5px] leading-tight transition-colors',
    clickable
      ? 'group border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-muted'
      : 'border-dashed border-line text-muted',
    emphasis && 'text-[10.5px]',
  );

  if (clickable) {
    return (
      <button
        type="button"
        className={base}
        onClick={() => onSelectName(name)}
        title={`Inspect ${name}`}
      >
        {content}
      </button>
    );
  }
  return (
    <span
      className={base}
      title={thing ? `${thing.kind}: ${name}` : 'Not defined as an entity in this model set'}
    >
      {content}
    </span>
  );
}

function ReferenceChips({
  values,
  atlas,
  onSelectName,
  empty = 'None declared',
}: {
  values?: string[];
  atlas: Atlas;
  onSelectName: (name: string) => void;
  empty?: string;
}) {
  if (!values || values.length === 0) {
    return <p className="text-[10px] italic text-faint">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <RefChip key={value} name={value} atlas={atlas} onSelectName={onSelectName} />
      ))}
    </div>
  );
}

function InterfaceBlock({
  entity,
  atlas,
  onSelectName,
}: {
  entity: AtlasEntity;
  atlas: Atlas;
  onSelectName: (name: string) => void;
}) {
  const data = entity.data as unknown as Task | Method;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
      <div>
        <p className="eyebrow mb-1.5 text-faint">Takes</p>
        <ReferenceChips values={data.inputParameters} atlas={atlas} onSelectName={onSelectName} />
      </div>
      <Icon name="arrow-right" size={12} className="mt-6 text-line-strong" />
      <div>
        <p className="eyebrow mb-1.5 text-faint">Returns</p>
        <ReferenceChips values={data.outputParameters} atlas={atlas} onSelectName={onSelectName} />
      </div>
    </div>
  );
}

function ContextRow({ label, value, accent }: { label: string; value?: string; accent: string }) {
  if (!value) return null;
  return (
    <div
      className="rounded-r-md border-l-2 bg-surface-muted/70 py-1.5 pl-2.5 pr-2"
      style={{ borderLeftColor: accent }}
    >
      <p className="eyebrow mb-0.5 text-faint">{label}</p>
      <p className="text-[11px] leading-relaxed text-ink">{value}</p>
    </div>
  );
}

function AssertionCard({
  assertion,
  atlas,
  onSelectName,
}: {
  assertion: Assertion;
  atlas: Atlas;
  onSelectName: (name: string) => void;
}) {
  const equivalent = lookup(atlas, assertion.equivalentTo);
  return (
    <div className="rounded-lg border border-line bg-surface p-2.5">
      <div className="flex items-start gap-1.5">
        <Icon name="quote" size={12} className="mt-[2px] shrink-0 text-faint" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold leading-snug text-ink">{assertion.name}</p>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{assertion.description}</p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-line pt-1.5">
        <span className="eyebrow text-[8px] text-faint">equivalent to</span>
        {equivalent ? (
          <RefChip name={assertion.equivalentTo} atlas={atlas} onSelectName={onSelectName} />
        ) : (
          <span className="mono text-[9px] text-ink">{assertion.equivalentTo}</span>
        )}
      </div>
    </div>
  );
}

function MeansList({
  task,
  atlas,
  onSelectName,
}: {
  task: Task;
  atlas: Atlas;
  onSelectName: (name: string) => void;
}) {
  if (!task.means?.length) return <p className="text-[10px] italic text-faint">No mechanism declared.</p>;
  return (
    <div className="grid gap-1.5">
      {task.means.map((means, index) => {
        const target = lookup(atlas, means.mechanismReference);
        const clickable = isGraphNode(target);
        return (
          <div
            key={`${means.mechanismReference}-${index}`}
            className="rounded-lg border border-line bg-surface p-2.5"
          >
            <div className="flex items-center gap-2">
              <span className="mono flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#2F9FD9]/12 text-[8px] font-medium text-[#1a6f98] dark:text-[#7fc8ea]">
                M
              </span>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onSelectName(means.mechanismReference)}
                  className="group flex min-w-0 items-center gap-1 text-left text-[11px] font-semibold text-ink transition-colors hover:text-[#1a6f98] dark:hover:text-[#7fc8ea]"
                >
                  <span className="truncate">{means.mechanismReference}</span>
                  <Icon
                    name="arrow-up-right"
                    size={10}
                    className="shrink-0 text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </button>
              ) : (
                <span className="truncate text-[11px] font-semibold text-ink">
                  {means.mechanismReference}
                </span>
              )}
              <span className="eyebrow ml-auto shrink-0 text-faint">method</span>
            </div>
            {means.actualArguments.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-6">
                {means.actualArguments.map((argument) => (
                  <RefChip
                    key={argument}
                    name={argument}
                    atlas={atlas}
                    onSelectName={onSelectName}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrganiserBlock({
  organizer,
  atlas,
  onSelectName,
}: {
  organizer: Organizer;
  atlas: Atlas;
  onSelectName: (name: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.1em] text-muted">
          {organizer.states.length} states
        </span>
        <span className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.1em] text-muted">
          {organizer.transitions.length} transitions
        </span>
        <span className="mono ml-auto text-[8.5px] text-faint">
          {organizer.startState} <span className="text-line-strong">to</span> {organizer.successState}
        </span>
      </div>
      <FsmDiagram organizer={organizer} atlas={atlas} onSelectName={onSelectName} variant="compact" />
    </div>
  );
}

function ConceptDetails({
  concept,
  atlas,
  onSelectName,
}: {
  concept: Concept;
  atlas: Atlas;
  onSelectName: (name: string) => void;
}) {
  const instances = atlas.entities.filter(
    (entity) =>
      entity.kind === 'instance' &&
      String((entity.data as unknown as Instance).concept) === concept.name,
  );
  const properties = concept.properties ?? [];
  return (
    <>
      <Section label="Definition">
        <div className="grid gap-2">
          <div>
            <p className="eyebrow mb-1.5 text-faint">Super concept</p>
            <ReferenceChips
              values={concept.superConcept}
              atlas={atlas}
              onSelectName={onSelectName}
              empty="Root concept"
            />
          </div>
        </div>
      </Section>
      <Section label="Properties" count={properties.length}>
        {properties.length === 0 ? (
          <p className="text-[10px] italic text-faint">No properties declared.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line">
            {properties.map((property, index) => (
              <div
                key={property.name}
                className={cn(
                  'grid grid-cols-[1fr_1fr] items-center gap-2 px-2.5 py-[7px]',
                  index !== 0 && 'border-t border-line',
                )}
              >
                <span className="mono truncate text-[10px] text-ink">{property.name}</span>
                <span className="flex justify-end">
                  <RefChip name={property.type} atlas={atlas} onSelectName={onSelectName} />
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section label="Instances" count={instances.length}>
        {instances.length === 0 ? (
          <p className="text-[10px] italic text-faint">No instances in this model set.</p>
        ) : (
          <div className="grid gap-1">
            {instances.map((instance) => (
              <ConnectionButton
                key={instance.id}
                entity={instance}
                atlas={atlas}
                onSelectName={onSelectName}
                labels={['instance of']}
              />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function ValueDisplay({
  value,
  atlas,
  onSelectName,
}: {
  value: unknown;
  atlas: Atlas;
  onSelectName: (name: string) => void;
}) {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap justify-end gap-1">
        {value.map((item, index) => (
          <ValueDisplay
            key={`${String(item)}-${index}`}
            value={item}
            atlas={atlas}
            onSelectName={onSelectName}
          />
        ))}
      </div>
    );
  }
  if (value === null) return <span className="mono text-[9.5px] text-faint">null</span>;
  if (typeof value === 'boolean') {
    return (
      <span
        className={cn(
          'mono rounded px-1.5 py-0.5 text-[9px]',
          value
            ? 'bg-moss/10 text-moss dark:bg-[#8cc4ab]/10 dark:text-[#a8d3bd]'
            : 'bg-surface-muted text-muted',
        )}
      >
        {String(value)}
      </span>
    );
  }
  if (typeof value === 'number') {
    return <span className="mono text-[10px] font-medium text-ink">{value}</span>;
  }
  if (typeof value === 'string') {
    if (lookup(atlas, value)) {
      return <RefChip name={value} atlas={atlas} onSelectName={onSelectName} />;
    }
    return (
      <span className="mono max-w-full truncate text-[10px] text-ink" title={value}>
        {value}
      </span>
    );
  }
  return (
    <span className="mono text-[9px] leading-relaxed text-muted">
      {JSON.stringify(value)}
    </span>
  );
}

function InstanceDetails({
  instance,
  atlas,
  onSelectName,
}: {
  instance: Instance;
  atlas: Atlas;
  onSelectName: (name: string) => void;
}) {
  const values = Object.entries(instance.values ?? {});
  return (
    <>
      <Section label="Realises">
        <div className="flex flex-wrap items-center gap-1.5">
          <RefChip name={instance.concept} atlas={atlas} onSelectName={onSelectName} emphasis />
          <span className="text-[10px] text-faint">concept</span>
        </div>
      </Section>
      <Section label="Values" count={values.length}>
        {values.length === 0 ? (
          <p className="text-[10px] italic text-faint">No values recorded.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line">
            {values.map(([key, value], index) => (
              <div
                key={key}
                className={cn(
                  'grid grid-cols-[0.85fr_1fr] items-start gap-2 px-2.5 py-[7px]',
                  index !== 0 && 'border-t border-line',
                )}
              >
                <span className="mono truncate pt-[2px] text-[10px] text-muted">{key}</span>
                <div className="flex min-w-0 justify-end text-right">
                  <ValueDisplay value={value} atlas={atlas} onSelectName={onSelectName} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function ConnectionButton({
  entity,
  atlas,
  onSelectName,
  labels,
  direction,
}: {
  entity: AtlasEntity;
  atlas: Atlas;
  onSelectName: (name: string) => void;
  labels: string[];
  direction?: 'out' | 'in';
}) {
  const degree = atlas.adjacency.get(entity.id)?.size ?? 0;
  return (
    <button
      type="button"
      onClick={() => onSelectName(entity.name)}
      className="group flex w-full items-start gap-2 rounded-md border border-transparent px-1.5 py-1.5 text-left transition-colors hover:border-line hover:bg-surface"
      title={entity.name}
    >
      <EntityGlyph kind={entity.kind} size={21} className="mt-[1px]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {direction && (
            <Icon
              name={direction === 'out' ? 'arrow-right' : 'arrow-up-right'}
              size={9}
              className="shrink-0 text-faint"
            />
          )}
          <span className="truncate text-[10.5px] font-medium text-ink">{entity.name}</span>
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1">
          {labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className="rounded-sm bg-surface-muted px-1 py-[1px] text-[8px] uppercase tracking-[0.08em] text-faint"
            >
              {label}
            </span>
          ))}
          {labels.length > 3 && (
            <span className="text-[8px] text-faint">+{labels.length - 3}</span>
          )}
        </span>
      </span>
      <span className="mono mt-[3px] shrink-0 text-[8px] text-faint group-hover:text-muted">
        {degree}
      </span>
      <Icon
        name="chevron-right"
        size={11}
        className="mt-[5px] shrink-0 text-line-strong transition-transform group-hover:translate-x-0.5 group-hover:text-muted"
      />
    </button>
  );
}

function Connections({
  entity,
  atlas,
  onSelectName,
}: {
  entity: AtlasEntity;
  atlas: Atlas;
  onSelectName: (name: string) => void;
}) {
  const entitiesById = useMemo(
    () => new Map(atlas.entities.map((item) => [item.id, item])),
    [atlas.entities],
  );
  const outgoing = atlas.outgoing.get(entity.id) ?? [];
  const incoming = atlas.incoming.get(entity.id) ?? [];

  const groups = (edges: AtlasEdge[], direction: 'out' | 'in') =>
    edges.map((edge) => ({
      edge,
      direction,
      other: entitiesById.get(direction === 'out' ? edge.targetId : edge.sourceId),
    }));

  const rows = [...groups(outgoing, 'out'), ...groups(incoming, 'in')];

  return (
    <Section label="Connections" count={rows.length}>
      {rows.length === 0 ? (
        <p className="text-[10px] italic text-faint">
          This record has no inferred links to other nodes.
        </p>
      ) : (
        <div className="grid gap-0.5">
          {rows.map(({ edge, direction, other }) =>
            other ? (
              <ConnectionButton
                key={`${edge.id}-${direction}`}
                entity={other}
                atlas={atlas}
                onSelectName={onSelectName}
                labels={edge.labels}
                direction={direction}
              />
            ) : null,
          )}
        </div>
      )}
      <p className="mt-2 flex items-start gap-1 text-[8.5px] leading-relaxed text-faint">
        <Icon name="info" size={10} className="mt-[1px] shrink-0" />
        Links are inferred from name matches in any field, not from a fixed reference schema.
      </p>
    </Section>
  );
}

function TaskDetails({
  entity,
  atlas,
  onSelectName,
}: {
  entity: AtlasEntity;
  atlas: Atlas;
  onSelectName: (name: string) => void;
}) {
  const task = entity.data as unknown as Task;
  return (
    <>
      <Section label="Interface">
        <InterfaceBlock entity={entity} atlas={atlas} onSelectName={onSelectName} />
      </Section>
      <Section label="Context">
        <div className="grid gap-1.5">
          <ContextRow label="Given" value={task.given} accent="#C6A800" />
          <ContextRow label="Makes" value={task.makes} accent="#005C45" />
        </div>
      </Section>
      <Section label="Means" count={task.means?.length ?? 0}>
        <MeansList task={task} atlas={atlas} onSelectName={onSelectName} />
      </Section>
    </>
  );
}

function MethodDetails({
  entity,
  atlas,
  onSelectName,
}: {
  entity: AtlasEntity;
  atlas: Atlas;
  onSelectName: (name: string) => void;
}) {
  const method = entity.data as unknown as Method;
  const assertions = method.assertions ?? [];
  return (
    <>
      <Section label="Interface">
        <InterfaceBlock entity={entity} atlas={atlas} onSelectName={onSelectName} />
      </Section>
      <Section label="Context">
        <div className="grid gap-1.5">
          <ContextRow label="Requires" value={method.requires} accent="#2F9FD9" />
          <ContextRow label="Provides" value={method.provides} accent="#005C45" />
        </div>
      </Section>
      <Section
        label="Organiser"
        count={method.organizer?.states.length}
        action={
          method.organizer ? (
            <span className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-faint">
              FSM
            </span>
          ) : undefined
        }
      >
        {method.organizer ? (
          <OrganiserBlock
            organizer={method.organizer}
            atlas={atlas}
            onSelectName={onSelectName}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-line px-3 py-3">
            <p className="text-[10.5px] font-medium text-muted">No organiser specified</p>
            <p className="mt-0.5 text-[9.5px] leading-relaxed text-faint">
              This method describes an interface and its requirements, but does not
              prescribe the order in which goals are invoked.
            </p>
          </div>
        )}
      </Section>
      <Section label="Assertions" count={assertions.length}>
        {assertions.length === 0 ? (
          <p className="text-[10px] italic text-faint">No assertions declared.</p>
        ) : (
          <div className="grid gap-1.5">
            {assertions.map((assertion) => (
              <AssertionCard
                key={assertion.name}
                assertion={assertion}
                atlas={atlas}
                onSelectName={onSelectName}
              />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function EmptyInspector({ atlas, onSelectName }: { atlas: Atlas; onSelectName: (name: string) => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-5 py-3.5">
        <p className="eyebrow text-faint">Inspector</p>
      </div>
      <div className="flex-1 overflow-y-auto thin-scrollbar px-5 py-8">
        <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-dashed border-line-strong" />
          <span className="absolute inset-2 rounded-full border border-line" />
          <Icon name="compass" size={22} className="relative text-moss" />
        </div>
        <p className="serif text-center text-[20px] leading-snug text-ink">Read the model,<br />one node at a time.</p>
        <p className="mx-auto mt-2 max-w-[240px] text-center text-[10.5px] leading-relaxed text-muted">
          Select any node in the graph to open its fields as structured, linked content.
          Nothing here writes back to the JSON.
        </p>
        <div className="mt-6">
          <p className="eyebrow mb-2 text-faint">Most connected</p>
          <div className="grid gap-1">
            {atlas.hubs.slice(0, 4).map((hub) => (
              <button
                key={hub.id}
                type="button"
                onClick={() => onSelectName(hub.name)}
                className="group flex items-center gap-2 rounded-lg border border-line bg-surface p-2 text-left transition-colors hover:border-line-strong hover:bg-surface-muted"
              >
                <EntityGlyph kind={hub.kind} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] font-medium text-ink">{hub.name}</span>
                  <span className="eyebrow mt-0.5 block text-[8px] text-faint">
                    {KIND_META[hub.kind].label} - {atlas.adjacency.get(hub.id)?.size ?? 0} links
                  </span>
                </span>
                <Icon name="arrow-up-right" size={11} className="text-faint" />
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 border-t border-line pt-4">
          <p className="eyebrow mb-2 text-faint">Reading the colours</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(['task', 'method', 'concept', 'instance'] as const).map((kind) => (
              <div key={kind} className="flex items-center gap-1.5">
                <EntityGlyph kind={kind} size={17} />
                <span className="text-[9.5px] text-muted">{KIND_META[kind].label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Inspector({
  atlas,
  entity,
  onClose,
  onSelectName,
  className,
}: InspectorProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [entity?.id]);

  if (!entity) {
    return (
      <div className={cn('overflow-hidden bg-surface', className)}>
        <EmptyInspector atlas={atlas} onSelectName={onSelectName} />
      </div>
    );
  }

  const data = entity.data;
  const task = entity.kind === 'task' ? (data as unknown as Task) : null;
  const method = entity.kind === 'method' ? (data as unknown as Method) : null;
  const concept = entity.kind === 'concept' ? (data as unknown as Concept) : null;
  const instance = entity.kind === 'instance' ? (data as unknown as Instance) : null;
  const sourceLabel =
    entity.kind === 'task'
      ? 'Task model'
      : entity.kind === 'method'
        ? 'Method model'
        : 'Knowledge model';
  const json = JSON.stringify(data, null, 2);
  const primaryId = instance ? instance.concept : null;

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-surface', className)}>
      <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
        <div className="flex items-center gap-2">
          <KindBadge kind={entity.kind} />
          <span className="mono text-[8.5px] text-faint">{sourceLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <CopyButton value={entity.name} label="Name" className="border-0 bg-transparent px-1.5" />
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label="Close inspector"
            title="Close inspector"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto thin-scrollbar">
        <div className="px-5 pb-5 pt-4">
          <p className="eyebrow mb-1.5 flex items-center gap-1 text-faint">
            {KIND_META[entity.kind].label}
            <span className="text-line-strong">/</span>
            {primaryId ? (
              <span className="normal-case tracking-normal">{primaryId}</span>
            ) : (
              <span className="normal-case tracking-normal">entity</span>
            )}
          </p>
          <h2 className="serif break-words text-[25px] font-medium leading-[1.08] tracking-[-0.015em] text-ink-strong">
            {entity.name}
          </h2>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">{entity.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1 text-[9px] text-faint">
              <Icon name="link" size={10} />
              {atlas.adjacency.get(entity.id)?.size ?? 0} links
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] text-faint">
              <Icon name="layers" size={10} />
              {Object.keys(data).length} fields
            </span>
            <span className="ml-auto">
              <ReadOnlyNote />
            </span>
          </div>
        </div>

        {task && <TaskDetails entity={entity} atlas={atlas} onSelectName={onSelectName} />}
        {method && <MethodDetails entity={entity} atlas={atlas} onSelectName={onSelectName} />}
        {concept && <ConceptDetails concept={concept} atlas={atlas} onSelectName={onSelectName} />}
        {instance && <InstanceDetails instance={instance} atlas={atlas} onSelectName={onSelectName} />}

        <Connections entity={entity} atlas={atlas} onSelectName={onSelectName} />

        <details className="group border-t border-line px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Icon name="code" size={13} className="text-faint" />
              <span className="eyebrow text-faint">Raw record</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[9px] text-faint group-open:hidden">Open</span>
              <Icon
                name="chevron-down"
                size={12}
                className="text-faint transition-transform group-open:rotate-180"
              />
            </span>
          </summary>
          <div className="mt-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="mono text-[8.5px] text-faint">{entity.name}.json</span>
              <CopyButton value={json} label="Copy" />
            </div>
            <pre className="thin-scrollbar max-h-72 overflow-auto rounded-lg border border-line bg-surface-muted p-3 font-mono text-[9px] leading-[1.7] text-muted">
              {json}
            </pre>
          </div>
        </details>

        <div className="flex items-start gap-1.5 border-t border-line bg-surface-muted/50 px-5 py-3 text-[8.5px] leading-relaxed text-faint">
          <Icon name="lock" size={10} className="mt-[1px] shrink-0" />
          Frozen source record. Structured sections above are derived for reading; the JSON
          document is never modified.
        </div>
      </div>
    </div>
  );
}
