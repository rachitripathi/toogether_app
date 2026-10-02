export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Great-circle ("as the crow flies") distance via the haversine formula — accurate to well
// under 1% at city scale, and needs no network call or maps SDK.
export const distanceKm = (a: LatLng, b: LatLng) => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

export const formatDistance = (km: number) => {
  if (km < 1) return `${Math.max(Math.round(km * 1000 / 50) * 50, 50)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
};
