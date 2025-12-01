import { sendEmail } from "./email.service";

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getOTPEmailTemplate = (otp: string, userName: string): string => {
  return `
     <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .otp-code { font-size: 32px; font-weight: bold; color: #00A3C7; letter-spacing: 8px; text-align: center; padding: 20px; background: #f0f9fb; border-radius: 8px; margin: 20px 0; }
        .footer { color: #888; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to H2Oasis!</h1>
        <p>Hi ${userName},</p>
        <p>Your verification code is:</p>
        <div class="otp-code">${otp}</div>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <div class="footer">
          <p>© 2025 H2Oasis. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
};

export const sendOTPEmail = async (
  email: string,
  otp: string,
  userName: string = "there",
): Promise<void> => {
  const html = getOTPEmailTemplate(otp, userName);

  await sendEmail({
    to: email,
    subject: "Your H2Oasis Verification Code",
    html: html,
  });
};
