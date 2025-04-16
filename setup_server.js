import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create videos directory if it doesn't exist
const videosDir = path.join(__dirname, 'videos');

if (!fs.existsSync(videosDir)) {
  console.log('Creating videos directory...');
  fs.mkdirSync(videosDir, { recursive: true });
  console.log('Videos directory created successfully!');
} else {
  console.log('Videos directory already exists.');
}

console.log('Setup complete. You can now run the application using:');
console.log('- npm run dev (frontend only)');
console.log('- uvicorn main:app --reload (backend only)');
console.log('- node server.js (both frontend and backend)'); 