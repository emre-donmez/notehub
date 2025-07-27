/**
 * Build script to inject environment variables into JavaScript
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

// Create environment variables object to inject
const envJS = `// Auto-generated environment configuration
window.__ENV__ = ${JSON.stringify(env, null, 2)};
`;

// Write to a file that will be loaded before other scripts
fs.writeFileSync(path.join(__dirname, 'env.js'), envJS);

console.log('Environment variables injected successfully');