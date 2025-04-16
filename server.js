import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create videos directory if it doesn't exist
const videosDir = path.join(__dirname, 'videos');
if (!fs.existsSync(videosDir)) {
  console.log('Creating videos directory...');
  fs.mkdirSync(videosDir, { recursive: true });
  console.log('Videos directory created.');
}

// Start the frontend
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true
});

// Start the backend
const backend = spawn('uvicorn', ['main:app', '--reload'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down servers...');
  frontend.kill();
  backend.kill();
  process.exit(0);
});

console.log('Servers started! Access:');
console.log('- Frontend: http://localhost:5173');
console.log('- Backend: http://localhost:8000');

frontend.on('close', code => {
  console.log(`Frontend process exited with code ${code}`);
  backend.kill();
  process.exit(code);
});

backend.on('close', code => {
  console.log(`Backend process exited with code ${code}`);
  frontend.kill();
  process.exit(code);
}); 