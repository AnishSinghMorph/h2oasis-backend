import mongoose, { Document, Schema } from "mongoose";

/**
 * Password Reset Code Interface
 * Stores temporary codes for password reset flow
 */
export interface IPasswordReset extends Document {
  email: string;
  code: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Password Reset Schema
 * TTL index automatically deletes expired codes
 */
const PasswordResetSchema = new Schema<IPasswordReset>({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true, // Index for faster lookups
  },
  code: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    // Note: TTL index is created separately below
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// TTL Index: MongoDB automatically deletes documents when expiresAt is reached
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index to find codes by email quickly
PasswordResetSchema.index({ email: 1, code: 1 });

export const PasswordReset = mongoose.model<IPasswordReset>(
  "PasswordReset",
  PasswordResetSchema,
);
