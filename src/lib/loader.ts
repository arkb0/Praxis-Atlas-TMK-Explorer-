/**
 * Local model loading.
 *
 * Turns files picked from the user's machine into frozen model sets. Files are
 * grouped by their containing folder, so one entry point reads three loose
 * files, a single skill folder, or a library with one subfolder per skill.
 *
 * A document is recognised by its schema-required `model` field rather than by
 * its file name; other JSON files are ignored. Each recognised document is
 * checked against the `required` lists of its schema, because the views assume
 * those fields exist. Nothing is uploaded: files are read with the File API.
 */
import { deepFreeze } from '../data';
import type {
  KnowledgeModel,
  MethodModel,
  ModelDocument,
  ModelSet,
  TaskModel,
} from '../types/tmk';

type DocumentId = ModelDocument['id'];

export interface LoadResult {
  sets: ModelSet[];
  /** Readable reasons why a file or folder was skipped. */
  problems: string[];
}

interface FoundDocument {
  path: string;
  json: unknown;
}

/** A structural description that mirrors a JSON schema's `required` lists. */
type Shape =
  | 'string'
  | 'object'
  | { each: Shape }
  | { required: Record<string, Shape>; optional?: Record<string, Shape> };

const DOCUMENT_IDS: DocumentId[] = ['task', 'method', 'knowledge'];
const MODEL_NAMES: Record<DocumentId, string> = {
  task: 'Task',
  method: 'Method',
  knowledge: 'Knowledge',
};
const MAX_PROBLEMS_PER_FILE = 3;

const STRINGS: Shape = { each: 'string' };
const ASSERTIONS: Shape = {
  each: { required: { name: 'string', description: 'string', equivalentTo: 'string' } },
};

