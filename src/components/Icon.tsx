/**
 * One small, dependency-free icon set. Icons inherit `currentColor` so they
 * work in light, dark and on coloured badges without extra variants.
 */
import type { SVGProps } from 'react';

export type IconName =
  | 'atlas'
  | 'library'
  | 'organisers'
  | 'models'
  | 'search'
  | 'sun'
  | 'moon'
  | 'close'
  | 'plus'
  | 'minus'
  | 'reset'
  | 'arrow-right'
  | 'arrow-up-right'
  | 'link'
  | 'lock'
  | 'copy'
  | 'check'
  | 'chevron-down'
  | 'chevron-right'
  | 'info'
  | 'leaf'
  | 'flag'
  | 'route'
  | 'cube'
  | 'dot'
  | 'layers'
  | 'filter'
  | 'target'
  | 'menu'
  | 'spark'
  | 'expand'
  | 'code'
  | 'quote'
  | 'compass'
  | 'eye';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

const PATHS: Record<IconName, React.ReactNode> = {
  atlas: (
    <>
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M8.2 8.3 10.5 16M15.7 8.2 13.4 16M8.5 6.6l7-.4" />
    </>
  ),
  library: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 11h6" />
    </>
  ),
  organisers: (
    <>
      <rect x="3" y="3" width="6" height="6" rx="1.6" />
      <rect x="15" y="15" width="6" height="6" rx="1.6" />
      <rect x="15" y="3" width="6" height="6" rx="1.6" />
      <path d="M9 6h6M6 9v6a3 3 0 0 0 3 3h6" />
    </>
  ),
  models: (
    <>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M12 8v8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  reset: (
    <>
      <path d="M4 10a8 8 0 1 1 2.4 8" />
      <path d="M4 4v6h6" />
    </>
  ),
  'arrow-right': <path d="M4 12h15M13 6l6 6-6 6" />,
  'arrow-up-right': <path d="M7 17 17 7M8 7h9v9" />,
  link: (
    <>
      <path d="M10 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7L11.2 6.6" />
      <path d="M14 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.4-1.4" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5V4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1" />
    </>
  ),
  check: <path d="m4 12.5 5 5L20 6.5" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4c-8 0-14 4-14 10 0 2 1 4 2 5 5-1 12-5 12-15z" />
      <path d="M4 21c1-5 4-9 9-12" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V4M5 4c4-2 7 2 11 0v8c-4 2-7-2-11 0" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18h4a4 4 0 0 0 0-8h-3a4 4 0 0 1 0-8h6" />
    </>
  ),
  cube: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  dot: (
    <>
      <circle cx="12" cy="12" r="8.5" strokeDasharray="2.4 3" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5M3 17.5l9 5 9-5" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  spark: (
    <>
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  expand: <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" />,
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13 4l-2 16" />,
  quote: (
    <>
      <path d="M9 10H4v5h5v3H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h5zM20 10h-5v5h5v3h-5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h5z" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

export default function Icon({
  name,
  size = 18,
  strokeWidth = 1.75,
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
