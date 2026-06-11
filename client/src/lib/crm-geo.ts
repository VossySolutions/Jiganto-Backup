type GeoCoord = { lat: number; lon: number };

const COUNTRY_COORDS: Record<string, GeoCoord> = {
  "united states": { lat: 39.8, lon: -98.5 },
  usa: { lat: 39.8, lon: -98.5 },
  us: { lat: 39.8, lon: -98.5 },
  "united kingdom": { lat: 55.4, lon: -3.4 },
  uk: { lat: 55.4, lon: -3.4 },
  canada: { lat: 56.1, lon: -106.3 },
  australia: { lat: -25.3, lon: 133.8 },
  germany: { lat: 51.2, lon: 10.5 },
  france: { lat: 46.2, lon: 2.2 },
  india: { lat: 20.6, lon: 78.9 },
  china: { lat: 35.9, lon: 104.2 },
  japan: { lat: 36.2, lon: 138.3 },
  brazil: { lat: -14.2, lon: -51.9 },
  mexico: { lat: 23.6, lon: -102.5 },
  spain: { lat: 40.5, lon: -3.7 },
  italy: { lat: 41.9, lon: 12.6 },
  netherlands: { lat: 52.1, lon: 5.3 },
  sweden: { lat: 60.1, lon: 18.6 },
  norway: { lat: 60.5, lon: 8.5 },
  switzerland: { lat: 46.8, lon: 8.2 },
  singapore: { lat: 1.35, lon: 103.8 },
  "south africa": { lat: -30.6, lon: 22.9 },
  "south korea": { lat: 35.9, lon: 127.8 },
  ireland: { lat: 53.4, lon: -8.2 },
  "new zealand": { lat: -40.9, lon: 174.9 },
  uae: { lat: 23.4, lon: 53.8 },
  "united arab emirates": { lat: 23.4, lon: 53.8 },
  israel: { lat: 31.0, lon: 34.9 },
  poland: { lat: 51.9, lon: 19.1 },
  belgium: { lat: 50.5, lon: 4.5 },
  austria: { lat: 47.5, lon: 14.5 },
  denmark: { lat: 56.3, lon: 9.5 },
  finland: { lat: 61.9, lon: 25.7 },
  portugal: { lat: 39.4, lon: -8.2 },
  argentina: { lat: -38.4, lon: -63.6 },
  chile: { lat: -35.7, lon: -71.5 },
  colombia: { lat: 4.6, lon: -74.1 },
  nigeria: { lat: 9.1, lon: 8.7 },
  egypt: { lat: 26.8, lon: 30.8 },
  kenya: { lat: -0.02, lon: 37.9 },
  indonesia: { lat: -0.8, lon: 113.9 },
  malaysia: { lat: 4.2, lon: 101.9 },
  thailand: { lat: 15.9, lon: 100.9 },
  vietnam: { lat: 14.1, lon: 108.3 },
  philippines: { lat: 12.9, lon: 121.8 },
  taiwan: { lat: 23.7, lon: 121.0 },
  "hong kong": { lat: 22.3, lon: 114.2 },
  russia: { lat: 61.5, lon: 105.3 },
  turkey: { lat: 38.9, lon: 35.2 },
  "saudi arabia": { lat: 23.9, lon: 45.1 },
};

