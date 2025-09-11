import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { verifyFirebaseToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/essential.middleware';

const router = Router();

router.get('/', asyncHandler(ProductController.getAllProducts));
router.get('/my-selection', verifyFirebaseToken, asyncHandler(ProductController.getUserSelection));
router.post('/select', verifyFirebaseToken, asyncHandler(ProductController.selectProduct));
router.delete('/unselect', verifyFirebaseToken, asyncHandler(ProductController.unselectProduct));

export default router;