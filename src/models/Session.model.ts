import mongoose, { Document, Schema } from "mongoose";

// Step within a session
export interface ISessionStep {
  StepNumber: number;
  Activity: string;
  DurationMinutes: number;
  Instructions: string;
  Message?: string;
  TimerStartMessage?: string;
  TimerEndMessage?: string;
}

// Main session document
export interface ISession extends Document {
  sessionId: string; // UUID from AI generation
  firebaseUid: string; // User who owns this session

  // Session data from AI
  SessionName: string;
  TotalDurationMinutes: number;
  RecommendedFor: string;
  Steps: ISessionStep[];
  Tips: string[];
  StartMessage: string;
  CompletionMessage: string;

  // User interaction metadata
  isCompleted: boolean;
  completedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const SessionStepSchema = new Schema<ISessionStep>(
  {
    StepNumber: {
      type: Number,
      required: true,
    },
    Activity: {
      type: String,
      required: true,
    },
    DurationMinutes: {
      type: Number,
      required: true,
    },
    Instructions: {
      type: String,
      required: true,
    },
    Message: {
      type: String,
      required: false,
    },
    TimerStartMessage: {
      type: String,
      required: false,
    },
    TimerEndMessage: {
      type: String,
      required: false,
    },
  },
  { _id: false }, // Don't create _id for subdocuments
);

const SessionSchema = new Schema<ISession>(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    firebaseUid: {
      type: String,
      required: true,
      index: true,
    },
    SessionName: {
      type: String,
      required: true,
    },
    TotalDurationMinutes: {
      type: Number,
      required: true,
    },
    RecommendedFor: {
      type: String,
      required: true,
    },
    Steps: {
      type: [SessionStepSchema],
      required: true,
      default: [],
    },
    Tips: {
      type: [String],
      required: true,
      default: [],
    },
    StartMessage: {
      type: String,
      required: true,
    },
    CompletionMessage: {
      type: String,
      required: true,
    },
    isCompleted: {
      type: Boolean,
      required: true,
      default: false,
    },
    completedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  },
);

// Compound index for efficient queries
SessionSchema.index({ firebaseUid: 1, createdAt: -1 });
SessionSchema.index({ firebaseUid: 1, isCompleted: 1 });

export const Session = mongoose.model<ISession>("Session", SessionSchema);
