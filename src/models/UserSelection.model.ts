import mongoose from "mongoose";

const userSelectionSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Firebase UID
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  selectedAt: { type: Date, default: Date.now },
});

userSelectionSchema.index({ userId: 1 }, { unique: true });

export const UserSelection = mongoose.model(
  "UserSelection",
  userSelectionSchema,
);
