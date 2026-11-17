/**
 * Ivy trace parsing and TMK graph derivation.
 *
 * Everything here treats the pasted text as read-only source material. The
 * parser records raw text alongside every interpreted fragment, and the UI
 * can always fall back to it. Presentation may add indentation, headings and
 * syntax colour, but no prose, JSON value, score or name is rewritten.
 *
 * Format handled (sections may vary):
 *   ===...===
 *   QUESTION: ...
 *   ===...===
 *   ---...---
 *   SECTION TITLE
 *   ---...---
 *   content
 *   ...
 *   *** (separates traces)
 */
import type { Atlas, AtlasEntity } from './atlas';
import { fieldLabel, lookup } from './atlas';

export type TraceSectionKind =
  | 'anchor'
  | 'prompt'
  | 'classification'
  | 'retrieval'
  | 'intermediate'
  | 'final'
  | 'tuple'
  | 'generic';

export interface RetrievedDoc {
  index: number;
  score: number | null;
  scoreRaw: string;
  source: string;
  entry: string;
  /** Body exactly as pasted, without the [n] header. */
  raw: string;
  parsed: unknown | null;
}

export interface TupleField {
  key: string;
  value: string;
}

export interface SixTuple {
  responseType?: string;
  metadata: string[];
  sources: string[];
  scores: Array<number | null>;
  extras: TupleField[];
  raw: string;
  available: boolean;
}

export interface TraceSection {
  id: string;
  heading: string;
  kind: TraceSectionKind;
  content: string;
  docs: RetrievedDoc[];
  tuple?: SixTuple;
}

export interface SkillNames {
  tasks: string[];
  methods: string[];
  concepts: string[];
}

export interface ParsedTrace {
  id: string;
  index: number;
  raw: string;
  question: string;
  sections: TraceSection[];
  skillNames: SkillNames;
  classification?: string;
  docs: RetrievedDoc[];
  tuple?: SixTuple;
  warnings: string[];
}

const EQUALS_LINE = /^\s*={10,}\s*$/;
const DASH_LINE = /^\s*-{10,}\s*$/;
const SEPARATOR_LINE = /^\s*\*{3,}\s*$/;
const DOC_HEADER = /^\s*\[(\d+)\]\s+score=([^\s]+)\s+source=(\S+)\s+entry=(\S+)\s*$/;

