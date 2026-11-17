/**
 * Read-only JSON presentation with syntax colour and an optional raw view.
 *
 * The source text is never rewritten in the trace; values are re-indented for
 * display only. When `raw` is supplied, users can switch back to the exact
 * characters that were pasted.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { CopyButton } from './ui';
import Icon from './Icon';

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

function highlight(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = TOKEN.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] !== undefined) {
      const isKey = Boolean(match[2]);
      nodes.push(
        <span key={`token-${key}`} className={isKey ? 'text-[#a9d6ba]' : 'text-[#e8d79a]'}>
          {match[1]}
        </span>,
      );
      if (isKey) nodes.push(<span key={`colon-${key}`} className="text-[#7f988a]">{match[2]}</span>);
    } else if (match[3] !== undefined) {
      nodes.push(
        <span key={`token-${key}`} className="text-[#82c8ea]">
          {match[3]}
        </span>,
      );
    } else {
      nodes.push(
        <span key={`token-${key}`} className="text-[#e3a98f]">
          {match[0]}
        </span>,
      );
    }
    last = match.index + match[0].length;
    key += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function jsonText(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

interface CodeBlockProps {
  value: unknown;
  /** Exact pasted body, when a normalised pretty view is shown. */
  raw?: string;
  maxHeight?: number;
  label?: string;
  className?: string;
  compact?: boolean;
}

export default function CodeBlock({
  value,
  raw,
  maxHeight = 260,
  label,
  className,
  compact = false,
}: CodeBlockProps) {
  const pretty = useMemo(() => jsonText(value), [value]);
  const [rawView, setRawView] = useState(false);
  const canToggle = Boolean(raw && raw.trim() !== pretty.trim());
  const text = rawView && raw ? raw : pretty;

  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-[#101f18]', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2.5 py-1.5">
        <span className="mono truncate text-[8px] uppercase tracking-[0.12em] text-[#8ba697]">
          {label ?? 'json'}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {canToggle && (
            <button
              type="button"
              onClick={() => setRawView((current) => !current)}
              className={cn(
                'mono flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] transition-colors',
                rawView
                  ? 'bg-white/10 text-[#e8d79a]'
                  : 'text-[#8ba697] hover:bg-white/5 hover:text-[#d6e2d8]',
              )}
              aria-pressed={rawView}
              title={rawView ? 'Show normalised JSON' : 'Show the exact pasted body'}
            >
              <Icon name="code" size={9} />
              {rawView ? 'raw' : 'pretty'}
            </button>
          )}
          <CopyButton
            value={text}
            label="Copy"
            className="border-white/10 bg-white/[0.04] text-[#a8bcaf] hover:border-white/20 hover:text-[#eef2e6]"
          />
        </div>
      </div>
      <pre
        className={cn(
          'thin-scrollbar overflow-auto px-3 py-2.5 font-mono leading-[1.7] text-[#d7e2d4]',
          compact ? 'text-[9px]' : 'text-[9.5px]',
        )}
        style={{ maxHeight }}
      >
        <code>{rawView && raw ? text : highlight(text)}</code>
      </pre>
    </div>
  );
}
