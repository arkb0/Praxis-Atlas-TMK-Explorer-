/**
 * Atlas construction: a pure, display-level projection of the three models.
 *
 * The models have no formal foreign-key fields. Instead of hard-coding which
 * property points where, every string leaf is scanned and an exact,
 * case-insensitive name match creates a reference. That keeps the viewer
 * useful when the schemata evolve, and it means newly introduced reference
 * fields are picked up without a code change.
 *
 * Only task, method, concept and instance records become graph nodes.
 * Relations and assertions are still indexed as named annotations so the
 * inspector can resolve and link them.
 */

import type {
  Assertion,
  Concept,
  EntityKind,
  Instance,
  KnowledgeModel,
  Method,
  MethodModel,
  NamedKind,
  Task,
  TaskModel,
} from '../types/tmk';

export interface AtlasEntity {
  id: string;
  kind: EntityKind;
  name: string;
  description: string;
  data: Record<string, unknown>;
}

export interface NamedThing {
  id: string;
  kind: NamedKind;
  name: string;
  description: string;
  data: Record<string, unknown>;
}

export interface ReferenceHit {
  sourceId: string;
  targetId: string;
  path: string;
  value: string;
}

export interface AtlasEdge {
  id: string;
  sourceId: string;
  targetId: string;
  labels: string[];
  fields: string[];
}

export interface AtlasStats {
  byKind: Record<EntityKind, number>;
  entities: number;
  edges: number;
  references: number;
  relations: number;
  assertions: number;
  organisers: number;
  isolated: number;
}

export interface Atlas {
  entities: AtlasEntity[];
  named: Map<string, NamedThing>;
  edges: AtlasEdge[];
  references: ReferenceHit[];
  adjacency: Map<string, Set<string>>;
  outgoing: Map<string, AtlasEdge[]>;
  incoming: Map<string, AtlasEdge[]>;
  hubs: AtlasEntity[];
  stats: AtlasStats;
}

type StringVisitor = (value: string, path: string) => void;

function walkStrings(value: unknown, path: string[], visit: StringVisitor): void {
  if (typeof value === 'string') {
    visit(value, path.join('.'));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, [...path, String(index)], visit));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      walkStrings(child, [...path, key], visit);
    }
  }
}

function humanise(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();
}

const PATH_LABELS: Array<[RegExp, string]> = [
  [/means.*mechanismReference/, 'means'],
  [/goalInvocation.*goalReference/, 'invokes'],
  [/actualArguments/, 'argument'],
  [/inputParameters/, 'input'],
  [/outputParameters/, 'output'],
  [/superConcept/, 'super concept'],
  [/properties.*\.type/, 'property type'],
  [/values\./, 'value'],
  [/triples.*\.instance1/, 'subject'],
  [/triples.*\.instance2/, 'object'],
  [/triples.*\.relation/, 'relation'],
  [/\.concept$/, 'instance of'],
  [/equivalentTo/, 'equivalent to'],
  [/requires/, 'requires'],
  [/provides/, 'provides'],
];

/** Turn a deeply nested field path into a short, readable edge label. */
export function fieldLabel(path: string): string {
  for (const [pattern, label] of PATH_LABELS) {
    if (pattern.test(path)) return label;
  }
  const parts = path.replace(/\.\d+(?=\.|$)/g, '').split('.').filter(Boolean);
  return humanise(parts[parts.length - 1] ?? 'reference');
}

function makeTask(task: Task): AtlasEntity {
  return {
    id: `task:${task.name}`,
    kind: 'task',
    name: task.name,
    description: task.description,
    data: task as unknown as Record<string, unknown>,
  };
}

function makeMethod(method: Method): AtlasEntity {
  return {
    id: `method:${method.name}`,
    kind: 'method',
    name: method.name,
    description: method.description,
    data: method as unknown as Record<string, unknown>,
  };
}

function makeConcept(concept: Concept): AtlasEntity {
  return {
    id: `concept:${concept.name}`,
    kind: 'concept',
    name: concept.name,
    description: concept.description ?? '',
    data: concept as unknown as Record<string, unknown>,
  };
}

function makeInstance(instance: Instance): AtlasEntity {
  return {
    id: `instance:${instance.name}`,
    kind: 'instance',
    name: instance.name,
    description: `An instance of ${instance.concept}.`,
    data: instance as unknown as Record<string, unknown>,
  };
}

function annotation(
  kind: 'relation' | 'assertion',
  record: { name: string; description?: string },
  extra: Record<string, unknown> = {},
): NamedThing {
  return {
    id: `${kind}:${record.name}`,
    kind,
    name: record.name,
    description: record.description ?? `${record.name} (${kind}).`,
    data: { ...record, ...extra },
  };
}

