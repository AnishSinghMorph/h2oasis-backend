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
      const user = await User.findOne({
        email: userData.email.toLowerCase(),
        isActive: true
      });

      if (user) {
        console.log(`Linking ${userData.provider} to existing account: ${userData.email}`);

        // Remove .com/.net/etc from provider for Map key (Mongoose doesn't support dots)
        const providerKey = userData.provider.split('.')[0]; // "google.com" → "google"

        if (!user.linkedProviders) {
          user.linkedProviders = new Map();
        }

        user.linkedProviders.set(providerKey, userData.firebaseUid);
        user.markModified('linkedProviders'); // ← Tell Mongoose the Map changed
        user.lastLoginAt = new Date();

        if (userData.provider !== "password") {
          user.isEmailVerified = true;
        }

        if (!user.fullName && userData.fullName) {
          user.fullName = userData.fullName
        }

        if (!user.displayName && userData.displayName) {
          user.displayName = userData.displayName
        }
        if (!user.photoURL && userData.photoURL) {
          user.photoURL = userData.photoURL;
        }

        await user.save();
        return user;
      }


   console.log(`creating new account for: ${userData.email}`);

   // Remove .com/.net/etc from provider for Map key (Mongoose doesn't support dots)
   const providerKey = userData.provider.split('.')[0]; // "google.com" → "google"

   const newUser = await User.create({
    firebaseUid: userData.firebaseUid,
    email: userData.email.toLowerCase(),
    fullName: userData.fullName,
    displayName: userData.displayName,
    photoURL: userData.photoURL,
    provider: userData.provider,
    linkedProviders: new Map([[providerKey, userData.firebaseUid]]),
    lastLoginAt: new Date(),
    isActive: true,
    isEmailVerified: userData.provider !== 'password',
    isPhoneVerified: false,
    profileCompleted: userData.provider !== 'password'
   });
   return newUser;
  } catch (error) {
    console.log("error creating/updating user:", error);
    throw new Error("failed to creaate or update user");
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
