import mongoose, { Document, Schema } from "mongoose";

/**
 * Raw Webhook Model
 * 
 * PURPOSE: Store IMMUTABLE copy of every webhook received
 * 
 * Why store raw webhooks?
 * 1. AUDIT TRAIL - Compliance, debugging, forensics
 * 2. REPLAY - If processing fails, can replay from raw data
 * 3. DATA RECOVERY - If transformation had a bug, can reprocess
 * 4. ANALYTICS - Analyze webhook patterns, ROOK API changes
 * 
 * IMPORTANT: Never delete raw webhooks! They're your source of truth.
 */

export interface IRawWebhook extends Document {
  // Provider info
  provider: string; // "rook", "fitbit", "oura", etc.
  externalUserId: string; // ROOK's user_id (MongoDB ObjectId from your system)
  dataStructure: string; // "sleep_summary", "physical_summary", etc.
  
  // Raw payload (entire webhook body)
  payload: any; // Store everything ROOK sent
  
  // Timestamps
  receivedAt: Date; // When webhook hit our endpoint
  
  // Processing status
  processed: boolean; // Has worker processed this?
  processedAt?: Date; // When did worker finish?
  error?: string; // If processing failed, what was the error?
  
  // SQS tracking
  sqsMessageId?: string; // SQS message ID (for correlation)
  
  // Metadata
  userAgent?: string; // ROOK's user agent
  ipAddress?: string; // ROOK's IP address
}

const RawWebhookSchema = new Schema<IRawWebhook>(
  {
    provider: {
      type: String,
      required: true,
      index: true,
    },
    externalUserId: {
      type: String,
      required: true,
      index: true, // Fast lookup by user
    },
    dataStructure: {
      type: String,
      required: true,
      index: true, // Fast lookup by type
    },
    payload: {
      type: Schema.Types.Mixed, // Can store any JSON structure
      required: true,
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true, // Fast lookup by date
    },
    processed: {
      type: Boolean,
      required: true,
      default: false,
      index: true, // Fast lookup of unprocessed webhooks
    },
    processedAt: {
      type: Date,
    },
    error: {
      type: String,
    },
    sqsMessageId: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Compound index for common queries
RawWebhookSchema.index({ provider: 1, externalUserId: 1, receivedAt: -1 });
RawWebhookSchema.index({ processed: 1, receivedAt: -1 });

/**
 * Helper method to mark webhook as processed
 */
RawWebhookSchema.methods.markProcessed = async function(error?: string) {
  this.processed = true;
  this.processedAt = new Date();
  if (error) {
    this.error = error;
  }
  return this.save();
};

/**
 * Static method to find unprocessed webhooks (for manual replay)
 */
RawWebhookSchema.statics.findUnprocessed = function(limit: number = 100) {
  return this.find({ processed: false })
    .sort({ receivedAt: 1 }) // Oldest first
    .limit(limit);
};

/**
 * Static method to find failed webhooks
 */
RawWebhookSchema.statics.findFailed = function(limit: number = 100) {
  return this.find({
    processed: true,
    error: { $exists: true, $ne: null },
  })
    .sort({ receivedAt: -1 })
    .limit(limit);
};

export const RawWebhook = mongoose.model<IRawWebhook>(
  "RawWebhook",
  RawWebhookSchema
);
