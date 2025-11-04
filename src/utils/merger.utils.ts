import {
  ISleepData,
  IPhysicalData,
  IBodyData,
  IActivityEvent,
} from "../models/HealthData.types";

/**
 * Merger Utilities
 * Smart merging logic that preserves old values when new values are null
 * and only updates if data is newer based on timestamps
 */
export class MergerUtils {
  /**
   * Merge sleep data
   */
  static mergeSleepData(
    existing: ISleepData | undefined,
    newData: ISleepData,
  ): ISleepData {
    const existingData = existing || {};

    if (existingData.last_updated && newData.last_updated) {
      const existingTime = new Date(existingData.last_updated).getTime();
      const newTime = new Date(newData.last_updated).getTime();

      if (newTime < existingTime) {
        console.log("⏭️ Skipping older sleep data");
        return existingData;
      }
    }

    const merged: ISleepData = {
      duration_minutes:
        newData.duration_minutes ?? existingData.duration_minutes,
      efficiency_percentage:
        newData.efficiency_percentage ?? existingData.efficiency_percentage,
      sleep_start: newData.sleep_start ?? existingData.sleep_start,
      sleep_end: newData.sleep_end ?? existingData.sleep_end,
      light_sleep_minutes:
        newData.light_sleep_minutes ?? existingData.light_sleep_minutes,
      rem_sleep_minutes:
        newData.rem_sleep_minutes ?? existingData.rem_sleep_minutes,
      deep_sleep_minutes:
        newData.deep_sleep_minutes ?? existingData.deep_sleep_minutes,
      awake_minutes: newData.awake_minutes ?? existingData.awake_minutes,
      last_updated: newData.last_updated ?? existingData.last_updated,
    };

    if (newData.heart_rate || existingData.heart_rate) {
      merged.heart_rate = {
        min_bpm:
          newData.heart_rate?.min_bpm ?? existingData.heart_rate?.min_bpm,
        max_bpm:
          newData.heart_rate?.max_bpm ?? existingData.heart_rate?.max_bpm,
        avg_bpm:
          newData.heart_rate?.avg_bpm ?? existingData.heart_rate?.avg_bpm,
        resting_bpm:
          newData.heart_rate?.resting_bpm ??
          existingData.heart_rate?.resting_bpm,
      };
    }

    if (newData.hrv || existingData.hrv) {
      merged.hrv = {
        rmssd_avg_ms:
          newData.hrv?.rmssd_avg_ms ?? existingData.hrv?.rmssd_avg_ms,
        sdnn_avg_ms: newData.hrv?.sdnn_avg_ms ?? existingData.hrv?.sdnn_avg_ms,
      };
    }

    if (newData.breathing || existingData.breathing) {
      merged.breathing = {
        avg_breaths_per_min:
          newData.breathing?.avg_breaths_per_min ??
          existingData.breathing?.avg_breaths_per_min,
        spo2_avg_percentage:
          newData.breathing?.spo2_avg_percentage ??
          existingData.breathing?.spo2_avg_percentage,
        spo2_min_percentage:
          newData.breathing?.spo2_min_percentage ??
          existingData.breathing?.spo2_min_percentage,
        spo2_max_percentage:
          newData.breathing?.spo2_max_percentage ??
          existingData.breathing?.spo2_max_percentage,
      };
    }

    console.log("✅ Sleep data merged successfully");
    return merged;
  }

