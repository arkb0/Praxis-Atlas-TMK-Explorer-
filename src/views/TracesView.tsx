/**
 * Ivy trace anatomy.
 *
 * This view is additive: it does not read or write the active TMK model, except
 * to overlay direct model links in the trace graph. A pasted trace is opaque
 * source material. Parsing produces a parallel description (sections, docs,
 * tuple) while the raw trace stays recoverable at all times.
 */
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/utils/cn';
import { KIND_META } from '@/lib/kinds';
import type { Atlas } from '@/lib/atlas';
import {
  buildTraceGraph,
  parseTraces,
  type ParsedTrace,
  type RetrievedDoc,
  type SixTuple,
  type TraceNode,
  type TraceNodeKind,
  type TraceSection,
  type TraceSectionKind,
} from '@/lib/traces';
import type { EntityKind, ModelSet } from '@/types/tmk';
import PageHeader from '@/components/PageHeader';
import TraceGraph from '@/components/TraceGraph';
import CodeBlock from '@/components/CodeBlock';
import Prose from '@/components/Prose';
import Icon, { type IconName } from '@/components/Icon';
import { CopyButton } from '@/components/ui';
import sampleTraces from '@/data/sample-traces.txt?raw';

interface TracesViewProps {
  atlas: Atlas;
  modelSet: ModelSet;
  source: string;
  onSourceChange: (text: string) => void;
  onInspectInAtlas: (name: string) => void;
  onOpenModels: () => void;
}

const TRACE_KIND: Record<
  TraceNodeKind,
  { label: string; colour: string; entityKind: EntityKind }
> = {
  task: { label: 'Task', colour: KIND_META.task.accent, entityKind: 'task' },
  method: { label: 'Method', colour: KIND_META.method.accent, entityKind: 'method' },
  concept: { label: 'Knowledge', colour: KIND_META.concept.accent, entityKind: 'concept' },
  operation: { label: 'Operation', colour: '#5C8A72', entityKind: 'instance' },
  unknown: { label: 'Unclassified', colour: '#8A9386', entityKind: 'instance' },
};

const SECTION_ICON: Record<TraceSectionKind, IconName> = {
  anchor: 'compass',
  prompt: 'code',
  classification: 'target',
  retrieval: 'search',
  intermediate: 'route',
  final: 'flag',
  tuple: 'layers',
  generic: 'library',
};

function traceKindOf(label: string | null | undefined): TraceNodeKind {
  const key = (label ?? '').trim().toLowerCase();
  if (key === 'task') return 'task';
  if (key === 'method') return 'method';
  if (key === 'knowledge' || key === 'concept') return 'concept';
  if (key === 'operation') return 'operation';
  return 'unknown';
}

function byName(name: string): string {
  return name.trim().toLowerCase();
}

function scoreText(score: number | null | undefined): string {
  return score === null || score === undefined ? 'not provided' : String(score);
}

function scoreWidth(score: number | null | undefined): string {
  if (score === null || score === undefined) return '0%';
  return `${Math.max(0, Math.min(1, score)) * 100}%`;
}

function TraceBadge({
  kind,
  label,
  className,
}: {
  kind: TraceNodeKind;
  label?: string;
  className?: string;
}) {
  const meta = TRACE_KIND[kind];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-[2px] text-[8.5px] font-semibold uppercase leading-none tracking-[0.1em]',
        className,
      )}
      style={{
        backgroundColor: `${meta.colour}1f`,
        color: meta.colour,
        border: `1px solid ${meta.colour}38`,
      }}
    >
      {label ?? meta.label}
    </span>
  );
}

function ClassificationBadge({ value }: { value?: string }) {
  if (!value) {
    return (
      <span className="rounded-full border border-line bg-surface-muted px-2 py-[3px] text-[8.5px] uppercase tracking-[0.1em] text-faint">
        no classification
      </span>
    );
  }
  const yes = value.toLowerCase() === 'yes';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[8.5px] font-semibold uppercase tracking-[0.1em]',
        yes
          ? 'border-moss/25 bg-moss/[0.08] text-moss dark:border-[#9bc9b0]/25 dark:bg-[#9bc9b0]/10 dark:text-[#a8cbb7]'
          : 'border-rust/25 bg-rust/[0.08] text-rust',
      )}
    >
      <Icon name={yes ? 'check' : 'close'} size={9} />
      {value}
    </span>
  );
}

// --- paste / load ----------------------------------------------------------

