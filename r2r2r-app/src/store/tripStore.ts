import { create } from 'zustand';
import type { TripPlan, Forecast, GearItem } from '../lib/types';
import {
  createTrip,
  getAllTrips,
  getTrip,
  updateTripStatus,
  updateGearChecklist,
  addCheckIn,
  addHydrationEntry,
  logTurnaroundOverride,
} from '../lib/db/trips';
import { fetchForecast, getFallbackForecast } from '../lib/weather';
import { assessTurnaround } from '../lib/turnaround';
import type { TurnaroundAssessment } from '../lib/types';

interface TripStore {
  trips: TripPlan[];
  activeTrip: TripPlan | null;
  forecast: Forecast | null;
  forecastLoading: boolean;
  turnaroundAssessment: TurnaroundAssessment | null;

  loadTrips: () => Promise<void>;
  loadActiveTrip: (id: string) => Promise<void>;
  saveTrip: (trip: TripPlan) => Promise<void>;
  setTripStatus: (id: string, status: TripPlan['status']) => Promise<void>;
  saveGearChecklist: (id: string, gear: GearItem[]) => Promise<void>;
  recordCheckIn: (
    tripId: string,
    waypointId: string,
    plannedTime: Date
  ) => Promise<void>;
  logHydration: (
    tripId: string,
    waterOz: number,
    hadElectrolytes: boolean
  ) => Promise<void>;
  overrideTurnaround: (tripId: string) => Promise<void>;
  loadForecast: (tripDate: Date) => Promise<void>;
  recalculateTurnaround: () => void;
}

export const useTripStore = create<TripStore>((set, get) => ({
  trips: [],
  activeTrip: null,
  forecast: null,
  forecastLoading: false,
  turnaroundAssessment: null,

  loadTrips: async () => {
    const trips = await getAllTrips();
    set({ trips });
  },

  loadActiveTrip: async (id) => {
    const trip = await getTrip(id);
    set({ activeTrip: trip });
    if (trip) get().recalculateTurnaround();
  },

  saveTrip: async (trip) => {
    await createTrip(trip);
    await get().loadTrips();
  },

  setTripStatus: async (id, status) => {
    await updateTripStatus(id, status);
    await get().loadTrips();
    if (get().activeTrip?.id === id) {
      await get().loadActiveTrip(id);
    }
  },

  saveGearChecklist: async (id, gear) => {
    await updateGearChecklist(id, gear);
    if (get().activeTrip?.id === id) {
      set((state) => ({
        activeTrip: state.activeTrip ? { ...state.activeTrip, gearChecklist: gear } : null,
      }));
    }
  },

  recordCheckIn: async (tripId, waypointId, plannedTime) => {
    const actualTime = new Date();
    const deltaMinutes = Math.round((actualTime.getTime() - plannedTime.getTime()) / 60000);
    await addCheckIn(tripId, { waypointId, actualTime, plannedTime, deltaMinutes });
    await get().loadActiveTrip(tripId);
  },

  logHydration: async (tripId, waterOz, hadElectrolytes) => {
    await addHydrationEntry(tripId, { waterOz, hadElectrolytes });
    await get().loadActiveTrip(tripId);
  },

  overrideTurnaround: async (tripId) => {
    const assessment = get().turnaroundAssessment;
    if (assessment) await logTurnaroundOverride(tripId, assessment);
  },

  loadForecast: async (tripDate) => {
    set({ forecastLoading: true });
    try {
      const forecast = await fetchForecast();
      set({ forecast, forecastLoading: false });
    } catch {
      set({ forecast: getFallbackForecast(tripDate), forecastLoading: false });
    }
    get().recalculateTurnaround();
  },

  recalculateTurnaround: () => {
    const { activeTrip, forecast } = get();
    if (!activeTrip || !forecast) return;
    const assessment = assessTurnaround(
      activeTrip.checkIns,
      activeTrip,
      new Date(),
      forecast
    );
    set({ turnaroundAssessment: assessment });
  },
}));