function unquote(value: string): string {
  const trimmed = value.trim().replace(/;+$/, '');
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
      return trimmed.slice(1, -1).replace(/\\(['"\\])/g, '$1');
    }
  }
  return trimmed;
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      current += char;
      if (char === '\\') {
        current += value[index + 1] ?? '';
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
    } else if (char === '[' || char === '{' || char === '(') {
      depth += 1;
      current += char;
    } else if (char === ']' || char === '}' || char === ')') {
      depth -= 1;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter((part) => part.length > 0);
}

function arrayItems(text: string): string[] | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  return splitTopLevel(text.slice(start + 1, end));
}

/**
 * Parse a Python-style literal or strict JSON value. The stage 2 documents are
 * Python dict reprs (single quotes), so `JSON.parse` is not enough. Returns
 * null instead of throwing when the text is not a complete literal.
 */
export function parseLiteral(input: string): unknown | null {
  let position = 0;
  const length = input.length;
  const skipSpace = (): void => {
    while (position < length && /\s/.test(input[position])) position += 1;
  };
  const fail = (): never => {
    throw new Error('Unsupported literal');
  };

  const readString = (): string => {
    const quote = input[position];
    position += 1;
    let result = '';
    while (position < length) {
      const char = input[position];
      position += 1;
      if (char === quote) return result;
      if (char === '\\') {
        const escape = input[position];
        position += 1;
        if (escape === 'n') result += '\n';
        else if (escape === 't') result += '\t';
        else if (escape === 'r') result += '\r';
        else if (escape === 'b') result += '\b';
        else if (escape === 'f') result += '\f';
        else if (escape === 'u') {
          result += String.fromCharCode(Number.parseInt(input.slice(position, position + 4), 16));
          position += 4;
        } else if (escape === 'x') {
          result += String.fromCharCode(Number.parseInt(input.slice(position, position + 2), 16));
          position += 2;
        } else result += escape;
      } else {
        result += char;
      }
    }
    return fail();
  };

  const readValue = (): unknown => {
    skipSpace();
    const char = input[position];
    if (char === '{') {
      position += 1;
      const object: Record<string, unknown> = {};
      skipSpace();
      while (position < length && input[position] !== '}') {
        skipSpace();
        const key =
          input[position] === "'" || input[position] === '"'
            ? readString()
            : (() => {
                const start = position;
                while (position < length && /[\w$-]/.test(input[position])) position += 1;
                if (start === position) fail();
                return input.slice(start, position);
              })();
        skipSpace();
        if (input[position] !== ':') fail();
        position += 1;
        object[key] = readValue();
        skipSpace();
        if (input[position] === ',') {
          position += 1;
          skipSpace();
        } else if (input[position] !== '}') {
          fail();
        }
      }
      if (input[position] !== '}') fail();
      position += 1;
      return object;
    }
    if (char === '[') {
      position += 1;
      const array: unknown[] = [];
      skipSpace();
      while (position < length && input[position] !== ']') {
        array.push(readValue());
        skipSpace();
        if (input[position] === ',') {
          position += 1;
          skipSpace();
        } else if (input[position] !== ']') {
          fail();
        }
      }
      if (input[position] !== ']') fail();
      position += 1;
      return array;
    }
    if (char === "'" || char === '"') return readString();
    if (input.startsWith('True', position)) {
      position += 4;
      return true;
    }
    if (input.startsWith('False', position)) {
      position += 5;
      return false;
    }
    if (input.startsWith('None', position) || input.startsWith('null', position)) {
      position += input.startsWith('None', position) ? 4 : 4;
      return null;
    }
    const numberMatch = input
      .slice(position)
      .match(/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (numberMatch) {
      position += numberMatch[0].length;
      return Number(numberMatch[0]);
    }
    return fail();
  };

  try {
    const value = readValue();
    skipSpace();
    if (position !== length) return null;
    return value;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sectionKind(heading: string): TraceSectionKind {
  const upper = heading.toUpperCase();
  if (upper.includes('6-TUPLE')) return 'tuple';
  if (upper.includes('IDENTITY')) return 'anchor';
  if (upper.includes('STAGE 1 INPUT')) return 'prompt';
  if (upper.includes('STAGE 1 OUTPUT') || upper.includes('CLASSIFICATION')) return 'classification';
  if (upper.includes('STAGE 2 OUTPUT') || upper.includes('FAISS')) return 'retrieval';
  if (upper.includes('STAGE 3 OUTPUT') || upper.includes('INTERMEDIATE')) return 'intermediate';
  if (upper.includes('STAGE 4 OUTPUT') || upper.includes('FINAL ANSWER')) return 'final';
  return 'generic';
}

function parseDocs(content: string): RetrievedDoc[] {
  const lines = content.split('\n');
  const docs: RetrievedDoc[] = [];
  let current: RetrievedDoc | null = null;
  let body: string[] = [];

  const flush = (): void => {
    if (!current) return;
    current.raw = body.join('\n').trim();
    current.parsed = parseLiteral(current.raw);
    docs.push(current);
    current = null;
    body = [];
  };

  for (const line of lines) {
    const match = line.match(DOC_HEADER);
    if (match) {
      flush();
      const score = Number(match[2]);
      current = {
        index: Number(match[1]),
        score: Number.isFinite(score) ? score : null,
        scoreRaw: match[2],
        source: match[3],
        entry: match[4],
        raw: '',
        parsed: null,
      };
      continue;
    }
    if (current) body.push(line);
  }
  flush();
  return docs;
}

function parseTuple(content: string): SixTuple {
  const tuple: SixTuple = {
    metadata: [],
    sources: [],
    scores: [],
    extras: [],
    raw: content,
    available: false,
  };

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    const match = line.match(/^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!match) {
      tuple.extras.push({ key: '', value: line.trim() });
      continue;
    }
    const key = match[1];
    const rawValue = match[2].trim();
    if (key === 'response_type') {
      tuple.responseType = unquote(rawValue);
      tuple.available = true;
    } else if (key === 'metadata_trace') {
      tuple.metadata = (arrayItems(rawValue) ?? []).map(unquote);
      tuple.available = true;
    } else if (key === 'sources_trace') {
      tuple.sources = (arrayItems(rawValue) ?? []).map(unquote);
      tuple.available = true;
    } else if (key === 'scores_trace') {
      tuple.scores = (arrayItems(rawValue) ?? []).map((item) => {
        const number = Number(unquote(item));
        return Number.isFinite(number) ? number : null;
      });
      tuple.available = true;
    } else {
      tuple.extras.push({ key, value: rawValue });
    }
  }
  return tuple;
}

function parseSkillNames(content: string): SkillNames {
  const names: SkillNames = { tasks: [], methods: [], concepts: [] };
  const fences = [...content.matchAll(/```([\s\S]*?)```/g)].map((match) => match[1]);
  const block = fences.find(
    (fence) => /Tasks:/.test(fence) && /Methods:/.test(fence) && /Knowledge concepts:/.test(fence),
  );
  if (!block) return names;

  let target: keyof SkillNames | null = null;
  for (const line of block.split('\n')) {
    const match = line.match(/^\s*(Tasks|Methods|Knowledge concepts)\s*:\s*(.*)$/i);
    if (match) {
      target =
        match[1].toLowerCase() === 'tasks'
          ? 'tasks'
          : match[1].toLowerCase() === 'methods'
            ? 'methods'
            : 'concepts';
      const rest = match[2].trim();
      if (rest) names[target].push(...rest.split(',').map((name) => name.trim()).filter(Boolean));
    } else if (target && line.trim()) {
      names[target].push(...line.split(',').map((name) => name.trim()).filter(Boolean));
    }
  }
  // Strip trailing punctuation that belongs to the list, never inner characters.
  for (const key of Object.keys(names) as Array<keyof SkillNames>) {
    names[key] = names[key].map((name) => name.replace(/[.;]+$/, '')).filter(Boolean);
  }
  return names;
}

function parseQuestion(lines: string[]): string {
  for (let index = 0; index < lines.length; index += 1) {
    if (!EQUALS_LINE.test(lines[index])) continue;
    let next = index + 1;
    while (next < lines.length && !lines[next].trim()) next += 1;
    if (next >= lines.length || !/^QUESTION\s*:/i.test(lines[next].trim())) continue;
    const parts: string[] = [lines[next].replace(/^\s*QUESTION\s*:\s*/i, '')];
    next += 1;
    while (next < lines.length && !EQUALS_LINE.test(lines[next])) {
      parts.push(lines[next]);
      next += 1;
    }
    return parts.join('\n').trim();
  }
  return '';
}

function parseTrace(rawChunk: string, index: number): ParsedTrace {
  const raw = rawChunk;
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const question = parseQuestion(lines);
  const sections: TraceSection[] = [];
  const warnings: string[] = [];

  let position = 0;
  let sectionIndex = 0;
  while (position < lines.length) {
    if (!DASH_LINE.test(lines[position])) {
      position += 1;
      continue;
    }
    let headingAt = position + 1;
    while (headingAt < lines.length && !lines[headingAt].trim()) headingAt += 1;
    const heading = lines[headingAt]?.trim() ?? '';
    let separatorAt = headingAt + 1;
    while (separatorAt < lines.length && !lines[separatorAt].trim()) separatorAt += 1;

    if (heading && separatorAt < lines.length && DASH_LINE.test(lines[separatorAt])) {
      let end = separatorAt + 1;
      while (end < lines.length && !DASH_LINE.test(lines[end])) end += 1;
      const content = lines
        .slice(separatorAt + 1, end)
        .join('\n')
        .replace(/^\n+|\n+$/g, '');
      const kind = sectionKind(heading);
      sectionIndex += 1;
      sections.push({
        id: `section-${sectionIndex}`,
        heading,
        kind,
        content,
        docs: kind === 'retrieval' ? parseDocs(content) : [],
        tuple: kind === 'tuple' ? parseTuple(content) : undefined,
      });
      position = end;
      continue;
    }
    position += 1;
  }

  const identity = sections.find((section) => section.kind === 'anchor');
  const prompt = sections.find((section) => section.kind === 'prompt');
  const classificationSection = sections.find((section) => section.kind === 'classification');
  const tupleSection = sections.find((section) => section.kind === 'tuple');
  const docs = sections.flatMap((section) => section.docs);
  const skillNames = parseSkillNames(prompt?.content ?? raw);
  const classification = classificationSection
    ? classificationSection.content.trim().replace(/^['"]|['".]$/g, '').toLowerCase()
    : undefined;

  if (!question) warnings.push('No QUESTION header was found.');
  if (!identity && !sections.length) warnings.push('No section dividers were found; showing raw text.');
  if (!classificationSection) warnings.push('No classification output was found.');
  if (!tupleSection) warnings.push('No 6-tuple trace was found.');

  return {
    id: `trace-${index + 1}`,
    index,
    raw,
    question: question || 'Untitled trace',
    sections,
    skillNames,
    classification,
    docs,
    tuple: tupleSection?.tuple,
    warnings,
  };
}

/** Split on a line containing only three (or more) asterisks. */
export function splitTraces(text: string): string[] {
  const chunks: string[][] = [[]];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (SEPARATOR_LINE.test(line)) {
      chunks.push([]);
    } else {
      chunks[chunks.length - 1].push(line);
    }
  }
  return chunks
    .map((chunk) => chunk.join('\n'))
    .filter((chunk) => chunk.trim().length > 0);
}

/** Parse every trace in the pasted text. Never throws. */
export function parseTraces(text: string): ParsedTrace[] {
  if (!text.trim()) return [];
  return splitTraces(text).map(parseTrace);
}

// ---------------------------------------------------------------------------
// Trace graph
// ---------------------------------------------------------------------------

export type TraceNodeKind = 'task' | 'method' | 'concept' | 'operation' | 'unknown';
export type GraphOrigin = 'trace' | 'model';

export interface TraceNode {
  id: string;
  name: string;
  kind: TraceNodeKind;
  /** Present in the 6-tuple trace itself. */
  inTrace: boolean;
  /** Direct outgoing connection of a trace item. */
  outgoing: boolean;
  /** Direct incoming connection to a trace item. */
  incoming: boolean;
  score: number | null;
  sourceIndexes: number[];
  description: string;
  doc?: RetrievedDoc;
  inAtlas: boolean;
  fields?: unknown;
}

export interface TraceEdge {
  id: string;
  sourceId: string;
  targetId: string;
  labels: string[];
  origins: GraphOrigin[];
}

export interface TraceGraph {
  nodes: TraceNode[];
  edges: TraceEdge[];
  traceNames: string[];
  outgoingCount: number;
  incomingCount: number;
}

export interface TraceGraphOptions {
  includeOut: boolean;
  includeIn: boolean;
  atlas: Atlas;
}

const KIND_BY_LABEL: Record<string, TraceNodeKind> = {
  task: 'task',
  method: 'method',
  knowledge: 'concept',
  concept: 'concept',
  operation: 'operation',
};

const TRACE_KIND_ORDER: TraceNodeKind[] = ['task', 'method', 'concept', 'operation', 'unknown'];

export function traceKindOrder(kind: TraceNodeKind): number {
  return TRACE_KIND_ORDER.indexOf(kind);
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Build the graph for one trace.
 *
 * Edges come from two sources and are kept distinct:
 * - `trace`: structured references inside the retrieved documents (means,
 *   organisers, parameter types, properties).
 * - `model`: direct edges of the loaded TMK, when a trace name resolves there.
 *
 * Only trace items and (optionally) their direct neighbours are returned.
 */
export function buildTraceGraph(trace: ParsedTrace, options: TraceGraphOptions): TraceGraph {
  const { includeOut, includeIn, atlas } = options;
  const tuple = trace.tuple;
  const traceNames = tuple?.sources ?? trace.docs.map((doc) => doc.entry);
  const traceKinds = new Map<string, TraceNodeKind>();
  traceNames.forEach((name, index) => {
    const label = tuple?.metadata[index] ?? '';
    traceKinds.set(normalise(name), KIND_BY_LABEL[normalise(label)] ?? 'unknown');
  });

  interface IndexEntry {
    name: string;
    kind: TraceNodeKind;
  }
  const index = new Map<string, IndexEntry>();
  const addName = (name: string, kind: TraceNodeKind): void => {
    if (!name.trim()) return;
    const key = normalise(name);
    const existing = index.get(key);
    if (!existing || (existing.kind === 'unknown' && kind !== 'unknown')) {
      index.set(key, { name: name.trim(), kind });
    }
  };

  traceNames.forEach((name) => addName(name, traceKinds.get(normalise(name)) ?? 'unknown'));
  trace.skillNames.tasks.forEach((name) => addName(name, 'task'));
  trace.skillNames.methods.forEach((name) => addName(name, 'method'));
  trace.skillNames.concepts.forEach((name) => addName(name, 'concept'));
  trace.docs.forEach((doc) => {
    addName(doc.entry, KIND_BY_LABEL[normalise(doc.source)] ?? 'unknown');
  });

  // Node records are created for every known TMK name; only the relevant ones
  // are returned after the edge filter below.
  const nodeMap = new Map<string, TraceNode>();
  const nodeFor = (name: string, kindHint?: TraceNodeKind): TraceNode => {
    const key = normalise(name);
    const known = index.get(key);
    const named = lookup(atlas, name);
    const entity: AtlasEntity | undefined =
      named && named.kind !== 'relation' && named.kind !== 'assertion'
        ? (named as AtlasEntity)
        : undefined;
    const kind =
      kindHint && kindHint !== 'unknown'
        ? kindHint
        : known && known.kind !== 'unknown'
          ? known.kind
          : entity
            ? (entity.kind as TraceNodeKind)
            : 'unknown';
    const existing = nodeMap.get(key);
    if (existing) {
      if (existing.kind === 'unknown' && kind !== 'unknown') existing.kind = kind;
      return existing;
    }
    const doc = trace.docs.find((item) => normalise(item.entry) === key);
    const parsed = doc?.parsed;
    const description =
      (isRecord(parsed) && typeof parsed.description === 'string' ? parsed.description : '') ||
      entity?.description ||
      '';
    const node: TraceNode = {
      id: key,
      name: known?.name ?? entity?.name ?? name,
      kind,
      inTrace: traceNames.some((item) => normalise(item) === key),
      outgoing: false,
      incoming: false,
      score:
        traceNames
          .map((item, index) => (normalise(item) === key ? tuple?.scores[index] ?? null : null))
          .find((score) => score !== null) ?? null,
      sourceIndexes: traceNames.reduce<number[]>((acc, item, index) => {
        if (normalise(item) === key) acc.push(index);
        return acc;
      }, []),
      description,
      doc,
      inAtlas: Boolean(entity),
      fields: parsed ?? entity?.data,
    };
    nodeMap.set(key, node);
    return node;
  };

  traceNames.forEach((name) => nodeFor(name, traceKinds.get(normalise(name))));

  const edges = new Map<string, TraceEdge>();
  const addEdge = (
    sourceName: string,
    targetName: string,
    label: string,
    origin: GraphOrigin,
  ): void => {
    const source = nodeFor(sourceName);
    const target = nodeFor(targetName);
    if (source.id === target.id) return;
    const key = `${source.id}|${target.id}`;
    const existing = edges.get(key);
    if (existing) {
      if (!existing.labels.includes(label)) existing.labels.push(label);
      if (!existing.origins.includes(origin)) existing.origins.push(origin);
    } else {
      edges.set(key, {
        id: key,
        sourceId: source.id,
        targetId: target.id,
        labels: [label],
        origins: [origin],
      });
    }
  };

  // Structured references inside retrieved documents.
  const visit = (value: unknown, owner: string, path: string[]): void => {
    if (typeof value === 'string') {
      const parts = value.includes(':')
        ? [value.trim(), value.slice(value.indexOf(':') + 1).trim()]
        : [value.trim()];
      for (const part of parts) {
        const known = index.get(normalise(part));
        if (known) addEdge(owner, known.name, fieldLabel(path.join('.')), 'trace');
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, owner, [...path, String(index)]));
      return;
    }
    if (isRecord(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (key === 'name' || key === 'description') continue;
        visit(child, owner, [...path, key]);
      }
    }
  };
  trace.docs.forEach((doc) => {
    if (doc.parsed !== null) visit(doc.parsed, doc.entry, []);
  });

  // Direct model links for trace items only (no path expansion).
  const entityById = new Map(atlas.entities.map((entity) => [entity.id, entity]));
  traceNames.forEach((name) => {
    const entity = lookup(atlas, name);
    if (!entity) return;
    for (const edge of atlas.outgoing.get(entity.id) ?? []) {
      const target = entityById.get(edge.targetId);
      if (target) addEdge(name, target.name, edge.labels[0] ?? 'link', 'model');
    }
    for (const edge of atlas.incoming.get(entity.id) ?? []) {
      const source = entityById.get(edge.sourceId);
      if (source) addEdge(source.name, name, edge.labels[0] ?? 'link', 'model');
    }
  });

  const traceIds = new Set(traceNames.map(normalise));
  const allowed = new Set<string>(traceIds);
  for (const edge of edges.values()) {
    if (includeOut && traceIds.has(edge.sourceId)) allowed.add(edge.targetId);
    if (includeIn && traceIds.has(edge.targetId)) allowed.add(edge.sourceId);
  }

  const nodes = [...nodeMap.values()]
    .filter((node) => allowed.has(node.id))
    .map((node) => {
      const outgoing = [...edges.values()].some(
        (edge) => edge.sourceId === node.id && traceIds.has(edge.sourceId) && edge.targetId !== node.id,
      );
      const incoming = [...edges.values()].some(
        (edge) => edge.targetId === node.id && traceIds.has(edge.targetId) && edge.sourceId !== node.id,
      );
      return { ...node, outgoing: !node.inTrace && outgoing, incoming: !node.inTrace && incoming };
    });

  const allowedEdges = [...edges.values()].filter(
    (edge) =>
      allowed.has(edge.sourceId) &&
      allowed.has(edge.targetId) &&
      (traceIds.has(edge.sourceId) || traceIds.has(edge.targetId)) &&
      ((includeOut && traceIds.has(edge.sourceId)) ||
        (includeIn && traceIds.has(edge.targetId)) ||
        (traceIds.has(edge.sourceId) && traceIds.has(edge.targetId))),
  );

  return {
    nodes: nodes.sort(
      (a, b) =>
        Number(b.inTrace) - Number(a.inTrace) ||
        traceKindOrder(a.kind) - traceKindOrder(b.kind) ||
        a.name.localeCompare(b.name),
    ),
    edges: allowedEdges,
    traceNames,
    outgoingCount: [...edges.values()].filter((edge) => traceIds.has(edge.sourceId)).length,
    incomingCount: [...edges.values()].filter((edge) => traceIds.has(edge.targetId)).length,
  };
}
