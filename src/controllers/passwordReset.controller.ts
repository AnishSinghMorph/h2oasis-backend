import { Request, Response } from "express";
import {
  sendPasswordResetCode,
  resetPassword,
} from "../services/passwordReset.service";

/**
 * Send password reset code to email
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      res.status(400).json({
        success: false,
        message: "Email is required",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
      return;
    }

    console.log(`📧 Password reset requested for: ${email}`);

    // Send reset code
    const result = await sendPasswordResetCode(email);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("❌ Error in forgotPassword controller:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};

/**
 * Reset password with code
 * POST /api/auth/reset-password
 */
export const resetPasswordWithCode = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, code, newPassword } = req.body;

    // Validate inputs
    if (!email || !code || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Email, code, and new password are required",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
      return;
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({
        success: false,
        message: "Invalid code format. Code must be 6 digits.",
      });
      return;
    }

    console.log(`🔐 Password reset attempt for: ${email}`);

    // Reset password
    const result = await resetPassword(email, code, newPassword);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("❌ Error in resetPasswordWithCode controller:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }
};
