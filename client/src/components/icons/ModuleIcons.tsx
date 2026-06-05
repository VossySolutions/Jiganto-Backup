interface IconProps {
  className?: string;
}

// ============================================================
// MODULE ICONS (Sidebar + Module Discovery)
// ============================================================

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="#3b82f6" />
      <rect x="9" y="1" width="6" height="3" rx="1" fill="#22c55e" />
      <rect x="9" y="5.5" width="6" height="1.5" rx="0.75" fill="#a855f7" />
      <rect x="1" y="9" width="6" height="2" rx="1" fill="#f97316" />
      <rect x="1" y="12.5" width="3" height="2.5" rx="1" fill="#ec4899" />
      <rect x="5.5" y="12.5" width="3" height="2.5" rx="1" fill="#0ea5e9" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#eab308" />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="9" rx="2" fill="#6366f1" />
      <path d="M4 13L7 11H14" stroke="#6366f1" strokeWidth="0" fill="none" />
      <polygon points="4,11 4,14 7,11" fill="#6366f1" />
      <circle cx="5" cy="6.5" r="1" fill="white" fillOpacity="0.9" />
      <circle cx="8" cy="6.5" r="1" fill="white" fillOpacity="0.9" />
      <circle cx="11" cy="6.5" r="1" fill="white" fillOpacity="0.9" />
    </svg>
  );
}

export function DocumentsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="10" height="14" rx="1.5" fill="#3b82f6" />
      <rect x="4" y="3.5" width="6" height="1" rx="0.5" fill="white" fillOpacity="0.8" />
      <rect x="4" y="5.5" width="4.5" height="1" rx="0.5" fill="white" fillOpacity="0.6" />
      <rect x="4" y="7.5" width="6" height="1" rx="0.5" fill="white" fillOpacity="0.5" />
      <rect x="4" y="9.5" width="3.5" height="1" rx="0.5" fill="white" fillOpacity="0.4" />
      <rect x="10" y="4" width="4" height="11" rx="1.5" fill="#22c55e" />
      <rect x="11.5" y="6" width="2" height="0.8" rx="0.4" fill="white" fillOpacity="0.7" />
      <rect x="11.5" y="7.5" width="1.5" height="0.8" rx="0.4" fill="white" fillOpacity="0.5" />
    </svg>
  );
}

export function PortfolioIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="10" rx="2" fill="#7c3aed" />
      <rect x="5" y="1.5" width="6" height="4" rx="1" fill="#a855f7" />
      <rect x="3" y="7" width="4" height="3" rx="1" fill="white" fillOpacity="0.3" />
      <rect x="9" y="7" width="4" height="3" rx="1" fill="white" fillOpacity="0.2" />
      <rect x="3" y="11" width="10" height="1.5" rx="0.5" fill="white" fillOpacity="0.15" />
    </svg>
  );
}

export function ProjectsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="4" height="12" rx="1" fill="#0ea5e9" />
      <rect x="6" y="1" width="4" height="14" rx="1" fill="#3b82f6" />
      <rect x="11" y="5" width="4" height="10" rx="1" fill="#6366f1" />
      <rect x="2" y="4.5" width="2" height="1.5" rx="0.5" fill="white" fillOpacity="0.7" />
      <rect x="7" y="2.5" width="2" height="1.5" rx="0.5" fill="white" fillOpacity="0.7" />
      <rect x="12" y="6.5" width="2" height="1.5" rx="0.5" fill="white" fillOpacity="0.7" />
    </svg>
  );
}

export function TasksIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="4" rx="1" fill="#ec4899" />
      <polyline points="3,3 4,4 6,2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="8" y="2.5" width="5" height="1" rx="0.5" fill="white" fillOpacity="0.6" />
      <rect x="1" y="6" width="14" height="4" rx="1" fill="#8b5cf6" />
      <polyline points="3,8 4,9 6,7" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="8" y="7.5" width="5" height="1" rx="0.5" fill="white" fillOpacity="0.6" />
      <rect x="1" y="11" width="14" height="4" rx="1" fill="#0ea5e9" />
      <rect x="2.5" y="12.5" width="2.5" height="1" rx="0.5" fill="white" fillOpacity="0.5" />
      <rect x="8" y="12.5" width="5" height="1" rx="0.5" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

export function WorkspacesIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#f59e0b" />
      <rect x="3" y="3" width="4.5" height="4.5" rx="1" fill="white" fillOpacity="0.85" />
      <rect x="8.5" y="3" width="4.5" height="2" rx="0.7" fill="white" fillOpacity="0.6" />
      <rect x="8.5" y="5.8" width="4.5" height="1.7" rx="0.7" fill="white" fillOpacity="0.4" />
      <rect x="3" y="8.5" width="10" height="1.5" rx="0.5" fill="white" fillOpacity="0.5" />
      <rect x="3" y="11" width="7" height="1.5" rx="0.5" fill="white" fillOpacity="0.35" />
    </svg>
  );
}

export function BusinessIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="5" width="12" height="10" rx="1.5" fill="#7c3aed" />
      <rect x="5" y="2" width="6" height="5" rx="1" fill="#a855f7" />
      <rect x="4" y="8" width="3.5" height="2.5" rx="0.7" fill="white" fillOpacity="0.3" />
      <rect x="8.5" y="8" width="3.5" height="2.5" rx="0.7" fill="white" fillOpacity="0.2" />
      <polyline points="4,12 6,11 8.5,12.5 12,10.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6" />
    </svg>
  );
}

export function CRMIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="3" fill="#22c55e" />
      <path d="M1 14C1 11 3 9 6 9C9 9 11 11 11 14" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="4.5" r="2" fill="#10b981" />
      <path d="M9 13.5C9 11.5 10.2 10 12 10C13.8 10 15 11.5 15 13.5" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <circle cx="12.5" cy="2.5" r="1" fill="#f59e0b" />
    </svg>
  );
}

export function FinanceIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#10b981" />
      <text x="8" y="11" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">$</text>
    </svg>
  );
}

export function ResourcesIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5" cy="4" r="2.5" fill="#f97316" />
      <circle cx="11" cy="4" r="2.5" fill="#0ea5e9" />
      <path d="M1 12C1 9.8 2.8 8 5 8C7.2 8 9 9.8 9 12" fill="#f97316" fillOpacity="0.7" />
      <path d="M7 12C7 9.8 8.8 8 11 8C13.2 8 15 9.8 15 12" fill="#0ea5e9" fillOpacity="0.7" />
      <rect x="3" y="13" width="10" height="2" rx="1" fill="#eab308" />
    </svg>
  );
}

export function ServiceDeskIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8C3 4.7 5.2 2 8 2C10.8 2 13 4.7 13 8" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="1" y="7" width="3" height="5" rx="1" fill="#14b8a6" />
      <rect x="12" y="7" width="3" height="5" rx="1" fill="#0d9488" />
      <path d="M12 12C12 13.5 10.2 14.5 8 14.5" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="14.5" r="1" fill="#f59e0b" />
    </svg>
  );
}

export function HelpDeskIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#0ea5e9" />
      <circle cx="8" cy="8" r="5" stroke="white" strokeWidth="1.2" fill="none" opacity="0.5" />
      <circle cx="8" cy="8" r="3" stroke="white" strokeWidth="1" fill="none" opacity="0.3" />
      <path d="M5.5 5.5C5.5 4 6.5 3 8 3C9.5 3 10.5 4 10.5 5.5C10.5 7 8 7.5 8 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="11.5" r="1" fill="white" />
    </svg>
  );
}

export function TestManagementIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M5 1V4L3 7V14C3 14.5 3.5 15 4 15H12C12.5 15 13 14.5 13 14V7L11 4V1" stroke="#ef4444" strokeWidth="1.2" fill="none" />
      <rect x="5" y="1" width="6" height="3" rx="0.5" fill="#ef4444" fillOpacity="0.3" />
      <path d="M3 7H13" stroke="#ef4444" strokeWidth="1" />
      <circle cx="6.5" cy="10" r="0.8" fill="#22c55e" />
      <circle cx="8" cy="12" r="0.8" fill="#3b82f6" />
      <circle cx="9.5" cy="10.5" r="0.8" fill="#f59e0b" />
    </svg>
  );
}

export function BPMIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="8" r="2" fill="#8b5cf6" />
      <rect x="6" y="5.5" width="4" height="5" rx="1" fill="#3b82f6" />
      <path d="M13 5L15 8L13 11L11 8Z" fill="#22c55e" />
      <line x1="5" y1="8" x2="6" y2="8" stroke="#6b7280" strokeWidth="1.2" />
      <line x1="10" y1="8" x2="11" y2="8" stroke="#6b7280" strokeWidth="1.2" />
      <circle cx="3" cy="3" r="1.2" stroke="#f97316" strokeWidth="1" fill="#f97316" fillOpacity="0.3" />
      <line x1="3" y1="4.2" x2="3" y2="6" stroke="#f97316" strokeWidth="1" />
    </svg>
  );
}

export function SurveysIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" rx="1.5" fill="#06b6d4" />
      <rect x="4" y="3.5" width="1.5" height="1.5" rx="0.3" fill="white" fillOpacity="0.8" />
      <rect x="7" y="3.5" width="5" height="1.5" rx="0.5" fill="white" fillOpacity="0.5" />
      <rect x="4" y="6.5" width="1.5" height="1.5" rx="0.3" fill="white" fillOpacity="0.8" />
      <rect x="7" y="6.5" width="4" height="1.5" rx="0.5" fill="white" fillOpacity="0.5" />
      <rect x="4" y="9.5" width="1.5" height="1.5" rx="0.3" fill="white" fillOpacity="0.8" />
      <rect x="7" y="9.5" width="3" height="1.5" rx="0.5" fill="white" fillOpacity="0.5" />
      <polyline points="4.2,4 4.6,4.7 5.3,3.7" stroke="#06b6d4" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <polyline points="4.2,7 4.6,7.7 5.3,6.7" stroke="#06b6d4" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function DigitalSigningIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="10" height="14" rx="1.5" fill="#ec4899" fillOpacity="0.2" />
      <rect x="2" y="1" width="10" height="14" rx="1.5" stroke="#ec4899" strokeWidth="1" fill="none" />
      <rect x="4" y="3.5" width="6" height="1" rx="0.5" fill="#ec4899" fillOpacity="0.4" />
      <rect x="4" y="5.5" width="4.5" height="1" rx="0.5" fill="#ec4899" fillOpacity="0.3" />
      <path d="M5 11C5.5 9.5 7 9 8 10C9 11 10 12.5 11 11" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <line x1="12" y1="4" x2="14" y2="2" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="2" r="1" fill="#f59e0b" />
    </svg>
  );
}

