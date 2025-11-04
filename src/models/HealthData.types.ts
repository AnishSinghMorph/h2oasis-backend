export interface ISleepData {
  duration_minutes?: number;
  efficiency_percentage?: number;
  sleep_start?: string;
  sleep_end?: string;
  light_sleep_minutes?: number;
  rem_sleep_minutes?: number;
  deep_sleep_minutes?: number;
  awake_minutes?: number;
  heart_rate?: {
    min_bpm?: number;
    max_bpm?: number;
    avg_bpm?: number;
    resting_bpm?: number;
  };
  hrv?: {
    rmssd_avg_ms?: number;
    sdnn_avg_ms?: number;
  };
  breathing?: {
    avg_breaths_per_min?: number;
    spo2_avg_percentage?: number;
    spo2_min_percentage?: number;
    spo2_max_percentage?: number;
  };
  last_updated?: string;
}

export interface IPhysicalData {
  steps?: number;
  calories_kcal?: number;
  active_calories_kcal?: number;
  basal_metabolic_rate_kcal?: number;
  distance_meters?: number;
  floors_climbed?: number;
  active_minutes?: number;
  moderate_intensity_minutes?: number;
  vigorous_intensity_minutes?: number;
  heart_rate?: {
    min_bpm?: number;
    max_bpm?: number;
    avg_bpm?: number;
    resting_bpm?: number;
  };
  activity_score?: number;
  last_updated?: string;
}

export interface IBodyData {
  weight_kg?: number;
  height_cm?: number;
  bmi?: number;
  body_fat_percentage?: number;
  muscle_percentage?: number;
  water_percentage?: number;
  bone_percentage?: number;
  waist_cm?: number;
  hip_cm?: number;
  chest_cm?: number;
  blood_pressure?: {
    systolic_mmHg?: number;
    diastolic_mmHg?: number;
  };
  blood_glucose_mg_dl?: number;
  water_intake_ml?: number;
  last_updated?: string;
}

export interface IActivityEvent {
  activity_type?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  calories_burned_kcal?: number;
  distance_meters?: number;
  avg_heart_rate_bpm?: number;
  max_heart_rate_bpm?: number;
  last_updated?: string;
}

// Device-specific data types

/**
 * Readiness/Recovery Score (Oura Ring)
 * Measures how ready your body is for the day
 */
export interface IReadinessData {
  score?: number; // 0-100
  resting_heart_rate_bpm?: number;
  hrv_rmssd_ms?: number;
  temperature_deviation_c?: number;
  last_updated?: string;
}

/**
 * Strain Score (Whoop)
 * Measures cardiovascular load during the day
 */
export interface IStrainData {
  score?: number; // 0-21
  last_updated?: string;
}

/**
 * Recovery Score (Whoop)
 * Measures how recovered your body is from previous days
 */
export interface IRecoveryData {
  score?: number; // 0-100
  resting_heart_rate_bpm?: number;
  hrv_rmssd_ms?: number;
  last_updated?: string;
}

/**
 * Body Battery (Garmin)
 * Measures your body's energy reserves
 */
export interface IBodyBatteryData {
  level?: number; // 0-100
  last_updated?: string;
}

/**
 * Stress Level (Garmin)
 * Measures your stress throughout the day
 */
export interface IStressData {
  stress_level?: number; // 0-100
  last_updated?: string;
}

/**
 * Main health data container
 * Different wearables populate different fields
 */
export interface IHealthData {
  sleep?: ISleepData;
  physical?: IPhysicalData;
  body?: IBodyData;
  activity_events?: IActivityEvent[];

  // Device-specific fields
  readiness?: IReadinessData; // Oura
  strain?: IStrainData; // Whoop
  recovery?: IRecoveryData; // Whoop, Oura
  body_battery?: IBodyBatteryData; // Garmin
  stress?: IStressData; // Garmin
}

export interface IRookWebhookPayload {
  version: number;
  data_structure: string;
  client_uuid: string;
  user_id: string;
  document_version: number;
  pre_existing_data: boolean;
  auto_detected?: boolean;
  sleep_health?: any;
  physical_health?: any;
  body_health?: any;
}
