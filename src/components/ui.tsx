/** Small, shared presentation primitives. */
import { useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import Icon from './Icon';
import { KIND_META } from '@/lib/kinds';
import type { EntityKind } from '@/types/tmk';

const BADGE_STYLES: Record<EntityKind, string> = {
  task: 'bg-[#F8D727] text-[#3d3100]',
  method: 'bg-[#2F9FD9] text-white',
  concept: 'bg-[#005C45] text-[#f4f1e5]',
  instance:
    'border border-[#005C45]/30 bg-[#005C45]/5 text-[#005C45] dark:border-[#9cc4b0]/30 dark:bg-[#9cc4b0]/10 dark:text-[#b6d3c2]',
};

export function KindBadge({
  kind,
  withIcon = true,
  className,
}: {
  kind: EntityKind;
  withIcon?: boolean;
  className?: string;
}) {
  const meta = KIND_META[kind];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] font-semibold uppercase leading-none tracking-[0.12em]',
        BADGE_STYLES[kind],
        className,
      )}
    >
      {withIcon && <Icon name={meta.icon} size={10} strokeWidth={2.1} />}
      {meta.label}
    </span>
  );
}

export function EntityGlyph({
  kind,
  size = 30,
  className,
}: {
  kind: EntityKind;
  size?: number;
  className?: string;
}) {
  const meta = KIND_META[kind];
  const isInstance = kind === 'instance';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        isInstance && 'border border-dashed border-[#005C45]/50 dark:border-[#a9c9b8]/40',
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: isInstance ? 'var(--surface-muted)' : meta.accent,
        color: isInstance
          ? 'var(--moss)'
          : kind === 'task'
            ? '#3d3100'
            : '#faf8ef',
      }}
    >
      <Icon name={meta.icon} size={Math.round(size * 0.48)} strokeWidth={2} />
    </span>
  );
}

/** A coloured dot used in filters and legends. */
export function KindDot({ kind, size = 7 }: { kind: EntityKind; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: KIND_META[kind].accent,
        boxShadow: kind === 'instance' ? 'inset 0 0 0 1px var(--moss)' : undefined,
      }}
    />
  );
}

export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permissions may be unavailable; leave the UI unchanged.
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[10px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink',
        className,
      )}
      aria-label={`${label} ${value}`}
    >
      <Icon name={copied ? 'check' : 'copy'} size={11} />
      {copied ? 'Copied' : label}
    </button>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search entities',
  className,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <label
      className={cn(
        'group flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5 transition-colors focus-within:border-sky/70 focus-within:ring-2 focus-within:ring-sky/15',
        className,
      )}
    >
      <Icon name="search" size={13} className="shrink-0 text-faint" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[11.5px] text-ink outline-none placeholder:text-faint"
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="rounded p-0.5 text-faint hover:bg-surface-muted hover:text-ink"
          aria-label="Clear search"
        >
          <Icon name="close" size={11} />
        </button>
      )}
    </label>
  );
}

export function FilterButton({
  active,
  onClick,
  color,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-medium transition-all',
        active
          ? 'border-line-strong bg-surface text-ink shadow-[0_1px_1px_rgba(30,40,30,0.04)]'
          : 'border-transparent bg-transparent text-faint hover:text-muted',
      )}
    >
      {color && (
        <span
          className="h-[6px] w-[6px] rounded-full transition-opacity"
          style={{ backgroundColor: color, opacity: active ? 1 : 0.55 }}
        />
      )}
      {children}
      {typeof count === 'number' && (
        <span className={cn('mono text-[9px]', active ? 'text-faint' : 'text-faint/70')}>
          {count}
        </span>
      )}
    </button>
  );
}

export function ReadOnlyNote({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-1 text-[9px] font-medium uppercase tracking-[0.12em] text-faint',
        className,
      )}
    >
      <Icon name="lock" size={10} />
      Read-only
    </span>
  );
}
