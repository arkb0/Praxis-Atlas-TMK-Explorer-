/**
 * A deliberately small prose renderer for trace sections.
 *
 * It understands paragraphs, bullets, numbered items, fenced code and inline
 * code/bold. It never executes or interprets HTML. Text is passed through as
 * text nodes; only wrapping and markers change, so a trace's wording is
 * preserved exactly.
 */
import { useMemo, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { parseLiteral } from '@/lib/traces';
import CodeBlock from './CodeBlock';

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*/g;

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] !== undefined) {
      nodes.push(
        <code
          key={`inline-${key}`}
          className="rounded border border-line bg-surface-muted px-1 py-[1px] font-mono text-[0.88em] text-ink"
        >
          {match[1]}
        </code>,
      );
    } else {
      nodes.push(<strong key={`strong-${key}`} className="font-semibold text-ink">{match[2]}</strong>);
    }
    last = match.index + match[0].length;
    key += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function fencedCode(code: string, key: string): ReactNode {
  const parsed = parseLiteral(code);
  if (parsed !== null) {
    return (
      <CodeBlock
        key={key}
        value={parsed}
        raw={code}
        label="code - json"
        maxHeight={320}
        className="my-2.5"
      />
    );
  }
  return (
    <pre
      key={key}
      className="thin-scrollbar my-2.5 max-h-80 overflow-auto rounded-lg border border-line bg-[#101f18] p-2.5 font-mono text-[9px] leading-relaxed text-[#d7e2d4]"
    >
      <code>{code}</code>
    </pre>
  );
}

interface Block {
  type: 'p' | 'ul' | 'ol' | 'code';
  items?: Array<{ marker: string; text: string }>;
  text?: string;
  code?: string;
}

function parseBlocks(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Block | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushParagraph();
      flushList();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', code: code.join('\n') });
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items?.push({ marker: '', text: bullet[1] });
      continue;
    }

    const numbered = line.match(/^\s*(\d+[.)])\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [] };
      }
      list.items?.push({ marker: numbered[1], text: numbered[2] });
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return blocks;
}

interface ProseProps {
  content: string;
  /** Keep the source line breaks, for prompts rather than formatted prose. */
  preserveLines?: boolean;
  className?: string;
}

export default function Prose({ content, preserveLines = false, className }: ProseProps) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  if (preserveLines) {
    const lines = content.split('\n');
    const rendered: ReactNode[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim().startsWith('```')) {
        const code: string[] = [];
        index += 1;
        while (index < lines.length && !lines[index].trim().startsWith('```')) {
          code.push(lines[index]);
          index += 1;
        }
        rendered.push(fencedCode(code.join('\n'), `line-code-${index}`));
        continue;
      }
      if (!line.trim()) {
        rendered.push(<div key={`space-${index}`} className="h-2" />);
        continue;
      }
      rendered.push(
        <div key={`line-${index}`} className="whitespace-pre-wrap">
          {inline(line)}
        </div>,
      );
    }
    return (
      <div className={cn('text-[11px] leading-[1.8] text-muted', className)}>{rendered}</div>
    );
  }

  return (
    <div className={cn('text-[11px] leading-[1.8] text-muted', className)}>
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return fencedCode(block.code ?? '', `block-code-${index}`);
        }
        if (block.type === 'ul' || block.type === 'ol') {
          return (
            <ul key={`list-${index}`} className="my-2 grid gap-1.5">
              {block.items?.map((item, itemIndex) => (
                <li key={`item-${itemIndex}`} className="flex gap-2">
                  <span
                    className={cn(
                      'shrink-0 select-none font-mono text-[9px] text-faint',
                      block.type === 'ul' ? 'pt-[2px]' : 'pt-[3px]',
                    )}
                  >
                    {block.type === 'ul' ? '•' : item.marker}
                  </span>
                  <span className="min-w-0">{inline(item.text)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={`p-${index}`} className="my-2 first:mt-0 last:mb-0">
            {inline(block.text ?? '')}
          </p>
        );
      })}
    </div>
  );
}
