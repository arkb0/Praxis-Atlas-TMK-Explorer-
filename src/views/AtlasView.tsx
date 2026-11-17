/**
 * Primary graph view. Layer filters and search affect presentation only;
 * positions and the underlying atlas remain stable between interactions.
 */
import { useState } from 'react';
import { KIND_META, KIND_ORDER } from '@/lib/kinds';
import type { Atlas, AtlasEntity } from '@/lib/atlas';
import type { EntityKind, ModelSet } from '@/types/tmk';
import GraphCanvas from '@/components/GraphCanvas';
import Inspector from '@/components/Inspector';
import PageHeader from '@/components/PageHeader';
import Icon from '@/components/Icon';
import { FilterButton, SearchInput } from '@/components/ui';

interface AtlasViewProps {
  atlas: Atlas;
  modelSet: ModelSet;
  selected: AtlasEntity | null;
  onSelect: (id: string | null) => void;
  onSelectName: (name: string) => void;
  onOpenModels: () => void;
}

const ALL_KINDS = new Set<EntityKind>(KIND_ORDER);

export default function AtlasView({
  atlas,
  modelSet,
  selected,
  onSelect,
  onSelectName,
  onOpenModels,
}: AtlasViewProps) {
  const [visibleKinds, setVisibleKinds] = useState<Set<EntityKind>>(new Set(ALL_KINDS));
  const [query, setQuery] = useState('');

  const toggleKind = (kind: EntityKind) => {
    setVisibleKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const allVisible = visibleKinds.size === KIND_ORDER.length;

  return (
    <>
      <PageHeader
        kicker={
          <>
            {modelSet.name}
            <span className="text-line-strong">/</span>
            {modelSet.origin}
          </>
        }
        title={
          <>
            Skill{' '}<span className="italic text-moss dark:text-[#a8cbb7]">atlas</span>
          </>
        }
        description="Follow a task to the method that discharges it, then outward into the field knowledge it depends on. Every link is inferred from the three source documents."
        stats={[
          { label: 'Entities', value: atlas.stats.entities },
          { label: 'Inferred links', value: atlas.stats.edges },
          { label: 'Organisers', value: atlas.stats.organisers },
        ]}
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_396px]">
        <div className="flex min-w-0 flex-col gap-3">
          <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-muted text-moss dark:text-[#a8cbb7]">
                  <Icon name="atlas" size={16} />
                </span>
                <div>
                  <h2 className="flex items-center gap-2 text-[12.5px] font-semibold leading-tight text-ink">
                    The skill graph
                    <span className="inline-flex items-center gap-1 rounded-full border border-moss/20 bg-moss/[0.06] px-1.5 py-[1px] text-[7.5px] font-medium uppercase tracking-[0.12em] text-moss dark:border-[#9bc9b0]/20 dark:bg-[#9bc9b0]/10 dark:text-[#a8cbb7]">
                      <span className="h-[4px] w-[4px] rounded-full bg-moss dark:bg-[#a8cbb7]" />
                      live
                    </span>
                  </h2>
                  <p className="mt-0.5 text-[9px] text-faint">
                    Hover for a preview, click to open the full record.
                  </p>
                </div>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Find an entity"
                  className="w-full sm:w-[210px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setVisibleKinds(new Set(ALL_KINDS));
                    setQuery('');
                  }}
                  disabled={allVisible && !query}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
                  title="Reset layers and search"
                  aria-label="Reset layers and search"
                >
                  <Icon name="reset" size={13} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line bg-surface-muted/40 px-4 py-2">
              <span className="eyebrow mr-1 text-faint">Layers</span>
              <div className="flex flex-wrap items-center gap-0.5 rounded-full border border-line bg-surface p-[3px]">
                {KIND_ORDER.map((kind) => (
                  <FilterButton
                    key={kind}
                    active={visibleKinds.has(kind)}
                    onClick={() => toggleKind(kind)}
                    color={KIND_META[kind].accent}
                    count={atlas.stats.byKind[kind]}
                  >
                    {KIND_META[kind].plural}
                  </FilterButton>
                ))}
              </div>
              <span className="ml-auto hidden items-center gap-1.5 text-[8.5px] text-faint md:flex">
                <Icon name="info" size={10} />
                Edge colour follows the referring node
              </span>
            </div>

            <GraphCanvas
              atlas={atlas}
              selectedId={selected?.id ?? null}
              onSelect={onSelect}
              visibleKinds={visibleKinds}
              query={query}
              className="h-[clamp(460px,56vh,570px)] w-full"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
              <p className="flex items-start gap-1.5 text-[8.5px] leading-relaxed text-faint">
                <Icon name="link" size={10} className="mt-[1px] shrink-0" />
                References come from exact name matches in any field. No reference schema is
                assumed and no JSON is changed.
              </p>
              <button
                type="button"
                onClick={onOpenModels}
                className="group inline-flex items-center gap-1 text-[9px] font-medium text-muted transition-colors hover:text-ink"
              >
                How this works
                <Icon
                  name="arrow-right"
                  size={11}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </button>
            </div>
          </section>

          <p className="flex items-center gap-1.5 px-1 text-[9px] text-faint xl:hidden">
            <Icon name="eye" size={11} />
            Selecting a node opens its inspector in a drawer.
          </p>
        </div>

        <aside className="sticky top-[60px] hidden h-[calc(100vh-76px)] max-h-[900px] min-h-[600px] self-start overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)] xl:block">
          <Inspector
            atlas={atlas}
            entity={selected}
            onClose={() => onSelect(null)}
            onSelectName={onSelectName}
            className="h-full"
          />
        </aside>
      </div>
    </>
  );
}
