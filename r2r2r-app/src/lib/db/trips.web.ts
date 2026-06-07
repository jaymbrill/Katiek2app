// Web shim: localStorage-backed trip persistence

import type { TripPlan, GearItem } from '../types';
import gearItemsData from '../../constants/gearItems.json';

const TRIPS_KEY = 'r2r2r:trips';
const CHECKINS_KEY = 'r2r2r:checkins:';
const HYDRATION_KEY = 'r2r2r:hydration:';
const OVERRIDES_KEY = 'r2r2r:overrides:';

function readTrips(): TripPlan[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as any[];
    return items.map(deserializeTrip);
  } catch {
    return [];
  }
}

function deserializeTrip(raw: any): TripPlan {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    tripDate: new Date(raw.tripDate),
    targetFinishTime: new Date(raw.targetFinishTime),
    checkIns: [],
    hydrationLog: [],
  };
}

function writeTrips(trips: TripPlan[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
}

export async function createTrip(trip: TripPlan): Promise<void> {
  const trips = readTrips();
  const defaultGear: GearItem[] = (gearItemsData as any[]).map((g) => ({
    ...g,
    packed: false,
  }));
  trips.push({ ...trip, gearChecklist: defaultGear });
  writeTrips(trips);
}

export async function getTrip(id: string): Promise<TripPlan | null> {
  const trips = readTrips();
  const trip = trips.find((t) => t.id === id) ?? null;
  if (!trip) return null;
  trip.checkIns = await getCheckIns(id);
  trip.hydrationLog = await getHydrationLog(id);
  return trip;
}

export async function getAllTrips(): Promise<TripPlan[]> {
  return readTrips().sort(
    (a, b) => new Date(b.tripDate).getTime() - new Date(a.tripDate).getTime()
  );
}

export async function updateTripStatus(id: string, status: TripPlan['status']): Promise<void> {
  const trips = readTrips();
  const idx = trips.findIndex((t) => t.id === id);
  if (idx !== -1) {
    trips[idx].status = status;
    writeTrips(trips);
  }
}

export async function updateGearChecklist(id: string, gear: GearItem[]): Promise<void> {
  const trips = readTrips();
  const idx = trips.findIndex((t) => t.id === id);
  if (idx !== -1) {
    trips[idx].gearChecklist = gear;
    writeTrips(trips);
  }
}

export async function addCheckIn(
  tripId: string,
  checkIn: { waypointId: string; actualTime: Date; plannedTime: Date; deltaMinutes: number }
): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  const key = CHECKINS_KEY + tripId;
  const existing = JSON.parse(localStorage.getItem(key) ?? '[]');
  existing.push(checkIn);
  localStorage.setItem(key, JSON.stringify(existing));
}

export async function getCheckIns(tripId: string): Promise<TripPlan['checkIns']> {
  if (typeof localStorage === 'undefined') return [];
  const key = CHECKINS_KEY + tripId;
  const raw = JSON.parse(localStorage.getItem(key) ?? '[]') as any[];
  return raw.map((r) => ({
    ...r,
    actualTime: new Date(r.actualTime),
    plannedTime: new Date(r.plannedTime),
  }));
}

export async function addHydrationEntry(
  tripId: string,
  entry: { waterOz: number; hadElectrolytes: boolean }
): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  const key = HYDRATION_KEY + tripId;
  const existing = JSON.parse(localStorage.getItem(key) ?? '[]');
  existing.push({ ...entry, timestamp: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(existing));
}

export async function getHydrationLog(tripId: string): Promise<TripPlan['hydrationLog']> {
  if (typeof localStorage === 'undefined') return [];
  const key = HYDRATION_KEY + tripId;
  const raw = JSON.parse(localStorage.getItem(key) ?? '[]') as any[];
  return raw.map((r) => ({
    ...r,
    timestamp: new Date(r.timestamp),
  }));
}

export async function logTurnaroundOverride(
  tripId: string,
  assessment: object
): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  const key = OVERRIDES_KEY + tripId;
  const existing = JSON.parse(localStorage.getItem(key) ?? '[]');
  existing.push({ time: new Date().toISOString(), assessment });
  localStorage.setItem(key, JSON.stringify(existing));
}