const CITY_COORDS: Record<string, GeoCoord> = {
  "new york": { lat: 40.7, lon: -74.0 },
  "san francisco": { lat: 37.8, lon: -122.4 },
  "los angeles": { lat: 34.1, lon: -118.2 },
  chicago: { lat: 41.9, lon: -87.6 },
  houston: { lat: 29.8, lon: -95.4 },
  seattle: { lat: 47.6, lon: -122.3 },
  boston: { lat: 42.4, lon: -71.1 },
  atlanta: { lat: 33.7, lon: -84.4 },
  dallas: { lat: 32.8, lon: -96.8 },
  miami: { lat: 25.8, lon: -80.2 },
  london: { lat: 51.5, lon: -0.1 },
  manchester: { lat: 53.5, lon: -2.2 },
  paris: { lat: 48.9, lon: 2.4 },
  berlin: { lat: 52.5, lon: 13.4 },
  munich: { lat: 48.1, lon: 11.6 },
  amsterdam: { lat: 52.4, lon: 4.9 },
  dublin: { lat: 53.3, lon: -6.3 },
  sydney: { lat: -33.9, lon: 151.2 },
  melbourne: { lat: -37.8, lon: 145.0 },
  toronto: { lat: 43.7, lon: -79.4 },
  vancouver: { lat: 49.3, lon: -123.1 },
  mumbai: { lat: 19.1, lon: 72.9 },
  delhi: { lat: 28.6, lon: 77.2 },
  bangalore: { lat: 12.9, lon: 77.6 },
  tokyo: { lat: 35.7, lon: 139.7 },
  singapore: { lat: 1.35, lon: 103.8 },
  "hong kong": { lat: 22.3, lon: 114.2 },
  dubai: { lat: 25.2, lon: 55.3 },
  "são paulo": { lat: -23.5, lon: -46.6 },
  "sao paulo": { lat: -23.5, lon: -46.6 },
  "mexico city": { lat: 19.4, lon: -99.1 },
  madrid: { lat: 40.4, lon: -3.7 },
  rome: { lat: 41.9, lon: 12.5 },
  zurich: { lat: 47.4, lon: 8.5 },
  stockholm: { lat: 59.3, lon: 18.1 },
  oslo: { lat: 59.9, lon: 10.8 },
  copenhagen: { lat: 55.7, lon: 12.6 },
  brussels: { lat: 50.8, lon: 4.4 },
  warsaw: { lat: 52.2, lon: 21.0 },
  johannesburg: { lat: -26.2, lon: 28.0 },
  lagos: { lat: 6.5, lon: 3.4 },
  cairo: { lat: 30.0, lon: 31.2 },
  nairobi: { lat: -1.3, lon: 36.8 },
  austin: { lat: 30.3, lon: -97.7 },
  denver: { lat: 39.7, lon: -104.9 },
  phoenix: { lat: 33.4, lon: -112.1 },
  portland: { lat: 45.5, lon: -122.7 },
  "washington dc": { lat: 38.9, lon: -77.0 },
  philadelphia: { lat: 39.9, lon: -75.2 },
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function geoToMapPercent(lat: number, lon: number): { left: number; top: number } {
  const left = ((lon + 180) / 360) * 100;
  const top = ((90 - lat) / 180) * 100;
  return { left: clamp(left, 3, 97), top: clamp(top, 8, 92) };
}

export function resolveAccountGeo(
  country: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
  name: string,
  index: number,
): { left: number; top: number; resolved: boolean } {
  if (city) {
    const cityKey = normalizeKey(city);
    const cityCoord = CITY_COORDS[cityKey];
    if (cityCoord) {
      const pos = geoToMapPercent(cityCoord.lat, cityCoord.lon);
      return { ...pos, resolved: true };
    }
  }

  if (state) {
    const stateKey = normalizeKey(state);
    const stateCoord = CITY_COORDS[stateKey];
    if (stateCoord) {
      const pos = geoToMapPercent(stateCoord.lat, stateCoord.lon);
      return { ...pos, resolved: true };
    }
  }

  if (country) {
    const countryKey = normalizeKey(country);
    const countryCoord = COUNTRY_COORDS[countryKey];
    if (countryCoord) {
      const jitterLon = ((name.charCodeAt(0) + index * 7) % 20) - 10;
      const jitterLat = ((name.charCodeAt(1) || 0) + index * 5) % 14 - 7;
      const pos = geoToMapPercent(
        countryCoord.lat + jitterLat * 0.15,
        countryCoord.lon + jitterLon * 0.2,
      );
      return { ...pos, resolved: true };
    }
  }

  const left = 10 + ((name.charCodeAt(0) * 17 + index * 23) % 75);
  const top = 15 + (((name.charCodeAt(1) || 0) * 13 + index * 19) % 65);
  return { left, top, resolved: false };
}
