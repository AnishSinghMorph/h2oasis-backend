import mongoose, { Document, Schema } from 'mongoose';

// User interface for TypeScript
export interface IUser extends Document {
  firebaseUid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string; // For phone/email login option
  displayName?: string;
  photoURL?: string;
  provider: string; // 'password', 'google.com', 'apple.com'
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
  isActive: boolean;
  profileCompleted: boolean; // Track if user completed profile setup
}

// MongoDB schema definition
const UserSchema = new Schema<IUser>({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: [30, 'First name cannot exceed 30 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [30, 'Last name cannot exceed 30 characters']
  },
  phone: {
    type: String,
    sparse: true, // Allows multiple null values but unique non-null values
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters']
  },
  photoURL: {
    type: String,
    validate: {
      validator: function(v: string) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Photo URL must be a valid HTTP/HTTPS URL'
    }
  },
  provider: {
    type: String,
    required: true,
    enum: {
      values: ['password', 'google.com', 'apple.com'],
      message: 'Provider must be password, google.com, or apple.com'
    }
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  lastLoginAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profileCompleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'users'
});

// Indexes for better query performance
UserSchema.index({ firebaseUid: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ phone: 1 }, { sparse: true });
UserSchema.index({ provider: 1 });
UserSchema.index({ isActive: 1 });

// Virtual for full name display
UserSchema.virtual('fullDisplayName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.displayName || this.email.split('@')[0];
});

// Pre-save middleware to set profileCompleted status
UserSchema.pre('save', function(next) {
  if (this.provider === 'password') {
    // For email/password users, profile is complete when email is verified
    this.profileCompleted = this.isEmailVerified;
  } else {
    // For social logins, profile is usually complete on creation
    this.profileCompleted = true;
  }
  next();
});

export const User = mongoose.model<IUser>('User', UserSchema);
