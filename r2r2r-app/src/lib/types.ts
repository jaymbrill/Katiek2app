export type FitnessLevel = 'BEGINNER' | 'INTERMEDIATE' | 'STRONG' | 'ELITE';
export type GearTier = 'REQUIRED' | 'STRONGLY_RECOMMENDED' | 'OPTIONAL';
export type TripStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';
export type TripDirection = 'S_TO_N' | 'N_TO_S';
export type WaterSourceStatus = 'OPEN' | 'SEASONAL' | 'DOWN';
export type ConditionStatus = 'GO' | 'CAUTION' | 'NO_GO';
export type TurnaroundRecommendation = 'CONTINUE' | 'CONSIDER_TURNING' | 'TURN_BACK_NOW';

export interface WaterSource {
  id: string;
  name: string;
  mileFromSouthTH: number;
  critical: boolean;
  status: WaterSourceStatus;
  lastVerified: string;
  notes: string;
}

export interface Segment {
  id: string;
  name: string;
  miles: number;
  elevationChangeFt: number;
  baseTimeMinutes: number;
  fromWaypointId: string;
  toWaypointId: string;
}

export interface ScheduledSegment extends Segment {
  adjustedTimeMinutes: number;
  plannedStartTime: Date;
  plannedEndTime: Date;
}

export interface GearItem {
  id: string;
  name: string;
  tier: GearTier;
  notes: string;
  weightOz?: number;
  packed: boolean;
}

export interface CheckIn {
  waypointId: string;
  actualTime: Date;
  plannedTime: Date;
  deltaMinutes: number;
}

export interface HydrationEntry {
  timestamp: Date;
  waterOz: number;
  hadElectrolytes: boolean;
}

export interface HourlyTarget {
  hour: number;
  segment: string;
  waterOz: number;
  electrolytes: boolean;
  tempF: number;
  notes?: string;
}

export interface HydrationPlan {
  hourlySchedule: HourlyTarget[];
  totalWaterLiters: number;
  totalElectrolyteDoses: number;
}

export interface TripPlan {
  id: string;
  createdAt: Date;
  tripDate: Date;
  startTime: string;
  direction: TripDirection;
  fitnessLevel: FitnessLevel;
  bodyWeightLbs: number;
  targetFinishTime: Date;
  status: TripStatus;
  scheduledSegments: ScheduledSegment[];
  checkIns: CheckIn[];
  hydrationLog: HydrationEntry[];
  gearChecklist: GearItem[];
}

export interface TurnaroundAssessment {
  recommendation: TurnaroundRecommendation;
  reasoning: string;
  estimatedFinishTime: Date;
  latestSafeTurnaroundTime: Date;
  minutesBehindPlan: number;
}

export interface Forecast {
  innerGorgeHighF: number;
  hourlyTemps: number[];
  summary: string;
  lastUpdated: Date;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}
