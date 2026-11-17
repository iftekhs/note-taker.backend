import { createApp } from './src/app.js';
import { startServer } from './src/server/start.js';

const app = createApp();

startServer(app).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
