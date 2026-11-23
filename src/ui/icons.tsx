type P = { size?: number };
const base = (size = 22) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const IconPlate = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
  </svg>
);

export const IconList = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M8 9h8M8 12h8M8 15h5" />
  </svg>
);

export const IconPeople = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
    <circle cx="16.5" cy="9.5" r="2.4" />
    <path d="M15.5 14.6c2.3.1 4.2 1.4 4.9 4.1" />
  </svg>
);

export const IconPlus = ({ size }: P) => (
  <svg {...base(size)} strokeWidth={2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconScan = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M8 9h8M8 12h8M8 15h5" />
  </svg>
);

export const IconCheck = ({ size }: P) => (
  <svg {...base(size)} strokeWidth={2}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
