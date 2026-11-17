/**
 * Source documents, raw JSON and the reference conventions used by the app.
 * Raw output is generated from the frozen imports on each render; downloads
 * are created client-side and never write back to project files.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/utils/cn';
import type { Atlas } from '@/lib/atlas';
import type {
  KnowledgeModel,
  MethodModel,
  ModelDocument,
  ModelSet,
  TaskModel,
} from '@/types/tmk';
import ModelLoader from '@/components/ModelLoader';
import PageHeader from '@/components/PageHeader';
import Icon from '@/components/Icon';
import { CopyButton, ReadOnlyNote } from '@/components/ui';

interface ModelsViewProps {
  atlas: Atlas;
  modelSet: ModelSet;
  documents: ModelDocument[];
  library: ModelSet[];
  onLoad: (sets: ModelSet[]) => void;
  onSelect: (set: ModelSet) => void;
}

function documentCounts(document: ModelDocument): Array<{ label: string; value: number }> {
  if (document.model.model === 'Task') {
    return [{ label: 'tasks', value: (document.model as TaskModel).tasks.length }];
  }
  if (document.model.model === 'Method') {
    return [{ label: 'methods', value: (document.model as MethodModel).methods.length }];
  }
  const knowledge = document.model as KnowledgeModel;
  return [
    { label: 'concepts', value: knowledge.concepts.length },
    { label: 'instances', value: knowledge.instances.length },
  ];
}

function documentIcon(id: ModelDocument['id']): 'flag' | 'route' | 'cube' {
  return id === 'task' ? 'flag' : id === 'method' ? 'route' : 'cube';
}

export default function ModelsView({
  atlas,
  modelSet,
  documents,
  library,
  onLoad,
  onSelect,
}: ModelsViewProps) {
  const [activeId, setActiveId] = useState<ModelDocument['id']>('task');
  const active = documents.find((document) => document.id === activeId) ?? documents[0];
  const json = useMemo(() => JSON.stringify(active.model, null, 2), [active.model]);
  const lines = useMemo(() => json.split('\n'), [json]);

  function download() {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = active.file.split('/').pop() ?? 'model.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        kicker={`${modelSet.origin} / Source documents`}
        title={
          <>
            The{' '}<span className="italic text-moss dark:text-[#a8cbb7]">models</span>{' '}
            <span className="whitespace-nowrap">behind the map</span>
          </>
        }
        description="Three plain JSON documents, each true to its schema. Praxis Atlas reads them without altering a byte; all structure and links are derived at display time."
        stats={[
          { label: 'Documents', value: documents.length },
          { label: 'Entities', value: atlas.stats.entities },
          { label: 'Annotations', value: atlas.stats.relations + atlas.stats.assertions },
        ]}
      />

      <ModelLoader library={library} active={modelSet} onLoad={onLoad} onSelect={onSelect} />

      <div className="grid gap-2.5 sm:grid-cols-3">
        {documents.map((document) => {
          const isActive = document.id === activeId;
          return (
            <button
              key={document.id}
              type="button"
              onClick={() => setActiveId(document.id)}
              aria-pressed={isActive}
              className={cn(
                'group relative flex flex-col overflow-hidden rounded-xl border bg-surface p-3.5 text-left transition-all',
                isActive
                  ? 'border-line-strong shadow-[var(--shadow-card)]'
                  : 'border-line hover:-translate-y-[1px] hover:border-line-strong',
              )}
            >
              {isActive && <span className="absolute inset-x-0 top-0 h-[2px] bg-gold" />}
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md border',
                      isActive
                        ? 'border-gold/50 bg-gold/10 text-[#7a6500] dark:text-gold'
                        : 'border-line bg-surface-muted text-muted',
                    )}
                  >
                    <Icon name={documentIcon(document.id)} size={13} />
                  </span>
                  <span className="text-[11.5px] font-semibold text-ink">{document.label}</span>
                </span>
                <span
                  className={cn(
                    'mono rounded border px-1.5 py-[1px] text-[7.5px] uppercase tracking-[0.1em]',
                    isActive
                      ? 'border-moss/20 bg-moss/[0.06] text-moss dark:border-[#9bc9b0]/20 dark:bg-[#9bc9b0]/10 dark:text-[#a8cbb7]'
                      : 'border-line text-faint',
                  )}
                >
                  {isActive ? 'viewing' : 'open'}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-[9px] leading-relaxed text-muted">{document.description}</p>
              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2">
                <span className="mono truncate text-[8px] text-faint">{document.file}</span>
                <span className="flex shrink-0 gap-2">
                  {documentCounts(document).map((count) => (
                    <span key={count.label} className="text-[8px] text-faint">
                      <span className="mono text-ink">{count.value}</span> {count.label}
                    </span>
                  ))}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-1.5 py-1">
              <span className="h-[5px] w-[5px] rounded-full bg-moss" />
              <span className="mono text-[9px] text-ink">model: {active.model.model}</span>
            </span>
            <span className="mono hidden text-[8.5px] text-faint sm:block">{active.file}</span>
            <span className="mono text-[8.5px] text-faint">{lines.length} lines</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ReadOnlyNote />
            <CopyButton value={json} label="Copy JSON" />
            <button
              type="button"
              onClick={download}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[10px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              <Icon name="arrow-right" size={11} className="rotate-90" />
              Download
            </button>
          </div>
        </div>
        <div className="thin-scrollbar max-h-[470px] overflow-auto bg-[#101f18] dark:bg-[#08120e]">
          <pre className="min-w-max px-0 py-3 font-mono text-[9.5px] leading-[1.75] text-[#d7e2d4]">
            {lines.map((line, index) => (
              <div key={`${index}-${line.slice(0, 8)}`} className="flex hover:bg-white/[0.035]">
                <span className="w-10 shrink-0 select-none pr-2 text-right text-[8px] text-[#658074]">
                  {index + 1}
                </span>
                <code className="whitespace-pre pr-5">{line || ' '}</code>
              </div>
            ))}
          </pre>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 lg:grid-cols-3">
        <InfoCard
          icon="link"
          title="References are inferred"
          body="Every string leaf in every record is compared, case-insensitively, against the set of named things. An exact match becomes a reference. No field is assumed to be special."
          footer="src/lib/atlas.ts"
        />
        <InfoCard
          icon="layers"
          title="Four kinds become nodes"
          body="Tasks, methods, concepts and instances form the graph. Relations and assertions are indexed as annotations so the inspector can resolve their names without cluttering the canvas."
          footer="NamedKind in src/types/tmk.ts"
        />
        <InfoCard
          icon="code"
          title="A seam for editing"
          body="Source documents are deep-frozen in src/data/index.ts. The atlas is a pure projection, so a future editor can build a draft atlas from a cloned document and swap it in."
          footer="src/data/index.ts"
        />
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon name="models" size={13} className="text-moss dark:text-[#a8cbb7]" />
            <p className="text-[10.5px] font-semibold text-ink">Schema at a glance</p>
          </div>
          <span className="mono text-[8px] text-faint">
            {modelSet.name} / {modelSet.origin}
          </span>
        </div>
        <div className="mt-2.5 grid gap-3 border-t border-line pt-2.5 sm:grid-cols-3">
          <SchemaNotes
            title="Task"
            fields={['name, description', 'inputParameters, outputParameters', 'given, makes (optional)', 'means[] -> mechanismReference + actualArguments']}
          />
          <SchemaNotes
            title="Method"
            fields={['name, description, parameters', 'requires, provides (optional)', 'assertions[] (optional)', 'organizer -> states + transitions']}
          />
          <SchemaNotes
            title="Knowledge"
            fields={['concepts[] -> superConcept, properties', 'instances[] -> concept, values', 'relations[], triples[]', 'assertions[] (optional)']}
          />
        </div>
      </div>
    </>
  );
}

function InfoCard({
  icon,
  title,
  body,
  footer,
}: {
  icon: 'link' | 'layers' | 'code';
  title: string;
  body: string;
  footer: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-surface-muted text-moss dark:text-[#a8cbb7]">
          <Icon name={icon} size={12} />
        </span>
        <p className="text-[10.5px] font-semibold text-ink">{title}</p>
      </div>
      <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted">{body}</p>
      <p className="mono mt-2 border-t border-line pt-1.5 text-[8px] text-faint">{footer}</p>
    </div>
  );
}

function SchemaNotes({ title, fields }: { title: string; fields: string[] }) {
  return (
    <div>
      <p className="eyebrow mb-1 text-faint">{title}</p>
      <ul className="space-y-0.5">
        {fields.map((field) => (
          <li key={field} className="flex items-start gap-1.5 text-[8.5px] leading-relaxed text-muted">
            <span className="mt-[5px] h-[3px] w-[3px] shrink-0 rounded-full bg-line-strong" />
            <span className="mono break-words">{field}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
