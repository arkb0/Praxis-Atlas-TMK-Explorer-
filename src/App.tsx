/**
 * Praxis Atlas - application shell.
 *
 * Holds the active model set (the bundled example, or one loaded from disk)
 * and derives its atlas; everything else is ephemeral view state (active
 * view, selected node, theme). Selection travels by no more than an entity
 * id. Navigation into a reference is resolved through the atlas name index,
 * not through model mutation.
 */
import { useEffect, useMemo, useState } from 'react';
import { documentsOf, exampleModelSet } from '@/data';
import sampleTraces from '@/data/sample-traces.txt?raw';
import { createAtlas, lookup } from '@/lib/atlas';
import type { ViewId } from '@/lib/navigation';
import type { ModelSet } from '@/types/tmk';
import { Sidebar, MobileHeader } from '@/components/Sidebar';
import Inspector from '@/components/Inspector';
import Icon from '@/components/Icon';
import { ReadOnlyNote } from '@/components/ui';
import AtlasView from '@/views/AtlasView';
import LibraryView from '@/views/LibraryView';
import OrganisersView from '@/views/OrganisersView';
import ModelsView from '@/views/ModelsView';
import TracesView from '@/views/TracesView';

function getInitialTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export default function App() {
  const [view, setView] = useState<ViewId>('atlas');
  const [library, setLibrary] = useState<ModelSet[]>([exampleModelSet]);
  const [modelSet, setModelSet] = useState<ModelSet>(exampleModelSet);
  const [traceSource, setTraceSource] = useState(sampleTraces);
  const atlas = useMemo(
    () => createAtlas(modelSet.task, modelSet.method, modelSet.knowledge),
    [modelSet],
  );
  const documents = useMemo(() => documentsOf(modelSet), [modelSet]);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => atlas.entities.find((entity) => entity.kind === 'task')?.id ?? null,
  );
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  const selected = atlas.entities.find((entity) => entity.id === selectedId) ?? null;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('praxis-theme', theme);
    } catch {
      // Theme persistence is optional.
    }
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInspectorOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function toggleTheme() {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }

  function navigate(nextView: ViewId) {
    setView(nextView);
    setInspectorOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function selectById(id: string | null) {
    setSelectedId(id);
    if (id) setInspectorOpen(true);
  }

  function selectByName(name: string) {
    const thing = lookup(atlas, name);
    if (!thing || thing.kind === 'relation' || thing.kind === 'assertion') return;
    setSelectedId(thing.id);
    setInspectorOpen(true);
    setView('atlas');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function closeInspector() {
    setInspectorOpen(false);
    setSelectedId(null);
  }

  // Entity ids belong to one atlas, so switching model set drops the selection.
  function openModelSet(set: ModelSet) {
    setModelSet(set);
    setSelectedId(null);
    setInspectorOpen(false);
  }

  function loadLibrary(sets: ModelSet[]) {
    setLibrary(sets);
    openModelSet(sets[0]);
  }

  const navProps = {
    view,
    onNavigate: navigate,
    stats: atlas.stats,
    documentCount: documents.length,
  };

  return (
    <div className="min-h-screen bg-page">
      <Sidebar {...navProps} theme={theme} onToggleTheme={toggleTheme} modelSet={modelSet} />

      <div className="lg:pl-[244px]">
        <MobileHeader {...navProps} theme={theme} onToggleTheme={toggleTheme} />

        <div className="sticky top-0 z-20 hidden h-11 items-center justify-between border-b border-line bg-page/90 px-8 backdrop-blur-md lg:flex">
          <div className="flex min-w-0 items-center gap-2 text-[9.5px] text-faint">
            <Icon name="layers" size={12} />
            <span className="uppercase tracking-[0.12em]">Workspace</span>
            <Icon name="chevron-right" size={9} className="text-line-strong" />
            <span className="truncate text-muted">{modelSet.name}</span>
            <span className="mono ml-1 rounded border border-line bg-surface px-1 py-[1px] text-[7.5px] uppercase tracking-[0.1em] text-faint">
              {modelSet.origin}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1.5 text-[9px] text-faint">
              <span className="h-[5px] w-[5px] rounded-full bg-moss dark:bg-[#86bfa4]" />
              {documents.length} documents loaded
            </span>
            <span className="h-3 w-px bg-line" />
            <ReadOnlyNote />
            <button
              type="button"
              onClick={() => navigate('models')}
              className="group flex items-center gap-1 text-[9px] font-medium text-muted transition-colors hover:text-ink"
            >
              Source JSON
              <Icon
                name="arrow-up-right"
                size={10}
                className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </button>
          </div>
        </div>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div key={view} className="animate-rise">
            {view === 'atlas' && (
              <AtlasView
                atlas={atlas}
                modelSet={modelSet}
                selected={selected}
                onSelect={selectById}
                onSelectName={selectByName}
                onOpenModels={() => navigate('models')}
              />
            )}
            {view === 'traces' && (
              <TracesView
                atlas={atlas}
                modelSet={modelSet}
                source={traceSource}
                onSourceChange={setTraceSource}
                onInspectInAtlas={selectByName}
                onOpenModels={() => navigate('models')}
              />
            )}
            {view === 'library' && (
              <LibraryView atlas={atlas} modelSet={modelSet} onSelectName={selectByName} />
            )}
            {view === 'organisers' && (
              <OrganisersView atlas={atlas} modelSet={modelSet} onSelectName={selectByName} />
            )}
            {view === 'models' && (
              <ModelsView
                atlas={atlas}
                modelSet={modelSet}
                documents={documents}
                library={library}
                onLoad={loadLibrary}
                onSelect={openModelSet}
              />
            )}
          </div>

          <footer className="mt-8 flex flex-col gap-2 border-t border-line pt-4 text-[8.5px] text-faint sm:flex-row sm:items-center sm:justify-between">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-muted">
                <Icon name="leaf" size={11} className="text-moss dark:text-[#a8cbb7]" />
                Praxis Atlas
              </span>
              <span className="text-line-strong">/</span>
              <span>A read-only Task - Method - Knowledge explorer.</span>
              <span className="hidden sm:inline">React, Vite, Tailwind CSS and d3-force.</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="mono uppercase tracking-[0.1em]">{modelSet.origin}</span>
              <span className="text-line-strong">/</span>
              <span className="mono uppercase tracking-[0.1em]">No writes</span>
            </p>
          </footer>
        </main>
      </div>

      {selected && inspectorOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end xl:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`Inspector for ${selected.name}`}
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#06100c]/45 backdrop-blur-[2px] animate-fade"
            onClick={() => setInspectorOpen(false)}
            aria-label="Close inspector"
          />
          <div className="relative flex h-full w-full max-w-[430px] flex-col border-l border-line bg-surface shadow-[-20px_0_60px_-30px_rgba(10,25,18,0.5)] animate-rise">
            <Inspector
              atlas={atlas}
              entity={selected}
              onClose={closeInspector}
              onSelectName={selectByName}
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
