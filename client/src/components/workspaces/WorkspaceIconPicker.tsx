import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
}

interface WorkspaceIconDef {
  key: string;
  label: string;
  tint: string;
  Icon: (props: IconProps) => JSX.Element;
}

function ChartBarsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="13" width="4" height="8" rx="1" fill="#3b82f6" />
      <rect x="10" y="8" width="4" height="13" rx="1" fill="#22c55e" />
      <rect x="17" y="3" width="4" height="18" rx="1" fill="#f97316" />
    </svg>
  );
}

function PeopleIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="3.5" fill="#8b5cf6" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="#8b5cf6" fillOpacity="0.5" />
      <circle cx="17" cy="8" r="2.5" fill="#a855f7" />
      <path d="M13 20c0-2.8 1.8-5 4-5s4 2.2 4 5" fill="#a855f7" fillOpacity="0.4" />
    </svg>
  );
}

function MegaphoneIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M18 4L8 8H4a1 1 0 00-1 1v3a1 1 0 001 1h4l10 4V4z" fill="#ec4899" />
      <rect x="6" y="13" width="3" height="5" rx="1" fill="#db2777" />
      <circle cx="20" cy="8" r="1.5" fill="#f59e0b" />
      <circle cx="21" cy="12" r="1" fill="#f59e0b" fillOpacity="0.6" />
    </svg>
  );
}

function TargetIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#ef4444" strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="5.5" stroke="#ef4444" strokeWidth="1.5" fill="none" opacity="0.6" />
      <circle cx="12" cy="12" r="2.5" fill="#ef4444" />
    </svg>
  );
}

function LightbulbIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 3a6 6 0 00-3 11.2V16a1 1 0 001 1h4a1 1 0 001-1v-1.8A6 6 0 0012 3z" fill="#f59e0b" />
      <rect x="9" y="18" width="6" height="2" rx="1" fill="#d97706" />
      <line x1="12" y1="8" x2="12" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="10" x2="14" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function RocketIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 3c-1.5 3-2 6-2 9l-3 3h10l-3-3c0-3-.5-6-2-9z" fill="#6366f1" />
      <circle cx="12" cy="10" r="1.5" fill="white" fillOpacity="0.8" />
      <path d="M7 15l-2 4h4l-2-4z" fill="#f97316" />
      <path d="M17 15l2 4h-4l2-4z" fill="#f97316" />
      <path d="M10 19h4l-2 3-2-3z" fill="#ef4444" />
    </svg>
  );
}

function GlobeIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill="#0ea5e9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" stroke="white" strokeWidth="1" fill="none" opacity="0.4" />
      <line x1="3" y1="9" x2="21" y2="9" stroke="white" strokeWidth="0.8" opacity="0.4" />
      <line x1="3" y1="15" x2="21" y2="15" stroke="white" strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
}

function FolderIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M2 7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" fill="#f59e0b" />
      <rect x="5" y="11" width="6" height="1.5" rx="0.75" fill="white" fillOpacity="0.5" />
      <rect x="5" y="14" width="4" height="1.5" rx="0.75" fill="white" fillOpacity="0.35" />
    </svg>
  );
}

function GearIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" fill="#6b7280" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.2.65.76 1.1 1.44 1.13H21a2 2 0 010 4h-.09c-.68.03-1.24.48-1.44 1.13z" stroke="#6b7280" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function PaintIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="12" rx="2" fill="#a855f7" />
      <circle cx="7" cy="9" r="2" fill="#ef4444" />
      <circle cx="12" cy="9" r="2" fill="#22c55e" />
      <circle cx="17" cy="9" r="2" fill="#3b82f6" />
      <rect x="10" y="15" width="4" height="7" rx="1" fill="#d4d4d8" />
    </svg>
  );
}

function HeartIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#ef4444" />
    </svg>
  );
}

function StarIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#f59e0b" />
    </svg>
  );
}

function CodeIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="#1e293b" />
      <path d="M8 10l-3 2 3 2" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 10l3 2-3 2" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="13" y1="8" x2="11" y2="16" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function BookIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h6a2 2 0 012 2v14a1.5 1.5 0 00-1.5-1.5H4V4z" fill="#3b82f6" />
      <path d="M20 4h-6a2 2 0 00-2 2v14a1.5 1.5 0 011.5-1.5H20V4z" fill="#60a5fa" />
      <rect x="6" y="7" width="3" height="1" rx="0.5" fill="white" fillOpacity="0.6" />
      <rect x="6" y="9.5" width="2" height="1" rx="0.5" fill="white" fillOpacity="0.4" />
      <rect x="15" y="7" width="3" height="1" rx="0.5" fill="white" fillOpacity="0.6" />
      <rect x="15" y="9.5" width="2" height="1" rx="0.5" fill="white" fillOpacity="0.4" />
    </svg>
  );
}

function BriefcaseIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="7" width="20" height="13" rx="2" fill="#7c3aed" />
      <rect x="8" y="3" width="8" height="6" rx="1.5" fill="#a855f7" />
      <rect x="5" y="11" width="5" height="4" rx="1" fill="white" fillOpacity="0.25" />
      <rect x="14" y="11" width="5" height="4" rx="1" fill="white" fillOpacity="0.2" />
    </svg>
  );
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" fill="#14b8a6" />
      <rect x="3" y="5" width="18" height="4" rx="2" fill="#0d9488" />
      <rect x="7" y="3" width="2" height="4" rx="1" fill="#0d9488" />
      <rect x="15" y="3" width="2" height="4" rx="1" fill="#0d9488" />
      <rect x="6" y="12" width="3" height="2.5" rx="0.5" fill="white" fillOpacity="0.6" />
      <rect x="10.5" y="12" width="3" height="2.5" rx="0.5" fill="white" fillOpacity="0.4" />
      <rect x="15" y="12" width="3" height="2.5" rx="0.5" fill="white" fillOpacity="0.3" />
      <rect x="6" y="16" width="3" height="2.5" rx="0.5" fill="white" fillOpacity="0.3" />
    </svg>
  );
}

function PuzzleIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h4V4a2 2 0 014 0v3h4a2 2 0 012 2v4h3a2 2 0 010 4h-3v4a2 2 0 01-2 2h-4v-3a2 2 0 00-4 0v3H4a2 2 0 01-2-2v-4h3a2 2 0 000-4H2V9a2 2 0 012-2z" fill="#f97316" />
    </svg>
  );
}

function ShieldIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 6v5c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" fill="#22c55e" />
      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrophyIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M8 4h8v7a4 4 0 01-8 0V4z" fill="#f59e0b" />
      <path d="M8 6H5a1 1 0 00-1 1v1c0 2.2 1.8 4 4 4" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
      <path d="M16 6h3a1 1 0 011 1v1c0 2.2-1.8 4-4 4" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
      <rect x="10" y="14" width="4" height="3" rx="0.5" fill="#d97706" />
      <rect x="8" y="18" width="8" height="2" rx="1" fill="#d97706" />
    </svg>
  );
}

function FlagIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="1.5" height="18" rx="0.75" fill="#6b7280" />
      <path d="M7 4h12l-3 4 3 4H7V4z" fill="#ef4444" />
    </svg>
  );
}

function CompassIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#0ea5e9" strokeWidth="2" fill="none" />
      <polygon points="12,6 14,10 12,14 10,10" fill="#ef4444" fillOpacity="0.8" />
      <polygon points="12,14 14,10 12,18 10,14" fill="#3b82f6" fillOpacity="0.6" transform="rotate(180 12 14)" />
      <circle cx="12" cy="12" r="1.5" fill="white" stroke="#0ea5e9" strokeWidth="1" />
    </svg>
  );
}

function HeadphonesIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 13C4 8.58 7.58 5 12 5s8 3.58 8 8" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <rect x="2" y="12" width="4" height="7" rx="1.5" fill="#8b5cf6" />
      <rect x="18" y="12" width="4" height="7" rx="1.5" fill="#7c3aed" />
    </svg>
  );
}

function CameraIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 3h6l1.5 2H20a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2h3.5L9 3z" fill="#6366f1" />
      <circle cx="12" cy="12" r="4" fill="white" fillOpacity="0.3" />
      <circle cx="12" cy="12" r="2.5" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

function MusicIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 18V6l12-3v12" stroke="#ec4899" strokeWidth="2" fill="none" />
      <circle cx="6" cy="18" r="3" fill="#ec4899" />
      <circle cx="18" cy="15" r="3" fill="#db2777" />
    </svg>
  );
}

function StethoscopeIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M6 12a4 4 0 004 4h0a4 4 0 004-4V4" stroke="#0ea5e9" strokeWidth="2" fill="none" />
      <circle cx="6" cy="4" r="1.5" fill="#0ea5e9" />
      <circle cx="14" cy="4" r="1.5" fill="#0ea5e9" />
      <circle cx="18" cy="16" r="3" fill="#14b8a6" />
      <circle cx="18" cy="16" r="1.2" fill="white" fillOpacity="0.6" />
      <path d="M18 13V12a4 4 0 00-4-4" stroke="#14b8a6" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function CoinsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <ellipse cx="10" cy="10" rx="7" ry="3" fill="#f59e0b" />
      <path d="M3 10v4c0 1.66 3.13 3 7 3s7-1.34 7-3v-4" stroke="#d97706" strokeWidth="1.5" fill="none" />
      <ellipse cx="14" cy="14" rx="7" ry="3" fill="#fbbf24" fillOpacity="0.7" />
      <path d="M7 14v4c0 1.66 3.13 3 7 3s7-1.34 7-3v-4" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function ShoppingBagIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M5 8h14l-1.5 12H6.5L5 8z" fill="#ec4899" />
      <path d="M8 8V6a4 4 0 018 0v2" stroke="#db2777" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="9" y="12" width="6" height="1.5" rx="0.75" fill="white" fillOpacity="0.4" />
    </svg>
  );
}

function HammerIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="10" y="11" width="3" height="10" rx="1" fill="#92400e" transform="rotate(-30 12 16)" />
      <rect x="5" y="3" width="14" height="6" rx="2" fill="#6b7280" transform="rotate(-30 12 6)" />
      <rect x="7" y="4" width="4" height="4" rx="1" fill="#9ca3af" fillOpacity="0.5" />
    </svg>
  );
}

function GraduationCapIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <polygon points="12,3 2,9 12,15 22,9" fill="#1e293b" />
      <polygon points="12,3 2,9 12,15 22,9" fill="#334155" fillOpacity="0.5" />
      <path d="M6 11v5c0 2 3 4 6 4s6-2 6-4v-5" fill="#475569" fillOpacity="0.4" />
      <line x1="20" y1="9" x2="20" y2="17" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="20" cy="17.5" r="1.5" fill="#f59e0b" />
    </svg>
  );
}

function FlaskIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 3h6v6l4 10a1 1 0 01-1 1H6a1 1 0 01-1-1l4-10V3z" fill="#8b5cf6" fillOpacity="0.3" stroke="#8b5cf6" strokeWidth="1.5" />
      <rect x="8" y="14" width="8" height="5" rx="0.5" fill="#a855f7" fillOpacity="0.6" />
      <circle cx="11" cy="16" r="1" fill="#c084fc" />
      <circle cx="14" cy="15" r="0.7" fill="#e9d5ff" />
      <rect x="9" y="2" width="6" height="1.5" rx="0.5" fill="#7c3aed" />
    </svg>
  );
}

function ScalesIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <line x1="12" y1="3" x2="12" y2="19" stroke="#6b7280" strokeWidth="2" />
      <rect x="8" y="19" width="8" height="2" rx="1" fill="#6b7280" />
      <line x1="4" y1="7" x2="20" y2="7" stroke="#6b7280" strokeWidth="1.5" />
      <path d="M2 13l2-6 2 6a2 2 0 01-4 0z" fill="#3b82f6" />
      <path d="M18 11l2-4 2 4a2 2 0 01-4 0z" fill="#ef4444" />
    </svg>
  );
}

function FilmIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="#1e293b" />
      <rect x="2" y="4" width="4" height="16" fill="#334155" />
      <rect x="18" y="4" width="4" height="16" fill="#334155" />
      <rect x="3" y="6" width="2" height="2" rx="0.5" fill="#f59e0b" fillOpacity="0.6" />
      <rect x="3" y="10" width="2" height="2" rx="0.5" fill="#f59e0b" fillOpacity="0.6" />
      <rect x="3" y="14" width="2" height="2" rx="0.5" fill="#f59e0b" fillOpacity="0.6" />
      <rect x="19" y="6" width="2" height="2" rx="0.5" fill="#f59e0b" fillOpacity="0.6" />
      <rect x="19" y="10" width="2" height="2" rx="0.5" fill="#f59e0b" fillOpacity="0.6" />
      <rect x="19" y="14" width="2" height="2" rx="0.5" fill="#f59e0b" fillOpacity="0.6" />
      <polygon points="10,8 16,12 10,16" fill="white" fillOpacity="0.5" />
    </svg>
  );
}

function TruckIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="1" y="8" width="14" height="8" rx="1" fill="#3b82f6" />
      <path d="M15 10h4l3 4v2h-7v-6z" fill="#60a5fa" />
      <circle cx="6" cy="18" r="2" fill="#1e293b" />
      <circle cx="6" cy="18" r="0.8" fill="#6b7280" />
      <circle cx="19" cy="18" r="2" fill="#1e293b" />
      <circle cx="19" cy="18" r="0.8" fill="#6b7280" />
    </svg>
  );
}

function LeafIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M6 21c0-7 4-14 14-14-2 8-6 12-14 14z" fill="#22c55e" />
      <path d="M6 21c0-7 4-14 14-14" stroke="#16a34a" strokeWidth="1.5" fill="none" />
      <path d="M10 16c2-3 5-6 10-7" stroke="#86efac" strokeWidth="1" fill="none" opacity="0.6" />
    </svg>
  );
}

function WrenchIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.77 3.77z" fill="#6b7280" />
      <circle cx="8.5" cy="8.5" r="3" fill="#9ca3af" fillOpacity="0.4" />
    </svg>
  );
}

function MagnifyingGlassIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="#6366f1" strokeWidth="2.5" fill="none" />
      <circle cx="11" cy="11" r="4" fill="#6366f1" fillOpacity="0.15" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function RefreshIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M21 4v5h-5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M3 20v-5h5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M5.64 9A8 8 0 0118.36 7l2.64 2" stroke="#22c55e" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M18.36 15A8 8 0 015.64 17l-2.64-2" stroke="#16a34a" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function CloudUploadIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M6.5 19A5.5 5.5 0 015 8.5 7 7 0 0119 9a4.5 4.5 0 01-.5 9H6.5z" fill="#0ea5e9" fillOpacity="0.3" stroke="#0ea5e9" strokeWidth="1.5" />
      <path d="M12 13v6" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 15l3-3 3 3" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareNetworkIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="18" cy="5" r="3" fill="#8b5cf6" />
      <circle cx="6" cy="12" r="3" fill="#3b82f6" />
      <circle cx="18" cy="19" r="3" fill="#ec4899" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="#6b7280" strokeWidth="1.5" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="#6b7280" strokeWidth="1.5" />
    </svg>
  );
}

function HandshakeIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M2 11l4-4 4 2 3-3 3 1 4-3 2 2-5 5-3-1-3 3-4-2-3 3-2-3z" fill="#f97316" fillOpacity="0.6" />
      <path d="M12 16l-3 3a2 2 0 01-2.83 0l-.17-.17" stroke="#f97316" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M12 16l3 3a2 2 0 002.83 0l.17-.17" stroke="#d97706" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M2 11l2-2" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 11l-2-2" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TimelineIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <line x1="3" y1="12" x2="21" y2="12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
      <circle cx="5" cy="12" r="2.5" fill="#3b82f6" />
      <circle cx="12" cy="12" r="2.5" fill="#22c55e" />
      <circle cx="19" cy="12" r="2.5" fill="#f59e0b" />
      <line x1="5" y1="9" x2="5" y2="6" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="15" x2="12" y2="18" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="19" y1="9" x2="19" y2="6" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DashboardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="#3b82f6" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" fill="#22c55e" />
      <rect x="3" y="13" width="8" height="5" rx="1.5" fill="#f59e0b" />
      <rect x="13" y="10" width="8" height="8" rx="1.5" fill="#8b5cf6" fillOpacity="0.7" />
      <rect x="3" y="20" width="18" height="2" rx="1" fill="#6b7280" fillOpacity="0.3" />
    </svg>
  );
}

function PipelineIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="5" height="16" rx="1" fill="#3b82f6" />
      <rect x="9.5" y="6" width="5" height="14" rx="1" fill="#8b5cf6" fillOpacity="0.8" />
      <rect x="17" y="8" width="5" height="12" rx="1" fill="#ec4899" fillOpacity="0.7" />
      <path d="M7 10h2.5" stroke="#6b7280" strokeWidth="1" strokeDasharray="2 1" />
      <path d="M14.5 12h2.5" stroke="#6b7280" strokeWidth="1" strokeDasharray="2 1" />
    </svg>
  );
}

function KanbanBoardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="6" height="18" rx="1" fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="1" />
      <rect x="9" y="3" width="6" height="18" rx="1" fill="#f59e0b" fillOpacity="0.2" stroke="#f59e0b" strokeWidth="1" />
      <rect x="16" y="3" width="6" height="18" rx="1" fill="#22c55e" fillOpacity="0.2" stroke="#22c55e" strokeWidth="1" />
      <rect x="3" y="5" width="4" height="3" rx="0.5" fill="#3b82f6" />
      <rect x="3" y="9.5" width="4" height="3" rx="0.5" fill="#3b82f6" fillOpacity="0.6" />
      <rect x="10" y="5" width="4" height="3" rx="0.5" fill="#f59e0b" />
      <rect x="17" y="5" width="4" height="3" rx="0.5" fill="#22c55e" />
      <rect x="17" y="9.5" width="4" height="3" rx="0.5" fill="#22c55e" fillOpacity="0.6" />
    </svg>
  );
}

function InboxIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" fill="#6366f1" fillOpacity="0.2" stroke="#6366f1" strokeWidth="1.5" />
      <path d="M2 14h5l2 3h6l2-3h5" stroke="#6366f1" strokeWidth="1.5" fill="none" />
      <path d="M9 9h6" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 6h4" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function ChecklistIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#14b8a6" fillOpacity="0.15" stroke="#14b8a6" strokeWidth="1.5" />
      <path d="M7 8l1.5 1.5L11 7" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="13" y1="8.5" x2="18" y2="8.5" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 13l1.5 1.5L11 12" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="13" y1="13.5" x2="18" y2="13.5" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="7" y="17" width="3" height="2" rx="0.5" fill="#6b7280" fillOpacity="0.3" />
      <line x1="13" y1="18" x2="18" y2="18" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

function ClipboardCheckIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="14" height="18" rx="2" fill="#7c3aed" fillOpacity="0.2" stroke="#7c3aed" strokeWidth="1.5" />
      <rect x="8" y="1.5" width="8" height="3" rx="1" fill="#7c3aed" />
      <path d="M9 12l2 2 4-4" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ServerIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="6" rx="1.5" fill="#1e293b" />
      <circle cx="7" cy="6" r="1" fill="#22c55e" />
      <circle cx="10" cy="6" r="1" fill="#f59e0b" />
      <rect x="14" y="5" width="4" height="2" rx="0.5" fill="#475569" />
      <rect x="3" y="11" width="18" height="6" rx="1.5" fill="#334155" />
      <circle cx="7" cy="14" r="1" fill="#22c55e" />
      <circle cx="10" cy="14" r="1" fill="#3b82f6" />
      <rect x="14" y="13" width="4" height="2" rx="0.5" fill="#475569" />
      <rect x="3" y="19" width="18" height="2" rx="1" fill="#6b7280" fillOpacity="0.3" />
    </svg>
  );
}

function MapPinIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ef4444" />
      <circle cx="12" cy="9" r="3" fill="white" fillOpacity="0.8" />
      <circle cx="12" cy="9" r="1.2" fill="#ef4444" fillOpacity="0.6" />
    </svg>
  );
}

function BellIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" fill="#f59e0b" />
      <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="18" cy="5" r="2.5" fill="#ef4444" />
    </svg>
  );
}

function LightningIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <polygon points="13,2 4,14 12,14 11,22 20,10 12,10" fill="#f59e0b" />
      <polygon points="13,2 4,14 12,14 11,22 20,10 12,10" fill="white" fillOpacity="0.2" />
      <path d="M13 2L4 14h8l-1 8 9-12h-8l1-8z" stroke="#d97706" strokeWidth="0.5" fill="none" />
    </svg>
  );
}

function DownloadIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 4v12" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 12l4 4 4-4" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DatabaseIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="6" rx="8" ry="3" fill="#8b5cf6" />
      <path d="M4 6v4c0 1.66 3.58 3 8 3s8-1.34 8-3V6" stroke="#7c3aed" strokeWidth="1.5" fill="none" />
      <path d="M4 10v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4" stroke="#7c3aed" strokeWidth="1.5" fill="none" />
      <path d="M4 14v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4" stroke="#7c3aed" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export const WORKSPACE_ICONS: WorkspaceIconDef[] = [
  { key: "chart-bars", label: "Chart Bars", tint: "#3b82f6", Icon: ChartBarsIcon },
  { key: "people", label: "People", tint: "#8b5cf6", Icon: PeopleIcon },
  { key: "megaphone", label: "Megaphone", tint: "#ec4899", Icon: MegaphoneIcon },
  { key: "target", label: "Target", tint: "#ef4444", Icon: TargetIcon },
  { key: "lightbulb", label: "Lightbulb", tint: "#f59e0b", Icon: LightbulbIcon },
  { key: "rocket", label: "Rocket", tint: "#6366f1", Icon: RocketIcon },
  { key: "globe", label: "Globe", tint: "#0ea5e9", Icon: GlobeIcon },
  { key: "folder", label: "Folder", tint: "#f59e0b", Icon: FolderIcon },
  { key: "gear", label: "Gear", tint: "#6b7280", Icon: GearIcon },
  { key: "paint", label: "Paint", tint: "#a855f7", Icon: PaintIcon },
  { key: "heart", label: "Heart", tint: "#ef4444", Icon: HeartIcon },
  { key: "star", label: "Star", tint: "#f59e0b", Icon: StarIcon },
  { key: "code", label: "Code", tint: "#1e293b", Icon: CodeIcon },
  { key: "book", label: "Book", tint: "#3b82f6", Icon: BookIcon },
  { key: "briefcase", label: "Briefcase", tint: "#7c3aed", Icon: BriefcaseIcon },
  { key: "calendar", label: "Calendar", tint: "#14b8a6", Icon: CalendarIcon },
  { key: "puzzle", label: "Puzzle", tint: "#f97316", Icon: PuzzleIcon },
  { key: "shield", label: "Shield", tint: "#22c55e", Icon: ShieldIcon },
  { key: "trophy", label: "Trophy", tint: "#f59e0b", Icon: TrophyIcon },
  { key: "flag", label: "Flag", tint: "#ef4444", Icon: FlagIcon },
  { key: "compass", label: "Compass", tint: "#0ea5e9", Icon: CompassIcon },
  { key: "headphones", label: "Headphones", tint: "#8b5cf6", Icon: HeadphonesIcon },
  { key: "camera", label: "Camera", tint: "#6366f1", Icon: CameraIcon },
  { key: "music", label: "Music", tint: "#ec4899", Icon: MusicIcon },
  { key: "stethoscope", label: "Stethoscope", tint: "#0ea5e9", Icon: StethoscopeIcon },
  { key: "coins", label: "Coins", tint: "#f59e0b", Icon: CoinsIcon },
  { key: "shopping-bag", label: "Shopping Bag", tint: "#ec4899", Icon: ShoppingBagIcon },
  { key: "hammer", label: "Hammer", tint: "#6b7280", Icon: HammerIcon },
  { key: "graduation-cap", label: "Graduation Cap", tint: "#1e293b", Icon: GraduationCapIcon },
  { key: "flask", label: "Flask", tint: "#8b5cf6", Icon: FlaskIcon },
  { key: "scales", label: "Scales", tint: "#3b82f6", Icon: ScalesIcon },
  { key: "film", label: "Film", tint: "#1e293b", Icon: FilmIcon },
  { key: "truck", label: "Truck", tint: "#3b82f6", Icon: TruckIcon },
  { key: "leaf", label: "Leaf", tint: "#22c55e", Icon: LeafIcon },
  { key: "wrench", label: "Wrench", tint: "#6b7280", Icon: WrenchIcon },
  { key: "magnifying-glass", label: "Magnifying Glass", tint: "#6366f1", Icon: MagnifyingGlassIcon },
  { key: "link", label: "Link", tint: "#3b82f6", Icon: LinkIcon },
  { key: "refresh", label: "Refresh", tint: "#22c55e", Icon: RefreshIcon },
  { key: "cloud-upload", label: "Cloud Upload", tint: "#0ea5e9", Icon: CloudUploadIcon },
  { key: "share-network", label: "Share Network", tint: "#8b5cf6", Icon: ShareNetworkIcon },
  { key: "handshake", label: "Handshake", tint: "#f97316", Icon: HandshakeIcon },
  { key: "timeline", label: "Timeline", tint: "#3b82f6", Icon: TimelineIcon },
  { key: "dashboard", label: "Dashboard", tint: "#3b82f6", Icon: DashboardIcon },
  { key: "pipeline", label: "Pipeline", tint: "#8b5cf6", Icon: PipelineIcon },
  { key: "kanban-board", label: "Kanban Board", tint: "#f59e0b", Icon: KanbanBoardIcon },
  { key: "inbox", label: "Inbox", tint: "#6366f1", Icon: InboxIcon },
  { key: "checklist", label: "Checklist", tint: "#14b8a6", Icon: ChecklistIcon },
  { key: "clipboard-check", label: "Clipboard Check", tint: "#7c3aed", Icon: ClipboardCheckIcon },
  { key: "server", label: "Server", tint: "#1e293b", Icon: ServerIcon },
  { key: "map-pin", label: "Map Pin", tint: "#ef4444", Icon: MapPinIcon },
  { key: "bell", label: "Bell", tint: "#f59e0b", Icon: BellIcon },
  { key: "lightning", label: "Lightning", tint: "#f59e0b", Icon: LightningIcon },
  { key: "download", label: "Download", tint: "#3b82f6", Icon: DownloadIcon },
  { key: "database-icon", label: "Database", tint: "#8b5cf6", Icon: DatabaseIcon },
];