export function WhiteboardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="11" rx="1.5" fill="#a855f7" />
      <rect x="2.5" y="2.5" width="11" height="8" rx="1" fill="white" fillOpacity="0.9" />
      <circle cx="5.5" cy="5.5" r="1.5" fill="#ef4444" fillOpacity="0.7" />
      <rect x="8" y="4" width="4" height="3" rx="0.5" fill="#3b82f6" fillOpacity="0.6" />
      <line x1="4" y1="9" x2="12" y2="9" stroke="#22c55e" strokeWidth="1" strokeLinecap="round" />
      <line x1="6" y1="12" x2="6" y2="14.5" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="12" x2="10" y2="14.5" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4" y1="14.5" x2="12" y2="14.5" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TemplatesIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="9" height="12" rx="1.5" fill="#f59e0b" />
      <rect x="3" y="4" width="5" height="1.5" rx="0.5" fill="white" fillOpacity="0.7" />
      <rect x="3" y="6.5" width="3.5" height="1" rx="0.5" fill="white" fillOpacity="0.5" />
      <rect x="3" y="8.5" width="5" height="1" rx="0.5" fill="white" fillOpacity="0.4" />
      <rect x="5" y="5" width="10" height="10" rx="1.5" fill="#0ea5e9" />
      <rect x="7" y="7" width="5.5" height="1.5" rx="0.5" fill="white" fillOpacity="0.7" />
      <rect x="7" y="9.5" width="4" height="1" rx="0.5" fill="white" fillOpacity="0.5" />
      <rect x="7" y="11.5" width="5.5" height="1" rx="0.5" fill="white" fillOpacity="0.4" />
    </svg>
  );
}


// ============================================================
// BUSINESS MANAGEMENT TAB ICONS
// ============================================================

export function BizDashboardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="9" width="3" height="6" rx="0.7" fill="#3b82f6" />
      <rect x="5.5" y="5" width="3" height="10" rx="0.7" fill="#22c55e" />
      <rect x="10" y="1" width="3" height="14" rx="0.7" fill="#f97316" />
      <circle cx="14" cy="3" r="1" fill="#ef4444" />
    </svg>
  );
}

export function BizStrategyMapIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="3" r="2" fill="#7c3aed" />
      <circle cx="4" cy="9" r="2" fill="#3b82f6" />
      <circle cx="12" cy="9" r="2" fill="#22c55e" />
      <circle cx="8" cy="14" r="1.5" fill="#f97316" />
      <line x1="8" y1="5" x2="4" y2="7" stroke="#6b7280" strokeWidth="1" />
      <line x1="8" y1="5" x2="12" y2="7" stroke="#6b7280" strokeWidth="1" />
      <line x1="4" y1="11" x2="8" y2="12.5" stroke="#6b7280" strokeWidth="1" />
      <line x1="12" y1="11" x2="8" y2="12.5" stroke="#6b7280" strokeWidth="1" />
    </svg>
  );
}

export function BizStrategyIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="#14b8a6" strokeWidth="1.5" fill="none" />
      <circle cx="8" cy="8" r="4.5" stroke="#14b8a6" strokeWidth="1" fill="none" opacity="0.5" />
      <circle cx="8" cy="8" r="2" fill="#14b8a6" />
      <line x1="8" y1="1" x2="8" y2="4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="7,1.5 8,0 9,1.5" fill="#ef4444" />
    </svg>
  );
}

export function BizGoalsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 14L3 4L8 1L8 11Z" fill="#22c55e" />
      <path d="M3 4L8 1L8 4Z" fill="#16a34a" />
      <rect x="2" y="3.5" width="1" height="11" rx="0.5" fill="#6b7280" />
      <circle cx="12" cy="6" r="1" fill="#f59e0b" />
      <circle cx="12" cy="9" r="1" fill="#f59e0b" fillOpacity="0.6" />
      <circle cx="12" cy="12" r="1" fill="#f59e0b" fillOpacity="0.3" />
    </svg>
  );
}

export function BizObjectivesIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="4.5" fill="#3b82f6" fillOpacity="0.25" stroke="#3b82f6" strokeWidth="1" />
      <circle cx="8" cy="8" r="2" fill="#3b82f6" />
      <line x1="8" y1="1" x2="8" y2="3.5" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="15" y1="8" x2="12.5" y2="8" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function BizInitiativesIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polyline points="1,13 4,9 7,10 10,5 14,2" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="2" r="1.5" fill="#f59e0b" />
      <circle cx="1" cy="13" r="1" fill="#ef4444" />
      <rect x="1" y="14" width="14" height="1" rx="0.5" fill="#d1d5db" />
    </svg>
  );
}

export function BizOKRsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="3.5" rx="1.5" fill="#8b5cf6" />
      <rect x="1" y="2" width="9" height="3.5" rx="1.5" fill="#a855f7" />
      <rect x="1" y="6.5" width="14" height="3.5" rx="1.5" fill="#3b82f6" fillOpacity="0.3" />
      <rect x="1" y="6.5" width="11" height="3.5" rx="1.5" fill="#3b82f6" />
      <rect x="1" y="11" width="14" height="3.5" rx="1.5" fill="#22c55e" fillOpacity="0.3" />
      <rect x="1" y="11" width="6" height="3.5" rx="1.5" fill="#22c55e" />
    </svg>
  );
}

export function BizKPIsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 14L2 8" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M5.5 14L5.5 5" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M9 14L9 3" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12.5 14L12.5 6" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
      <polyline points="1,7 4,4 7.5,5 11,2 14,3" stroke="#ef4444" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="3" r="1" fill="#ef4444" />
    </svg>
  );
}


export function BizExecutionIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1.2" />
      <path d="M5 8L7.5 10.5L11 5.5" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="12" cy="3" r="2" fill="#f97316" />
      <path d="M11.3 2.3L12.7 3.7M12.7 2.3L11.3 3.7" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

export function BizDocumentsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="9" height="12" rx="1.5" fill="#f59e0b" />
      <rect x="4" y="3.5" width="5" height="1" rx="0.5" fill="white" fillOpacity="0.7" />
      <rect x="4" y="5.5" width="3.5" height="1" rx="0.5" fill="white" fillOpacity="0.5" />
      <rect x="4" y="7.5" width="5" height="1" rx="0.5" fill="white" fillOpacity="0.4" />
      <rect x="5" y="4" width="10" height="11" rx="1.5" fill="#eab308" />
      <rect x="7" y="6.5" width="5.5" height="1" rx="0.5" fill="white" fillOpacity="0.6" />
      <rect x="7" y="8.5" width="4" height="1" rx="0.5" fill="white" fillOpacity="0.4" />
      <rect x="7" y="10.5" width="5.5" height="1" rx="0.5" fill="white" fillOpacity="0.3" />
    </svg>
  );
}


// ============================================================
// TASKS MODULE TAB ICONS
// ============================================================

export function TaskDashboardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6.5" height="6.5" rx="1.5" fill="#3b82f6" />
      <rect x="8.5" y="1" width="6.5" height="6.5" rx="1.5" fill="#22c55e" />
      <rect x="1" y="8.5" width="6.5" height="6.5" rx="1.5" fill="#f97316" />
      <rect x="8.5" y="8.5" width="6.5" height="6.5" rx="1.5" fill="#8b5cf6" />
      <rect x="2.5" y="3" width="3.5" height="1" rx="0.5" fill="white" fillOpacity="0.6" />
      <rect x="10" y="3" width="3.5" height="1" rx="0.5" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

export function TaskPersonalIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3.5" fill="#8b5cf6" />
      <path d="M2 15C2 11.7 4.7 9 8 9C11.3 9 14 11.7 14 15" fill="#8b5cf6" fillOpacity="0.4" />
      <polyline points="6,5 7.5,6.5 10,3.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function TaskCompanyIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="3" width="10" height="12" rx="1" fill="#22c55e" />
      <rect x="1" y="7" width="4" height="8" rx="1" fill="#16a34a" />
      <rect x="11" y="7" width="4" height="8" rx="1" fill="#16a34a" />
      <rect x="5" y="5" width="2" height="2" rx="0.3" fill="white" fillOpacity="0.7" />
      <rect x="9" y="5" width="2" height="2" rx="0.3" fill="white" fillOpacity="0.7" />
      <rect x="5" y="9" width="2" height="2" rx="0.3" fill="white" fillOpacity="0.5" />
      <rect x="9" y="9" width="2" height="2" rx="0.3" fill="white" fillOpacity="0.5" />
      <rect x="6.5" y="12" width="3" height="3" rx="0.3" fill="white" fillOpacity="0.8" />
    </svg>
  );
}

export function TaskTeamIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5" cy="4" r="2.5" fill="#f59e0b" />
      <circle cx="11" cy="4" r="2.5" fill="#0ea5e9" />
      <path d="M1 13C1 10.5 2.8 8.5 5 8.5C7.2 8.5 9 10.5 9 13" fill="#f59e0b" fillOpacity="0.5" />
      <path d="M7 13C7 10.5 8.8 8.5 11 8.5C13.2 8.5 15 10.5 15 13" fill="#0ea5e9" fillOpacity="0.5" />
      <circle cx="8" cy="8" r="1.5" fill="#ec4899" />
    </svg>
  );
}

export function TaskProjectIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="12" rx="1.5" fill="#14b8a6" fillOpacity="0.15" />
      <rect x="1" y="1" width="6" height="3" rx="1" fill="#14b8a6" />
      <rect x="1" y="3" width="14" height="1" fill="#14b8a6" fillOpacity="0.3" />
      <rect x="3" y="6" width="4" height="1.5" rx="0.5" fill="#14b8a6" />
      <rect x="3" y="8.5" width="6" height="1.5" rx="0.5" fill="#0ea5e9" />
      <rect x="3" y="11" width="3" height="1.5" rx="0.5" fill="#8b5cf6" />
    </svg>
  );
}

export function TaskCustomerIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" rx="2" fill="#ef4444" fillOpacity="0.15" />
      <rect x="1" y="3" width="14" height="10" rx="2" stroke="#ef4444" strokeWidth="1" fill="none" />
      <circle cx="6" cy="7" r="2" fill="#ef4444" />
      <path d="M3 12.5C3 10.5 4.3 9.5 6 9.5C7.7 9.5 9 10.5 9 12.5" fill="#ef4444" fillOpacity="0.4" />
      <rect x="10" y="6" width="3" height="1" rx="0.5" fill="#ef4444" fillOpacity="0.5" />
      <rect x="10" y="8" width="2" height="1" rx="0.5" fill="#ef4444" fillOpacity="0.3" />
    </svg>
  );
}