  /**
   * Merge physical activity data
   */
  static mergePhysicalData(
    existing: IPhysicalData | undefined,
    newData: IPhysicalData,
  ): IPhysicalData {
    const existingData = existing || {};

    if (existingData.last_updated && newData.last_updated) {
      const existingTime = new Date(existingData.last_updated).getTime();
      const newTime = new Date(newData.last_updated).getTime();

      if (newTime < existingTime) {
        console.log("⏭️ Skipping older physical data");
        return existingData;
      }
    }

    const merged: IPhysicalData = {
      steps: newData.steps ?? existingData.steps,
      calories_kcal: newData.calories_kcal ?? existingData.calories_kcal,
      active_calories_kcal:
        newData.active_calories_kcal ?? existingData.active_calories_kcal,
      basal_metabolic_rate_kcal:
        newData.basal_metabolic_rate_kcal ??
        existingData.basal_metabolic_rate_kcal,
      distance_meters: newData.distance_meters ?? existingData.distance_meters,
      floors_climbed: newData.floors_climbed ?? existingData.floors_climbed,
      active_minutes: newData.active_minutes ?? existingData.active_minutes,
      moderate_intensity_minutes:
        newData.moderate_intensity_minutes ??
        existingData.moderate_intensity_minutes,
      vigorous_intensity_minutes:
        newData.vigorous_intensity_minutes ??
        existingData.vigorous_intensity_minutes,
      activity_score: newData.activity_score ?? existingData.activity_score,
      last_updated: newData.last_updated ?? existingData.last_updated,
    };

    if (newData.heart_rate || existingData.heart_rate) {
      merged.heart_rate = {
        min_bpm:
          newData.heart_rate?.min_bpm ?? existingData.heart_rate?.min_bpm,
        max_bpm:
          newData.heart_rate?.max_bpm ?? existingData.heart_rate?.max_bpm,
        avg_bpm:
          newData.heart_rate?.avg_bpm ?? existingData.heart_rate?.avg_bpm,
        resting_bpm:
          newData.heart_rate?.resting_bpm ??
          existingData.heart_rate?.resting_bpm,
      };
    }

    console.log("✅ Physical data merged successfully");
    return merged;
  }

  /**
   * Merge body metrics data
   */
  static mergeBodyData(
    existing: IBodyData | undefined,
    newData: IBodyData,
  ): IBodyData {
    const existingData = existing || {};

    if (existingData.last_updated && newData.last_updated) {
      const existingTime = new Date(existingData.last_updated).getTime();
      const newTime = new Date(newData.last_updated).getTime();

      if (newTime < existingTime) {
        console.log("⏭️ Skipping older body data");
        return existingData;
      }
    }

    const merged: IBodyData = {
      weight_kg: newData.weight_kg ?? existingData.weight_kg,
      height_cm: newData.height_cm ?? existingData.height_cm,
      bmi: newData.bmi ?? existingData.bmi,
      body_fat_percentage:
        newData.body_fat_percentage ?? existingData.body_fat_percentage,
      muscle_percentage:
        newData.muscle_percentage ?? existingData.muscle_percentage,
      water_percentage:
        newData.water_percentage ?? existingData.water_percentage,
      bone_percentage: newData.bone_percentage ?? existingData.bone_percentage,
      waist_cm: newData.waist_cm ?? existingData.waist_cm,
      hip_cm: newData.hip_cm ?? existingData.hip_cm,
      chest_cm: newData.chest_cm ?? existingData.chest_cm,
      blood_glucose_mg_dl:
        newData.blood_glucose_mg_dl ?? existingData.blood_glucose_mg_dl,
      water_intake_ml: newData.water_intake_ml ?? existingData.water_intake_ml,
      last_updated: newData.last_updated ?? existingData.last_updated,
    };

    if (newData.blood_pressure || existingData.blood_pressure) {
      merged.blood_pressure = {
        systolic_mmHg:
          newData.blood_pressure?.systolic_mmHg ??
          existingData.blood_pressure?.systolic_mmHg,
        diastolic_mmHg:
          newData.blood_pressure?.diastolic_mmHg ??
          existingData.blood_pressure?.diastolic_mmHg,
      };
    }

    console.log("✅ Body data merged successfully");
    return merged;
  }

  /**
   * Merge activity events (append new events, remove duplicates, limit to 50)
   */
  static mergeActivityEvents(
    existing: IActivityEvent[] | undefined,
    newEvents: IActivityEvent[],
  ): IActivityEvent[] {
    const existingEvents = existing || [];

    const allEvents = [...existingEvents, ...newEvents];

    const uniqueEvents = allEvents.reduce((acc, event) => {
      const exists = acc.find((e) => e.start_time === event.start_time);
      if (!exists) {
        acc.push(event);
      }
      return acc;
    }, [] as IActivityEvent[]);

    uniqueEvents.sort((a, b) => {
      if (!a.start_time || !b.start_time) return 0;
      return (
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );
    });

    const limitedEvents = uniqueEvents.slice(0, 50);

    console.log(
      `✅ Activity events merged: ${newEvents.length} new, ${limitedEvents.length} total`,
    );
    return limitedEvents;
  }
}
