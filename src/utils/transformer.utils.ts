import { ISleepData, IPhysicalData, IBodyData, IActivityEvent } from '../models/HealthData.types';

export class TransformerUtils {
  
  static transformSleepSummary(sleepSummary: any): ISleepData | null {
    if (!sleepSummary) return null;
    
    const duration = sleepSummary.duration || {};
    const heartRate = sleepSummary.heart_rate || {};
    const breathing = sleepSummary.breathing || {};
    const scores = sleepSummary.scores || {};
    const metadata = sleepSummary.metadata || {};
    
    const cleanData: ISleepData = {};
    
    if (duration.sleep_duration_seconds_int) {
      cleanData.duration_minutes = Math.round(duration.sleep_duration_seconds_int / 60);
    }
    
    if (scores.sleep_efficiency_1_100_score_int) {
      cleanData.efficiency_percentage = scores.sleep_efficiency_1_100_score_int;
    }
    
    if (duration.sleep_start_datetime_string) {
      cleanData.sleep_start = duration.sleep_start_datetime_string;
    }
    
    if (duration.sleep_end_datetime_string) {
      cleanData.sleep_end = duration.sleep_end_datetime_string;
    }
    
    if (duration.light_sleep_duration_seconds_int) {
      cleanData.light_sleep_minutes = Math.round(duration.light_sleep_duration_seconds_int / 60);
    }
    
    if (duration.rem_sleep_duration_seconds_int) {
      cleanData.rem_sleep_minutes = Math.round(duration.rem_sleep_duration_seconds_int / 60);
    }
    
    if (duration.deep_sleep_duration_seconds_int) {
      cleanData.deep_sleep_minutes = Math.round(duration.deep_sleep_duration_seconds_int / 60);
    }
    
    if (duration.time_awake_during_sleep_seconds_int) {
      cleanData.awake_minutes = Math.round(duration.time_awake_during_sleep_seconds_int / 60);
    }
    
    const hrData: any = {};
    if (heartRate.hr_minimum_bpm_int) hrData.min_bpm = heartRate.hr_minimum_bpm_int;
    if (heartRate.hr_maximum_bpm_int) hrData.max_bpm = heartRate.hr_maximum_bpm_int;
    if (heartRate.hr_avg_bpm_int) hrData.avg_bpm = heartRate.hr_avg_bpm_int;
    if (heartRate.hr_resting_bpm_int) hrData.resting_bpm = heartRate.hr_resting_bpm_int;
    
    if (Object.keys(hrData).length > 0) {
      cleanData.heart_rate = hrData;
    }
    
    const hrvData: any = {};
    if (heartRate.hrv_avg_rmssd_float) hrvData.rmssd_avg_ms = heartRate.hrv_avg_rmssd_float;
    if (heartRate.hrv_avg_sdnn_float) hrvData.sdnn_avg_ms = heartRate.hrv_avg_sdnn_float;
    
    if (Object.keys(hrvData).length > 0) {
      cleanData.hrv = hrvData;
    }
    
    const breathingData: any = {};
    if (breathing.breaths_avg_per_min_int) breathingData.avg_breaths_per_min = breathing.breaths_avg_per_min_int;
    if (breathing.saturation_avg_percentage_int) breathingData.spo2_avg_percentage = breathing.saturation_avg_percentage_int;
    if (breathing.saturation_minimum_percentage_int) breathingData.spo2_min_percentage = breathing.saturation_minimum_percentage_int;
    if (breathing.saturation_maximum_percentage_int) breathingData.spo2_max_percentage = breathing.saturation_maximum_percentage_int;
    
    if (Object.keys(breathingData).length > 0) {
      cleanData.breathing = breathingData;
    }
    
    if (metadata.datetime_string) {
      cleanData.last_updated = metadata.datetime_string;
    }
    
    return cleanData;
  }
  