const SHAPES: Record<DocumentId, Shape> = {
  task: {
    required: {
      tasks: {
        each: {
          required: {
            name: 'string',
            description: 'string',
            inputParameters: STRINGS,
            outputParameters: STRINGS,
            means: {
              each: { required: { mechanismReference: 'string', actualArguments: STRINGS } },
            },
          },
          optional: { given: 'string', makes: 'string' },
        },
      },
    },
  },
  method: {
    required: {
      methods: {
        each: {
          required: {
            name: 'string',
            description: 'string',
            inputParameters: STRINGS,
            outputParameters: STRINGS,
          },
          optional: {
            requires: 'string',
            provides: 'string',
            assertions: ASSERTIONS,
            organizer: {
              required: {
                startState: 'string',
                successState: 'string',
                failureState: 'string',
                states: {
                  each: {
                    required: {
                      name: 'string',
                      goalInvocation: {
                        required: {
                          goalReference: 'string',
                          type: 'string',
                          actualArguments: STRINGS,
                        },
                      },
                    },
                  },
                },
                transitions: {
                  each: {
                    required: {
                      sourceState: 'string',
                      targetState: 'string',
                      dataCondition: 'string',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  knowledge: {
    required: {
      concepts: {
        each: {
          required: { name: 'string' },
          optional: {
            description: 'string',
            superConcept: STRINGS,
            properties: { each: { required: { name: 'string', type: 'string' } } },
          },
        },
      },
      instances: {
        each: {
          required: { name: 'string', concept: 'string' },
          optional: { values: 'object' },
        },
      },
    },
    optional: {
      relations: { each: { required: { name: 'string', domain: 'string', range: 'string' } } },
      triples: {
        each: { required: { instance1: 'string', relation: 'string', instance2: 'string' } },
      },
      assertions: ASSERTIONS,
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Collect every place where `value` departs from `shape`. */
function findProblems(value: unknown, shape: Shape, path: string, problems: string[]): void {
  const at = (key: string): string => (path ? `${path}.${key}` : key);

  if (shape === 'string') {
    if (typeof value !== 'string') problems.push(`${path} should be a string`);
  } else if (shape === 'object') {
    if (!isRecord(value)) problems.push(`${path} should be an object`);
  } else if ('each' in shape) {
    if (!Array.isArray(value)) {
      problems.push(`${path} should be a list`);
    } else {
      value.forEach((item, index) => findProblems(item, shape.each, `${path}[${index}]`, problems));
    }
  } else if (!isRecord(value)) {
    problems.push(`${path} should be an object`);
  } else {
    for (const [key, child] of Object.entries(shape.required)) {
      if (key in value) findProblems(value[key], child, at(key), problems);
      else problems.push(`${at(key)} is missing`);
    }
    for (const [key, child] of Object.entries(shape.optional ?? {})) {
      if (key in value) findProblems(value[key], child, at(key), problems);
    }
  }
}

function summarise(problems: string[]): string {
  const shown = problems.slice(0, MAX_PROBLEMS_PER_FILE).join('; ');
  const hidden = problems.length - MAX_PROBLEMS_PER_FILE;
  return hidden > 0 ? `${shown} (+${hidden} more)` : shown;
}

/** Which of the three documents a parsed file is, judged by its `model` field. */
function identify(json: unknown): DocumentId | undefined {
  if (!isRecord(json)) return undefined;
  return DOCUMENT_IDS.find((id) => MODEL_NAMES[id] === json.model);
}

/** Folder pickers supply a relative path; plain file pickers only a name. */
function pathOf(file: File): string {
  return file.webkitRelativePath || file.name;
}

function folderOf(file: File): string {
  const path = pathOf(file);
  return path.slice(0, Math.max(path.lastIndexOf('/'), 0));
}

/** Read one folder's worth of files; returns null when it is not a usable skill. */
async function readFolder(
  folder: string,
  files: File[],
  problems: string[],
): Promise<ModelSet | null> {
  const label = folder || 'Selected files';
  const found: Partial<Record<DocumentId, FoundDocument>> = {};

  for (const file of files) {
    const path = pathOf(file);
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      problems.push(`${path}: not valid JSON.`);
      continue;
    }
    const id = identify(json);
    if (!id) continue; // Some other JSON file, not a TMK document.
    if (found[id]) {
      problems.push(`${label}: more than one ${MODEL_NAMES[id]} model.`);
      return null;
    }
    found[id] = { path, json };
  }

  const { task, method, knowledge } = found;
  if (!task && !method && !knowledge) return null; // Not a skill folder.
  if (!task || !method || !knowledge) {
    const missing = DOCUMENT_IDS.filter((id) => !found[id]).map((id) => MODEL_NAMES[id]);
    const hint = folder ? '' : ' Select all three files together.';
    problems.push(`${label}: no ${missing.join(' or ')} model found.${hint}`);
    return null;
  }

  const documents: Array<[DocumentId, FoundDocument]> = [
    ['task', task],
    ['method', method],
    ['knowledge', knowledge],
  ];
  const invalid = documents.flatMap(([id, document]) => {
    const issues: string[] = [];
    findProblems(document.json, SHAPES[id], '', issues);
    return issues.length > 0 ? [`${document.path}: ${summarise(issues)}.`] : [];
  });
  if (invalid.length > 0) {
    problems.push(...invalid);
    return null;
  }

  // A skill is named after its folder; the parent folder is its library.
  const parent = folder.slice(0, Math.max(folder.lastIndexOf('/'), 0));
  return deepFreeze({
    name: folder.slice(folder.lastIndexOf('/') + 1) || 'Local model',
    origin: parent || (folder ? 'Local folder' : 'Local files'),
    task: task.json as TaskModel,
    method: method.json as MethodModel,
    knowledge: knowledge.json as KnowledgeModel,
    files: { task: task.path, method: method.path, knowledge: knowledge.path },
  });
}

/**
 * Build a model set for every folder in the selection that holds a complete,
 * valid triplet. Folders are returned in natural name order.
 */
export async function readModelSets(files: File[]): Promise<LoadResult> {
  const folders = new Map<string, File[]>();
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.json')) continue;
    const folder = folderOf(file);
    folders.set(folder, [...(folders.get(folder) ?? []), file]);
  }

  const sets: ModelSet[] = [];
  const problems: string[] = [];
  const names = [...folders.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  for (const folder of names) {
    const set = await readFolder(folder, folders.get(folder) ?? [], problems);
    if (set) sets.push(set);
  }

  if (sets.length === 0 && problems.length === 0) {
    problems.push(
      'No Task, Method or Knowledge documents found. Each is recognised by its "model" field.',
    );
  }
  return { sets, problems };
}
