import { Router } from "express";
import { ProductController } from "../controllers/product.controller";
import { verifyFirebaseToken } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/essential.middleware";

const router = Router();

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     description: Retrieve list of all H2Oasis products (Cold Plunge, Hot Tub, Sauna)
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                         example: Cold Plunge
 *                       type:
 *                         type: string
 *                         example: cold-plunge
 */
router.get("/", asyncHandler(ProductController.getAllProducts));

/**
 * @swagger
 * /api/products/my-selection:
 *   get:
 *     summary: Get user's selected product
 *     description: Retrieve the product currently selected by the authenticated user
 *     tags: [Products]
 *     security:
 *       - FirebaseAuth: []
 *     responses:
 *       200:
 *         description: User selection retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/my-selection",
  verifyFirebaseToken,
  asyncHandler(ProductController.getUserSelection),
);

/**
 * @swagger
 * /api/products/select:
 *   post:
 *     summary: Select a product
 *     description: Set the user's selected product (Cold Plunge, Hot Tub, or Sauna)
 *     tags: [Products]
 *     security:
 *       - FirebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *             properties:
 *               productId:
 *                 type: string
 *                 description: MongoDB ObjectId of the product
 *                 example: 68ca84b497a2fdc903b5dc84
 *     responses:
 *       200:
 *         description: Product selected successfully
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/select",
  verifyFirebaseToken,
  asyncHandler(ProductController.selectProduct),
);

/**
 * @swagger
 * /api/products/unselect:
 *   delete:
 *     summary: Unselect product
 *     description: Remove the user's current product selection
 *     tags: [Products]
 *     security:
 *       - FirebaseAuth: []
 *     responses:
 *       200:
 *         description: Product unselected successfully
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/unselect",
  verifyFirebaseToken,
  asyncHandler(ProductController.unselectProduct),
);

export default router;