  static transformPhysicalSummary(physicalSummary: any): IPhysicalData | null {
    if (!physicalSummary) return null;
    
    const activity = physicalSummary.activity || {};
    const calories = physicalSummary.calories || {};
    const distance = physicalSummary.distance || {};
    const heartRate = physicalSummary.heart_rate || {};
    const metadata = physicalSummary.metadata || {};
    
    const cleanData: IPhysicalData = {};
    
    if (distance.steps_int !== null && distance.steps_int !== undefined) {
      cleanData.steps = distance.steps_int;
    }
    
    if (distance.traveled_distance_meters_float) {
      cleanData.distance_meters = distance.traveled_distance_meters_float;
    }
    
    if (distance.floors_climbed_float) {
      cleanData.floors_climbed = distance.floors_climbed_float;
    }
    
    if (calories.calories_expenditure_kcal_float) {
      cleanData.calories_kcal = Math.round(calories.calories_expenditure_kcal_float);
    }
    
    if (calories.calories_net_active_kcal_float) {
      cleanData.active_calories_kcal = Math.round(calories.calories_net_active_kcal_float);
    }
    
    if (calories.calories_basal_metabolic_rate_kcal_float) {
      cleanData.basal_metabolic_rate_kcal = Math.round(calories.calories_basal_metabolic_rate_kcal_float);
    }
    
    if (activity.active_seconds_int) {
      cleanData.active_minutes = Math.round(activity.active_seconds_int / 60);
    }
    
    if (activity.moderate_intensity_seconds_int) {
      cleanData.moderate_intensity_minutes = Math.round(activity.moderate_intensity_seconds_int / 60);
    }
    
    if (activity.vigorous_intensity_seconds_int) {
      cleanData.vigorous_intensity_minutes = Math.round(activity.vigorous_intensity_seconds_int / 60);
    }
    
    const hrData: any = {};
    if (heartRate.hr_minimum_bpm_int) hrData.min_bpm = heartRate.hr_minimum_bpm_int;
    if (heartRate.hr_maximum_bpm_int) hrData.max_bpm = heartRate.hr_maximum_bpm_int;
    if (heartRate.hr_avg_bpm_int) hrData.avg_bpm = heartRate.hr_avg_bpm_int;
    if (heartRate.hr_resting_bpm_int) hrData.resting_bpm = heartRate.hr_resting_bpm_int;
    
    if (Object.keys(hrData).length > 0) {
      cleanData.heart_rate = hrData;
    }
    
    if (metadata.datetime_string) {
      cleanData.last_updated = metadata.datetime_string;
    }
    
    return cleanData;
  }
  
  static transformBodySummary(bodySummary: any): IBodyData | null {
    if (!bodySummary) return null;
    
    const bodyMetrics = bodySummary.body_metrics || {};
    const bloodPressure = bodySummary.blood_pressure || {};
    const bloodGlucose = bodySummary.blood_glucose || {};
    const hydration = bodySummary.hydration || {};
    const metadata = bodySummary.metadata || {};
    
    const cleanData: IBodyData = {};
    
    if (bodyMetrics.weight_kg_float) cleanData.weight_kg = bodyMetrics.weight_kg_float;
    if (bodyMetrics.height_cm_int) cleanData.height_cm = bodyMetrics.height_cm_int;
    if (bodyMetrics.bmi_float) cleanData.bmi = Math.round(bodyMetrics.bmi_float * 100) / 100;
    if (bodyMetrics.muscle_composition_percentage_int) cleanData.muscle_percentage = bodyMetrics.muscle_composition_percentage_int;
    if (bodyMetrics.water_composition_percentage_int) cleanData.water_percentage = bodyMetrics.water_composition_percentage_int;
    if (bodyMetrics.bone_composition_percentage_int) cleanData.bone_percentage = bodyMetrics.bone_composition_percentage_int;
    
    const bpData: any = {};
    if (bloodPressure.blood_pressure_avg_object?.systolic_mmHg_int) {
      bpData.systolic_mmHg = bloodPressure.blood_pressure_avg_object.systolic_mmHg_int;
    }
    if (bloodPressure.blood_pressure_avg_object?.diastolic_mmHg_int) {
      bpData.diastolic_mmHg = bloodPressure.blood_pressure_avg_object.diastolic_mmHg_int;
    }
    if (Object.keys(bpData).length > 0) {
      cleanData.blood_pressure = bpData;
    }
    
    if (bloodGlucose.blood_glucose_avg_mg_per_dL_int) {
      cleanData.blood_glucose_mg_dl = bloodGlucose.blood_glucose_avg_mg_per_dL_int;
    }
    
    if (hydration.water_total_consumption_mL_int) {
      cleanData.water_intake_ml = hydration.water_total_consumption_mL_int;
    }
    
    if (metadata.datetime_string) {
      cleanData.last_updated = metadata.datetime_string;
    }
    
    return cleanData;
  }
  
