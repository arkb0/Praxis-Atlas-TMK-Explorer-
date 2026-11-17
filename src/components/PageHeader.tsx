import type { ReactNode } from 'react';
import Icon from './Icon';

export interface HeaderStat {
  label: string;
  value: number | string;
  note?: string;
}

export default function PageHeader({
  kicker,
  title,
  description,
  stats,
  actions,
}: {
  kicker: ReactNode;
  title: ReactNode;
  description: ReactNode;
  stats?: HeaderStat[];
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-moss dark:text-[#a8c9b6]">
            <Icon name="leaf" size={11} />
          </span>
          <p className="eyebrow text-faint">{kicker}</p>
        </div>
        <h1 className="serif text-[34px] font-medium leading-[0.98] tracking-[-0.03em] text-ink-strong sm:text-[42px]">
          {title}
        </h1>
        <p className="mt-2 max-w-[560px] text-[11.5px] leading-relaxed text-muted sm:text-[12px]">
          {description}
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center lg:shrink-0">
        {stats && stats.length > 0 && (
          <div className="grid w-full grid-cols-3 divide-x divide-line overflow-hidden rounded-xl border border-line bg-surface sm:w-auto">
            {stats.map((stat) => (
              <div key={stat.label} className="min-w-[86px] px-3.5 py-2.5">
                <p className="eyebrow whitespace-nowrap text-[8px] text-faint">{stat.label}</p>
                <p className="serif mt-0.5 text-[22px] leading-none text-ink-strong">{stat.value}</p>
                {stat.note && (
                  <p className="mt-0.5 text-[8px] text-faint">{stat.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
        {actions}
      </div>
    </header>
  );
}
