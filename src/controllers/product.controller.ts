import { Request, Response } from 'express';
import { DatabaseService } from '../utils/database';
import { Product } from '../models/Product.model';
import { UserSelection } from '../models/UserSelection.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class ProductController {
  
  static async getAllProducts(req: Request, res: Response): Promise<void> {
    await DatabaseService.connect();
    const products = await Product.find({ isActive: true });
    res.json({ success: true, products });
  }

  // 🆕 Get user's current selection
  static async getUserSelection(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.uid;

    await DatabaseService.connect();
    
    const selection = await UserSelection.findOne({ userId }).populate('productId');
    
    if (!selection) {
      res.json({ success: true, selection: null });
      return;
    }

    res.json({ success: true, selection });
  }

  static async selectProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { productId } = req.body;
    const userId = req.user!.uid;

    await DatabaseService.connect();
    
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    const selection = await UserSelection.findOneAndUpdate(
      { userId },
      { userId, productId, selectedAt: new Date() },
      { upsert: true, new: true }
    ).populate('productId');

    res.json({ success: true, selection });
  }

  // 🆕 Allow user to unselect/deselect their current choice
  static async unselectProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.uid;

    await DatabaseService.connect();
    
    const result = await UserSelection.findOneAndDelete({ userId });
    
    if (!result) {
      res.status(404).json({ success: false, message: 'No selection found to remove' });
      return;
    }

    res.json({ success: true, message: 'Product unselected successfully' });
  }
}
