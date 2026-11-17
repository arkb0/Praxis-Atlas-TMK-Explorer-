/**
 * TypeScript mirrors of the three TMK JSON schemata.
 *
 * The schemata are deliberately loose: models share no formal foreign keys,
 * so references are inferred by the viewer (see `src/lib/atlas.ts`). These
 * types only describe the shapes that the schemata guarantee.
 */

export interface ParameterReference {
  inputParameters?: string[];
  outputParameters?: string[];
}

export interface Assertion {
  name: string;
  description: string;
  equivalentTo: string;
}

export interface GoalInvocation {
  goalReference: string;
  type: string;
  actualArguments: string[];
}

export interface OrganizerState {
  name: string;
  goalInvocation: GoalInvocation;
}

export interface OrganizerTransition {
  sourceState: string;
  targetState: string;
  dataCondition: string;
}

export interface Organizer {
  startState: string;
  successState: string;
  failureState: string;
  states: OrganizerState[];
  transitions: OrganizerTransition[];
}

export interface Means {
  mechanismReference: string;
  actualArguments: string[];
}

export interface Task {
  name: string;
  description: string;
  inputParameters: string[];
  outputParameters: string[];
  given?: string;
  makes?: string;
  means: Means[];
}

export interface TaskModel {
  model: 'Task';
  tasks: Task[];
}

export interface Method {
  name: string;
  description: string;
  inputParameters: string[];
  outputParameters: string[];
  requires?: string;
  provides?: string;
  assertions?: Assertion[];
  organizer?: Organizer;
}

export interface MethodModel {
  model: 'Method';
  methods: Method[];
}

export interface PropertyDefinition {
  name: string;
  type: string;
}

export interface Concept {
  name: string;
  description?: string;
  superConcept?: string[];
  properties?: PropertyDefinition[];
}

export type InstanceValues = Record<string, unknown>;

export interface Instance {
  name: string;
  concept: string;
  values?: InstanceValues;
}

export interface Relation {
  name: string;
  domain: string;
  range: string;
}

export interface Triple {
  instance1: string;
  relation: string;
  instance2: string;
}

export interface KnowledgeModel {
  model: 'Knowledge';
  concepts: Concept[];
  instances: Instance[];
  relations?: Relation[];
  triples?: Triple[];
  assertions?: Assertion[];
}

export type TmkModel = TaskModel | MethodModel | KnowledgeModel;
export type EntityKind = 'task' | 'method' | 'concept' | 'instance';
export type AnnotationKind = 'relation' | 'assertion';
export type NamedKind = EntityKind | AnnotationKind;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ModelDocument {
  id: 'task' | 'method' | 'knowledge';
  label: string;
  file: string;
  description: string;
  model: TmkModel;
}

/** One loadable skill: a named Task / Method / Knowledge triplet. */
export interface ModelSet {
  name: string;
  /** Short provenance label, e.g. the library folder the skill came from. */
  origin: string;
  task: TaskModel;
  method: MethodModel;
  knowledge: KnowledgeModel;
  /** Display path of each source file. */
  files: Record<ModelDocument['id'], string>;
}
