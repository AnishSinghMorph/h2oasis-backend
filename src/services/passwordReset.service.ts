import crypto from "crypto";
import bcrypt from "bcrypt";
import { PasswordReset } from "../models/PasswordReset.model";
import { User } from "../models/User.model";
import { sendEmail } from "./email.service";

/**
 * Password Reset Service
 * Handles forgot password and reset password logic
 */

/**
 * Generate a 6-digit random code
 */
const generateResetCode = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Send password reset code to user's email
 */
export const sendPasswordResetCode = async (
  email: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    // 1. Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // For security, don't reveal if email exists or not
      return {
        success: true,
        message:
          "If an account exists with this email, a reset code has been sent.",
      };
    }

    // 2. Generate 6-digit code
    const code = generateResetCode();

    // 3. Set expiration (30 minutes from now)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // 4. Delete any existing codes for this email
    await PasswordReset.deleteMany({ email: email.toLowerCase() });

    // 5. Save new code
    await PasswordReset.create({
      email: email.toLowerCase(),
      code,
      expiresAt,
    });

    // 6. Send email with code
    await sendEmail({
      to: email,
      subject: "Password Reset Code - H2Oasis",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #3AAFA9 0%, #2B7A78 100%);
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              color: white;
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content {
              padding: 40px 30px;
            }
            .code-box {
              background: #f8f9fa;
              border: 2px dashed #3AAFA9;
              border-radius: 8px;
              padding: 30px;
              text-align: center;
              margin: 30px 0;
            }
            .code {
              font-size: 36px;
              font-weight: bold;
              color: #3AAFA9;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
            }
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .warning p {
              margin: 0;
              color: #856404;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px 30px;
              text-align: center;
              color: #6c757d;
              font-size: 14px;
            }
            .button {
              display: inline-block;
              background: #3AAFA9;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You requested to reset your password for your H2Oasis account. Use the code below to complete the process:</p>
              
              <div class="code-box">
                <div class="code">${code}</div>
                <p style="margin: 10px 0 0 0; color: #6c757d;">Enter this code in the app</p>
              </div>

              <p><strong>This code will expire in 30 minutes.</strong></p>

              <div class="warning">
                <p><strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
              </div>

              <p>For your security:</p>
              <ul>
                <li>Never share this code with anyone</li>
                <li>H2Oasis will never ask for your password via email</li>
                <li>This code can only be used once</li>
              </ul>

              <p>Best regards,<br><strong>The H2Oasis Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} H2Oasis. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`✅ Password reset code sent to: ${email}`);

    return {
      success: true,
      message:
        "If an account exists with this email, a reset code has been sent.",
    };
  } catch (error) {
    console.error("❌ Error sending password reset code:", error);
    throw error;
  }
};

/**
 * Verify reset code and update password
 */
export const resetPassword = async (
  email: string,
  code: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    // 1. Validate password strength
    if (newPassword.length < 8) {
      return {
        success: false,
        message: "Password must be at least 8 characters long",
      };
    }

    // 2. Find the reset code
    const resetCode = await PasswordReset.findOne({
      email: email.toLowerCase(),
      code,
    });

    if (!resetCode) {
      return {
        success: false,
        message: "Invalid or expired reset code",
      };
    }

    // 3. Check if code is expired
    if (new Date() > resetCode.expiresAt) {
      await PasswordReset.deleteOne({ _id: resetCode._id });
      return {
        success: false,
        message: "Reset code has expired. Please request a new one.",
      };
    }

    // 4. Find user
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    // 5. Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 6. Update user password
    user.password = hashedPassword;
    await user.save();

    // 7. Delete the used reset code
    await PasswordReset.deleteOne({ _id: resetCode._id });

    console.log(`✅ Password reset successful for: ${email}`);

    return {
      success: true,
      message: "Password has been reset successfully",
    };
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    throw error;
  }
};