/**
 * Build the display atlas from a model triplet.
 *
 * Pure function: it never writes to any argument. Callers can safely memoise
 * it or reuse it in a future preview of an unsaved draft.
 */
export function createAtlas(
  taskModel: TaskModel,
  methodModel: MethodModel,
  knowledgeModel: KnowledgeModel,
): Atlas {
  const entities: AtlasEntity[] = [
    ...taskModel.tasks.map(makeTask),
    ...methodModel.methods.map(makeMethod),
    ...knowledgeModel.concepts.map(makeConcept),
    ...knowledgeModel.instances.map(makeInstance),
  ];

  const named = new Map<string, NamedThing>();
  const remember = (thing: NamedThing): void => {
    const key = thing.name.trim().toLowerCase();
    // Entity nodes win over annotations with the same name.
    if (!named.has(key)) named.set(key, thing);
  };

  entities.forEach(remember);
  (knowledgeModel.relations ?? []).forEach((relation) => {
    remember(
      annotation(
        'relation',
        {
          name: relation.name,
          description: `${relation.domain} to ${relation.range}.`,
        },
        relation as unknown as Record<string, unknown>,
      ),
    );
  });
  [
    ...(knowledgeModel.assertions ?? []),
    ...methodModel.methods.flatMap((method) => method.assertions ?? []),
  ].forEach((assertion: Assertion) => {
    remember(annotation('assertion', assertion, { equivalentTo: assertion.equivalentTo }));
  });

  const references: ReferenceHit[] = [];
  const edgeMap = new Map<string, AtlasEdge>();
  const adjacency = new Map<string, Set<string>>();
  entities.forEach((entity) => adjacency.set(entity.id, new Set()));

  for (const entity of entities) {
    walkStrings(entity.data, [], (rawValue, path) => {
      const value = rawValue.trim();
      if (!value) return;
      const tail = path.split('.').pop();
      if (tail === 'name' || tail === 'model') return;
      const target = named.get(value.toLowerCase());
      if (!target || target.id === entity.id) return;

      references.push({ sourceId: entity.id, targetId: target.id, path, value });

      // Annotations are described in the inspector, not drawn as graph nodes.
      if (target.kind === 'relation' || target.kind === 'assertion') return;

      const key = `${entity.id}|${target.id}`;
      const existing = edgeMap.get(key);
      if (existing) {
        const label = fieldLabel(path);
        if (!existing.labels.includes(label)) existing.labels.push(label);
        if (!existing.fields.includes(path)) existing.fields.push(path);
      } else {
        edgeMap.set(key, {
          id: key,
          sourceId: entity.id,
          targetId: target.id,
          labels: [fieldLabel(path)],
          fields: [path],
        });
      }
      adjacency.get(entity.id)?.add(target.id);
      adjacency.get(target.id)?.add(entity.id);
    });
  }

  const edges = [...edgeMap.values()];
  const outgoing = new Map<string, AtlasEdge[]>();
  const incoming = new Map<string, AtlasEdge[]>();
  entities.forEach((entity) => {
    outgoing.set(entity.id, []);
    incoming.set(entity.id, []);
  });
  edges.forEach((edge) => {
    outgoing.get(edge.sourceId)?.push(edge);
    incoming.get(edge.targetId)?.push(edge);
  });

  const byKind: Record<EntityKind, number> = {
    task: taskModel.tasks.length,
    method: methodModel.methods.length,
    concept: knowledgeModel.concepts.length,
    instance: knowledgeModel.instances.length,
  };
  const isolated = entities.filter(
    (entity) => (adjacency.get(entity.id)?.size ?? 0) === 0,
  ).length;
  const hubs = [...entities].sort(
    (a, b) => (adjacency.get(b.id)?.size ?? 0) - (adjacency.get(a.id)?.size ?? 0),
  );

  return {
    entities,
    named,
    edges,
    references,
    adjacency,
    outgoing,
    incoming,
    hubs,
    stats: {
      byKind,
      entities: entities.length,
      edges: edges.length,
      references: references.length,
      relations: knowledgeModel.relations?.length ?? 0,
      assertions:
        (knowledgeModel.assertions?.length ?? 0) +
        methodModel.methods.reduce(
          (total, method) => total + (method.assertions?.length ?? 0),
          0,
        ),
      organisers: methodModel.methods.filter((method) => method.organizer).length,
      isolated,
    },
  };
}

/** Look up a named entity or annotation, ignoring case. */
export function lookup(atlas: Atlas, name: string): NamedThing | undefined {
  return atlas.named.get(name.trim().toLowerCase());
}