// ============================================================
// BPM SUB-NAV ICONS
// ============================================================

export function BpmLibraryIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="4" height="12" rx="1" fill="#f59e0b" />
      <rect x="6" y="1" width="4" height="14" rx="1" fill="#f97316" />
      <rect x="11" y="3" width="4" height="11" rx="1" fill="#eab308" />
      <rect x="2" y="4" width="2" height="1" rx="0.3" fill="white" fillOpacity="0.6" />
      <rect x="7" y="3" width="2" height="1" rx="0.3" fill="white" fillOpacity="0.6" />
      <rect x="12" y="5" width="2" height="1" rx="0.3" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

export function BpmDiagramsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="4" r="2" fill="#3b82f6" />
      <rect x="7" y="2.5" width="4" height="3" rx="0.7" fill="#0ea5e9" />
      <path d="M12.5 9L15 12L12.5 15L10 12Z" fill="#22c55e" />
      <line x1="5" y1="4" x2="7" y2="4" stroke="#6b7280" strokeWidth="1" />
      <line x1="9" y1="5.5" x2="9" y2="9" stroke="#6b7280" strokeWidth="1" />
      <line x1="9" y1="9" x2="10" y2="9.5" stroke="#6b7280" strokeWidth="1" />
      <circle cx="3" cy="12" r="1.5" fill="#8b5cf6" />
      <line x1="3" y1="6" x2="3" y2="10.5" stroke="#6b7280" strokeWidth="1" />
    </svg>
  );
}

export function BpmPortalIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#1e88c8" fillOpacity="0.15" />
      <rect x="1" y="1" width="14" height="3" rx="2" fill="#1e88c8" />
      <circle cx="3" cy="2.5" r="0.7" fill="#ef4444" />
      <circle cx="5" cy="2.5" r="0.7" fill="#f59e0b" />
      <circle cx="7" cy="2.5" r="0.7" fill="#22c55e" />
      <rect x="3" y="6" width="4" height="3.5" rx="0.7" fill="#3b82f6" fillOpacity="0.4" />
      <rect x="9" y="6" width="4" height="3.5" rx="0.7" fill="#8b5cf6" fillOpacity="0.4" />
      <rect x="3" y="11" width="10" height="2" rx="0.7" fill="#22c55e" fillOpacity="0.3" />
    </svg>
  );
}

export function BpmArchitectureIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="1" width="6" height="3" rx="0.7" fill="#8b5cf6" />
      <rect x="1" y="6" width="5" height="3" rx="0.7" fill="#3b82f6" />
      <rect x="10" y="6" width="5" height="3" rx="0.7" fill="#22c55e" />
      <rect x="3" y="12" width="4.5" height="3" rx="0.7" fill="#f97316" />
      <rect x="8.5" y="12" width="4.5" height="3" rx="0.7" fill="#ec4899" />
      <line x1="8" y1="4" x2="3.5" y2="6" stroke="#6b7280" strokeWidth="1" />
      <line x1="8" y1="4" x2="12.5" y2="6" stroke="#6b7280" strokeWidth="1" />
      <line x1="3.5" y1="9" x2="5.25" y2="12" stroke="#6b7280" strokeWidth="1" />
      <line x1="12.5" y1="9" x2="10.75" y2="12" stroke="#6b7280" strokeWidth="1" />
    </svg>
  );
}

export function BpmOrgChartIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="3" r="2" fill="#14b8a6" />
      <rect x="6.5" y="1.5" width="3" height="3" rx="1.5" fill="#14b8a6" />
      <circle cx="3.5" cy="10" r="1.5" fill="#0ea5e9" />
      <circle cx="8" cy="10" r="1.5" fill="#8b5cf6" />
      <circle cx="12.5" cy="10" r="1.5" fill="#f97316" />
      <line x1="8" y1="5" x2="8" y2="8.5" stroke="#6b7280" strokeWidth="1" />
      <line x1="3.5" y1="8.5" x2="12.5" y2="8.5" stroke="#6b7280" strokeWidth="1" />
      <line x1="3.5" y1="8.5" x2="3.5" y2="8.5" stroke="#6b7280" strokeWidth="1" />
    </svg>
  );
}

export function BpmFrameworksIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" stroke="#22c55e" strokeWidth="1.2" fill="none" />
      <line x1="1" y1="5" x2="15" y2="5" stroke="#22c55e" strokeWidth="1" />
      <line x1="5.5" y1="5" x2="5.5" y2="15" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
      <circle cx="3.25" cy="3" r="1" fill="#22c55e" />
      <rect x="7" y="7" width="3" height="1.5" rx="0.5" fill="#22c55e" fillOpacity="0.5" />
      <rect x="7" y="10" width="4" height="1.5" rx="0.5" fill="#22c55e" fillOpacity="0.35" />
      <rect x="12" y="7" width="1.5" height="1.5" rx="0.5" fill="#f59e0b" />
      <rect x="12" y="10" width="1.5" height="1.5" rx="0.5" fill="#3b82f6" />
    </svg>
  );
}


// ============================================================
// RESOURCES MODULE TAB ICONS
// ============================================================

export function ResDashboardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1A7 7 0 0 1 15 8H8Z" fill="#3b82f6" />
      <path d="M8 1A7 7 0 0 0 1 8H8Z" fill="#22c55e" />
      <path d="M1 8A7 7 0 0 0 8 15V8Z" fill="#f97316" />
      <path d="M8 15A7 7 0 0 0 15 8H8Z" fill="#8b5cf6" />
      <circle cx="8" cy="8" r="2.5" fill="white" />
    </svg>
  );
}

export function ResPeopleIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5.5" cy="4" r="2.5" fill="#8b5cf6" />
      <circle cx="10.5" cy="4" r="2.5" fill="#a855f7" />
      <path d="M1.5 13C1.5 10.5 3.2 8.5 5.5 8.5C7.8 8.5 9.5 10.5 9.5 13" fill="#8b5cf6" fillOpacity="0.5" />
      <path d="M6.5 13C6.5 10.5 8.2 8.5 10.5 8.5C12.8 8.5 14.5 10.5 14.5 13" fill="#a855f7" fillOpacity="0.5" />
    </svg>
  );
}

export function ResSkillsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="#14b8a6" strokeWidth="1" fill="none" />
      <line x1="5.5" y1="1" x2="5.5" y2="15" stroke="#14b8a6" strokeWidth="0.8" opacity="0.5" />
      <line x1="10.5" y1="1" x2="10.5" y2="15" stroke="#14b8a6" strokeWidth="0.8" opacity="0.5" />
      <line x1="1" y1="5.5" x2="15" y2="5.5" stroke="#14b8a6" strokeWidth="0.8" opacity="0.5" />
      <line x1="1" y1="10.5" x2="15" y2="10.5" stroke="#14b8a6" strokeWidth="0.8" opacity="0.5" />
      <circle cx="3.25" cy="3.25" r="1.2" fill="#14b8a6" />
      <circle cx="8" cy="8" r="1.2" fill="#22c55e" />
      <circle cx="13" cy="3.25" r="1.2" fill="#0ea5e9" />
      <circle cx="3.25" cy="13" r="1.2" fill="#f59e0b" />
    </svg>
  );
}

export function ResCapacityIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="3" rx="1" fill="#22c55e" fillOpacity="0.2" />
      <rect x="1" y="2" width="10" height="3" rx="1" fill="#22c55e" />
      <rect x="1" y="6.5" width="14" height="3" rx="1" fill="#3b82f6" fillOpacity="0.2" />
      <rect x="1" y="6.5" width="7" height="3" rx="1" fill="#3b82f6" />
      <rect x="1" y="11" width="14" height="3" rx="1" fill="#f97316" fillOpacity="0.2" />
      <rect x="1" y="11" width="12" height="3" rx="1" fill="#f97316" />
    </svg>
  );
}

export function ResPipelineIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polyline points="1,12 4,8 7,9 10,4 14,2" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="4" cy="8" r="1.2" fill="#ef4444" />
      <circle cx="10" cy="4" r="1.2" fill="#ef4444" />
      <circle cx="14" cy="2" r="1.2" fill="#ef4444" />
      <rect x="1" y="14" width="14" height="1" rx="0.5" fill="#d1d5db" />
    </svg>
  );
}

export function ResTimesheetsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="1.2" />
      <line x1="8" y1="4" x2="8" y2="8" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="8" x2="11" y2="10" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="8" r="1" fill="#f59e0b" />
    </svg>
  );
}

export function ResApprovalsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#22c55e" />
      <polyline points="5,8 7,10 11,5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}


// ============================================================
// DOCUMENTS FILTER TAB ICONS
// ============================================================

export function DocAllIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" fill="#3b82f6" />
      <rect x="9" y="1" width="6" height="6" rx="1" fill="#0ea5e9" />
      <rect x="1" y="9" width="6" height="6" rx="1" fill="#6366f1" />
      <rect x="9" y="9" width="6" height="6" rx="1" fill="#8b5cf6" />
    </svg>
  );
}

export function DocMyDocsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polygon points="8,1 10,5 14.5,5.5 11,9 12,13.5 8,11 4,13.5 5,9 1.5,5.5 6,5" fill="#f59e0b" />
    </svg>
  );
}

export function DocBusinessIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="5" width="10" height="9" rx="1.5" fill="#8b5cf6" />
      <rect x="5.5" y="2.5" width="5" height="4" rx="1" fill="#a855f7" />
      <rect x="5" y="8" width="6" height="1" rx="0.5" fill="white" fillOpacity="0.5" />
      <rect x="6" y="10" width="4" height="1" rx="0.5" fill="white" fillOpacity="0.3" />
    </svg>
  );
}

export function DocCustomerIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#22c55e" fillOpacity="0.15" stroke="#22c55e" strokeWidth="1.2" />
      <circle cx="8" cy="6" r="2.5" fill="#22c55e" />
      <path d="M3.5 14C3.5 11 5.5 9 8 9C10.5 9 12.5 11 12.5 14" fill="#22c55e" fillOpacity="0.5" />
    </svg>
  );
}

export function DocProjectIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="12" rx="1.5" fill="#f97316" fillOpacity="0.2" />
      <rect x="1" y="1" width="6" height="3" rx="1" fill="#f97316" />
      <rect x="1" y="3" width="14" height="1" fill="#f97316" fillOpacity="0.3" />
      <rect x="3" y="6" width="5" height="1.5" rx="0.5" fill="#f97316" fillOpacity="0.5" />
      <rect x="3" y="9" width="3.5" height="1.5" rx="0.5" fill="#f97316" fillOpacity="0.35" />
    </svg>
  );
}

