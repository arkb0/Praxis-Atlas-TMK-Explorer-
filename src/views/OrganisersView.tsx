/**
 * Gallery of method organisers. Each one is rendered with the same reusable
 * FSM component used in the inspector, so both surfaces stay honest to JSON.
 */
import { KIND_META } from '@/lib/kinds';
import type { Atlas } from '@/lib/atlas';
import type { Method, ModelSet } from '@/types/tmk';
import PageHeader from '@/components/PageHeader';
import FsmDiagram from '@/components/FsmDiagram';
import Icon from '@/components/Icon';
import { EntityGlyph } from '@/components/ui';

interface OrganisersViewProps {
  atlas: Atlas;
  modelSet: ModelSet;
  onSelectName: (name: string) => void;
}

export default function OrganisersView({ atlas, modelSet, onSelectName }: OrganisersViewProps) {
  const methods = atlas.entities
    .filter((entity) => entity.kind === 'method')
    .map((entity) => ({ entity, method: entity.data as unknown as Method }));
  const withOrganiser = methods.filter(({ method }) => Boolean(method.organizer));
  const withoutOrganiser = methods.filter(({ method }) => !method.organizer);
  const stateCount = withOrganiser.reduce(
    (total, { method }) => total + (method.organizer?.states.length ?? 0),
    0,
  );
  const transitionCount = withOrganiser.reduce(
    (total, { method }) => total + (method.organizer?.transitions.length ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        kicker={`${modelSet.origin} / Method organisers`}
        title={
          <>
            How the work{' '}<span className="italic text-moss dark:text-[#a8cbb7]">moves</span>
          </>
        }
        description="An organiser is a method's control layer: named states invoke goals, while guarded transitions carry the data conditions that decide what happens next."
        stats={[
          { label: 'Organisers', value: withOrganiser.length },
          { label: 'States', value: stateCount },
          { label: 'Transitions', value: transitionCount },
        ]}
      />

      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface-muted text-moss dark:text-[#a8cbb7]">
            <Icon name="organisers" size={13} />
          </span>
          <p className="max-w-[600px] text-[10px] leading-relaxed text-muted">
            States are ranked by transition depth, not hand-placed. Light diamonds on each card show
            the kind of goal a state invokes. Select a state to read its actual arguments.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5 text-[8.5px] uppercase tracking-[0.1em] text-faint">
          <span className="inline-flex items-center gap-1"><span className="h-[5px] w-[5px] rounded-full bg-gold" /> start</span>
          <span className="inline-flex items-center gap-1"><span className="h-[5px] w-[5px] rounded-full bg-moss" /> success</span>
          <span className="inline-flex items-center gap-1"><span className="h-[5px] w-[5px] rounded-full bg-rust" /> failure</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {withOrganiser.map(({ entity, method }) => {
          const organizer = method.organizer;
          if (!organizer) return null;
          const assertions = method.assertions ?? [];
          return (
            <article
              key={entity.id}
              className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]"
            >
              <header className="flex items-start gap-3 border-b border-line px-4 py-3.5">
                <EntityGlyph kind="method" size={29} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="eyebrow text-[8px] text-faint">Method / organiser</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-line-strong" />
                    <span className="mono text-[8px] text-faint">{organizer.states.length} states</span>
                  </div>
                  <h2 className="serif break-words text-[21px] font-medium leading-tight tracking-[-0.01em] text-ink">
                    {entity.name}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-[9.5px] leading-relaxed text-muted">
                    {entity.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectName(entity.name)}
                  className="group mt-0.5 flex h-7 shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[9px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
                  title={`Inspect ${entity.name}`}
                >
                  Inspect
                  <Icon
                    name="arrow-up-right"
                    size={10}
                    className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </button>
              </header>

              <div className="flex-1 px-3.5 py-3">
                <FsmDiagram
                  organizer={organizer}
                  atlas={atlas}
                  onSelectName={onSelectName}
                  variant="compact"
                />
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-muted/40 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-[8.5px] text-faint">
                    <span className="mono text-ink">{organizer.transitions.length}</span> transitions
                  </span>
                  <span className="text-[8.5px] text-faint">
                    <span className="mono text-ink">{assertions.length}</span> assertions
                  </span>
                  <span className="hidden items-center gap-1 text-[8.5px] text-faint sm:flex">
                    <span className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: KIND_META.method.accent }} />
                    method
                  </span>
                </div>
                <span className="mono text-[8px] text-faint">
                  {organizer.startState} <span className="text-line-strong">to</span> {organizer.successState}
                </span>
              </footer>
            </article>
          );
        })}
      </div>

      {withoutOrganiser.length > 0 && (
        <section className="mt-7">
          <div className="mb-2.5 flex items-end justify-between gap-3 border-b border-line pb-2">
            <div className="flex items-center gap-2">
              <EntityGlyph kind="method" size={21} className="opacity-60" />
              <h2 className="serif text-[19px] font-medium leading-none text-ink">
                Interface-only methods
              </h2>
              <span className="mono text-[9px] text-faint">{withoutOrganiser.length}</span>
            </div>
            <p className="text-[9px] text-faint">Declared without an explicit state machine</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {withoutOrganiser.map(({ entity, method }) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => onSelectName(entity.name)}
                className="group flex items-start gap-3 rounded-xl border border-dashed border-line-strong bg-surface px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-muted/40"
              >
                <span className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded border border-dashed border-line-strong text-faint">
                  <Icon name="route" size={11} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[11.5px] font-semibold text-ink">{entity.name}</span>
                    <span className="eyebrow shrink-0 text-[7.5px] text-faint">method</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[9px] leading-relaxed text-muted">
                    {method.description}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {[...method.inputParameters, ...method.outputParameters].slice(0, 4).map((parameter) => (
                      <span
                        key={parameter}
                        className="mono rounded border border-line bg-surface px-1 py-[1px] text-[8px] text-muted"
                      >
                        {parameter}
                      </span>
                    ))}
                  </span>
                </span>
                <Icon
                  name="arrow-up-right"
                  size={11}
                  className="mt-1 shrink-0 text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
                />
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
