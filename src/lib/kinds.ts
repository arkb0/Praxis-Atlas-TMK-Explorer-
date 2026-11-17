/** Presentation metadata for the four graph node kinds. */
import type { EntityKind } from '../types/tmk';

export interface KindMeta {
  label: string;
  plural: string;
  adjective: string;
  description: string;
  /** Solid node / edge accent. */
  accent: string;
  /** Edge accent adjusted for dark backgrounds. */
  edge: string;
  icon: 'flag' | 'route' | 'cube' | 'dot';
}

export const KIND_ORDER: EntityKind[] = ['task', 'method', 'concept', 'instance'];

export const KIND_META: Record<EntityKind, KindMeta> = {
  task: {
    label: 'Task',
    plural: 'Tasks',
    adjective: 'task',
    description: 'Something the practice sets out to achieve.',
    accent: '#F8D727',
    edge: '#C6A800',
    icon: 'flag',
  },
  method: {
    label: 'Method',
    plural: 'Methods',
    adjective: 'method',
    description: 'The mechanism that discharges a task.',
    accent: '#2F9FD9',
    edge: '#2F9FD9',
    icon: 'route',
  },
  concept: {
    label: 'Concept',
    plural: 'Concepts',
    adjective: 'knowledge',
    description: 'A class of thing the method reasons about.',
    accent: '#005C45',
    edge: '#0B7A5C',
    icon: 'cube',
  },
  instance: {
    label: 'Instance',
    plural: 'Instances',
    adjective: 'knowledge',
    description: 'A grounded example of a concept.',
    accent: '#5C8A72',
    edge: '#79A28C',
    icon: 'dot',
  },
};