export function DocFinanceIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="1.5" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1" />
      <line x1="1" y1="4.5" x2="15" y2="4.5" stroke="#ef4444" strokeWidth="0.8" />
      <line x1="5.5" y1="4.5" x2="5.5" y2="15" stroke="#ef4444" strokeWidth="0.8" opacity="0.5" />
      <rect x="2" y="2" width="2.5" height="1.5" rx="0.5" fill="#ef4444" fillOpacity="0.5" />
      <rect x="7" y="6" width="3" height="1" rx="0.3" fill="#ef4444" fillOpacity="0.4" />
      <rect x="7" y="8.5" width="4" height="1" rx="0.3" fill="#ef4444" fillOpacity="0.3" />
      <rect x="7" y="11" width="2.5" height="1" rx="0.3" fill="#ef4444" fillOpacity="0.3" />
    </svg>
  );
}

export function DocTestingIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polyline points="5,8 7,10 11,5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="8" cy="8" r="7" stroke="#22c55e" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function DocBPMIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="4" cy="4" r="2" fill="#ec4899" />
      <rect x="9" y="2" width="5" height="4" rx="1" fill="#ec4899" fillOpacity="0.6" />
      <circle cx="4" cy="12" r="2" fill="#ec4899" fillOpacity="0.4" />
      <rect x="9" y="10" width="5" height="4" rx="1" fill="#ec4899" fillOpacity="0.3" />
      <line x1="6" y1="4" x2="9" y2="4" stroke="#6b7280" strokeWidth="1" />
      <line x1="6" y1="12" x2="9" y2="12" stroke="#6b7280" strokeWidth="1" />
      <line x1="11.5" y1="6" x2="11.5" y2="10" stroke="#6b7280" strokeWidth="1" />
    </svg>
  );
}

export function PfDashboardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="#3B82F6" opacity="0.85" />
      <rect x="9" y="1" width="6" height="3" rx="1" fill="#10B981" opacity="0.8" />
      <rect x="9" y="5.5" width="6" height="3" rx="1" fill="#F59E0B" opacity="0.8" />
      <rect x="1" y="9" width="14" height="6" rx="1.5" fill="#7C3AED" opacity="0.15" />
      <rect x="2.5" y="10.5" width="3" height="3" rx="0.5" fill="#7C3AED" opacity="0.7" />
      <rect x="6.5" y="11.5" width="3" height="2" rx="0.5" fill="#3B82F6" opacity="0.6" />
      <rect x="10.5" y="10.5" width="3" height="3" rx="0.5" fill="#10B981" opacity="0.7" />
    </svg>
  );
}

export function PfPortfoliosIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="11" rx="2" fill="#7C3AED" opacity="0.15" />
      <rect x="4" y="1" width="8" height="3" rx="1" fill="#7C3AED" opacity="0.8" />
      <rect x="3" y="6" width="10" height="2" rx="0.5" fill="#3B82F6" opacity="0.5" />
      <rect x="3" y="9" width="7" height="2" rx="0.5" fill="#10B981" opacity="0.5" />
      <rect x="3" y="12" width="5" height="1.5" rx="0.5" fill="#F59E0B" opacity="0.5" />
    </svg>
  );
}

export function PfProgrammesIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="4" r="2.5" fill="#3B82F6" opacity="0.85" />
      <line x1="8" y1="6.5" x2="4" y2="10" stroke="#6B7280" strokeWidth="1" />
      <line x1="8" y1="6.5" x2="12" y2="10" stroke="#6B7280" strokeWidth="1" />
      <circle cx="4" cy="11.5" r="2" fill="#10B981" opacity="0.75" />
      <circle cx="12" cy="11.5" r="2" fill="#F59E0B" opacity="0.75" />
      <circle cx="8" cy="13" r="1.5" fill="#EC4899" opacity="0.6" />
    </svg>
  );
}

export function PfRoadmapIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="9" height="2.5" rx="1" fill="#3B82F6" opacity="0.8" />
      <rect x="3" y="5.5" width="11" height="2.5" rx="1" fill="#10B981" opacity="0.75" />
      <rect x="2" y="9" width="7" height="2.5" rx="1" fill="#F59E0B" opacity="0.75" />
      <rect x="5" y="12.5" width="10" height="2.5" rx="1" fill="#7C3AED" opacity="0.7" />
      <line x1="7" y1="1" x2="7" y2="16" stroke="#EF4444" strokeWidth="1" strokeDasharray="2 1" opacity="0.6" />
    </svg>
  );
}

export function PfHealthIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="4" height="4" rx="1" fill="#10B981" opacity="0.8" />
      <rect x="6" y="1" width="4" height="4" rx="1" fill="#10B981" opacity="0.8" />
      <rect x="11" y="1" width="4" height="4" rx="1" fill="#F59E0B" opacity="0.8" />
      <rect x="1" y="6" width="4" height="4" rx="1" fill="#10B981" opacity="0.8" />
      <rect x="6" y="6" width="4" height="4" rx="1" fill="#EF4444" opacity="0.8" />
      <rect x="11" y="6" width="4" height="4" rx="1" fill="#10B981" opacity="0.8" />
      <rect x="1" y="11" width="4" height="4" rx="1" fill="#F59E0B" opacity="0.8" />
      <rect x="6" y="11" width="4" height="4" rx="1" fill="#10B981" opacity="0.8" />
      <rect x="11" y="11" width="4" height="4" rx="1" fill="#10B981" opacity="0.8" />
    </svg>
  );
}

export function PfReportsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#3B82F6" opacity="0.1" />
      <rect x="3" y="9" width="2" height="5" rx="0.5" fill="#3B82F6" opacity="0.8" />
      <rect x="6" y="6" width="2" height="8" rx="0.5" fill="#10B981" opacity="0.8" />
      <rect x="9" y="4" width="2" height="10" rx="0.5" fill="#F59E0B" opacity="0.8" />
      <rect x="12" y="7" width="2" height="7" rx="0.5" fill="#7C3AED" opacity="0.8" />
      <path d="M3 8 L6 5 L9 3 L12 6" stroke="#EF4444" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}


// ============================================================
// PROJECT MANAGEMENT - WORK TYPE ICONS
// ============================================================

export function PmProjectIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="12" rx="1.5" fill="#3b82f6" fillOpacity="0.15" />
      <rect x="1" y="1" width="6" height="3" rx="1" fill="#3b82f6" />
      <rect x="3" y="5.5" width="5" height="1.5" rx="0.5" fill="#3b82f6" />
      <rect x="3" y="8" width="8" height="1.5" rx="0.5" fill="#0ea5e9" />
      <rect x="3" y="10.5" width="4" height="1.5" rx="0.5" fill="#8b5cf6" />
      <circle cx="13" cy="5" r="1.2" fill="#22c55e" />
    </svg>
  );
}

export function PmProgrammeIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.2" fill="#7c3aed" />
      <rect x="9" y="1" width="6" height="6" rx="1.2" fill="#3b82f6" />
      <rect x="1" y="9" width="6" height="6" rx="1.2" fill="#0ea5e9" />
      <rect x="9" y="9" width="6" height="6" rx="1.2" fill="#22c55e" />
      <rect x="3" y="3" width="2" height="1" rx="0.3" fill="white" fillOpacity="0.6" />
      <rect x="11" y="3" width="2" height="1" rx="0.3" fill="white" fillOpacity="0.6" />
      <rect x="3" y="11" width="2" height="1" rx="0.3" fill="white" fillOpacity="0.6" />
      <rect x="11" y="11" width="2" height="1" rx="0.3" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

export function PmInitiativeIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5Z" fill="#6366f1" />
      <circle cx="8" cy="7" r="2" fill="white" fillOpacity="0.4" />
      <circle cx="8" cy="7" r="1" fill="#f59e0b" />
    </svg>
  );
}

export function PmCampaignIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="#f97316" strokeWidth="1.2" fill="#f97316" fillOpacity="0.1" />
      <circle cx="8" cy="8" r="5" stroke="#f97316" strokeWidth="1" fill="none" opacity="0.4" />
      <circle cx="8" cy="8" r="3" fill="#f97316" fillOpacity="0.3" />
      <circle cx="8" cy="8" r="1.5" fill="#f97316" />
      <line x1="13" y1="3" x2="15" y2="1" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="14,0 16,0 16,2" fill="#ef4444" />
    </svg>
  );
}

export function PmPocIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M5 1V4L3 7V14C3 14.5 3.5 15 4 15H12C12.5 15 13 14.5 13 14V7L11 4V1" stroke="#14b8a6" strokeWidth="1.2" fill="none" />
      <rect x="5" y="1" width="6" height="3" rx="0.5" fill="#14b8a6" fillOpacity="0.3" />
      <path d="M3 7H13" stroke="#14b8a6" strokeWidth="1" />
      <circle cx="6.5" cy="10" r="1" fill="#3b82f6" />
      <circle cx="9.5" cy="10" r="1" fill="#f59e0b" />
      <circle cx="8" cy="12.5" r="0.8" fill="#22c55e" />
    </svg>
  );
}

export function PmUserDefinedIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#6b7280" fillOpacity="0.15" />
      <rect x="1" y="1" width="14" height="14" rx="2" stroke="#6b7280" strokeWidth="1" fill="none" />
      <path d="M10.5 3L13 5.5L6.5 12H4V9.5Z" fill="#8b5cf6" />
      <line x1="9" y1="4.5" x2="11.5" y2="7" stroke="white" strokeWidth="0.8" />
      <circle cx="13" cy="3" r="1" fill="#f59e0b" />
    </svg>
  );
}

export function PmPortfolioIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="10" rx="2" fill="#7c3aed" />
      <rect x="5" y="1.5" width="6" height="4" rx="1" fill="#a855f7" />
      <rect x="3" y="7" width="4" height="3" rx="0.7" fill="white" fillOpacity="0.3" />
      <rect x="9" y="7" width="4" height="3" rx="0.7" fill="white" fillOpacity="0.2" />
      <rect x="3" y="11.5" width="10" height="1.5" rx="0.5" fill="white" fillOpacity="0.15" />
    </svg>
  );
}

export function PmSubProjectIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="8" height="6" rx="1.2" fill="#0ea5e9" />
      <rect x="5" y="9" width="10" height="6" rx="1.2" fill="#14b8a6" />
      <line x1="5" y1="4" x2="5" y2="9" stroke="#6b7280" strokeWidth="1.2" strokeDasharray="2 1" />
      <rect x="2.5" y="2.5" width="3" height="1" rx="0.3" fill="white" fillOpacity="0.6" />
      <rect x="7" y="10.5" width="4" height="1" rx="0.3" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

