import { getDb } from './schema';
import type { TripPlan, GearItem } from '../types';
import gearItemsData from '../../constants/gearItems.json';

function rowToTrip(row: any): TripPlan {
  return {
    id: row.id,
    createdAt: new Date(row.created_at),
    tripDate: new Date(row.trip_date),
    startTime: row.start_time,
    direction: row.direction,
    fitnessLevel: row.fitness_level,
    bodyWeightLbs: row.body_weight_lbs,
    targetFinishTime: new Date(row.target_finish_time),
    status: row.status,
    scheduledSegments: JSON.parse(row.scheduled_segments_json),
    gearChecklist: JSON.parse(row.gear_checklist_json),
    checkIns: [],
    hydrationLog: [],
  };
}

export async function createTrip(trip: TripPlan): Promise<void> {
  const db = await getDb();
  const defaultGear: GearItem[] = (gearItemsData as any[]).map((g) => ({
    ...g,
    packed: false,
  }));

  await db.runAsync(
    `INSERT INTO trips
      (id, created_at, trip_date, start_time, direction, fitness_level, body_weight_lbs, target_finish_time, status, scheduled_segments_json, gear_checklist_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trip.id,
      trip.createdAt.toISOString(),
      trip.tripDate.toISOString(),
      trip.startTime,
      trip.direction,
      trip.fitnessLevel,
      trip.bodyWeightLbs,
      trip.targetFinishTime.toISOString(),
      trip.status,
      JSON.stringify(trip.scheduledSegments),
      JSON.stringify(defaultGear),
    ]
  );
}

export async function getTrip(id: string): Promise<TripPlan | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM trips WHERE id = ?', [id]);
  if (!row) return null;
  const trip = rowToTrip(row);
  trip.checkIns = await getCheckIns(id);
  trip.hydrationLog = await getHydrationLog(id);
  return trip;
}

export async function getAllTrips(): Promise<TripPlan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM trips ORDER BY trip_date DESC');
  return rows.map(rowToTrip);
}

export async function updateTripStatus(id: string, status: TripPlan['status']): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE trips SET status = ? WHERE id = ?', [status, id]);
}

export async function updateGearChecklist(id: string, gear: GearItem[]): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE trips SET gear_checklist_json = ? WHERE id = ?', [
    JSON.stringify(gear),
    id,
  ]);
}

export async function addCheckIn(
  tripId: string,
  checkIn: { waypointId: string; actualTime: Date; plannedTime: Date; deltaMinutes: number }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO check_ins (trip_id, waypoint_id, actual_time, planned_time, delta_minutes) VALUES (?, ?, ?, ?, ?)',
    [
      tripId,
      checkIn.waypointId,
      checkIn.actualTime.toISOString(),
      checkIn.plannedTime.toISOString(),
      checkIn.deltaMinutes,
    ]
  );
}

export async function getCheckIns(tripId: string): Promise<TripPlan['checkIns']> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM check_ins WHERE trip_id = ? ORDER BY actual_time ASC',
    [tripId]
  );
  return rows.map((r) => ({
    waypointId: r.waypoint_id,
    actualTime: new Date(r.actual_time),
    plannedTime: new Date(r.planned_time),
    deltaMinutes: r.delta_minutes,
  }));
}

export async function addHydrationEntry(
  tripId: string,
  entry: { waterOz: number; hadElectrolytes: boolean }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO hydration_log (trip_id, timestamp, water_oz, had_electrolytes) VALUES (?, ?, ?, ?)',
    [tripId, new Date().toISOString(), entry.waterOz, entry.hadElectrolytes ? 1 : 0]
  );
}

export async function getHydrationLog(tripId: string): Promise<TripPlan['hydrationLog']> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM hydration_log WHERE trip_id = ? ORDER BY timestamp ASC',
    [tripId]
  );
  return rows.map((r) => ({
    timestamp: new Date(r.timestamp),
    waterOz: r.water_oz,
    hadElectrolytes: r.had_electrolytes === 1,
  }));
}

export async function logTurnaroundOverride(
  tripId: string,
  assessment: object
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO turnaround_overrides (trip_id, override_time, assessment_json) VALUES (?, ?, ?)',
    [tripId, new Date().toISOString(), JSON.stringify(assessment)]
  );
}
