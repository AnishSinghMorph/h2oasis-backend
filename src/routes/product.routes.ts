import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { verifyFirebaseToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/essential.middleware';

const router = Router();

router.get('/', asyncHandler(ProductController.getAllProducts));
router.post('/seed', asyncHandler(ProductController.seedProducts));
router.post('/select', verifyFirebaseToken, asyncHandler(ProductController.selectProduct));

export default router;