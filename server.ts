import express from 'express';
import cors from 'cors';
import { initializeFirebaseAdmin } from './src/utils/firebase';
import { logger, errorHandler, notFound } from './src/middleware/essential.middleware';
import { DatabaseService } from './src/utils/database';
import { Product } from './src/models/Product.model';
import authRoutes from './src/routes/auth.routes';
import healthRoutes from './src/routes/health.routes';
import productRoutes from './src/routes/product.routes';
import chatRoutes from './src/routes/chat.routes';
import ttsRoutes from './src/routes/tts.routes';
import sttRoutes from './src/routes/stt.routes';

// Initialize Firebase Admin
initializeFirebaseAdmin();

const app = express();
const port = Number(process.env.PORT) || 3000;

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:8081', 
    'http://localhost:19006',
    'http://192.168.1.76:8081',
    'http://192.168.1.76:19006',
    'exp://192.168.1.76:8081',
    'exp://192.168.1.76:19006'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

// MIDDLEWARE SETUP (Order matters!)
app.use(logger);                    // 1. Log all requests
app.use(cors(corsOptions));         // 2. Handle CORS
app.use(express.json());            // 3. Parse JSON bodies

// ROUTES
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/stt', sttRoutes);

// ERROR HANDLING (Must be at the end)
app.use(notFound);        // Handle 404s
app.use(errorHandler);    // Handle all errors

// Start server
app.listen(port, '0.0.0.0', async () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Network access: http://192.168.1.76:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Database test: http://localhost:${port}/health/database`);
  
  // Auto-seed products on server start (like Django fixtures)
  try {
    await DatabaseService.connect();
    const existingProducts = await Product.countDocuments();
    
    if (existingProducts === 0) {
      console.log('🌱 No products found, seeding default products...');
      await Product.insertMany([
        { name: 'Cold Plunge', type: 'cold-plunge' },
        { name: 'Hot Tub', type: 'hot-tub' },
        { name: 'Sauna', type: 'sauna' }
      ]);
      console.log('✅ Products seeded successfully! (3 products created)');
    } else {
      console.log(`📦 Products already exist (${existingProducts} products found)`);
    }
  } catch (error) {
    console.error('❌ Error seeding products:', error);
  }
});