  static transformActivityEvent(activityEvents: any[]): IActivityEvent[] | null {
    if (!activityEvents || !Array.isArray(activityEvents)) return null;
    
    return activityEvents.map(event => {
      const cleanEvent: IActivityEvent = {};
      
      const activity = event.activity || {};
      const calories = event.calories || {};
      const distance = event.distance || {};
      const heartRate = event.heart_rate || {};
      const metadata = event.metadata || {};
      
      if (activity.activity_type_name_string) cleanEvent.activity_type = activity.activity_type_name_string;
      if (activity.activity_start_datetime_string) cleanEvent.start_time = activity.activity_start_datetime_string;
      if (activity.activity_end_datetime_string) cleanEvent.end_time = activity.activity_end_datetime_string;
      if (activity.activity_duration_seconds_int) {
        cleanEvent.duration_minutes = Math.round(activity.activity_duration_seconds_int / 60);
      }
      
      if (calories.calories_net_active_kcal_float) {
        cleanEvent.calories_burned_kcal = Math.round(calories.calories_net_active_kcal_float);
      }
      
      if (distance.traveled_distance_meters_float) {
        cleanEvent.distance_meters = distance.traveled_distance_meters_float;
      }
      
      if (heartRate.hr_avg_bpm_int) cleanEvent.avg_heart_rate_bpm = heartRate.hr_avg_bpm_int;
      if (heartRate.hr_maximum_bpm_int) cleanEvent.max_heart_rate_bpm = heartRate.hr_maximum_bpm_int;
      
      if (metadata.datetime_string) {
        cleanEvent.last_updated = metadata.datetime_string;
      }
      
      return cleanEvent;
    });
  }
  
  static transformBodyMetricsEvent(bodyMetricsEvents: any[]): IBodyData | null {
    if (!bodyMetricsEvents || !Array.isArray(bodyMetricsEvents) || bodyMetricsEvents.length === 0) {
      return null;
    }
    
    const event = bodyMetricsEvents[0];
    const bodyMetrics = event.body_metrics || {};
    const metadata = event.metadata || {};
    
    const cleanData: IBodyData = {};
    
    if (bodyMetrics.weight_kg_float) cleanData.weight_kg = bodyMetrics.weight_kg_float;
    if (bodyMetrics.height_cm_int) cleanData.height_cm = bodyMetrics.height_cm_int;
    if (bodyMetrics.bmi_float) cleanData.bmi = Math.round(bodyMetrics.bmi_float * 100) / 100;
    
    if (metadata.datetime_string) {
      cleanData.last_updated = metadata.datetime_string;
    }
    
    return cleanData;
  }
  
  static extractSource(payload: any): string {
    const locations = [
      payload.sleep_health?.summary?.sleep_summary?.metadata?.sources_of_data_array,
      payload.physical_health?.summary?.physical_summary?.metadata?.sources_of_data_array,
      payload.body_health?.summary?.body_summary?.metadata?.sources_of_data_array,
      payload.physical_health?.events?.activity_event?.[0]?.metadata?.sources_of_data_array,
      payload.body_health?.events?.body_metrics_event?.[0]?.metadata?.sources_of_data_array
    ];
    
    for (const sources of locations) {
      if (sources && Array.isArray(sources) && sources.length > 0) {
        return sources[0];
      }
    }
    
    return 'Unknown';
  }
}