export function PmProgramIncrementIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polyline points="1,13 4,9 7,10 10,5 14,2" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="2" r="1.5" fill="#3b82f6" />
      <rect x="1" y="14" width="14" height="1.2" rx="0.5" fill="#d1d5db" />
      <circle cx="4" cy="9" r="1" fill="#22c55e" />
      <circle cx="7" cy="10" r="1" fill="#f59e0b" />
      <circle cx="10" cy="5" r="1" fill="#8b5cf6" />
    </svg>
  );
}

export function PmWorkstreamIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="3" rx="1" fill="#3b82f6" />
      <rect x="1" y="6.5" width="14" height="3" rx="1" fill="#22c55e" />
      <rect x="1" y="11" width="14" height="3" rx="1" fill="#f97316" />
      <rect x="2.5" y="3" width="5" height="1" rx="0.3" fill="white" fillOpacity="0.6" />
      <rect x="2.5" y="7.5" width="7" height="1" rx="0.3" fill="white" fillOpacity="0.6" />
      <rect x="2.5" y="12" width="4" height="1" rx="0.3" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

export function PmTaskForceIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polygon points="8,1 9.5,5.5 14,6 10.5,9.5 11.5,14 8,11.5 4.5,14 5.5,9.5 2,6 6.5,5.5" fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" strokeWidth="1" />
      <circle cx="8" cy="7" r="2" fill="#ef4444" />
      <path d="M8 5L8.5 6.5H10L8.8 7.5L9.2 9L8 8L6.8 9L7.2 7.5L6 6.5H7.5Z" fill="white" fillOpacity="0.8" />
    </svg>
  );
}

export function PmChangeRequestIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="10" height="14" rx="1.5" fill="#ec4899" fillOpacity="0.15" stroke="#ec4899" strokeWidth="1" />
      <rect x="4" y="3.5" width="6" height="1" rx="0.5" fill="#ec4899" fillOpacity="0.4" />
      <rect x="4" y="5.5" width="4" height="1" rx="0.5" fill="#ec4899" fillOpacity="0.3" />
      <circle cx="12" cy="12" r="3" fill="#f59e0b" />
      <path d="M10.5 12H13.5M12 10.5V13.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function PmEnhancementIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polyline points="1,14 5,8 8,10 12,4 15,2" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="15" cy="2" r="1.2" fill="#22c55e" />
      <polygon points="13.5,1 15.5,1 15.5,3" fill="#22c55e" fillOpacity="0.4" />
      <rect x="1" y="14.5" width="14" height="1" rx="0.5" fill="#d1d5db" />
    </svg>
  );
}

export function PmExperimentIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M5 1V5L2 10V14C2 14.5 2.5 15 3 15H13C13.5 15 14 14.5 14 14V10L11 5V1" stroke="#8b5cf6" strokeWidth="1.2" fill="none" />
      <rect x="5" y="1" width="6" height="2" rx="0.5" fill="#8b5cf6" fillOpacity="0.3" />
      <path d="M2 10H14" stroke="#8b5cf6" strokeWidth="0.8" />
      <circle cx="5.5" cy="12" r="1" fill="#3b82f6" />
      <circle cx="8" cy="11.5" r="0.8" fill="#22c55e" />
      <circle cx="10.5" cy="12.5" r="1.2" fill="#f59e0b" />
    </svg>
  );
}

export function PmPilotIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L14 14H2Z" fill="#22c55e" fillOpacity="0.15" stroke="#22c55e" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="2" fill="#22c55e" />
      <circle cx="8" cy="8" r="1" fill="white" fillOpacity="0.7" />
      <line x1="8" y1="3.5" x2="8" y2="6" stroke="#22c55e" strokeWidth="1" strokeLinecap="round" />
      <circle cx="12" cy="4" r="1.5" fill="#f59e0b" />
    </svg>
  );
}

export function PmPrototypeIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="2" fill="#0ea5e9" fillOpacity="0.15" stroke="#0ea5e9" strokeWidth="1.2" />
      <circle cx="5.5" cy="5.5" r="1.5" fill="#3b82f6" />
      <rect x="8.5" y="4" width="4" height="3" rx="0.7" fill="#22c55e" />
      <rect x="3.5" y="9" width="9" height="2.5" rx="0.7" fill="#f97316" fillOpacity="0.5" />
      <line x1="5.5" y1="7" x2="5.5" y2="9" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="1.5 1" />
      <line x1="10.5" y1="7" x2="10.5" y2="9" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="1.5 1" />
    </svg>
  );
}

export function PmSprintIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="#0ea5e9" strokeWidth="1.5" fill="none" />
      <path d="M8 3V8L11 10" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1" fill="#3b82f6" />
      <path d="M13 2L14.5 0.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 2L1.5 0.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function PmImprovementIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 14A6 6 0 1 1 8 2" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M8 2A6 6 0 0 1 8 14" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="3 2" />
      <polygon points="8,4 9.5,7 8,6" fill="#22c55e" />
      <polygon points="8,12 6.5,9 8,10" fill="#22c55e" />
      <circle cx="13" cy="3" r="1.5" fill="#f59e0b" />
      <path d="M12.3 2.3L13.7 3.7" stroke="white" strokeWidth="0.7" strokeLinecap="round" />
    </svg>
  );
}


// ============================================================
// PROJECT MANAGEMENT - TOOL ICONS
// ============================================================

export function PmGanttChartIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="2" width="8" height="2.5" rx="0.7" fill="#3b82f6" />
      <rect x="5" y="5.5" width="6" height="2.5" rx="0.7" fill="#22c55e" />
      <rect x="4" y="9" width="10" height="2.5" rx="0.7" fill="#f97316" />
      <rect x="7" y="12.5" width="5" height="2.5" rx="0.7" fill="#8b5cf6" />
      <line x1="1.5" y1="1" x2="1.5" y2="15.5" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="1" y1="15.5" x2="15" y2="15.5" stroke="#6b7280" strokeWidth="0.8" />
    </svg>
  );
}

export function PmMilestonePlanIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <line x1="2" y1="14" x2="14" y2="14" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3 14V5L5.5 3L8 5V14" fill="#ef4444" fillOpacity="0.15" />
      <rect x="2.5" y="4.5" width="1" height="10" rx="0.3" fill="#6b7280" />
      <path d="M3.5 5L6 3L6 7L3.5 5Z" fill="#ef4444" />
      <circle cx="8" cy="10" r="1.5" fill="#3b82f6" />
      <circle cx="12" cy="7" r="1.5" fill="#22c55e" />
      <line x1="8" y1="11.5" x2="8" y2="14" stroke="#3b82f6" strokeWidth="0.8" />
      <line x1="12" y1="8.5" x2="12" y2="14" stroke="#22c55e" strokeWidth="0.8" />
    </svg>
  );
}

export function PmScrumBoardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="4" height="14" rx="1" fill="#3b82f6" fillOpacity="0.15" />
      <rect x="6" y="1" width="4" height="14" rx="1" fill="#f59e0b" fillOpacity="0.15" />
      <rect x="11" y="1" width="4" height="14" rx="1" fill="#22c55e" fillOpacity="0.15" />
      <rect x="1.5" y="3" width="3" height="2.5" rx="0.5" fill="#3b82f6" />
      <rect x="1.5" y="6.5" width="3" height="2" rx="0.5" fill="#3b82f6" fillOpacity="0.5" />
      <rect x="6.5" y="3" width="3" height="3" rx="0.5" fill="#f59e0b" />
      <rect x="11.5" y="3" width="3" height="2" rx="0.5" fill="#22c55e" />
      <rect x="11.5" y="6" width="3" height="2" rx="0.5" fill="#22c55e" fillOpacity="0.5" />
    </svg>
  );
}

export function PmKanbanBoardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="4" height="12" rx="1" fill="#8b5cf6" />
      <rect x="6" y="2" width="4" height="12" rx="1" fill="#ec4899" />
      <rect x="11" y="2" width="4" height="12" rx="1" fill="#14b8a6" />
      <rect x="2" y="4" width="2" height="1.5" rx="0.3" fill="white" fillOpacity="0.7" />
      <rect x="2" y="6.5" width="2" height="1.5" rx="0.3" fill="white" fillOpacity="0.4" />
      <rect x="7" y="4" width="2" height="2" rx="0.3" fill="white" fillOpacity="0.7" />
      <rect x="12" y="4" width="2" height="1.5" rx="0.3" fill="white" fillOpacity="0.7" />
    </svg>
  );
}

export function PmEpicsStoriesIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="4" rx="1" fill="#6366f1" />
      <rect x="3" y="6" width="12" height="3" rx="0.7" fill="#3b82f6" />
      <rect x="3" y="10" width="12" height="3" rx="0.7" fill="#0ea5e9" />
      <rect x="5" y="13.5" width="10" height="2" rx="0.5" fill="#22c55e" fillOpacity="0.6" />
      <rect x="2.5" y="2.5" width="4" height="1" rx="0.3" fill="white" fillOpacity="0.7" />
      <rect x="4.5" y="7" width="3" height="1" rx="0.3" fill="white" fillOpacity="0.5" />
    </svg>
  );
}

export function PmWbsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="1" width="6" height="3" rx="0.7" fill="#7c3aed" />
      <rect x="1" y="7" width="5" height="2.5" rx="0.5" fill="#3b82f6" />
      <rect x="10" y="7" width="5" height="2.5" rx="0.5" fill="#22c55e" />
      <rect x="1" y="12" width="3.5" height="2" rx="0.5" fill="#f59e0b" />
      <rect x="6" y="12" width="3.5" height="2" rx="0.5" fill="#f97316" />
      <rect x="11.5" y="12" width="3.5" height="2" rx="0.5" fill="#ef4444" />
      <line x1="8" y1="4" x2="8" y2="5.5" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="3.5" y1="5.5" x2="12.5" y2="5.5" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="3.5" y1="5.5" x2="3.5" y2="7" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="12.5" y1="5.5" x2="12.5" y2="7" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="3.5" y1="9.5" x2="3.5" y2="12" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="12.5" y1="9.5" x2="12.5" y2="12" stroke="#6b7280" strokeWidth="0.8" />
    </svg>
  );
}

