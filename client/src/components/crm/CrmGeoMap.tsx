import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { geoToMapPercent, resolveAccountGeo, type GeoPin } from "@/lib/crm-geo";

type CrmGeoMapProps = {
  pins: GeoPin[];
  onPinClick?: (pin: GeoPin) => void;
  emptyMessage?: string;
};

/** Equirectangular world map (Wikimedia, public domain). */
const WORLD_MAP_SRC =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/World_map_-_low_resolution.svg/1280px-World_map_-_low_resolution.svg.png";

export function CrmGeoMap({ pins, onPinClick, emptyMessage }: CrmGeoMapProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const resolvedPins = useMemo(
    () =>
      pins.map((pin, index) => {
        const geo = resolveAccountGeo(pin.country, pin.city, pin.state, pin.name, index);
        const pos = geoToMapPercent(geo.lat, geo.lon);
        return { ...pin, ...pos, resolved: geo.resolved };
      }),
    [pins],
  );

  const geocodedCount = resolvedPins.filter((p) => p.resolved).length;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-sky-200/60 dark:border-slate-700 bg-sky-50 dark:bg-slate-900 aspect-[2/1] min-h-[300px] max-h-[520px]">
      <img
        src={WORLD_MAP_SRC}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-90 dark:opacity-75"
        draggable={false}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-sky-100/20 via-transparent to-sky-200/30 dark:from-slate-900/20 dark:to-slate-900/40 pointer-events-none" />

      {resolvedPins.map((pin) => (
        <button
          key={pin.id}
          type="button"
          className="absolute z-10 -translate-x-1/2 -translate-y-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] rounded-full"
          style={{ left: `${pin.left}%`, top: `${pin.top}%` }}
          onMouseEnter={() => setHoveredId(pin.id)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => onPinClick?.(pin)}
          data-testid={`map-pin-${pin.id}`}
          title={pin.name}
        >
          <MapPin
            className="h-6 w-6 drop-shadow-md"
            style={{ color: pin.color }}
            fill={pin.color}
            strokeWidth={1.5}
            stroke="white"
          />
          {hoveredId === pin.id && (
            <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 z-20 w-max max-w-[180px] rounded-lg border bg-card px-2.5 py-2 text-left shadow-lg pointer-events-none">
              <p className="text-xs font-semibold truncate">{pin.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {[pin.city, pin.state, pin.country].filter(Boolean).join(", ") || "Location unknown"}
              </p>
              <p className="text-[10px] text-muted-foreground">{pin.segment}{!pin.resolved ? " · approximate" : ""}</p>
            </div>
          )}
        </button>
      ))}

      {resolvedPins.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground bg-background/40 backdrop-blur-[1px]">
          {emptyMessage ?? "Add country and city to customer accounts to plot them on the map"}
        </div>
      )}

      {resolvedPins.length > 0 && (
        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur-sm border border-border/40">
          <MapPin className="h-3 w-3" />
          {resolvedPins.length} pinned · {geocodedCount} geocoded
        </div>
      )}
    </div>
  );
}
