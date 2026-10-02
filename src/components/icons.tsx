/** A few line icons, drawn on a 24px grid in the text colour. Decorative: screen readers skip them. */
type IconProps = { className?: string };

function Svg({ className = "size-5", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return <Svg {...props}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>;
}

export function CloseIcon(props: IconProps) {
  return <Svg {...props}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
}

export function ChevronDownIcon(props: IconProps) {
  return <Svg {...props}><path d="m6 9 6 6 6-6" /></Svg>;
}

export function PlusIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 5v14M5 12h14" /></Svg>;
}

export function SearchIcon(props: IconProps) {
  return <Svg {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
}

export function AlertIcon(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16.5h.01" /></Svg>;
}

export function CheckCircleIcon(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></Svg>;
}

export function InfoIcon(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5h.01" /></Svg>;
}

export function LogoutIcon(props: IconProps) {
  return <Svg {...props}><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><path d="m16 16 4-4-4-4M20 12H9" /></Svg>;
}

export function GlobeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="m6 7 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Svg>
  );
}

export function BoxIcon(props: IconProps) {
  return <Svg {...props}><path d="M21 8 12 3 3 8v8l9 5 9-5Z" /><path d="m3 8 9 5 9-5M12 13v8" /></Svg>;
}

export function ReceiptIcon(props: IconProps) {
  return <Svg {...props}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" /><path d="M9 8h6M9 12h6" /></Svg>;
}

export function CartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" />
    </Svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return <Svg {...props}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
}

export function ArrowDownIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 5v14M6 13l6 6 6-6" /></Svg>;
}

export function HomeIcon(props: IconProps) {
  return <Svg {...props}><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10M10 20v-6h4v6" /></Svg>;
}

export function UsersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20v-1a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v1M16 4.3a3.5 3.5 0 0 1 0 7.4M21.5 20v-1a4 4 0 0 0-3-3.9" />
    </Svg>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7a2 2 0 0 1 2-2h11v4" />
      <path d="M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2ZM16 14h.01" />
    </Svg>
  );
}

/** Settings, drawn as sliders. */
export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </Svg>
  );
}

/** "More": four tiles. */
export function MoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect height="6" rx="1.5" width="6" x="4" y="4" />
      <rect height="6" rx="1.5" width="6" x="14" y="4" />
      <rect height="6" rx="1.5" width="6" x="4" y="14" />
      <rect height="6" rx="1.5" width="6" x="14" y="14" />
    </Svg>
  );
}

export function UserIcon(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></Svg>;
}

export function BookIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 7c-1.7-1.3-4-2-6.5-2-.9 0-1.7.1-2.5.3v13c.8-.2 1.6-.3 2.5-.3 2.5 0 4.8.7 6.5 2 1.7-1.3 4-2 6.5-2 .9 0 1.7.1 2.5.3v-13c-.8-.2-1.6-.3-2.5-.3-2.5 0-4.8.7-6.5 2Zm0 0v13" /></Svg>;
}

export function CheckIcon(props: IconProps) {
  return <Svg {...props}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>;
}

export function ChevronUpDownIcon(props: IconProps) {
  return <Svg {...props}><path d="m8 9 4-4 4 4M16 15l-4 4-4-4" /></Svg>;
}

export function GridIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect height="7" rx="2" width="7" x="3.5" y="3.5" />
      <rect height="7" rx="2" width="7" x="13.5" y="3.5" />
      <rect height="7" rx="2" width="7" x="3.5" y="13.5" />
      <rect height="7" rx="2" width="7" x="13.5" y="13.5" />
    </Svg>
  );
}

export function TagIcon(props: IconProps) {
  return <Svg {...props}><path d="M3.5 12.5v-8a1 1 0 0 1 1-1h8l8 8a1.4 1.4 0 0 1 0 2l-7 7a1.4 1.4 0 0 1-2 0Z" /><path d="M8 8h.01" /></Svg>;
}

export function LayersIcon(props: IconProps) {
  return <Svg {...props}><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 12.5 9 5 9-5M3 17l9 5 9-5" /></Svg>;
}

export function TruckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17.5" cy="18" r="1.8" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
}

/** Money coming in to the shop. */
export function ArrowDownLeftIcon(props: IconProps) {
  return <Svg {...props}><path d="M17 7 7 17M7 9v8h8" /></Svg>;
}

/** Money going out of the shop. */
export function ArrowUpRightIcon(props: IconProps) {
  return <Svg {...props}><path d="M7 17 17 7M9 7h8v8" /></Svg>;
}

export function StoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9.5 5.5 4h13L20 9.5" />
      <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5 12v8h14v-8M10 20v-5h4v5" />
    </Svg>
  );
}

export function BadgeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect height="16" rx="2" width="16" x="4" y="4" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8 16.5a4 4 0 0 1 8 0" />
    </Svg>
  );
}

export function MonitorIcon(props: IconProps) {
  return <Svg {...props}><rect height="11" rx="2" width="18" x="3" y="4" /><path d="M8 20h8M12 15v5" /></Svg>;
}

export function BuildingIcon(props: IconProps) {
  return <Svg {...props}><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3" /></Svg>;
}

export function BellIcon(props: IconProps) {
  return <Svg {...props}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></Svg>;
}

export function PrinterIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 8V3.5h10V8M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v6.5H7z" />
    </Svg>
  );
}

export function TrendUpIcon(props: IconProps) {
  return <Svg {...props}><path d="m3 17 6-6 4 4 8-8M15 7h6v6" /></Svg>;
}

export function TrendDownIcon(props: IconProps) {
  return <Svg {...props}><path d="m3 7 6 6 4-4 8 8M15 17h6v-6" /></Svg>;
}

export function WarningIcon(props: IconProps) {
  return <Svg {...props}><path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5v4M12 17h.01" /></Svg>;
}

/** Money or goods going back: a refund, a return. */
export function ReturnIcon(props: IconProps) {
  return <Svg {...props}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></Svg>;
}

export function MinusIcon(props: IconProps) {
  return <Svg {...props}><path d="M5 12h14" /></Svg>;
}

export function BanknoteIcon(props: IconProps) {
  return <Svg {...props}><rect height="12" rx="2" width="19" x="2.5" y="6" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v.01M18 14.5v.01" /></Svg>;
}

export function PhoneIcon(props: IconProps) {
  return <Svg {...props}><rect height="18" rx="2.5" width="11" x="6.5" y="3" /><path d="M11 17.5h2" /></Svg>;
}

export function BankIcon(props: IconProps) {
  return <Svg {...props}><path d="m3 9 9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18" /></Svg>;
}

export function UserPlusIcon(props: IconProps) {
  return <Svg {...props}><circle cx="10" cy="8" r="4" /><path d="M3 20a7 7 0 0 1 12.5-4.3M19 14v6M16 17h6" /></Svg>;
}

export function ChartIcon(props: IconProps) {
  return <Svg {...props}><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></Svg>;
}

export function PieIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 3v9h9a9 9 0 1 1-9-9Z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15Z" /></Svg>;
}

export function Spinner({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" fill="currentColor" />
    </svg>
  );
}
