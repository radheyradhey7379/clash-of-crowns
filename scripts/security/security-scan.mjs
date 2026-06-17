import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// We only want to scan src, firestore rules, and .env files (excluding .env.example)
const TARGET_DIRS = ['src', 'firebase'];
const TARGET_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.rules', '.json', '.env', '.env.local'];
const IGNORE_FILES = ['security-scan.mjs', 'firebase-applet-config.json', '.env.example'];

let hasCriticalErrors = false;
let warnings = 0;

function shouldScanFile(filePath) {
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath);
  
  if (IGNORE_FILES.includes(baseName)) return false;
  if (filePath.includes('.md')) return false; // Ignore docs
  if (filePath.includes('node_modules')) return false;
  if (filePath.includes('dist')) return false;
  
  if (baseName === '.env' || baseName === '.env.local') return true;
  return TARGET_EXTS.includes(ext);
}

function scanDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('dist')) {
        scanDirectory(fullPath);
      }
    } else {
      if (shouldScanFile(fullPath)) {
        scanFile(fullPath);
      }
    }
  }
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative(rootDir, filePath);
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for critical secrets
    if (line.includes('AIzaSy')) {
      if (!line.includes('YOUR_API_KEY')) {
        console.error(`❌ CRITICAL: Possible Firebase API Key (AIzaSy) leaked in ${relativePath}:${lineNum}`);
        hasCriticalErrors = true;
      }
    }
    
    if (line.includes('sk_live_')) {
      console.error(`❌ CRITICAL: Stripe Live Secret Key leaked in ${relativePath}:${lineNum}`);
      hasCriticalErrors = true;
    }
    
    if (line.includes('BEGIN PRIVATE KEY')) {
      console.error(`❌ CRITICAL: Private Key block leaked in ${relativePath}:${lineNum}`);
      hasCriticalErrors = true;
    }

    if (relativePath.startsWith('src') && line.includes('STRIPE_SECRET_KEY')) {
      console.error(`❌ CRITICAL: STRIPE_SECRET_KEY referenced in frontend code ${relativePath}:${lineNum}`);
      hasCriticalErrors = true;
    }

    if (relativePath.startsWith('src') && line.includes('FIREBASE_SERVICE_ACCOUNT')) {
      console.error(`❌ CRITICAL: FIREBASE_SERVICE_ACCOUNT referenced in frontend code ${relativePath}:${lineNum}`);
      hasCriticalErrors = true;
    }

    // Check for hardcoded encryption salt
    if (line.includes("'crowns-salt'") || line.includes('"crowns-salt"')) {
      console.error(`❌ CRITICAL: Hardcoded encryption salt found in ${relativePath}:${lineNum}`);
      hasCriticalErrors = true;
    }

    // Check for production debug logs
    // Look for setLogLevel without DEV check. Hard to do static analysis, but we can flag it.
    if (line.includes("setLogLevel('debug')") || line.includes('setLogLevel("debug")')) {
      // If it's on a line that also has DEV or is inside firebase.ts, we give a warning.
      console.warn(`⚠️ WARNING: setLogLevel('debug') found in ${relativePath}:${lineNum}. Ensure it is guarded by import.meta.env.DEV`);
      warnings++;
    }

    // Check for PII leaks in console logs
    if (line.includes('console.log(auth.currentUser') || line.includes('console.error(auth.currentUser')) {
      console.error(`❌ CRITICAL: Full currentUser object logged in ${relativePath}:${lineNum}`);
      hasCriticalErrors = true;
    }
    
    // Strict providerData check, if trying to log it
    if (line.includes('providerData') && line.includes('console.')) {
      console.error(`❌ CRITICAL: PII providerData logged in ${relativePath}:${lineNum}`);
      hasCriticalErrors = true;
    }

    // Localhost in production config checks
    // We only warn here because it might be valid for dev environments, but flag it
    // Wait, the prompt says "Add localhost production URL checks", "Fail only on real-looking secrets".
    // "Fail only on real-looking secrets" implies localhost is a warning or error if strictly checking prod. Let's make it a warning unless it's in a known prod file.
    if ((line.includes('ws://localhost') || line.includes('localhost:3001') || line.includes('http://localhost')) && !line.includes('env.DEV') && !line.includes('import.meta')) {
       console.warn(`⚠️ WARNING: Hardcoded localhost URL found in ${relativePath}:${lineNum}.`);
       warnings++;
    }
  });
}

console.log('🔍 Starting Security Scan...');

// Scan root .env files
['.env', '.env.local'].forEach(envFile => {
  const fullPath = path.join(rootDir, envFile);
  if (fs.existsSync(fullPath)) {
    scanFile(fullPath);
  }
});

// Scan directories
TARGET_DIRS.forEach(dir => {
  const fullPath = path.join(rootDir, dir);
  if (fs.existsSync(fullPath)) {
    scanDirectory(fullPath);
  }
});

console.log('✅ Scan Complete.');
console.log(`Warnings: ${warnings}`);

if (hasCriticalErrors) {
  console.error('\n🚨 Security scan failed! Critical leaks found. Do not release.');
  process.exit(1);
} else {
  console.log('\n🔒 No critical security leaks found.');
  process.exit(0);
}
