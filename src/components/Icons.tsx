import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

function svg(path: ReactNode, viewBox = '0 0 24 24') {
  return function Icon({ size = 20, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {path}
      </svg>
    );
  };
}

export const SearchIcon = svg(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </>,
);

export const CloseIcon = svg(<path d="M18 6 6 18M6 6l12 12" />);

export const LocateIcon = svg(
  <>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
    <path d="M12 2v2.4M12 19.6V22M22 12h-2.4M4.4 12H2" />
  </>,
);

export const CompassIcon = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.2 8.8-2 4.4-4.4 2 2-4.4z" fill="currentColor" stroke="none" />
  </>,
);

export const StarIcon = svg(
  <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" />,
);

export const StarFilledIcon = svg(
  <path
    d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"
    fill="currentColor"
  />,
);

export const SpeakerIcon = svg(
  <>
    <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
    <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.4a8 8 0 0 1 0 11.2" />
  </>,
);

export const StopIcon = svg(<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />);

export const RouteIcon = svg(
  <>
    <path d="m3 12 18-8-8 18-2.2-7.8z" />
  </>,
);

export const ExternalIcon = svg(
  <>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </>,
);

export const ListIcon = svg(
  <>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </>,
);

export const InfoIcon = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.9" r="1.1" fill="currentColor" stroke="none" />
  </>,
);

export const ClockIcon = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.2 2" />
  </>,
);

export const PhoneIcon = svg(
  <path d="M6.5 3h3l1.5 4-2 1.4a12 12 0 0 0 5.6 5.6l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z" />,
);

export const GlobeIcon = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.3 9h17.4M3.3 15h17.4" />
    <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
  </>,
);

export const PinIcon = svg(
  <>
    <path d="M12 21s6.5-5.6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21z" />
    <circle cx="12" cy="10.5" r="2.4" />
  </>,
);

export const TrashIcon = svg(
  <>
    <path d="M4 7h16M9.5 7V5h5v2M6.5 7l.8 12a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1l.8-12" />
  </>,
);

export const ChevronDownIcon = svg(<path d="m6 9 6 6 6-6" />);

export const WarningIcon = svg(
  <>
    <path d="M12 4 2.8 20h18.4z" />
    <path d="M12 10v4.4" />
    <circle cx="12" cy="17.2" r="1" fill="currentColor" stroke="none" />
  </>,
);

export const InstallIcon = svg(
  <>
    <path d="M12 3v11" />
    <path d="m7.5 10 4.5 4 4.5-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </>,
);

export const EuroIcon = svg(
  <>
    <path d="M17 6.5A6 6 0 0 0 8 12a6 6 0 0 0 9 5.5" />
    <path d="M5 10.5h7M5 13.5h7" />
  </>,
);
