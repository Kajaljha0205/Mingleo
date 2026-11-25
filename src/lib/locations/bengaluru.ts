// Pilot area list (no maps provider in V1). Centroids are approximate; only these are ever stored.
export type Area = { slug: string; name: string; lat: number; lng: number };

export const CITY = "Bengaluru";

export const AREAS: Area[] = [
  { slug: "basavanagudi", name: "Basavanagudi", lat: 12.9416, lng: 77.5755 },
  { slug: "banashankari", name: "Banashankari", lat: 12.9255, lng: 77.5468 },
  { slug: "bellandur", name: "Bellandur", lat: 12.9304, lng: 77.6784 },
  { slug: "btm-layout", name: "BTM Layout", lat: 12.9166, lng: 77.6101 },
  { slug: "electronic-city", name: "Electronic City", lat: 12.8452, lng: 77.6602 },
  { slug: "frazer-town", name: "Frazer Town", lat: 12.9986, lng: 77.6146 },
  { slug: "hebbal", name: "Hebbal", lat: 13.0358, lng: 77.597 },
  { slug: "hsr-layout", name: "HSR Layout", lat: 12.9116, lng: 77.6474 },
  { slug: "indiranagar", name: "Indiranagar", lat: 12.9784, lng: 77.6408 },
  { slug: "jayanagar", name: "Jayanagar", lat: 12.925, lng: 77.5938 },
  { slug: "jp-nagar", name: "JP Nagar", lat: 12.9063, lng: 77.5857 },
  { slug: "kalyan-nagar", name: "Kalyan Nagar", lat: 13.0221, lng: 77.6403 },
  { slug: "koramangala", name: "Koramangala", lat: 12.9352, lng: 77.6245 },
  { slug: "malleshwaram", name: "Malleshwaram", lat: 13.0035, lng: 77.5709 },
  { slug: "marathahalli", name: "Marathahalli", lat: 12.9569, lng: 77.7011 },
  { slug: "mg-road", name: "MG Road", lat: 12.9756, lng: 77.6066 },
  { slug: "rajajinagar", name: "Rajajinagar", lat: 12.9915, lng: 77.5543 },
  { slug: "rt-nagar", name: "RT Nagar", lat: 13.0213, lng: 77.5953 },
  { slug: "sadashivanagar", name: "Sadashivanagar", lat: 13.0068, lng: 77.5813 },
  { slug: "sarjapur-road", name: "Sarjapur Road", lat: 12.9105, lng: 77.6857 },
  { slug: "ulsoor", name: "Ulsoor", lat: 12.9817, lng: 77.6286 },
  { slug: "whitefield", name: "Whitefield", lat: 12.9698, lng: 77.75 },
  { slug: "yelahanka", name: "Yelahanka", lat: 13.1007, lng: 77.5963 },
  { slug: "yeshwanthpur", name: "Yeshwanthpur", lat: 13.028, lng: 77.5409 },
];

export const RADIUS_OPTIONS = [2, 5, 10, 25] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS)[number];
export const DEFAULT_RADIUS: RadiusKm = 5;

/** Furthest a "current location" may be from an area centroid to snap to it. */
export const SNAP_LIMIT_KM = 15;

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function nearestArea(lat: number, lng: number): Area | null {
  let best: Area | null = null;
  let bestKm = Infinity;
  for (const a of AREAS) {
    const km = distanceKm(lat, lng, a.lat, a.lng);
    if (km < bestKm) [best, bestKm] = [a, km];
  }
  return bestKm <= SNAP_LIMIT_KM ? best : null;
}

export function findArea(slug: string): Area | undefined {
  return AREAS.find((a) => a.slug === slug);
}

export function searchAreas(query: string): Area[] {
  const q = query.trim().toLowerCase();
  return q ? AREAS.filter((a) => a.name.toLowerCase().includes(q)) : AREAS;
}

export function isRadius(n: number): n is RadiusKm {
  return (RADIUS_OPTIONS as readonly number[]).includes(n);
}
