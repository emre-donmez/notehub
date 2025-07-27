/**
 * Build script to inject environment variables and create public directory
 * This runs during Vercel build process
 */
const fs = require('fs');
const path = require('path');

// Get environment variables
const env = {
    FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    ENABLE_FIREBASE: process.env.NEXT_PUBLIC_ENABLE_FIREBASE || 'false',
    DEFAULT_STORAGE_TYPE: process.env.NEXT_PUBLIC_DEFAULT_STORAGE_TYPE || 'local'
};

console.log('Building with environment variables:', {
    hasFirebaseConfig: !!env.FIREBASE_API_KEY,
    firebaseEnabled: env.ENABLE_FIREBASE,
    storageType: env.DEFAULT_STORAGE_TYPE
});

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

// Create environment variables object to inject
const envJS = `// Auto-generated environment configuration
window.__ENV__ = ${JSON.stringify(env, null, 2)};
`;

// Function to copy file
function copyFile(src, dest) {
    try {
        fs.copyFileSync(src, dest);
        console.log(`Copied: ${src} -> ${dest}`);
    } catch (error) {
        console.error(`Failed to copy ${src}:`, error.message);
    }
}

// Function to copy directory recursively
function copyDir(src, dest) {
    try {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const entries = fs.readdirSync(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                copyDir(srcPath, destPath);
            } else {
                copyFile(srcPath, destPath);
            }
        }
    } catch (error) {
        console.error(`Failed to copy directory ${src}:`, error.message);
    }
}

// Copy all necessary files to public directory
console.log('Copying files to public directory...');

// Copy main files
const filesToCopy = [
    'index.html',
    'styles.css',
    'vercel.json'
];

filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
        copyFile(file, path.join(publicDir, file));
    }
});

// Copy directories
const dirsToCopy = [
    'js',
    'icons'
];

dirsToCopy.forEach(dir => {
    if (fs.existsSync(dir)) {
        copyDir(dir, path.join(publicDir, dir));
    }
});

// Write environment variables to public directory
fs.writeFileSync(path.join(publicDir, 'env.js'), envJS);
console.log('Environment variables injected to public/env.js');

console.log('Build completed successfully - public directory created');