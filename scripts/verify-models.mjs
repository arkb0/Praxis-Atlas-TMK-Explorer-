#!/usr/bin/env node
/**
 * Dependency-free integrity check for the example TMK model set.
 *
 * Usage:  node scripts/verify-models.mjs
 * Exit 0 when every schema-required field is present and every reference the
 * viewer is expected to resolve does resolve.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (name) => JSON.parse(readFileSync(join(root, 'src', 'data', name), 'utf8'));

const taskModel = load('task-model.json');
const methodModel = load('method-model.json');
const knowledgeModel = load('knowledge-model.json');

const problems = [];
const requireFields = (record, fields, label) => {
  for (const field of fields) {
    if (!(field in record)) problems.push(`${label}: missing required field '${field}'`);
  }
};

for (const task of taskModel.tasks) {
  requireFields(task, ['name', 'description', 'inputParameters', 'outputParameters', 'means'], `task '${task.name}'`);
  for (const means of task.means) {
    requireFields(means, ['mechanismReference', 'actualArguments'], `task '${task.name}' means entry`);
  }
}

for (const method of methodModel.methods) {
  requireFields(method, ['name', 'description', 'inputParameters', 'outputParameters'], `method '${method.name}'`);
  for (const assertion of method.assertions ?? []) {
    requireFields(assertion, ['name', 'description', 'equivalentTo'], `method '${method.name}' assertion`);
  }
  const organizer = method.organizer;
  if (!organizer) continue;
  requireFields(
    organizer,
    ['startState', 'successState', 'failureState', 'states', 'transitions'],
    `method '${method.name}' organizer`,
  );
  const states = new Set(organizer.states.map((state) => state.name));
  for (const name of [organizer.startState, organizer.successState, organizer.failureState]) {
    if (!states.has(name)) problems.push(`method '${method.name}': organizer names unknown state '${name}'`);
  }
  for (const state of organizer.states) {
    requireFields(state, ['name', 'goalInvocation'], `state '${state.name}'`);
    if (state.goalInvocation) {
      requireFields(state.goalInvocation, ['goalReference', 'type', 'actualArguments'], `state '${state.name}' goalInvocation`);
    }
  }
  for (const transition of organizer.transitions) {
    requireFields(transition, ['sourceState', 'targetState', 'dataCondition'], `method '${method.name}' transition`);
    for (const name of [transition.sourceState, transition.targetState]) {
      if (!states.has(name)) problems.push(`method '${method.name}': transition names unknown state '${name}'`);
    }
  }
}

for (const concept of knowledgeModel.concepts) {
  requireFields(concept, ['name'], 'concept');
  for (const property of concept.properties ?? []) {
    requireFields(property, ['name', 'type'], `concept '${concept.name}' property`);
  }
}
for (const instance of knowledgeModel.instances) {
  requireFields(instance, ['name', 'concept'], 'instance');
}
for (const relation of knowledgeModel.relations ?? []) {
  requireFields(relation, ['name', 'domain', 'range'], 'relation');
}
for (const triple of knowledgeModel.triples ?? []) {
  requireFields(triple, ['instance1', 'relation', 'instance2'], 'triple');
}
for (const assertion of knowledgeModel.assertions ?? []) {
  requireFields(assertion, ['name', 'description', 'equivalentTo'], 'knowledge assertion');
}

// The viewer is intentionally generic. This check only asserts the references
// the example is *designed* to resolve, not a fixed reference schema.
const named = new Set([
  ...taskModel.tasks.map((task) => task.name),
  ...methodModel.methods.map((method) => method.name),
  ...knowledgeModel.concepts.map((concept) => concept.name),
  ...knowledgeModel.instances.map((instance) => instance.name),
  ...(knowledgeModel.relations ?? []).map((relation) => relation.name),
  ...(knowledgeModel.assertions ?? []).map((assertion) => assertion.name),
  ...methodModel.methods.flatMap((method) => (method.assertions ?? []).map((assertion) => assertion.name)),
]);
const lowercaseNames = new Set([...named].map((name) => name.toLowerCase()));

const intended = [
  ...taskModel.tasks.flatMap((task) =>
    task.means.map((means) => ({ from: `task '${task.name}'`, to: means.mechanismReference })),
  ),
  ...methodModel.methods.flatMap((method) =>
    (method.organizer?.states ?? []).map((state) => ({
      from: `method '${method.name}' state '${state.name}'`,
      to: state.goalInvocation.goalReference,
    })),
  ),
];
for (const reference of intended) {
  if (!lowercaseNames.has(reference.to.toLowerCase())) {
    problems.push(`${reference.from}: unresolved reference '${reference.to}'`);
  }
}

const instanceNames = new Set(knowledgeModel.instances.map((instance) => instance.name));
const relationNames = new Set((knowledgeModel.relations ?? []).map((relation) => relation.name));
for (const triple of knowledgeModel.triples ?? []) {
  if (!instanceNames.has(triple.instance1)) problems.push(`triple: unknown instance '${triple.instance1}'`);
  if (!instanceNames.has(triple.instance2)) problems.push(`triple: unknown instance '${triple.instance2}'`);
  if (!relationNames.has(triple.relation)) problems.push(`triple: unknown relation '${triple.relation}'`);
}

if (problems.length > 0) {
  console.error(`Model set has ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Model set is valid.');
console.log(`  tasks: ${taskModel.tasks.length}`);
console.log(`  methods: ${methodModel.methods.length}`);
console.log(`  organisers: ${methodModel.methods.filter((method) => method.organizer).length}`);
console.log(`  concepts: ${knowledgeModel.concepts.length}`);
console.log(`  instances: ${knowledgeModel.instances.length}`);
console.log(`  named references checked: ${intended.length}`);
