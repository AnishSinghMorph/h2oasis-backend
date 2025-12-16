// ============================================
// PRODUCT CONSTANTS
// ============================================
export const PRODUCT_TYPES = ["cold-plunge", "hot-tub", "sauna"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

// ============================================
// FOCUS GOAL CONSTANTS
// ============================================
export const FOCUS_GOAL_KEYS = [
  "stress-relief",
  "training-recovery",
  "traveler-balance",
  "muscle-recovery",
  "relax-rebalance",
  "other",
] as const;
export type FocusGoalKey = (typeof FOCUS_GOAL_KEYS)[number];

// ============================================
// AUTH PROVIDER CONSTANTS
// ============================================
export const AUTH_PROVIDERS = ["password", "google.com", "apple.com"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

// ============================================
// WEARABLE CONSTANTS
// ============================================
export const WEARABLE_TYPES = ["sdk", "api"] as const;
export type WearableType = (typeof WEARABLE_TYPES)[number];

export const WEARABLE_SOURCES = [
  "apple",
  "samsung",
  "garmin",
  "fitbit",
  "whoop",
  "oura",
  "polar",
] as const;
export type WearableSource = (typeof WEARABLE_SOURCES)[number];

export const API_WEARABLE_SOURCES = [
  "oura",
  "garmin",
  "fitbit",
  "whoop",
  "polar",
] as const;
export type ApiWearableSource = (typeof API_WEARABLE_SOURCES)[number];

// ============================================
// WEBHOOK CONSTANTS
// ============================================
export const WEBHOOK_EVENT_TYPES = [
  "connection_established",
  "connection_revoked",
  "user_created",
  "user_deleted",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

// ============================================
// CACHE TTL CONSTANTS (in seconds)
// ============================================
export const CACHE_TTL = {
  USER: 300, // 5 minutes
  HEALTH_DATA: 60, // 1 minute
  WEARABLES: 300, // 5 minutes
} as const;

// ============================================
// OTP CONSTANTS
// ============================================
export const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 10,
} as const;