export function getWorkspaceIconDef(key: string | null | undefined): WorkspaceIconDef | null {
  if (!key) return null;
  return WORKSPACE_ICONS.find((i) => i.key === key) || null;
}

export function WorkspaceIconRenderer({
  iconKey,
  size = 40,
  fallbackLetter,
  fallbackColor,
}: {
  iconKey: string | null | undefined;
  size?: number;
  fallbackLetter?: string;
  fallbackColor?: string;
}) {
  const def = getWorkspaceIconDef(iconKey);

  if (def) {
    const bgColor = def.tint + "1A";
    const svgSize = Math.round(size * 0.55);
    return (
      <div
        className="rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          width: size,
          height: size,
          backgroundColor: bgColor,
        }}
        data-testid="workspace-icon"
      >
        <def.Icon className={`w-[${svgSize}px] h-[${svgSize}px]`} />
      </div>
    );
  }

  return (
    <div
      className="rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: fallbackColor || "#7C3AED",
        fontSize: Math.round(size * 0.45),
      }}
      data-testid="workspace-icon-fallback"
    >
      {fallbackLetter || "W"}
    </div>
  );
}

export function WorkspaceIconPicker({
  selectedIcon,
  onSelect,
}: {
  selectedIcon: string | null | undefined;
  onSelect: (key: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const def = getWorkspaceIconDef(selectedIcon);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-lg hover-elevate flex items-center justify-center p-1"
          data-testid="workspace-icon-picker-trigger"
        >
          {def ? (
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: def.tint + "1A" }}
            >
              <def.Icon />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/30 text-muted-foreground text-xs">
              Icon
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start" data-testid="workspace-icon-picker-popover">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Choose an icon</span>
          {selectedIcon && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { onSelect(null); setOpen(false); }}
              data-testid="workspace-icon-remove"
            >
              Remove
            </button>
          )}
        </div>
        <div className="grid grid-cols-8 gap-1.5 max-h-[320px] overflow-y-auto" data-testid="workspace-icon-grid">
          {WORKSPACE_ICONS.map((icon) => (
            <button
              key={icon.key}
              type="button"
              onClick={() => { onSelect(icon.key); setOpen(false); }}
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center hover-elevate transition-colors",
                selectedIcon === icon.key && "ring-2 ring-primary"
              )}
              style={{ backgroundColor: icon.tint + "1A" }}
              title={icon.label}
              data-testid={`workspace-icon-option-${icon.key}`}
            >
              <icon.Icon />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
