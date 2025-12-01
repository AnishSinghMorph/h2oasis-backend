import mongoose, { Document, Schema } from "mongoose";
import { IHealthData } from "./HealthData.types";

export interface IWearableConnection {
  id: string;
  name: string;
  type: "sdk" | "api";
  connected: boolean;
  lastSync?: Date;
  connectedAt?: Date;
  data: IHealthData | null;
}

export interface IUser extends Document {
  firebaseUid: string;
  email: string;
  fullName?: string;
  phone?: string;
  displayName?: string;
  provider: string;
  linkedProviders?: Map<string, string>;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
  isActive: boolean;
  onboardingCompleted: boolean;
  profileCompleted: boolean;
  wearables?: Record<string, IWearableConnection>;
  photoURL?: string;
  emailOtp?: string;
  emailOtpExpiry?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    fullName: {
      type: String,
      trim: true,
      maxlength: [60, "Full name cannot exceed 60 characters"],
    },
    phone: {
      type: String,
      sparse: true,
      index: true,
      match: [/^\+?[\d\s\-()]+$/, "Please enter a valid phone number"],
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: [50, "Display name cannot exceed 50 characters"],
    },
    photoURL: {
      type: String,
      validate: {
        validator: function (v: string) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: "Photo URL must be a valid HTTP/HTTPS URL",
      },
    },
    provider: {
      type: String,
      required: true,
      enum: {
        values: ["password", "google.com", "apple.com"],
        message: "Provider must be password, google.com, or apple.com",
      },
    },
    linkedProviders: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    onboardingCompleted: { type: Boolean, default: false },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    wearables: {
      type: Schema.Types.Mixed,
      default: {},
    },
    emailOtp: { type: String },
    emailOtpExpiry: { type: Date },
  },
  {
    timestamps: true,
    collection: "users",
  },
);

UserSchema.index({ provider: 1 });
UserSchema.index({ isActive: 1 });

UserSchema.virtual("fullDisplayName").get(function () {
  return this.fullName || this.displayName || this.email.split("@")[0];
});

UserSchema.pre("save", function (next) {
  if (this.provider === "password") {
    this.profileCompleted = this.isEmailVerified;
  } else {
    this.profileCompleted = true;
  }
  next();
});

export const User = mongoose.model<IUser>("User", UserSchema);
