import { create } from 'zustand';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type LocationPickerOrigin = 'home' | 'create-event';

type LocationPickerStore = {
  origin: LocationPickerOrigin | null;
  initialCoordinate: MapCoordinate | null;
  initialRegion: MapRegion;
  result: { origin: LocationPickerOrigin; coordinate: MapCoordinate } | null;
  open: (origin: LocationPickerOrigin, initial: { coordinate: MapCoordinate | null; region: MapRegion }) => void;
  resolve: (coordinate: MapCoordinate) => void;
  consumeResult: (origin: LocationPickerOrigin) => MapCoordinate | null;
};

const FALLBACK_REGION: MapRegion = {
  latitude: 26.1445,
  longitude: 91.7362,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

// Hands the map-picker screen (app/location-picker.*) its starting point and carries
// the chosen coordinate back to whichever screen opened it. Route params can't carry
// a result back to the screen that pushed them, and the picker used to be rendered as
// a same-screen <Modal> — which on Android raced against whatever other <Modal> was
// closing at the same time and could dismiss itself right after opening. Routing to
// a real screen removes that race; this store is what replaces the old callback props.
export const useLocationPickerStore = create<LocationPickerStore>((set, get) => ({
  origin: null,
  initialCoordinate: null,
  initialRegion: FALLBACK_REGION,
  result: null,
  open: (origin, { coordinate, region }) =>
    set({ origin, initialCoordinate: coordinate, initialRegion: region, result: null }),
  resolve: (coordinate) => {
    const { origin } = get();
    if (origin) {
      set({ result: { origin, coordinate } });
    }
  },
  consumeResult: (origin) => {
    const { result } = get();
    if (result && result.origin === origin) {
      set({ result: null });
      return result.coordinate;
    }
    return null;
  },
}));
