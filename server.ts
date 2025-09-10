import express from 'express';
import cors from 'cors';
import { initializeFirebaseAdmin } from './src/utils/firebase';
import { logger, errorHandler, notFound } from './src/middleware/essential.middleware';
import authRoutes from './src/routes/auth.routes';
import healthRoutes from './src/routes/health.routes';
import productRoutes from './src/routes/product.routes';

// Initialize Firebase Admin
initializeFirebaseAdmin();

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:8081', 
    'http://localhost:19006',
    'http://192.168.1.55:8081',
    'exp://192.168.1.55:8081'
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

// ERROR HANDLING (Must be at the end)
app.use(notFound);        // Handle 404s
app.use(errorHandler);    // Handle all errors

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Database test: http://localhost:${port}/health/database`);
});
