/**
 * The built-in example model set, plus the two helpers every model set shares.
 *
 * The example JSON documents are imported (rather than fetched) so a
 * single-file production build always has something to show. Every model set,
 * bundled or loaded from disk, is deep-frozen before it reaches the UI: view
 * code may read it, never mutate it. A future editor should clone into a
 * draft store rather than thawing these objects.
 */

import taskJson from './task-model.json';
import methodJson from './method-model.json';
import knowledgeJson from './knowledge-model.json';
import type {
  KnowledgeModel,
  MethodModel,
  ModelDocument,
  ModelSet,
  TaskModel,
} from '../types/tmk';

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

/** Shown until the user loads their own models (see `src/lib/loader.ts`). */
export const exampleModelSet: ModelSet = deepFreeze({
  name: 'Autumn cover-crop programme',
  origin: 'Model set 01',
  task: taskJson as TaskModel,
  method: methodJson as MethodModel,
  knowledge: knowledgeJson as KnowledgeModel,
  files: {
    task: 'src/data/task-model.json',
    method: 'src/data/method-model.json',
    knowledge: 'src/data/knowledge-model.json',
  },
});

/** Describe the three source documents of a model set for display. */
export function documentsOf(set: ModelSet): ModelDocument[] {
  return [
    {
      id: 'task',
      label: 'Task model',
      file: set.files.task,
      description: 'What the practice sets out to achieve, and which method does the work.',
      model: set.task,
    },
    {
      id: 'method',
      label: 'Method model',
      file: set.files.method,
      description: 'How each task is discharged, including organisers as state machines.',
      model: set.method,
    },
    {
      id: 'knowledge',
      label: 'Knowledge model',
      file: set.files.knowledge,
      description: 'The concepts, instances and relations that ground the method.',
      model: set.knowledge,
    },
  ];
}