function LoadPanel({
  draft,
  source,
  editing,
  traceCount,
  yesCount,
  onChange,
  onRead,
  onEdit,
  onLoadExample,
  onClear,
}: {
  draft: string;
  source: string;
  editing: boolean;
  traceCount: number;
  yesCount: number;
  onChange: (value: string) => void;
  onRead: () => void;
  onEdit: () => void;
  onLoadExample: () => void;
  onClear: () => void;
}) {
  const dirty = draft !== source;
  const primary =
    'inline-flex h-8 items-center gap-1.5 rounded-md bg-moss px-3 text-[10px] font-semibold text-[#f4f1e5] transition-colors hover:bg-[#007054]';
  const secondary =
    'inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[10px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-muted';

  return (
    <section className="mb-4 rounded-xl border border-line bg-surface px-4 py-3" aria-label="Paste traces">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface-muted text-moss dark:text-[#a8cbb7]">
            <Icon name="quote" size={13} />
          </span>
          <div>
            <p className="text-[10.5px] font-semibold text-ink">Paste Ivy traces</p>
            <p className="mt-0.5 max-w-[640px] text-[9.5px] leading-relaxed text-muted">
              One trace or several, separated by a line containing only{' '}
              <code className="mono rounded border border-line bg-surface-muted px-1">***</code>.
              Everything is read in this browser and kept as written; the text is never sent
              anywhere. The bundled example is a condensed illustration of the format.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {!editing && (
            <button type="button" className={secondary} onClick={onEdit}>
              <Icon name="code" size={12} className="text-muted" />
              Edit input
            </button>
          )}
          <button type="button" className={secondary} onClick={onLoadExample}>
            <Icon name="spark" size={12} className="text-muted" />
            Example traces
          </button>
          {editing && (
            <button type="button" className={secondary} onClick={onClear}>
              <Icon name="close" size={12} className="text-muted" />
              Clear
            </button>
          )}
          {editing && (
            <button type="button" className={primary} onClick={onRead} disabled={!draft.trim()}>
              <Icon name="eye" size={12} />
              Read traces
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-3">
          <textarea
            value={draft}
            onChange={(event) => onChange(event.target.value)}
            rows={10}
            spellCheck={false}
            placeholder="Paste an Ivy trace here..."
            aria-label="Paste Ivy traces"
            className="thin-scrollbar w-full resize-y rounded-lg border border-line bg-surface-muted/50 px-3 py-2.5 font-mono text-[9.5px] leading-[1.7] text-ink outline-none transition-colors placeholder:text-faint focus:border-sky/70 focus:ring-2 focus:ring-sky/15"
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[8.5px] text-faint">
              {draft.length.toLocaleString('en-GB')} characters
              {dirty && ' - not read yet'}
            </p>
            <CopyButton value={draft} label="Copy input" />
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-2.5 text-[9.5px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[5px] w-[5px] rounded-full bg-moss dark:bg-[#86bfa4]" />
            <span className="mono text-ink">{traceCount}</span> trace{traceCount === 1 ? '' : 's'} read
          </span>
          <span>
            <span className="mono text-ink">{yesCount}</span> classified yes
          </span>
          <span className="text-faint">Source text is retained exactly.</span>
        </div>
      )}
    </section>
  );
}

// --- sections --------------------------------------------------------------

function SectionCard({
  section,
  trace,
  atlas,
  selectedId,
  onSelectName,
}: {
  section: TraceSection;
  trace: ParsedTrace;
  atlas: Atlas;
  selectedId: string | null;
  onSelectName: (name: string) => void;
}) {
  const isInput = section.kind === 'anchor' || section.kind === 'prompt';
  const [open, setOpen] = useState(!isInput);
  const icon = SECTION_ICON[section.kind];

  if (section.kind === 'tuple') return null;

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface-muted/40"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-muted text-moss dark:text-[#a8cbb7]">
          <Icon name={icon} size={13} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="mono block break-words text-[9.5px] font-medium tracking-[0.04em] text-ink">
            {section.heading}
          </span>
          <span className="mt-0.5 block text-[8.5px] text-faint">
            {section.kind === 'retrieval'
              ? `${section.docs.length} retrieved document${section.docs.length === 1 ? '' : 's'}`
              : isInput
                ? 'Prompt material - expand to read'
                : 'Rendered output'}
          </span>
        </span>
        {section.kind === 'classification' && <ClassificationBadge value={trace.classification} />}
        <Icon
          name="chevron-down"
          size={13}
          className={cn('ml-1 shrink-0 text-faint transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-t border-line px-4 py-3.5">
          {section.kind === 'classification' ? (
            <div className="flex flex-wrap items-center gap-2">
              <ClassificationBadge value={trace.classification} />
              <Prose content={section.content} preserveLines className="text-[11px]" />
            </div>
          ) : section.kind === 'retrieval' ? (
            section.docs.length > 0 ? (
              <div className="grid gap-2">
                {section.docs.map((doc) => (
                  <DocCard
                    key={`${doc.index}-${doc.entry}`}
                    doc={doc}
                    atlas={atlas}
                    selectedId={selectedId}
                    onSelectName={onSelectName}
                  />
                ))}
              </div>
            ) : (
              <Prose content={section.content} />
            )
          ) : isInput ? (
            <Prose content={section.content} preserveLines />
          ) : (
            <Prose content={section.content} />
          )}
          {!section.content.trim() && section.kind !== 'retrieval' && (
            <p className="text-[10px] italic text-faint">This section has no content.</p>
          )}
        </div>
      )}
    </section>
  );
}

function DocCard({
  doc,
  atlas,
  selectedId,
  onSelectName,
}: {
  doc: RetrievedDoc;
  atlas: Atlas;
  selectedId: string | null;
  onSelectName: (name: string) => void;
}) {
  const kind = traceKindOf(doc.source);
  const nodeId = byName(doc.entry);
  const selected = selectedId === nodeId;
  const inGraph = Boolean(
    atlas.entities.some((entity) => entity.name.toLowerCase() === nodeId) ||
      doc.parsed !== null,
  );
  return (
    <article
      className={cn(
        'overflow-hidden rounded-lg border bg-surface transition-colors',
        selected ? 'border-moss/40 dark:border-[#9bc9b0]/35' : 'border-line',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-2.5 py-2">
        <span className="mono rounded border border-line bg-surface-muted px-1 py-[1px] text-[8px] text-faint">
          [{doc.index}]
        </span>
        <TraceBadge kind={kind} label={doc.source || 'unknown'} />
        <button
          type="button"
          onClick={() => onSelectName(doc.entry)}
          disabled={!inGraph}
          className="group flex min-w-0 items-center gap-1 text-left"
          title={inGraph ? `Show ${doc.entry} in the trace graph` : doc.entry}
        >
          <span className="mono truncate text-[10.5px] font-semibold text-ink group-hover:text-moss dark:group-hover:text-[#a8cbb7]">
            {doc.entry}
          </span>
          {inGraph && (
            <Icon
              name="target"
              size={10}
              className="shrink-0 text-faint group-hover:text-moss dark:group-hover:text-[#a8cbb7]"
            />
          )}
        </button>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <span className="mono text-[8.5px] text-faint">score</span>
          <span className="mono text-[9.5px] text-ink" title={doc.scoreRaw}>
            {scoreText(doc.score)}
          </span>
          <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-surface-muted sm:block">
            <span className="block h-full rounded-full" style={{ width: scoreWidth(doc.score), backgroundColor: TRACE_KIND[kind].colour }} />
          </span>
        </span>
      </div>
      <div className="p-2.5">
        {doc.parsed === null && (
          <p className="mb-1.5 flex items-center gap-1 text-[8.5px] text-faint">
            <Icon name="info" size={9} />
            This body is not a complete JSON-compatible literal; the exact text is shown.
          </p>
        )}
        <CodeBlock
          value={doc.parsed ?? doc.raw}
          raw={doc.raw}
          maxHeight={230}
          label={`${doc.entry}.json`}
          compact
        />
      </div>
    </article>
  );
}

// --- 6-tuple ---------------------------------------------------------------

function TupleTable({
  tuple,
  graph,
  selectedId,
  onSelectName,
}: {
  tuple: SixTuple | undefined;
  graph: ReturnType<typeof buildTraceGraph> | null;
  selectedId: string | null;
  onSelectName: (name: string) => void;
}) {
  if (!tuple || !tuple.available) {
    return (
      <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Icon name="layers" size={13} className="text-moss dark:text-[#a8cbb7]" />
          <h2 className="text-[11px] font-semibold text-ink">6-tuple trace</h2>
        </div>
        <p className="mt-1 text-[9.5px] text-muted">
          This trace has no 6-tuple block, so there are no scored elements to align or plot.
        </p>
      </div>
    );
  }

  const rowCount = Math.max(
    tuple.metadata.length,
    tuple.sources.length,
    tuple.scores.length,
  );
  const misaligned =
    tuple.metadata.length !== tuple.sources.length ||
    tuple.sources.length !== tuple.scores.length;
  const graphIds = new Set(graph?.nodes.map((node) => node.id) ?? []);

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name="layers" size={13} className="text-moss dark:text-[#a8cbb7]" />
          <h2 className="text-[11px] font-semibold text-ink">6-tuple trace</h2>
          <span className="mono rounded border border-line bg-surface-muted px-1 py-[1px] text-[8px] text-faint">
            {rowCount} rows
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tuple.responseType && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-muted px-2 py-[2px] text-[8.5px] text-muted">
              response_type
              <span className="mono text-ink">{tuple.responseType}</span>
            </span>
          )}
          <CopyButton value={tuple.raw} label="Copy block" />
        </div>
      </div>

      <div className="thin-scrollbar overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-muted/50">
              <th className="w-10 px-3 py-2 text-[8px] font-medium uppercase tracking-[0.12em] text-faint">#</th>
              <th className="w-28 px-3 py-2 text-[8px] font-medium uppercase tracking-[0.12em] text-faint">Metadata</th>
              <th className="px-3 py-2 text-[8px] font-medium uppercase tracking-[0.12em] text-faint">Source</th>
              <th className="w-48 px-3 py-2 text-[8px] font-medium uppercase tracking-[0.12em] text-faint">Score</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, index) => {
              const metadata = tuple.metadata[index];
              const source = tuple.sources[index];
              const score = tuple.scores[index];
              const kind = traceKindOf(metadata);
              const id = source ? byName(source) : null;
              const selected = Boolean(id && selectedId === id);
              return (
                <tr
                  key={`tuple-row-${index}`}
                  className={cn(
                    'border-b border-line/70 last:border-b-0 transition-colors',
                    selected ? 'bg-moss/[0.055] dark:bg-[#9bc9b0]/[0.06]' : 'hover:bg-surface-muted/40',
                  )}
                >
                  <td className="px-3 py-2 align-middle">
                    <span className="mono text-[8.5px] text-faint">{index}</span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    {metadata ? (
                      <TraceBadge kind={kind} label={metadata} />
                    ) : (
                      <span className="text-[9px] italic text-faint">not provided</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    {source ? (
                      <button
                        type="button"
                        onClick={() => onSelectName(source)}
                        disabled={!graphIds.has(id ?? '')}
                        className={cn(
                          'group flex items-center gap-1.5 text-left',
                          graphIds.has(id ?? '') ? 'cursor-pointer' : 'cursor-default',
                        )}
                        title={
                          graphIds.has(id ?? '')
                            ? `Focus ${source} in the trace graph`
                            : `${source} is not plotted in the current view`
                        }
                      >
                        <span className="mono break-words text-[10px] font-medium text-ink">{source}</span>
                        {graphIds.has(id ?? '') && (
                          <Icon
                            name="target"
                            size={10}
                            className="shrink-0 text-faint transition-colors group-hover:text-moss dark:group-hover:text-[#a8cbb7]"
                          />
                        )}
                      </button>
                    ) : (
                      <span className="text-[9px] italic text-faint">not provided</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="mono min-w-[92px] text-[9px] text-muted" title={score === null || score === undefined ? undefined : String(score)}>
                        {scoreText(score)}
                      </span>
                      <span className="h-1 min-w-[48px] flex-1 overflow-hidden rounded-full bg-surface-muted">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: scoreWidth(score),
                            backgroundColor: metadata ? TRACE_KIND[kind].colour : 'var(--faint)',
                          }}
                        />
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 border-t border-line px-4 py-2">
        {misaligned && (
          <p className="flex items-start gap-1 text-[8.5px] leading-relaxed text-faint">
            <Icon name="info" size={9} className="mt-[1px] shrink-0" />
            The tuple lists differ in length. Rows are aligned strictly by index; missing values are
            left blank rather than guessed.
          </p>
        )}
        {tuple.extras.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {tuple.extras.map((extra, index) => (
              <span key={`extra-${index}`} className="mono break-words text-[8.5px] text-faint">
                {extra.key ? `${extra.key}: ` : ''}
                {extra.value}
              </span>
            ))}
          </div>
        )}
        <p className="text-[8.5px] text-faint">
          Rows are index-aligned exactly as pasted. Selecting a source focuses its node in the
          graph.
        </p>
      </div>
    </section>
  );
}

// --- graph panel -----------------------------------------------------------

function NodeDetail({
  node,
  graph,
  onSelectName,
  onInspectInAtlas,
  onOpenModels,
  showUnmatchedWarning,
}: {
  node: TraceNode | null;
  graph: ReturnType<typeof buildTraceGraph>;
  onSelectName: (name: string) => void;
  onInspectInAtlas: (name: string) => void;
  onOpenModels: () => void;
  showUnmatchedWarning: boolean;
}) {
  if (!node) {
    return (
      <div className="border-t border-line px-4 py-3">
        <p className="text-[9.5px] text-muted">
          Select a node to read its role, retrieved fields and direct connections.
        </p>
      </div>
    );
  }
  const incident = graph.edges.filter(
    (edge) => edge.sourceId === node.id || edge.targetId === node.id,
  );
  const nodeById = new Map(graph.nodes.map((item) => [item.id, item]));

  return (
    <div className="border-t border-line">
      <div className="px-4 pb-3 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <TraceBadge kind={node.kind} />
          {node.inTrace && (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-1.5 py-[2px] text-[8px] uppercase tracking-[0.1em] text-[#7a6500] dark:text-gold">
              trace item
            </span>
          )}
          {node.outgoing && (
            <span className="rounded-full border border-line bg-surface-muted px-1.5 py-[2px] text-[8px] uppercase tracking-[0.1em] text-muted">
              outgoing
            </span>
          )}
          {node.incoming && (
            <span className="rounded-full border border-line bg-surface-muted px-1.5 py-[2px] text-[8px] uppercase tracking-[0.1em] text-muted">
              incoming
            </span>
          )}
          {node.inTrace && node.score !== null && (
            <span className="mono ml-auto text-[8.5px] text-faint" title="score from the 6-tuple trace">
              {String(node.score)}
            </span>
          )}
        </div>
        <h3 className="serif mt-1.5 break-words text-[18px] font-medium leading-tight text-ink">
          {node.name}
        </h3>
        <p className="mt-1 text-[9.5px] leading-relaxed text-muted">
          {node.description || 'No retrieved description for this element in this trace.'}
        </p>
        {!node.inAtlas && showUnmatchedWarning && (
          <p className="mt-1.5 flex items-start gap-1 text-[8.5px] leading-relaxed text-faint">
            <Icon name="info" size={9} className="mt-[1px] shrink-0" />
            No trace name resolves in the loaded TMK, so kinds come from the trace metadata.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {node.inAtlas ? (
            <button
              type="button"
              onClick={() => onInspectInAtlas(node.name)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[9px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-muted"
            >
              <Icon name="arrow-up-right" size={10} />
              Inspect in atlas
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenModels}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[9px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-muted"
            >
              <Icon name="models" size={10} />
              Load its TMK
            </button>
          )}
          {node.doc && (
            <span className="mono inline-flex h-7 items-center rounded-md border border-line bg-surface-muted px-2 text-[8.5px] text-faint">
              retrieved [{node.doc.index}]
            </span>
          )}
        </div>
      </div>

      {incident.length > 0 && (
        <div className="border-t border-line px-4 py-2.5">
          <p className="eyebrow mb-1.5 text-faint">Direct connections</p>
          <div className="grid gap-0.5">
            {incident.map((edge) => {
              const out = edge.sourceId === node.id;
              const other = nodeById.get(out ? edge.targetId : edge.sourceId);
              if (!other) return null;
              return (
                <button
                  key={`${edge.id}-${node.id}`}
                  type="button"
                  onClick={() => onSelectName(other.name)}
                  className="group flex items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-surface-muted"
                >
                  <Icon
                    name={out ? 'arrow-right' : 'arrow-up-right'}
                    size={9}
                    className="shrink-0 text-faint"
                  />
                  <span className="mono truncate text-[9px] text-ink">{other.name}</span>
                  <span className="ml-auto truncate text-[8px] text-faint">
                    {edge.labels.slice(0, 2).join(', ')}
                  </span>
                  <span
                    className="h-[4px] w-[4px] shrink-0 rounded-full"
                    style={{ backgroundColor: TRACE_KIND[other.kind].colour }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {node.fields !== undefined && (
        <details className="group border-t border-line px-4 py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-1.5">
              <Icon name="code" size={11} className="text-faint" />
              <span className="eyebrow text-faint">Retrieved fields</span>
            </span>
            <Icon
              name="chevron-down"
              size={11}
              className="text-faint transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="mt-2">
            <CodeBlock value={node.fields} raw={node.doc?.raw} maxHeight={200} compact label={`${node.name}.json`} />
          </div>
        </details>
      )}
    </div>
  );
}

function GraphPanel({
  graph,
  selectedNode,
  includeOut,
  includeIn,
  onToggleOut,
  onToggleIn,
  onSelectName,
  onInspectInAtlas,
  onOpenModels,
  atlasMatches,
  modelSet,
}: {
  graph: ReturnType<typeof buildTraceGraph> | null;
  selectedNode: TraceNode | null;
  includeOut: boolean;
  includeIn: boolean;
  onToggleOut: () => void;
  onToggleIn: () => void;
  onSelectName: (name: string) => void;
  onInspectInAtlas: (name: string) => void;
  onOpenModels: () => void;
  atlasMatches: number;
  modelSet: ModelSet;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-muted text-moss dark:text-[#a8cbb7]">
            <Icon name="atlas" size={14} />
          </span>
          <div>
            <h2 className="text-[11.5px] font-semibold leading-tight text-ink">Trace TMK graph</h2>
            <p className="mt-0.5 text-[8.5px] text-faint">Filtered to this trace, never the whole model.</p>
          </div>
        </div>
        <span className="mono rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[8px] text-faint">
          {graph ? `${graph.nodes.length} nodes` : 'no data'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-surface-muted/40 px-4 py-2">
        <span className="eyebrow text-faint">Show</span>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-[3px] text-[9.5px] text-muted transition-colors hover:text-ink">
          <input
            type="checkbox"
            checked={includeOut}
            onChange={onToggleOut}
            className="h-3 w-3 accent-[#005C45] dark:accent-[#8cc4ab]"
          />
          Outgoing
          <span className="mono text-[8px] text-faint">{graph?.outgoingCount ?? 0}</span>
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-[3px] text-[9.5px] text-muted transition-colors hover:text-ink">
          <input
            type="checkbox"
            checked={includeIn}
            onChange={onToggleIn}
            className="h-3 w-3 accent-[#005C45] dark:accent-[#8cc4ab]"
          />
          Incoming
          <span className="mono text-[8px] text-faint">{graph?.incomingCount ?? 0}</span>
        </label>
        {!includeOut && !includeIn && (
          <span className="ml-auto text-[8px] text-faint">trace items only</span>
        )}
      </div>

      {graph ? (
        <TraceGraph
          graph={graph}
          selectedId={selectedNode?.id ?? null}
          onSelect={(id) => {
            const node = graph.nodes.find((item) => item.id === id);
            if (node) onSelectName(node.name);
          }}
          className="h-[330px] w-full rounded-none border-0"
        />
      ) : (
        <div className="px-4 py-10 text-center">
          <Icon name="atlas" size={20} className="mx-auto mb-2 text-faint" />
          <p className="text-[10.5px] text-muted">No 6-tuple trace to plot.</p>
        </div>
      )}

      <NodeDetail
        node={selectedNode}
        graph={graph ?? { nodes: [], edges: [], traceNames: [], outgoingCount: 0, incomingCount: 0 }}
        onSelectName={onSelectName}
        onInspectInAtlas={onInspectInAtlas}
        onOpenModels={onOpenModels}
        showUnmatchedWarning={atlasMatches === 0}
      />

      <div className="border-t border-line bg-surface-muted/40 px-4 py-2">
        <p className="text-[8px] leading-relaxed text-faint">
          Trace edges come from structured fields in the retrieved entries. Dashed edges are direct
          links from the loaded TMK ({modelSet.name}); {atlasMatches} trace name
          {atlasMatches === 1 ? '' : 's'} resolve there. No path beyond a direct connection is shown.
        </p>
      </div>
    </section>
  );
}

// --- page ------------------------------------------------------------------

export default function TracesView({
  atlas,
  modelSet,
  source,
  onSourceChange,
  onInspectInAtlas,
  onOpenModels,
}: TracesViewProps) {
  const [draft, setDraft] = useState(source);
  const [editing, setEditing] = useState(!source.trim());
  const [activeIndex, setActiveIndex] = useState(0);
  const [includeOut, setIncludeOut] = useState(false);
  const [includeIn, setIncludeIn] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    setDraft(source);
  }, [source]);

  const traces = useMemo(() => parseTraces(source), [source]);
  const activeTrace = traces[activeIndex] ?? traces[0] ?? null;

  useEffect(() => {
    setActiveIndex(0);
  }, [source]);

  useEffect(() => {
    setSelectedId(null);
    setShowRaw(false);
  }, [activeTrace?.id]);

  const graph = useMemo(
    () => (activeTrace ? buildTraceGraph(activeTrace, { includeOut, includeIn, atlas }) : null),
    [activeTrace, includeOut, includeIn, atlas],
  );

  const selectedNode =
    graph?.nodes.find((node) => node.id === selectedId) ??
    graph?.nodes.find((node) => node.inTrace) ??
    null;

  const atlasMatches = graph?.nodes.filter((node) => node.inAtlas && node.inTrace).length ?? 0;
  const traceItemCount = traces.reduce((total, trace) => total + (trace.tuple?.sources.length ?? 0), 0);
  const yesCount = traces.filter((trace) => (trace.classification ?? '').toLowerCase() === 'yes').length;

  function readTraces(): void {
    onSourceChange(draft);
    setEditing(false);
  }

  function loadExample(): void {
    setDraft(sampleTraces);
    onSourceChange(sampleTraces);
    setEditing(false);
  }

  function clear(): void {
    setDraft('');
    onSourceChange('');
    setEditing(true);
  }

  function selectName(name: string): void {
    setSelectedId(byName(name));
  }

  return (
    <>
      <PageHeader
        kicker={
          <>
            Ivy traces
            <span className="text-line-strong">/</span>
            Pasted evidence
          </>
        }
        title={
          <>
            Trace{' '}
            <span className="italic text-moss dark:text-[#a8cbb7]">anatomy</span>
          </>
        }
        description="Read an answer as a system produced it: the question, the prompts, the retrieved TMK documents, every stage output, and the scored 6-tuple. Presentation changes; the text does not."
        stats={[
          { label: 'Traces', value: traces.length },
          { label: 'Trace items', value: traceItemCount },
          { label: 'Classified yes', value: yesCount },
        ]}
      />

      <LoadPanel
        draft={draft}
        source={source}
        editing={editing}
        traceCount={traces.length}
        yesCount={yesCount}
        onChange={setDraft}
        onRead={readTraces}
        onEdit={() => setEditing(true)}
        onLoadExample={loadExample}
        onClear={clear}
      />

      {traces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <Icon name="quote" size={22} className="mx-auto mb-3 text-faint" />
          <p className="serif text-[21px] text-ink">Paste a trace to read it closely.</p>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[10.5px] leading-relaxed text-muted">
            The parser looks for <code className="mono">QUESTION:</code> headers, dashed section
            dividers, retrieved document blocks and a <code className="mono">6-TUPLE TRACE</code>.
            Use <code className="mono">***</code> on its own line between traces.
          </p>
          <button
            type="button"
            onClick={loadExample}
            className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md bg-moss px-3 text-[10px] font-semibold text-[#f4f1e5] transition-colors hover:bg-[#007054]"
          >
            <Icon name="spark" size={12} />
            Load example traces
          </button>
        </div>
      ) : activeTrace ? (
        <>
          {traces.length > 1 && (
            <div className="mb-4 flex flex-col gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 sm:flex-row sm:items-center">
              <span className="eyebrow shrink-0 px-1 text-faint">Traces</span>
              <div className="hide-scrollbar flex gap-1 overflow-x-auto">
                {traces.map((trace, index) => (
                  <button
                    key={trace.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-pressed={index === activeIndex}
                    className={cn(
                      'flex min-w-[150px] max-w-[260px] shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                      index === activeIndex
                        ? 'border-line-strong bg-surface-muted'
                        : 'border-line bg-surface hover:bg-surface-muted/50',
                    )}
                  >
                    <span className={cn('mono text-[8.5px]', index === activeIndex ? 'text-moss dark:text-[#a8cbb7]' : 'text-faint')}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-[9.5px] font-medium text-ink">{trace.question}</span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <ClassificationBadge value={trace.classification} />
                        <span className="mono text-[8px] text-faint">
                          {trace.tuple?.sources.length ?? 0} items
                        </span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="eyebrow text-faint">Question</span>
                <span className="mono text-[8px] text-line-strong">/</span>
                <span className="mono text-[8.5px] uppercase tracking-[0.1em] text-faint">
                  trace {String(activeTrace.index + 1).padStart(2, '0')} of{' '}
                  {String(traces.length).padStart(2, '0')}
                </span>
                <ClassificationBadge value={activeTrace.classification} />
                {activeTrace.tuple?.responseType && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-muted px-2 py-[2px] text-[8.5px] text-muted">
                    response_type
                    <span className="mono text-ink">{activeTrace.tuple.responseType}</span>
                  </span>
                )}
              </div>
              <div className="hidden items-center gap-1.5 sm:flex">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex h-[26px] items-center gap-1 rounded-md border border-line bg-surface px-2 text-[9px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
                >
                  <Icon name="quote" size={11} />
                  Edit input
                </button>
                <button
                  type="button"
                  onClick={() => loadExample()}
                  className="inline-flex h-[26px] items-center gap-1 rounded-md border border-line bg-surface px-2 text-[9px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
                >
                  <Icon name="spark" size={11} />
                  Example
                </button>
                <button
                  type="button"
                  onClick={onOpenModels}
                  className="inline-flex h-[26px] items-center gap-1 rounded-md border border-line bg-surface px-2 text-[9px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
                  title={`Open ${modelSet.name} in Source models`}
                >
                  <Icon name="models" size={11} />
                  Source TMK
                </button>
                <CopyButton value={activeTrace.raw} label="Copy trace" />
                <button
                  type="button"
                  onClick={() => setShowRaw((current) => !current)}
                  aria-pressed={showRaw}
                  className={cn(
                    'inline-flex h-[26px] items-center gap-1 rounded-md border px-2 text-[9px] font-medium transition-colors',
                    showRaw
                      ? 'border-line-strong bg-surface-muted text-ink'
                      : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  <Icon name="code" size={11} />
                  Raw
                </button>
              </div>
            </div>
            <div className="px-4 py-4">
              <h2 className="serif break-words text-[23px] font-medium leading-[1.18] tracking-[-0.015em] text-ink-strong sm:text-[27px]">
                {activeTrace.question}
              </h2>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] text-faint">
                <span>
                  <span className="mono text-ink">{activeTrace.sections.length}</span> sections
                </span>
                <span>
                  <span className="mono text-ink">{activeTrace.docs.length}</span> retrieved documents
                </span>
                <span>
                  <span className="mono text-ink">{activeTrace.tuple?.sources.length ?? 0}</span> trace items
                </span>
                <span className="ml-auto hidden sm:inline">
                  {activeTrace.raw.length.toLocaleString('en-GB')} source characters
                </span>
              </div>
              {activeTrace.warnings.length > 0 && (
                <details className="mt-2">
                  <summary className="mono cursor-pointer list-none text-[8.5px] text-faint hover:text-muted [&::-webkit-details-marker]:hidden">
                    Parsing notes ({activeTrace.warnings.length})
                  </summary>
                  <ul className="mt-1 grid gap-0.5">
                    {activeTrace.warnings.map((warning) => (
                      <li key={warning} className="flex items-start gap-1 text-[8.5px] leading-relaxed text-muted">
                        <Icon name="info" size={9} className="mt-[1px] shrink-0" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </section>

          <div className="mt-3">
            <TupleTable
              tuple={activeTrace.tuple}
              graph={graph}
              selectedId={selectedNode?.id ?? null}
              onSelectName={selectName}
            />
          </div>

          <div className="mt-3 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="order-2 min-w-0">
              {showRaw ? (
                <section className="overflow-hidden rounded-xl border border-line bg-surface">
                  <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Icon name="code" size={12} className="text-faint" />
                      <span className="eyebrow text-faint">Raw trace</span>
                      <span className="mono text-[8px] text-faint">exactly as pasted</span>
                    </div>
                    <CopyButton value={activeTrace.raw} label="Copy" />
                  </div>
                  <pre className="thin-scrollbar max-h-[640px] overflow-auto bg-[#101f18] px-3 py-3 font-mono text-[9px] leading-[1.7] whitespace-pre-wrap text-[#d7e2d4]">
                    {activeTrace.raw}
                  </pre>
                </section>
              ) : (
                <div className="grid gap-2.5">
                  {activeTrace.sections.map((section) => (
                    <SectionCard
                      key={`${activeTrace.raw.length}-${section.kind}-${section.heading}`}
                      section={section}
                      trace={activeTrace}
                      atlas={atlas}
                      selectedId={selectedNode?.id ?? null}
                      onSelectName={selectName}
                    />
                  ))}
                  {activeTrace.sections.length === 0 && (
                    <div className="rounded-xl border border-line bg-surface p-4">
                      <p className="text-[10px] text-muted">
                        No dashed section headings were found. The complete source is available via
                        the Raw toggle above.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <p className="mt-3 flex items-start gap-1.5 px-1 text-[8.5px] leading-relaxed text-faint">
                <Icon name="lock" size={10} className="mt-[1px] shrink-0" />
                Every section above is rendered from the pasted text. JSON is re-indented for
                reading; use Raw or a document's pretty/raw switch to inspect the exact characters.
              </p>
            </div>

            <aside className="order-1 xl:order-2 xl:sticky xl:top-[60px] xl:max-h-[calc(100vh-76px)] xl:overflow-y-auto xl:thin-scrollbar">
              <GraphPanel
                graph={graph}
                selectedNode={selectedNode}
                includeOut={includeOut}
                includeIn={includeIn}
                onToggleOut={() => setIncludeOut((current) => !current)}
                onToggleIn={() => setIncludeIn((current) => !current)}
                onSelectName={selectName}
                onInspectInAtlas={onInspectInAtlas}
                onOpenModels={onOpenModels}
                atlasMatches={atlasMatches}
                modelSet={modelSet}
              />
            </aside>
          </div>
        </>
      ) : null}
    </>
  );
}
