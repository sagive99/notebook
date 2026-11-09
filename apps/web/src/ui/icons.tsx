import type { ComponentChildren } from 'preact';

type IconProps = { size?: number };

const Svg = ({ size = 22, children, strokeWidth = 1.8 }: IconProps & { children: ComponentChildren; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const TodayIcon = (props: IconProps) => <Svg {...props}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></Svg>;
export const SpacesIcon = (props: IconProps) => <Svg {...props}><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></Svg>;
export const PeopleIcon = (props: IconProps) => <Svg {...props}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 15c3 0 5 2 5 4" /></Svg>;
export const SearchIcon = (props: IconProps) => <Svg {...props}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></Svg>;
export const PlusIcon = (props: IconProps) => <Svg {...props} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Svg>;
export const SlidersIcon = (props: IconProps) => <Svg {...props}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></Svg>;
export const ChevronLeftIcon = (props: IconProps) => <Svg {...props} strokeWidth={2}><path d="M15 6l-6 6 6 6" /></Svg>;
export const ChevronRightIcon = (props: IconProps) => <Svg {...props} strokeWidth={2}><path d="M9 6l6 6-6 6" /></Svg>;
export const CheckIcon = (props: IconProps) => <Svg {...props} strokeWidth={3}><path d="M5 12l5 5 9-10" /></Svg>;
export const BellIcon = (props: IconProps) => <Svg {...props}><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></Svg>;
export const PersonIcon = (props: IconProps) => <Svg {...props}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></Svg>;
export const MailIcon = (props: IconProps) => <Svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></Svg>;
export const CloudIcon = (props: IconProps) => <Svg {...props}><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.5 4.25 4.25 0 0 0 7 18z" /></Svg>;
export const ArrowUpIcon = (props: IconProps) => <Svg {...props} strokeWidth={2}><path d="M12 19V5M6 11l6-6 6 6" /></Svg>;
export const ArrowDownIcon = (props: IconProps) => <Svg {...props} strokeWidth={2}><path d="M12 5v14M6 13l6 6 6-6" /></Svg>;
export const MoreIcon = (props: IconProps) => <Svg {...props} strokeWidth={2.4}><path d="M6 12h.01M12 12h.01M18 12h.01" /></Svg>;
export const ExternalIcon = (props: IconProps) => <Svg {...props}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>;
export const PlayIcon = ({ size = 12 }: IconProps) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg>;
export const PauseIcon = ({ size = 12 }: IconProps) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>;
export const GripIcon = (props: IconProps) => <Svg {...props} strokeWidth={2.4}><path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" /></Svg>;
export const ClockIcon = (props: IconProps) => <Svg {...props}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></Svg>;
export const CloseIcon = (props: IconProps) => <Svg {...props} strokeWidth={2.4}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const BriefcaseIcon = (props: IconProps) => <Svg {...props}><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18" /></Svg>;
