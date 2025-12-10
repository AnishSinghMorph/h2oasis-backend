import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { User } from "../models/User.model";
import { PRODUCT_TYPES, FOCUS_GOAL_KEYS } from "../constants";

// ============================================
// HELPER FUNCTIONS
// ============================================
const sendError = (res: Response, status: number, message: string) => {
  res.status(status).json({ success: false, message });
};

const sendSuccess = (res: Response, message: string, data?: Record<string, any>) => {
  res.status(200).json({ success: true, message, ...data });
};

// ============================================
// CONTROLLER
// ============================================
export class OnboardingController {
  /**
   * Save selected product to user profile
   */
  static selectProduct = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { type, name } = req.body;

      if (!type || !PRODUCT_TYPES.includes(type)) {
        sendError(res, 400, `Invalid product type. Must be: ${PRODUCT_TYPES.join(", ")}`);
        return;
      }

      const user = await User.findOneAndUpdate(
        { firebaseUid: req.user!.uid },
        {
          selectedProduct: {
            type,
            name: name || type,
            selectedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!user) {
        sendError(res, 404, "User not found");
        return;
      }

      sendSuccess(res, "Product selected successfully", {
        selectedProduct: user.selectedProduct,
      });
    } catch (error) {
      console.error("Error selecting product:", error);
      sendError(res, 500, "Failed to select product");
    }
  };

  /**
   * Save selected focus goal to user profile
   */
  static selectFocusGoal = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { key, label, customText } = req.body;

      if (!key || !FOCUS_GOAL_KEYS.includes(key)) {
        sendError(res, 400, `Invalid focus goal. Must be: ${FOCUS_GOAL_KEYS.join(", ")}`);
        return;
      }

      const user = await User.findOneAndUpdate(
        { firebaseUid: req.user!.uid },
        {
          focusGoal: {
            key,
            label: label || key,
            customText: key === "other" ? customText : null,
            selectedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!user) {
        sendError(res, 404, "User not found");
        return;
      }

      sendSuccess(res, "Focus goal selected successfully", {
        focusGoal: user.focusGoal,
      });
    } catch (error) {
      console.error("Error selecting focus goal:", error);
      sendError(res, 500, "Failed to select focus goal");
    }
  };
}