export function PmStatusReportingIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" rx="1.5" fill="#0ea5e9" fillOpacity="0.15" stroke="#0ea5e9" strokeWidth="1" />
      <rect x="4" y="3" width="3" height="1.5" rx="0.5" fill="#22c55e" />
      <rect x="8" y="3" width="4" height="1.5" rx="0.5" fill="#22c55e" fillOpacity="0.4" />
      <rect x="4" y="5.5" width="5" height="1.5" rx="0.5" fill="#f59e0b" />
      <rect x="4" y="8" width="8" height="1.5" rx="0.5" fill="#3b82f6" fillOpacity="0.4" />
      <circle cx="5" cy="11.5" r="1" fill="#22c55e" />
      <circle cx="8" cy="11.5" r="1" fill="#f59e0b" />
      <circle cx="11" cy="11.5" r="1" fill="#ef4444" />
    </svg>
  );
}

export function PmProjectDashboardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6.5" height="5" rx="1" fill="#3b82f6" />
      <rect x="8.5" y="1" width="6.5" height="5" rx="1" fill="#22c55e" />
      <rect x="1" y="7" width="14" height="3" rx="1" fill="#f59e0b" fillOpacity="0.3" />
      <rect x="2" y="7.8" width="8" height="1.5" rx="0.5" fill="#f59e0b" />
      <rect x="1" y="11" width="4.5" height="4" rx="1" fill="#8b5cf6" />
      <rect x="6.5" y="11" width="4.5" height="4" rx="1" fill="#ec4899" />
      <rect x="12" y="11" width="3" height="4" rx="1" fill="#14b8a6" />
    </svg>
  );
}

export function Pm360ReportIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="#3b82f6" strokeWidth="1.5" fill="none" />
      <circle cx="8" cy="8" r="4.5" stroke="#22c55e" strokeWidth="1" fill="none" />
      <circle cx="8" cy="8" r="2" fill="#f59e0b" />
      <line x1="8" y1="1" x2="8" y2="4" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="15" y1="8" x2="12" y2="8" stroke="#8b5cf6" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="8" y1="15" x2="8" y2="12" stroke="#14b8a6" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="1" y1="8" x2="4" y2="8" stroke="#ec4899" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function PmRiskLogIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L15 14H1Z" fill="#f59e0b" fillOpacity="0.2" stroke="#f59e0b" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="7.2" y="5.5" width="1.6" height="4.5" rx="0.5" fill="#f59e0b" />
      <circle cx="8" cy="12" r="1" fill="#f59e0b" />
    </svg>
  );
}

export function PmIssuesLogIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeWidth="1.2" />
      <rect x="7.2" y="4" width="1.6" height="5" rx="0.5" fill="#ef4444" />
      <circle cx="8" cy="11.5" r="1" fill="#ef4444" />
    </svg>
  );
}

export function PmAssumptionsLogIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="9" r="5" fill="#eab308" fillOpacity="0.2" />
      <path d="M8 2C8 2 5 3.5 5 6.5C5 8 6.5 9 8 9C9.5 9 11 8 11 6.5C11 3.5 8 2 8 2Z" fill="#eab308" />
      <circle cx="8" cy="5.5" r="1" fill="white" fillOpacity="0.7" />
      <rect x="7" y="10.5" width="2" height="2.5" rx="0.5" fill="#f59e0b" />
      <rect x="6" y="13.5" width="4" height="1.5" rx="0.5" fill="#d97706" />
    </svg>
  );
}

export function PmDependenciesLogIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="4" cy="4" r="2.5" fill="#3b82f6" />
      <circle cx="12" cy="4" r="2.5" fill="#22c55e" />
      <circle cx="4" cy="12" r="2.5" fill="#f97316" />
      <circle cx="12" cy="12" r="2.5" fill="#8b5cf6" />
      <line x1="6.5" y1="4" x2="9.5" y2="4" stroke="#6b7280" strokeWidth="1" />
      <line x1="4" y1="6.5" x2="4" y2="9.5" stroke="#6b7280" strokeWidth="1" />
      <line x1="12" y1="6.5" x2="12" y2="9.5" stroke="#6b7280" strokeWidth="1" />
      <line x1="6" y1="6" x2="10" y2="10" stroke="#6b7280" strokeWidth="0.8" strokeDasharray="2 1" />
    </svg>
  );
}

export function PmDecisionsLogIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#6366f1" fillOpacity="0.15" stroke="#6366f1" strokeWidth="1.2" />
      <path d="M5 8L7.5 10.5L11.5 5.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="13" cy="3" r="2" fill="#f59e0b" />
      <path d="M12.3 3H13.7M13 2.3V3.7" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

export function PmChangeLogIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" rx="1.5" fill="#ec4899" fillOpacity="0.15" stroke="#ec4899" strokeWidth="1" />
      <rect x="4" y="3.5" width="8" height="1.5" rx="0.5" fill="#ec4899" fillOpacity="0.4" />
      <rect x="4" y="6" width="5" height="1.5" rx="0.5" fill="#ec4899" fillOpacity="0.3" />
      <path d="M10 9L12 11L10 13" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9L4 11L6 13" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PmRaciModelIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="1.5" fill="#14b8a6" fillOpacity="0.1" />
      <line x1="5" y1="1" x2="5" y2="15" stroke="#14b8a6" strokeWidth="0.6" />
      <line x1="8.5" y1="1" x2="8.5" y2="15" stroke="#14b8a6" strokeWidth="0.6" />
      <line x1="12" y1="1" x2="12" y2="15" stroke="#14b8a6" strokeWidth="0.6" />
      <line x1="1" y1="5" x2="15" y2="5" stroke="#14b8a6" strokeWidth="0.6" />
      <line x1="1" y1="8.5" x2="15" y2="8.5" stroke="#14b8a6" strokeWidth="0.6" />
      <line x1="1" y1="12" x2="15" y2="12" stroke="#14b8a6" strokeWidth="0.6" />
      <circle cx="3" cy="3" r="1" fill="#ef4444" />
      <circle cx="6.7" cy="6.7" r="1" fill="#3b82f6" />
      <circle cx="10.2" cy="3" r="1" fill="#22c55e" />
      <circle cx="13.5" cy="10.2" r="1" fill="#f59e0b" />
    </svg>
  );
}

export function PmResourceTrackerIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5" cy="4" r="2.5" fill="#f97316" />
      <circle cx="11" cy="4" r="2.5" fill="#0ea5e9" />
      <path d="M1 13C1 10.5 2.8 8.5 5 8.5C7.2 8.5 9 10.5 9 13" fill="#f97316" fillOpacity="0.5" />
      <path d="M7 13C7 10.5 8.8 8.5 11 8.5C13.2 8.5 15 10.5 15 13" fill="#0ea5e9" fillOpacity="0.5" />
      <rect x="3" y="14" width="10" height="1.5" rx="0.5" fill="#eab308" />
    </svg>
  );
}

export function PmTimesheetsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#0ea5e9" fillOpacity="0.12" stroke="#0ea5e9" strokeWidth="1" />
      <line x1="5" y1="1" x2="5" y2="15" stroke="#0ea5e9" strokeWidth="0.5" />
      <line x1="1" y1="5" x2="15" y2="5" stroke="#0ea5e9" strokeWidth="0.5" />
      <line x1="1" y1="8.5" x2="15" y2="8.5" stroke="#0ea5e9" strokeWidth="0.5" />
      <line x1="1" y1="12" x2="15" y2="12" stroke="#0ea5e9" strokeWidth="0.5" />
      <rect x="6" y="6" width="3" height="1.5" rx="0.3" fill="#3b82f6" />
      <rect x="10" y="6" width="2" height="1.5" rx="0.3" fill="#22c55e" />
      <rect x="6" y="9.5" width="4" height="1.5" rx="0.3" fill="#f59e0b" />
      <rect x="11" y="9.5" width="2" height="1.5" rx="0.3" fill="#8b5cf6" />
      <rect x="2" y="2.5" width="2" height="1" rx="0.3" fill="#0ea5e9" />
    </svg>
  );
}

export function PmFinanceTrackerIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="1.2" />
      <text x="8" y="11" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="Arial">$</text>
      <rect x="1" y="12" width="3" height="3" rx="0.5" fill="#3b82f6" />
      <rect x="5" y="10" width="3" height="5" rx="0.5" fill="#22c55e" />
      <rect x="9" y="11" width="3" height="4" rx="0.5" fill="#f59e0b" />
    </svg>
  );
}

export function PmSowTrackerIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" rx="1.5" fill="#7c3aed" fillOpacity="0.15" stroke="#7c3aed" strokeWidth="1" />
      <rect x="4" y="3" width="8" height="1.5" rx="0.5" fill="#7c3aed" />
      <rect x="4" y="5.5" width="6" height="1" rx="0.3" fill="#7c3aed" fillOpacity="0.4" />
      <rect x="4" y="7.5" width="7" height="1" rx="0.3" fill="#7c3aed" fillOpacity="0.3" />
      <path d="M5 11L7 13L11 9" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PmDocumentationIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="10" height="14" rx="1.5" fill="#3b82f6" />
      <rect x="4" y="3.5" width="6" height="1" rx="0.5" fill="white" fillOpacity="0.8" />
      <rect x="4" y="5.5" width="4.5" height="1" rx="0.5" fill="white" fillOpacity="0.6" />
      <rect x="4" y="7.5" width="6" height="1" rx="0.5" fill="white" fillOpacity="0.5" />
      <rect x="4" y="9.5" width="3.5" height="1" rx="0.5" fill="white" fillOpacity="0.4" />
      <rect x="10" y="4" width="4" height="11" rx="1.5" fill="#22c55e" />
      <rect x="11.5" y="6" width="2" height="0.8" rx="0.4" fill="white" fillOpacity="0.7" />
      <rect x="11.5" y="7.5" width="1.5" height="0.8" rx="0.4" fill="white" fillOpacity="0.5" />
    </svg>
  );
}

export function PmDeliverablesTrackerIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="4" rx="1" fill="#22c55e" />
      <polyline points="3,4 4,5 6,3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="8" y="3" width="5" height="1" rx="0.5" fill="white" fillOpacity="0.6" />
      <rect x="1" y="7" width="14" height="4" rx="1" fill="#f59e0b" />
      <rect x="2.5" y="8.5" width="2.5" height="1" rx="0.5" fill="white" fillOpacity="0.5" />
      <rect x="8" y="8.5" width="5" height="1" rx="0.5" fill="white" fillOpacity="0.6" />
      <rect x="1" y="12" width="14" height="4" rx="1" fill="#8b5cf6" fillOpacity="0.4" />
      <rect x="2.5" y="13.5" width="2.5" height="1" rx="0.5" fill="white" fillOpacity="0.5" />
    </svg>
  );
}

