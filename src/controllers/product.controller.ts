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

  static async seedProducts(req: Request, res: Response): Promise<void> {
    await DatabaseService.connect();

    const existingProducts = await Product.countDocuments();
    if (existingProducts > 0) {
      res.json({ success: true, message: 'Products already exist' });
      return;
    }

    const products = await Product.insertMany([
      { name: 'Cold Plunge', type: 'cold-plunge', image: 'cold-plunge-icon.png' },
      { name: 'Hot Tub', type: 'hot-tub', image: 'hot-tub-icon.png' },
      { name: 'Sauna', type: 'sauna', image: 'sauna-icon.png' }
    ]);

    res.json({ success: true, products });
  }
}
