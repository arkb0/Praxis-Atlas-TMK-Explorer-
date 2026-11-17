import type { IconName } from '@/components/Icon';

export type ViewId = 'atlas' | 'traces' | 'library' | 'organisers' | 'models';

export interface NavigationItem {
  id: ViewId;
  label: string;
  shortLabel: string;
  icon: IconName;
  description: string;
}

export const NAV_ITEMS: NavigationItem[] = [
  {
    id: 'atlas',
    label: 'Skill atlas',
    shortLabel: 'Atlas',
    icon: 'atlas',
    description: 'The whole model set as one connected graph.',
  },
  {
    id: 'traces',
    label: 'Ivy traces',
    shortLabel: 'Traces',
    icon: 'quote',
    description: 'Read pasted reasoning traces and plot their TMK elements.',
  },
  {
    id: 'library',
    label: 'Entity index',
    shortLabel: 'Index',
    icon: 'library',
    description: 'Browse every task, method, concept and instance.',
  },
  {
    id: 'organisers',
    label: 'Organisers',
    shortLabel: 'Organisers',
    icon: 'organisers',
    description: 'Read each method organiser as a state machine.',
  },
  {
    id: 'models',
    label: 'Source models',
    shortLabel: 'Models',
    icon: 'models',
    description: 'Inspect the three frozen JSON documents.',
  },
];
