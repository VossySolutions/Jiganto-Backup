import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { geoToSvgCoord, resolveAccountGeo, type GeoPin } from "@/lib/crm-geo";

type CrmGeoMapProps = {
  pins: GeoPin[];
  onPinClick?: (pin: GeoPin) => void;
  emptyMessage?: string;
};

/** Simplified equirectangular landmass outlines (viewBox 0 0 1000 500). */
function WorldLandmasses() {
  return (
    <g className="fill-emerald-300/85 dark:fill-emerald-800/55 stroke-emerald-700/45 dark:stroke-emerald-600/50" strokeWidth="1.2">
      <path d="M120,95 L210,72 L280,88 L320,115 L340,150 L310,185 L260,210 L210,225 L170,215 L130,190 L95,155 Z" />
      <path d="M175,235 L230,218 L270,240 L285,290 L260,340 L220,385 L185,420 L150,400 L130,350 L140,280 Z" />
      <path d="M430,88 L520,72 L590,78 L640,95 L670,120 L660,145 L620,165 L560,175 L500,168 L450,150 L420,120 Z" />
      <path d="M455,175 L520,168 L575,178 L610,205 L625,245 L615,295 L590,340 L545,375 L495,395 L450,385 L420,350 L410,300 L425,230 Z" />
      <path d="M455,395 L500,385 L545,395 L575,420 L560,455 L520,475 L475,470 L445,440 Z" />
      <path d="M640,95 L760,82 L860,95 L930,120 L960,155 L950,195 L920,230 L870,255 L810,265 L740,250 L680,220 L640,175 L625,130 Z" />
      <path d="M700,265 L780,255 L850,270 L890,305 L905,355 L880,400 L830,430 L770,440 L710,425 L670,385 L660,330 L675,290 Z" />
      <path d="M820,430 L880,420 L920,445 L905,475 L860,490 L815,480 Z" />
    </g>
  );
}

export function CrmGeoMap({ pins, onPinClick, emptyMessage }: CrmGeoMapProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const resolvedPins = useMemo(
    () =>
      pins.map((pin, index) => {
        const geo = resolveAccountGeo(pin.country, pin.city, pin.state, pin.name, index);
        const coord = geo.resolved
          ? geoToSvgCoord(geo.lat, geo.lon)
          : { x: (geo.left / 100) * 1000, y: (geo.top / 100) * 500 };
        return { ...pin, ...coord, resolved: geo.resolved };
      }),
    [pins],
  );

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-sky-200/60 dark:border-slate-700 bg-gradient-to-b from-sky-200/90 via-sky-100/80 to-emerald-100/70 dark:from-slate-900 dark:via-slate-850 dark:to-slate-800 aspect-[2/1] min-h-[280px] max-h-[480px]">
      <svg
        viewBox="0 0 1000 500"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <rect width="1000" height="500" className="fill-sky-200/70 dark:fill-slate-900/90" />
        <defs>
          <pattern id="crm-map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" className="stroke-sky-300/30 dark:stroke-slate-700/40" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="1000" height="500" fill="url(#crm-map-grid)" />
        <ellipse cx="500" cy="250" rx="490" ry="235" fill="none" className="stroke-sky-400/25 dark:stroke-slate-600/40" strokeWidth="1" />
        <WorldLandmasses />
        {resolvedPins.map((pin) => (
          <g
            key={pin.id}
            transform={`translate(${pin.x}, ${pin.y})`}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredId(pin.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onPinClick?.(pin)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onPinClick?.(pin);
            }}
            data-testid={`map-pin-${pin.id}`}
          >
            <circle r={hoveredId === pin.id ? 10 : 7} fill={pin.color} opacity="0.25" />
            <path
              d="M0,-14 C-5,-14 -8,-10 -8,-6 C-8,0 0,8 0,8 C0,8 8,0 8,-6 C8,-10 5,-14 0,-14 Z"
              fill={pin.color}
              className="drop-shadow-sm transition-transform"
              style={{ transform: hoveredId === pin.id ? "scale(1.15)" : undefined, transformOrigin: "0px 0px" }}
            />
            {hoveredId === pin.id && (
              <g transform="translate(0, 14)">
                <rect x="-72" y="4" width="144" height="52" rx="6" className="fill-card stroke-border" strokeWidth="1" />
                <text y="20" textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
                  {pin.name.length > 18 ? `${pin.name.slice(0, 16)}…` : pin.name}
                </text>
                <text y="36" textAnchor="middle" className="fill-muted-foreground text-[9px]">
                  {[pin.city, pin.state, pin.country].filter(Boolean).join(", ").slice(0, 32)}
                </text>
                <text y="48" textAnchor="middle" className="fill-muted-foreground text-[8px]">
                  {pin.segment}{!pin.resolved ? " · approximate" : ""}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>

      {resolvedPins.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {emptyMessage ?? "Add country and city to customer accounts to plot them on the map"}
        </div>
      )}

      {resolvedPins.length > 0 && (
        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur-sm">
          <MapPin className="h-3 w-3" />
          {resolvedPins.length} locations
        </div>
      )}
    </div>
  );
}
