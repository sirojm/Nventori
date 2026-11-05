import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './db/database.js';

import authRoutes from './routes/auth.js';
import inventoryRoutes from './routes/inventory.js';
import contactRoutes from './routes/contacts.js';
import transactionRoutes from './routes/transactions.js';
import activityRoutes from './routes/activities.js';
import qrRoutes from './routes/qr.js';
import reportRoutes from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Initialize SQLite DB
initDatabase();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Nventori API', version: '1.5.0', timestamp: new Date().toISOString() });
});

// Serve frontend in production build if dist folder exists
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('Nventori API Server is active on port ' + PORT + '. Run Vite client in dev mode (port 5173).');
    }
  });
});

app.listen(PORT, () => {
  console.log(`[Nventori] Server berjalan di http://localhost:${PORT}`);
  console.log(`[Nventori] API Health check: http://localhost:${PORT}/api/health`);
});