export function PmTestTrackerIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M5 1V4L3 7V14C3 14.5 3.5 15 4 15H12C12.5 15 13 14.5 13 14V7L11 4V1" stroke="#ef4444" strokeWidth="1.2" fill="none" />
      <rect x="5" y="1" width="6" height="3" rx="0.5" fill="#ef4444" fillOpacity="0.3" />
      <path d="M3 7H13" stroke="#ef4444" strokeWidth="1" />
      <circle cx="6.5" cy="10" r="0.8" fill="#22c55e" />
      <circle cx="8" cy="12" r="0.8" fill="#3b82f6" />
      <circle cx="9.5" cy="10.5" r="0.8" fill="#f59e0b" />
    </svg>
  );
}

export function PmOrgChartIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="1" width="6" height="3" rx="0.7" fill="#3b82f6" />
      <rect x="1" y="7" width="4.5" height="3" rx="0.7" fill="#22c55e" />
      <rect x="10.5" y="7" width="4.5" height="3" rx="0.7" fill="#f97316" />
      <rect x="1" y="12.5" width="4.5" height="2.5" rx="0.5" fill="#8b5cf6" />
      <rect x="10.5" y="12.5" width="4.5" height="2.5" rx="0.5" fill="#ec4899" />
      <line x1="8" y1="4" x2="8" y2="5.5" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="3.3" y1="5.5" x2="12.7" y2="5.5" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="3.3" y1="5.5" x2="3.3" y2="7" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="12.7" y1="5.5" x2="12.7" y2="7" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="3.3" y1="10" x2="3.3" y2="12.5" stroke="#6b7280" strokeWidth="0.8" />
      <line x1="12.7" y1="10" x2="12.7" y2="12.5" stroke="#6b7280" strokeWidth="0.8" />
    </svg>
  );
}

export function PmStakeholderMapIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="#14b8a6" strokeWidth="1" fill="#14b8a6" fillOpacity="0.1" />
      <circle cx="8" cy="8" r="4" stroke="#14b8a6" strokeWidth="0.8" fill="none" opacity="0.4" />
      <circle cx="8" cy="4" r="1.5" fill="#3b82f6" />
      <circle cx="12" cy="8" r="1.5" fill="#22c55e" />
      <circle cx="8" cy="12" r="1.5" fill="#f59e0b" />
      <circle cx="4" cy="8" r="1.5" fill="#ec4899" />
      <circle cx="8" cy="8" r="1.2" fill="#14b8a6" />
    </svg>
  );
}

export function PmBusinessProcessModelIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="8" r="2" fill="#8b5cf6" />
      <rect x="6" y="5.5" width="4" height="5" rx="1" fill="#3b82f6" />
      <path d="M13 5L15 8L13 11L11 8Z" fill="#22c55e" />
      <line x1="5" y1="8" x2="6" y2="8" stroke="#6b7280" strokeWidth="1.2" />
      <line x1="10" y1="8" x2="11" y2="8" stroke="#6b7280" strokeWidth="1.2" />
      <circle cx="3" cy="3" r="1.2" stroke="#f97316" strokeWidth="1" fill="#f97316" fillOpacity="0.3" />
      <line x1="3" y1="4.2" x2="3" y2="6" stroke="#f97316" strokeWidth="1" />
    </svg>
  );
}


// ============================================================
// PROJECT MANAGEMENT - CATEGORY ICONS
// ============================================================

export function PmPlanningSchedulingIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="12" rx="1.5" fill="#3b82f6" fillOpacity="0.12" stroke="#3b82f6" strokeWidth="1" />
      <rect x="4" y="1" width="2" height="3" rx="0.5" fill="#3b82f6" />
      <rect x="10" y="1" width="2" height="3" rx="0.5" fill="#3b82f6" />
      <rect x="3" y="6" width="4" height="1.5" rx="0.3" fill="#3b82f6" />
      <rect x="3" y="9" width="6" height="1.5" rx="0.3" fill="#22c55e" />
      <rect x="8" y="6" width="3" height="1.5" rx="0.3" fill="#f59e0b" />
      <rect x="3" y="12" width="3" height="1.5" rx="0.3" fill="#8b5cf6" />
    </svg>
  );
}

export function PmReportingDashboardsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="9" width="3" height="6" rx="0.7" fill="#3b82f6" />
      <rect x="5.5" y="5" width="3" height="10" rx="0.7" fill="#22c55e" />
      <rect x="10" y="1" width="3" height="14" rx="0.7" fill="#f97316" />
      <polyline points="2,8 6.5,4 11,2 14,1" stroke="#ef4444" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="1" r="1" fill="#ef4444" />
    </svg>
  );
}

export function PmRaidGovernanceIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L14 4V8C14 12 11 14.5 8 15.5C5 14.5 2 12 2 8V4Z" fill="#6366f1" fillOpacity="0.15" stroke="#6366f1" strokeWidth="1.2" />
      <path d="M5.5 8L7.5 10L10.5 6" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="3" r="1.5" fill="#f59e0b" />
    </svg>
  );
}

export function PmResourcesFinanceIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5" cy="5" r="3" fill="#0ea5e9" />
      <circle cx="11" cy="5" r="3" fill="#10b981" />
      <rect x="2" y="10" width="5" height="5" rx="1" fill="#0ea5e9" fillOpacity="0.4" />
      <rect x="9" y="10" width="5" height="5" rx="1" fill="#10b981" fillOpacity="0.4" />
      <text x="4.5" y="14" textAnchor="middle" fill="#0ea5e9" fontSize="5" fontWeight="bold" fontFamily="Arial">P</text>
      <text x="11.5" y="14" textAnchor="middle" fill="#10b981" fontSize="5" fontWeight="bold" fontFamily="Arial">$</text>
    </svg>
  );
}

export function PmDocumentationDeliveryIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="9" height="12" rx="1.5" fill="#3b82f6" />
      <rect x="3" y="4" width="5" height="1" rx="0.5" fill="white" fillOpacity="0.7" />
      <rect x="3" y="6" width="3.5" height="1" rx="0.5" fill="white" fillOpacity="0.5" />
      <rect x="3" y="8" width="5" height="1" rx="0.5" fill="white" fillOpacity="0.4" />
      <circle cx="13" cy="10" r="3" fill="#22c55e" />
      <polyline points="11.5,10 12.5,11 14.5,9" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function PmPeopleOrganisationIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="4" r="2.5" fill="#3b82f6" />
      <circle cx="3.5" cy="7" r="2" fill="#f97316" />
      <circle cx="12.5" cy="7" r="2" fill="#22c55e" />
      <path d="M5 14C5 11.5 6.3 10 8 10C9.7 10 11 11.5 11 14" fill="#3b82f6" fillOpacity="0.4" />
      <path d="M0.5 13C0.5 11 1.8 9.5 3.5 9.5C5.2 9.5 6.5 11 6.5 13" fill="#f97316" fillOpacity="0.3" />
      <path d="M9.5 13C9.5 11 10.8 9.5 12.5 9.5C14.2 9.5 15.5 11 15.5 13" fill="#22c55e" fillOpacity="0.3" />
    </svg>
  );
}

export function PmStatActiveIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L10 6H14L10.5 9L12 14L8 11L4 14L5.5 9L2 6H6Z" fill="#3b82f6" />
      <circle cx="8" cy="7.5" r="1.5" fill="white" fillOpacity="0.5" />
    </svg>
  );
}

export function PmStatPlanningIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="#ca8a04" strokeWidth="1.5" fill="#ca8a04" fillOpacity="0.1" />
      <circle cx="8" cy="8" r="3.5" stroke="#ca8a04" strokeWidth="1" fill="none" opacity="0.4" />
      <circle cx="8" cy="8" r="1.5" fill="#ca8a04" />
      <path d="M8 2V4.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function PmStatOnHoldIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" fill="#ea580c" fillOpacity="0.15" stroke="#ea580c" strokeWidth="1.2" />
      <rect x="5.5" y="5" width="2" height="6" rx="0.7" fill="#ea580c" />
      <rect x="8.5" y="5" width="2" height="6" rx="0.7" fill="#ea580c" />
    </svg>
  );
}

export function PmStatCompletedIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" fill="#16a34a" fillOpacity="0.15" stroke="#16a34a" strokeWidth="1.2" />
      <path d="M5 8L7.5 10.5L11.5 5.5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PmStatDraftIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="2" fill="#6b7280" fillOpacity="0.12" stroke="#6b7280" strokeWidth="1" />
      <path d="M9 4L12 7L7 12H4V9Z" fill="#6b7280" fillOpacity="0.5" />
      <line x1="8.5" y1="4.5" x2="11.5" y2="7.5" stroke="white" strokeWidth="0.7" />
    </svg>
  );
}

export function PmSprintBoardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="4" height="14" rx="1" fill="#3b82f6" fillOpacity="0.15" />
      <rect x="6" y="1" width="4" height="14" rx="1" fill="#f59e0b" fillOpacity="0.15" />
      <rect x="11" y="1" width="4" height="14" rx="1" fill="#22c55e" fillOpacity="0.15" />
      <rect x="1.5" y="3" width="3" height="2.5" rx="0.5" fill="#3b82f6" />
      <rect x="1.5" y="6.5" width="3" height="2" rx="0.5" fill="#3b82f6" fillOpacity="0.5" />
      <rect x="6.5" y="3" width="3" height="3" rx="0.5" fill="#f59e0b" />
      <rect x="11.5" y="3" width="3" height="2" rx="0.5" fill="#22c55e" />
      <rect x="11.5" y="6" width="3" height="2" rx="0.5" fill="#22c55e" fillOpacity="0.5" />
      <circle cx="13" cy="13" r="2.5" fill="#6366f1" />
      <path d="M12 13L12.8 13.8L14.2 12.2" stroke="white" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PmBacklogIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="3" rx="1" fill="#6366f1" />
      <rect x="1" y="5" width="14" height="2.5" rx="0.7" fill="#3b82f6" fillOpacity="0.8" />
      <rect x="1" y="8.5" width="14" height="2.5" rx="0.7" fill="#0ea5e9" fillOpacity="0.6" />
      <rect x="1" y="12" width="14" height="2.5" rx="0.7" fill="#94a3b8" fillOpacity="0.4" />
      <rect x="2.5" y="2" width="3" height="1" rx="0.3" fill="white" fillOpacity="0.7" />
      <circle cx="12" cy="2.5" r="1" fill="#f59e0b" />
      <rect x="2.5" y="5.7" width="5" height="0.8" rx="0.3" fill="white" fillOpacity="0.5" />
      <rect x="2.5" y="9.2" width="4" height="0.8" rx="0.3" fill="white" fillOpacity="0.4" />
    </svg>
  );
}

