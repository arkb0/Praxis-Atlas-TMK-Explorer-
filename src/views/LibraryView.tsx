/**
 * A browsable index of every graph entity plus the supporting annotations
 * (relations and assertions) that are deliberately not drawn as nodes.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/utils/cn';
import { KIND_META, KIND_ORDER } from '@/lib/kinds';
import { lookup, type Atlas, type AtlasEntity } from '@/lib/atlas';
import type { Assertion, KnowledgeModel, ModelSet, Relation } from '@/types/tmk';
import PageHeader from '@/components/PageHeader';
import Icon from '@/components/Icon';
import {
  EntityGlyph,
  FilterButton,
  SearchInput,
} from '@/components/ui';

interface LibraryViewProps {
  atlas: Atlas;
  modelSet: ModelSet;
  onSelectName: (name: string) => void;
}

export default function LibraryView({ atlas, modelSet, onSelectName }: LibraryViewProps) {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | (typeof KIND_ORDER)[number]>('all');

  const filtered = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    return atlas.entities.filter((entity) => {
      if (kindFilter !== 'all' && entity.kind !== kindFilter) return false;
      if (!normalised) return true;
      return `${entity.name} ${entity.description} ${entity.kind}`
        .toLowerCase()
        .includes(normalised);
    });
  }, [atlas.entities, kindFilter, query]);

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    meta: KIND_META[kind],
    entities: filtered.filter((entity) => entity.kind === kind),
  }));

  return (
    <>
      <PageHeader
        kicker={`${modelSet.origin} / Entity index`}
        title={
          <>
            Every{' '}<span className="italic text-moss dark:text-[#a8cbb7]">part</span>{' '}of the skill
          </>
        }
        description="Tasks name outcomes, methods describe mechanisms, and knowledge supplies the objects and examples. Browse the full index, then open any record in the graph inspector."
        stats={[
          { label: 'Records', value: atlas.stats.entities },
          { label: 'Concepts', value: atlas.stats.byKind.concept },
          { label: 'Instances', value: atlas.stats.byKind.instance },
        ]}
      />

      <div className="mb-5 flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by name, description or kind"
          className="h-9 w-full sm:max-w-[330px]"
        />
        <div className="flex flex-wrap items-center gap-0.5 rounded-full border border-line bg-surface-muted/50 p-[3px]">
          <FilterButton active={kindFilter === 'all'} onClick={() => setKindFilter('all')} count={atlas.entities.length}>
            All
          </FilterButton>
          {KIND_ORDER.map((kind) => (
            <FilterButton
              key={kind}
              active={kindFilter === kind}
              onClick={() => setKindFilter(kind)}
              color={KIND_META[kind].accent}
              count={atlas.stats.byKind[kind]}
            >
              {KIND_META[kind].plural}
            </FilterButton>
          ))}
        </div>
        <span className="mono ml-auto hidden text-[9px] text-faint sm:block">
          {filtered.length} shown
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <Icon name="search" size={22} className="mx-auto mb-3 text-faint" />
          <p className="serif text-[20px] text-ink">No records match that search.</p>
          <p className="mt-1 text-[10.5px] text-muted">Try a broader phrase or reset the kind filter.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setKindFilter('all');
            }}
            className="mt-3 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[10px] font-medium text-ink transition-colors hover:bg-surface-muted"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {groups.map(({ kind, meta, entities }) => {
            if (entities.length === 0) return null;
            return (
              <section key={kind}>
                <div className="mb-2.5 flex items-end justify-between gap-3 border-b border-line pb-2">
                  <div className="flex items-center gap-2">
                    <EntityGlyph kind={kind} size={23} />
                    <h2 className="serif text-[21px] font-medium leading-none text-ink">{meta.plural}</h2>
                    <span className="mono text-[9px] text-faint">{entities.length}</span>
                  </div>
                  <p className="hidden max-w-[340px] text-right text-[9px] leading-relaxed text-faint sm:block">
                    {meta.description}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                  {entities.map((entity) => (
                    <EntityCard
                      key={entity.id}
                      entity={entity}
                      atlas={atlas}
                      onSelectName={onSelectName}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Annotations atlas={atlas} knowledge={modelSet.knowledge} onSelectName={onSelectName} />
    </>
  );
}

function EntityCard({
  entity,
  atlas,
  onSelectName,
}: {
  entity: AtlasEntity;
  atlas: Atlas;
  onSelectName: (name: string) => void;
}) {
  const meta = KIND_META[entity.kind];
  const degree = atlas.adjacency.get(entity.id)?.size ?? 0;
  const source =
    entity.kind === 'task' ? 'task-model.json' : entity.kind === 'method' ? 'method-model.json' : 'knowledge-model.json';
  return (
    <button
      type="button"
      onClick={() => onSelectName(entity.name)}
      className="group relative flex min-h-[126px] flex-col overflow-hidden rounded-xl border border-line bg-surface p-3.5 text-left transition-all hover:-translate-y-[1px] hover:border-line-strong hover:shadow-[0_10px_30px_-20px_rgba(20,40,30,0.4)]"
    >
      <span
        className="absolute inset-y-0 left-0 w-[2px] opacity-0 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: meta.accent }}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <EntityGlyph kind={entity.kind} size={25} />
          <span className="eyebrow text-[8px] text-faint">{meta.label}</span>
        </div>
        <span className="mono flex items-center gap-1 text-[8px] text-faint">
          <Icon name="link" size={9} />
          {degree}
        </span>
      </div>
      <h3 className="mt-2 break-words text-[14px] font-semibold leading-snug tracking-[-0.01em] text-ink">
        {entity.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-[9.5px] leading-relaxed text-muted">{entity.description}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
        <span className="mono truncate text-[8px] text-faint">{source}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-medium text-muted transition-colors group-hover:text-ink">
          Inspect
          <Icon
            name="arrow-up-right"
            size={10}
            className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </button>
  );
}

function Annotations({
  atlas,
  knowledge,
  onSelectName,
}: {
  atlas: Atlas;
  knowledge: KnowledgeModel;
  onSelectName: (name: string) => void;
}) {
  const relations: Relation[] = knowledge.relations ?? [];
  const assertions: Assertion[] = knowledge.assertions ?? [];

  return (
    <details className="group mt-8 rounded-xl border border-line bg-surface" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface-muted text-moss dark:text-[#a8cbb7]">
            <Icon name="quote" size={13} />
          </span>
          <div>
            <h2 className="text-[12px] font-semibold text-ink">Annotations</h2>
            <p className="text-[9px] text-faint">Relations and assertions - named, linked, but not graph nodes.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono hidden text-[8.5px] text-faint sm:block">
            {relations.length} relations / {assertions.length} assertions
          </span>
          <Icon
            name="chevron-down"
            size={13}
            className="text-faint transition-transform group-open:rotate-180"
          />
        </div>
      </summary>
      <div className="grid gap-5 border-t border-line px-4 py-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow mb-2 text-faint">Relations</p>
          <div className="overflow-hidden rounded-lg border border-line">
            {relations.map((relation, index) => (
              <div
                key={relation.name}
                className={cn(
                  'flex flex-wrap items-center gap-1.5 px-2.5 py-2 text-[9.5px]',
                  index !== 0 && 'border-t border-line',
                )}
              >
                <span className="mono text-[10px] font-medium text-ink">{relation.name}</span>
                <span className="text-faint">from</span>
                <AnnotationRef name={relation.domain} atlas={atlas} onSelectName={onSelectName} />
                <Icon name="arrow-right" size={9} className="text-line-strong" />
                <span className="text-faint">to</span>
                <AnnotationRef name={relation.range} atlas={atlas} onSelectName={onSelectName} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow mb-2 text-faint">Knowledge assertions</p>
          <div className="grid gap-1.5">
            {assertions.map((assertion) => (
              <div key={assertion.name} className="rounded-lg border border-line bg-surface p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="mono text-[10px] font-medium text-ink">{assertion.name}</span>
                  <Icon name="quote" size={10} className="text-faint" />
                </div>
                <p className="mt-1 text-[9.5px] leading-relaxed text-muted">{assertion.description}</p>
                <p className="mono mt-1 break-words rounded bg-surface-muted px-1.5 py-1 text-[8.5px] text-muted">
                  {assertion.equivalentTo}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

function AnnotationRef({
  name,
  atlas,
  onSelectName,
}: {
  name: string;
  atlas: Atlas;
  onSelectName: (name: string) => void;
}) {
  const thing = lookup(atlas, name);
  if (!thing || thing.kind === 'relation' || thing.kind === 'assertion') {
    return <span className="mono rounded bg-surface-muted px-1 py-0.5 text-[9px] text-muted">{name}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onSelectName(name)}
      className="mono inline-flex items-center gap-1 rounded border border-line bg-surface px-1 py-0.5 text-[9px] text-ink transition-colors hover:border-line-strong hover:bg-surface-muted"
    >
      <span
        className="h-[4px] w-[4px] rounded-full"
        style={{ backgroundColor: KIND_META[thing.kind].accent }}
      />
      {name}
    </button>
  );
}
