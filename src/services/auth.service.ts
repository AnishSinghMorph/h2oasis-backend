import { User, IUser } from "../models/User.model";
import { admin } from "../utils/firebase";

export interface CreateUserData {
  firebaseUid: string;
  email: string;
  fullName?: string;
  phone?: string;
  displayName?: string;
  photoURL?: string;
  provider: string;
}

/**
 * Authentication service layer
 * Handles user creation, updates, and Firebase integration
 */
export class AuthService {
  /**
   * Create or update user in MongoDB after Firebase authentication
   * This syncs Firebase Auth users with our application database
   */
  static async createOrUpdateUser(userData: CreateUserData): Promise<IUser> {
    try {
      const user = await User.findOneAndUpdate(
        { firebaseUid: userData.firebaseUid },
        {
          ...userData,
          lastLoginAt: new Date(),
          isActive: true,
          // Set verification status based on provider
          isEmailVerified: userData.provider !== "password",
          isPhoneVerified: false,
          // Profile completion logic
          profileCompleted: userData.provider !== "password",
        },
        {
          upsert: true, // Create if doesn't exist
          new: true, // Return updated document
          runValidators: true,
        },
      );

      return user;
    } catch (error) {
      console.error("Error creating/updating user:", error);
      throw new Error("Failed to create or update user");
    }
  }

  /**
   * Get user by Firebase UID
   * Used for profile retrieval and user verification
   */
  static async getUserByFirebaseUid(
    firebaseUid: string,
  ): Promise<IUser | null> {
    try {
      return await User.findOne({ firebaseUid, isActive: true });
    } catch (error) {
      console.error("Error fetching user:", error);
      throw new Error("Failed to fetch user");
    }
  }

  /**
   * Update user profile information
   */
  static async updateUserProfile(
    firebaseUid: string,
    updateData: Partial<IUser>,
  ): Promise<IUser | null> {
    try {
      const user = await User.findOneAndUpdate(
        { firebaseUid, isActive: true },
        {
          ...updateData,
          updatedAt: new Date(),
        },
        {
          new: true,
          runValidators: true,
        },
      );

      return user;
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw new Error("Failed to update user profile");
    }
  }

  /**
   * Disable user account (soft delete)
   * Maintains data integrity while preventing access
   */
  static async deactivateUser(firebaseUid: string): Promise<void> {
    try {
      await User.findOneAndUpdate({ firebaseUid }, { isActive: false });

      // Also disable in Firebase Auth
      await admin.auth().updateUser(firebaseUid, { disabled: true });
    } catch (error) {
      console.error("Error deactivating user:", error);
      throw new Error("Failed to deactivate user");
    }
  }

  /**
   * Mark email as verified
   */
  static async markEmailVerified(firebaseUid: string): Promise<void> {
    try {
      await User.findOneAndUpdate(
        { firebaseUid },
        {
          isEmailVerified: true,
          profileCompleted: true,
        },
      );
    } catch (error) {
      console.error("Error marking email as verified:", error);
      throw new Error("Failed to mark email as verified");
    }
  }
}
