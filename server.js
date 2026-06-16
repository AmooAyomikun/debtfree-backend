import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './src/middleware/errorHandler.js';
import { PORT, FRONTEND_URL, NODE_ENV } from './src/config/constants.js';
import paymentsRouter from './src/routes/paymentRoutes.js';
import scannerRouter from './src/routes/scannerRoutes.js';
import notificationsRouter from './src/routes/notificationRoutes.js';
import userRouter from './src/routes/userRoutes.js';
import groupRouter from './src/routes/groupRoutes.js';
import kycRouter from './src/routes/kycRoutes.js';
import creditRouter from './src/routes/creditRoutes.js';
import authRouter from './src/routes/authRoutes.js';
import emailRouter from './src/routes/emailRoutes.js';

const app = express();

// Trust proxy for Render reverse proxy (fixes rate-limiting client IP identification)
app.set('trust proxy', 1);

// Webhook route needs raw body BEFORE express.json()
// We will add this when payment routes are registered
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Standard middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Security
app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:4173',
    ].filter(Boolean);
    
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowed => 
      origin === allowed || origin.endsWith('.vercel.app')
    )) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging (only in development)
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'DebtFree API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    services: {
      supabase: !!process.env.SUPABASE_URL,
      paystack: !!process.env.PAYSTACK_SECRET_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      firebase: !!process.env.FIREBASE_PROJECT_ID
    }
  });
});

// Routes
app.use('/api/payments', paymentsRouter);
app.use('/api/scanner', scannerRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/users', userRouter);
app.use('/api/groups', groupRouter);
app.use('/api/kyc', kycRouter);
app.use('/api/credit', creditRouter);
app.use('/api/auth', authRouter);
app.use('/api/email', emailRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 DebtFree API is running!');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log('');
});

export default app;
// Force nodemon restart to pick up column fixes

