/**
 * Model source picker: opens a triplet, a skill folder or a library of skill
 * folders from the local machine, and switches between the skills of a
 * library. Purely an input surface; parsing and validation live in
 * `src/lib/loader.ts`.
 */
import { useRef, useState, type ChangeEvent } from 'react';
import { cn } from '@/utils/cn';
import { readModelSets } from '@/lib/loader';
import type { ModelSet } from '@/types/tmk';
import Icon from './Icon';

interface ModelLoaderProps {
  library: ModelSet[];
  active: ModelSet;
  onLoad: (sets: ModelSet[]) => void;
  onSelect: (set: ModelSet) => void;
}

// Folder picking is a non-standard but widely supported input attribute
// (desktop Chrome, Edge, Firefox and Safari). It is absent from React's types.
const FOLDER_ATTRIBUTES = { webkitdirectory: '' } as Record<string, string>;
const CAN_PICK_FOLDERS =
  typeof HTMLInputElement !== 'undefined' && 'webkitdirectory' in HTMLInputElement.prototype;

const MAX_PROBLEMS_SHOWN = 6;
const BUTTON_CLASS =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[10px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-muted';

export default function ModelLoader({ library, active, onLoad, onSelect }: ModelLoaderProps) {
  const filesInput = useRef<HTMLInputElement | null>(null);
  const folderInput = useRef<HTMLInputElement | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  async function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const files = Array.from(input.files ?? []);
    input.value = ''; // Let the same selection be picked again.
    if (files.length === 0) return;
    const result = await readModelSets(files);
    setProblems(result.problems);
    if (result.sets.length > 0) onLoad(result.sets);
  }

  return (
    <section
      className="mb-4 rounded-xl border border-line bg-surface px-4 py-3"
      aria-label="Load models"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface-muted text-moss dark:text-[#a8cbb7]">
            <Icon name="models" size={13} />
          </span>
          <div>
            <p className="text-[10.5px] font-semibold text-ink">Load models</p>
            <p className="mt-0.5 max-w-[580px] text-[9.5px] leading-relaxed text-muted">
              Open the Task, Method and Knowledge JSON files together, a folder that holds all
              three, or a library folder with one subfolder per skill. Files are read in this
              browser and never uploaded.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" className={BUTTON_CLASS} onClick={() => filesInput.current?.click()}>
            <Icon name="code" size={12} className="text-muted" />
            Open files
          </button>
          {CAN_PICK_FOLDERS && (
            <button
              type="button"
              className={BUTTON_CLASS}
              onClick={() => folderInput.current?.click()}
            >
              <Icon name="layers" size={12} className="text-muted" />
              Open folder
            </button>
          )}
        </div>
      </div>

      {library.length > 1 && (
        <div className="mt-3 border-t border-line pt-2.5">
          <p className="eyebrow mb-1.5 text-faint">Library / {library.length} skills</p>
          <div className="thin-scrollbar flex max-h-28 flex-wrap gap-1 overflow-y-auto">
            {library.map((set) => {
              const isActive = set === active;
              return (
                <button
                  key={set.files.task}
                  type="button"
                  onClick={() => onSelect(set)}
                  aria-pressed={isActive}
                  title={set.files.task}
                  className={cn(
                    'inline-flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-medium transition-colors',
                    isActive
                      ? 'border-line-strong bg-surface-muted text-ink'
                      : 'border-line text-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  {isActive && <span className="h-[5px] w-[5px] rounded-full bg-gold" />}
                  {set.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {problems.length > 0 && (
        <ul role="alert" className="mt-3 grid gap-1 border-t border-line pt-2.5">
          {problems.slice(0, MAX_PROBLEMS_SHOWN).map((problem) => (
            <li
              key={problem}
              className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-rust"
            >
              <Icon name="info" size={11} className="mt-[1px] shrink-0" />
              <span className="min-w-0 break-words">{problem}</span>
            </li>
          ))}
          {problems.length > MAX_PROBLEMS_SHOWN && (
            <li className="pl-[17px] text-[9.5px] text-faint">
              and {problems.length - MAX_PROBLEMS_SHOWN} more not loaded
            </li>
          )}
        </ul>
      )}

      <input
        ref={filesInput}
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        onChange={handlePick}
      />
      <input ref={folderInput} type="file" hidden onChange={handlePick} {...FOLDER_ATTRIBUTES} />
    </section>
  );
}