export function PmSprintsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="6" height="5.5" rx="1" fill="#3b82f6" />
      <rect x="9" y="2" width="6" height="5.5" rx="1" fill="#22c55e" />
      <rect x="1" y="9.5" width="6" height="5.5" rx="1" fill="#f59e0b" />
      <rect x="9" y="9.5" width="6" height="5.5" rx="1" fill="#94a3b8" fillOpacity="0.3" />
      <rect x="2.5" y="3.5" width="3" height="0.8" rx="0.3" fill="white" fillOpacity="0.7" />
      <rect x="10.5" y="3.5" width="3" height="0.8" rx="0.3" fill="white" fillOpacity="0.7" />
      <rect x="2.5" y="11" width="3" height="0.8" rx="0.3" fill="white" fillOpacity="0.7" />
      <circle cx="4" cy="6" r="1" fill="white" fillOpacity="0.5" />
      <circle cx="12" cy="6" r="1" fill="white" fillOpacity="0.5" />
      <path d="M10 12L11.5 13.5L14 11" stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

export function PmDefectsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8.5" r="5" fill="#ef4444" fillOpacity="0.15" />
      <circle cx="8" cy="8.5" r="3.5" fill="#ef4444" />
      <path d="M6.5 7L9.5 10M9.5 7L6.5 10" stroke="white" strokeWidth="1" strokeLinecap="round" />
      <path d="M4 3L3 1.5" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" />
      <path d="M12 3L13 1.5" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" />
      <path d="M2 8.5H1" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" />
      <path d="M15 8.5H14" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" />
      <path d="M4 14L3 15" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" />
      <path d="M12 14L13 15" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function PmRoadmapIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="5" height="3" rx="0.7" fill="#6366f1" />
      <rect x="4" y="6.5" width="7" height="3" rx="0.7" fill="#3b82f6" />
      <rect x="7" y="11" width="8" height="3" rx="0.7" fill="#22c55e" />
      <line x1="3.5" y1="5" x2="3.5" y2="6.5" stroke="#94a3b8" strokeWidth="0.8" />
      <line x1="7.5" y1="9.5" x2="7.5" y2="11" stroke="#94a3b8" strokeWidth="0.8" />
      <circle cx="3.5" cy="3.5" r="0.8" fill="white" fillOpacity="0.6" />
      <circle cx="7.5" cy="8" r="0.8" fill="white" fillOpacity="0.6" />
      <circle cx="11" cy="12.5" r="0.8" fill="white" fillOpacity="0.6" />
      <circle cx="14" cy="1.5" r="1.2" fill="#f59e0b" />
    </svg>
  );
}

export function PmBestPracticeIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" rx="1.5" fill="#6366f1" fillOpacity="0.12" />
      <rect x="3.5" y="3" width="9" height="1.2" rx="0.3" fill="#6366f1" />
      <rect x="3.5" y="5.5" width="7" height="0.8" rx="0.3" fill="#3b82f6" fillOpacity="0.6" />
      <rect x="3.5" y="7.5" width="8" height="0.8" rx="0.3" fill="#3b82f6" fillOpacity="0.4" />
      <rect x="3.5" y="9.5" width="6" height="0.8" rx="0.3" fill="#3b82f6" fillOpacity="0.3" />
      <circle cx="12" cy="12" r="2.5" fill="#22c55e" />
      <path d="M10.8 12L11.5 12.7L13.2 11" stroke="white" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PmStoriesIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1.5" width="10" height="13" rx="1" fill="#0ea5e9" fillOpacity="0.15" />
      <rect x="2.5" y="3" width="7" height="1.2" rx="0.3" fill="#0ea5e9" />
      <rect x="2.5" y="5.5" width="5" height="0.8" rx="0.3" fill="#0ea5e9" fillOpacity="0.5" />
      <rect x="2.5" y="7.5" width="6" height="0.8" rx="0.3" fill="#0ea5e9" fillOpacity="0.4" />
      <rect x="2.5" y="9.5" width="4" height="0.8" rx="0.3" fill="#0ea5e9" fillOpacity="0.3" />
      <rect x="5" y="3.5" width="10" height="11" rx="1" fill="#7c3aed" fillOpacity="0.12" />
      <rect x="6.5" y="5.5" width="7" height="1" rx="0.3" fill="#7c3aed" />
      <rect x="6.5" y="7.5" width="5" height="0.8" rx="0.3" fill="#7c3aed" fillOpacity="0.5" />
      <rect x="6.5" y="9.5" width="6" height="0.8" rx="0.3" fill="#7c3aed" fillOpacity="0.4" />
      <circle cx="12.5" cy="12" r="1.5" fill="#f59e0b" />
      <rect x="11.8" y="11.5" width="1.4" height="0.7" rx="0.2" fill="white" fillOpacity="0.7" />
    </svg>
  );
}

export function SettingsGeneralIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" fill="#1E88C8" fillOpacity="0.12" />
      <circle cx="8" cy="8" r="4" stroke="#1E88C8" strokeWidth="1.3" fill="none" />
      <circle cx="8" cy="8" r="1.5" fill="#1E88C8" />
      <rect x="7.3" y="0.5" width="1.4" height="2.5" rx="0.5" fill="#0ea5e9" />
      <rect x="7.3" y="13" width="1.4" height="2.5" rx="0.5" fill="#0ea5e9" />
      <rect x="0.5" y="7.3" width="2.5" height="1.4" rx="0.5" fill="#3b82f6" />
      <rect x="13" y="7.3" width="2.5" height="1.4" rx="0.5" fill="#3b82f6" />
    </svg>
  );
}

export function SettingsPeopleIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="4.5" r="2.5" fill="#7c3aed" fillOpacity="0.15" />
      <circle cx="6" cy="4.5" r="1.8" fill="#7c3aed" />
      <path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" fill="#7c3aed" fillOpacity="0.2" />
      <path d="M2.5 13c0-1.8 1.5-3 3.5-3s3.5 1.2 3.5 3" stroke="#7c3aed" strokeWidth="1.2" fill="none" />
      <circle cx="11.5" cy="5" r="1.5" fill="#a855f7" />
      <path d="M9 12.5c0-1.5 1.1-2.5 2.5-2.5s2.5 1 2.5 2.5" stroke="#a855f7" strokeWidth="1" fill="none" />
    </svg>
  );
}

export function SettingsFinancialIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="11" rx="1.5" fill="#22c55e" fillOpacity="0.12" />
      <rect x="2" y="5" width="3" height="7.5" rx="0.5" fill="#22c55e" fillOpacity="0.3" />
      <rect x="6" y="7" width="3" height="5.5" rx="0.5" fill="#22c55e" />
      <rect x="10" y="3.5" width="3" height="9" rx="0.5" fill="#16a34a" />
      <path d="M8 1.5v2" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="8" cy="1.2" r="0.6" fill="#22c55e" />
    </svg>
  );
}

export function SettingsScheduleIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" fill="#f59e0b" fillOpacity="0.12" />
      <rect x="1.5" y="2.5" width="13" height="3" rx="1.5" fill="#f59e0b" />
      <rect x="4" y="1" width="1.3" height="2.5" rx="0.5" fill="#d97706" />
      <rect x="10.5" y="1" width="1.3" height="2.5" rx="0.5" fill="#d97706" />
      <rect x="3.5" y="7" width="2" height="2" rx="0.4" fill="#f59e0b" fillOpacity="0.4" />
      <rect x="7" y="7" width="2" height="2" rx="0.4" fill="#f59e0b" />
      <rect x="10.5" y="7" width="2" height="2" rx="0.4" fill="#f59e0b" fillOpacity="0.4" />
      <rect x="3.5" y="10.5" width="2" height="2" rx="0.4" fill="#f59e0b" fillOpacity="0.3" />
      <rect x="7" y="10.5" width="2" height="2" rx="0.4" fill="#f59e0b" fillOpacity="0.3" />
    </svg>
  );
}

export function SettingsStrategyIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#ec4899" fillOpacity="0.1" />
      <circle cx="8" cy="8" r="5.5" stroke="#ec4899" strokeWidth="1" fill="none" />
      <circle cx="8" cy="8" r="3.5" stroke="#ec4899" strokeWidth="1" fill="none" />
      <circle cx="8" cy="8" r="1.5" fill="#ec4899" />
      <path d="M8 1v2.5" stroke="#f472b6" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M13 3l-2 2" stroke="#f472b6" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsRiskIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L14.5 13.5H1.5L8 1z" fill="#ef4444" fillOpacity="0.12" stroke="#ef4444" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="7.2" y="5" width="1.6" height="4.5" rx="0.5" fill="#ef4444" />
      <circle cx="8" cy="11.5" r="0.9" fill="#ef4444" />
    </svg>
  );
}

export function SettingsTagsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 1.5h5.5l7.5 7-5 5-7.5-7.5V1.5z" fill="#6366f1" fillOpacity="0.12" stroke="#6366f1" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="4.5" cy="4.5" r="1.2" fill="#6366f1" />
      <path d="M3.5 3.5h6l5.5 5.5-3.5 3.5-5.5-5.5V3.5z" fill="#818cf8" fillOpacity="0.15" />
    </svg>
  );
}

export function SettingsGearIcon({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" stroke="#1E88C8" strokeWidth="1.3" fill="#1E88C8" fillOpacity="0.15" />
      <circle cx="8" cy="8" r="1.2" fill="#1E88C8" />
      <rect x="7.2" y="0.5" width="1.6" height="2" rx="0.5" fill="#3b82f6" />
      <rect x="7.2" y="13.5" width="1.6" height="2" rx="0.5" fill="#3b82f6" />
      <rect x="0.5" y="7.2" width="2" height="1.6" rx="0.5" fill="#0ea5e9" />
      <rect x="13.5" y="7.2" width="2" height="1.6" rx="0.5" fill="#0ea5e9" />
      <rect x="2.3" y="2.3" width="1.6" height="1.6" rx="0.5" fill="#7c3aed" transform="rotate(45 3.1 3.1)" />
      <rect x="12.1" y="12.1" width="1.6" height="1.6" rx="0.5" fill="#7c3aed" transform="rotate(45 12.9 12.9)" />
      <rect x="12.1" y="2.3" width="1.6" height="1.6" rx="0.5" fill="#22c55e" transform="rotate(45 12.9 3.1)" />
      <rect x="2.3" y="12.1" width="1.6" height="1.6" rx="0.5" fill="#22c55e" transform="rotate(45 3.1 12.9)" />
    </svg>
  );
}
