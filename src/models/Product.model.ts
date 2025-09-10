// src/models/Product.model.ts
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['cold-plunge', 'hot-tub', 'sauna'], required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Product = mongoose.model('Product', productSchema);