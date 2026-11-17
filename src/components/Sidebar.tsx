/**
 * Desktop workspace rail and compact mobile navigation.
 * Navigation is stateless; the active view lives in App.
 */
import { cn } from '@/utils/cn';
import { KIND_META } from '@/lib/kinds';
import { NAV_ITEMS, type ViewId } from '@/lib/navigation';
import type { AtlasStats } from '@/lib/atlas';
import type { ModelSet } from '@/types/tmk';
import { BrandLockup, BrandMark } from './Brand';
import Icon from './Icon';

interface NavProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  stats: AtlasStats;
  documentCount: number;
}

interface SidebarProps extends NavProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const COUNT_BY_VIEW: Record<ViewId, (stats: AtlasStats, documents: number) => number> = {
  atlas: (stats) => stats.entities,
  traces: () => 0,
  library: (stats) => stats.entities,
  organisers: (stats) => stats.organisers,
  models: (_stats, documents) => documents,
};

function NavList({ view, onNavigate, stats, documentCount, compact = false }: NavProps & { compact?: boolean }) {
  return (
    <nav className={cn('grid', compact ? 'grid-flow-col auto-cols-min gap-1' : 'gap-1')} aria-label="Workspace">
      {NAV_ITEMS.map((item) => {
        const active = item.id === view;
        const count = COUNT_BY_VIEW[item.id](stats, documentCount);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={active ? 'page' : undefined}
            title={compact ? item.label : item.description}
            className={cn(
              'group relative flex items-center transition-colors',
              compact
                ? 'h-8 shrink-0 gap-1.5 rounded-md px-2.5 text-[10.5px]'
                : 'h-[36px] gap-2.5 rounded-md px-2.5 text-[11.5px]',
              active
                ? compact
                  ? 'bg-sidebar-2 font-medium text-sidebar-ink'
                  : 'bg-sidebar-2/90 font-medium text-sidebar-ink'
                : 'text-sidebar-muted hover:bg-sidebar-2/50 hover:text-sidebar-ink',
            )}
          >
            {active && !compact && (
              <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-gold" />
            )}
            <Icon
              name={item.icon}
              size={compact ? 13 : 14}
              className={cn('shrink-0', active ? 'text-gold' : 'text-sidebar-muted group-hover:text-sidebar-ink')}
            />
            <span className="whitespace-nowrap">{compact ? item.shortLabel : item.label}</span>
            {!compact && count > 0 && (
              <span
                className={cn(
                  'mono ml-auto rounded border px-1 py-[1px] text-[8px] leading-none',
                  active
                    ? 'border-sidebar-line bg-sidebar/40 text-sidebar-muted'
                    : 'border-transparent text-sidebar-muted/70',
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function ModelSetCard({ stats, modelSet }: { stats: AtlasStats; modelSet: ModelSet }) {
  const total = Math.max(stats.entities, 1);
  const segments: Array<{ kind: keyof typeof KIND_META; value: number }> = [
    { kind: 'task', value: stats.byKind.task },
    { kind: 'method', value: stats.byKind.method },
    { kind: 'concept', value: stats.byKind.concept },
    { kind: 'instance', value: stats.byKind.instance },
  ];
  return (
    <div className="rounded-xl border border-sidebar-line bg-sidebar-2/55 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow text-sidebar-muted">This model set</p>
        <span className="mono flex items-center gap-1 text-[7px] uppercase tracking-[0.12em] text-sidebar-muted">
          <Icon name="lock" size={8} />
          read-only
        </span>
      </div>
      <p className="serif mt-2 text-[15px] leading-tight text-sidebar-ink">{modelSet.name}</p>
      <p className="mono mt-1 text-[7px] uppercase tracking-[0.14em] text-sidebar-muted">
        {modelSet.origin}
      </p>
      <div className="mt-3 flex h-[3px] w-full gap-[2px] overflow-hidden rounded-full">
        {segments.map((segment) => (
          <span
            key={segment.kind}
            className="h-full rounded-full"
            style={{
              width: `${(segment.value / total) * 100}%`,
              backgroundColor: KIND_META[segment.kind].accent,
              minWidth: segment.value > 0 ? 4 : 0,
            }}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5">
        {segments.map((segment) => (
          <div key={segment.kind} className="flex items-center gap-1.5">
            <span
              className="h-[5px] w-[5px] rounded-full"
              style={{ backgroundColor: KIND_META[segment.kind].accent }}
            />
            <span className="truncate text-[9px] text-sidebar-muted">{KIND_META[segment.kind].plural}</span>
            <span className="mono ml-auto text-[9px] text-sidebar-ink">{segment.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-sidebar-line pt-2">
        <span className="text-[8.5px] text-sidebar-muted">
          <span className="mono text-sidebar-ink">{stats.references}</span> name matches
        </span>
        <span className="text-[8.5px] text-sidebar-muted">
          <span className="mono text-sidebar-ink">{stats.edges}</span> links
        </span>
      </div>
    </div>
  );
}

export function Sidebar({
  view,
  onNavigate,
  stats,
  documentCount,
  theme,
  onToggleTheme,
  modelSet,
}: SidebarProps & { modelSet: ModelSet }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] flex-col border-r border-sidebar-line bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-line px-4">
        <BrandLockup />
      </div>
      <div className="thin-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
        <p className="eyebrow px-2 pb-2 text-sidebar-muted/80">Explore</p>
        <NavList view={view} onNavigate={onNavigate} stats={stats} documentCount={documentCount} />

        <div className="mt-5">
          <ModelSetCard stats={stats} modelSet={modelSet} />
        </div>

        <div className="mt-4 rounded-lg border border-dashed border-sidebar-line/80 px-2.5 py-2">
          <p className="flex items-center gap-1.5 text-[8.5px] font-medium text-sidebar-ink">
            <Icon name="spark" size={10} className="text-gold" />
            Three documents, one skill
          </p>
          <p className="mt-1 text-[8.5px] leading-relaxed text-sidebar-muted">
            Tasks call methods. Methods reason with knowledge. Instances make it real.
          </p>
        </div>

        <div className="mt-auto pt-5">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex w-full items-center justify-between rounded-lg border border-sidebar-line bg-sidebar-2/50 px-2.5 py-2 text-sidebar-muted transition-colors hover:text-sidebar-ink"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <span className="flex items-center gap-2 text-[9.5px]">
              <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={12} />
              {theme === 'dark' ? 'Dark field notes' : 'Light field notes'}
            </span>
            <span className="relative h-[14px] w-[26px] rounded-full border border-sidebar-line bg-sidebar">
              <span
                className={cn(
                  'absolute top-[2px] h-[8px] w-[8px] rounded-full bg-gold transition-all',
                  theme === 'dark' ? 'left-[14px]' : 'left-[3px]',
                )}
              />
            </span>
          </button>
          <div className="mt-3 flex items-center justify-between px-0.5">
            <span className="mono text-[7px] uppercase tracking-[0.12em] text-sidebar-muted/70">
              TMK schema / v1
            </span>
            <span className="mono text-[7px] uppercase tracking-[0.12em] text-sidebar-muted/70">
              Local data
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileHeader({
  view,
  onNavigate,
  stats,
  documentCount,
  theme,
  onToggleTheme,
}: SidebarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-sidebar-line bg-sidebar lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <BrandMark size={26} />
          <div className="flex items-baseline gap-1.5">
            <span className="serif text-[19px] font-medium tracking-[-0.02em] text-sidebar-ink">Praxis</span>
            <span className="mono rounded-[3px] border border-sidebar-line px-1 py-[1.5px] text-[6px] uppercase tracking-[0.16em] text-sidebar-muted">
              Atlas
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-sidebar-line text-sidebar-muted transition-colors hover:text-sidebar-ink"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={13} />
          </button>
        </div>
      </div>
      <div className="hide-scrollbar overflow-x-auto px-2 pb-2">
        <div className="flex items-center gap-1">
          <NavList view={view} onNavigate={onNavigate} stats={stats} documentCount={documentCount} compact />
          <span className="ml-auto hidden shrink-0 items-center gap-1 px-1 text-[8px] uppercase tracking-[0.1em] text-sidebar-muted sm:flex">
            <Icon name="lock" size={9} />
            read-only
          </span>
        </div>
      </div>
    </header>
  );
}
