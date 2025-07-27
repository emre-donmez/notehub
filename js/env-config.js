/**
 * Environment Configuration Loader
 * Optimized for Vercel deployment with environment variables
 */
class EnvironmentConfig {
    constructor() {
        this.config = {};
        this.isLoaded = false;
    }

    /**
     * Load environment configuration from Vercel environment variables
     * @returns {Promise<Object>} Configuration object
     */
    async loadConfig() {
        if (this.isLoaded) {
            return this.config;
        }

        this.config = this.loadFromEnvironmentVariables();
        this.isLoaded = true;
        
        console.log('Environment config loaded:', {
            hasFirebaseConfig: !!this.config.FIREBASE_API_KEY,
            firebaseEnabled: this.config.ENABLE_FIREBASE,
            storageType: this.config.DEFAULT_STORAGE_TYPE
        });
        
        return this.config;
    }

    /**
     * Load configuration from environment variables
     * Works with Vercel's build-time environment variables
     * @returns {Object} Configuration object
     */
    loadFromEnvironmentVariables() {
        // Try to get environment variables from different sources
        const getEnvVar = (key) => {
            // Check for Vercel environment variables with different prefixes
            const envSources = [
                key,
                `NEXT_PUBLIC_${key}`,
                `VITE_${key}`,
                `REACT_APP_${key}`
            ];

            for (const envKey of envSources) {
                // Check process.env if available (Node.js environment)
                if (typeof process !== 'undefined' && process.env && process.env[envKey]) {
                    return process.env[envKey];
                }
                
                // Check global environment object if available
                if (typeof window !== 'undefined' && window.process && window.process.env && window.process.env[envKey]) {
                    return window.process.env[envKey];
                }
            }

            return '';
        };

        const config = {
            FIREBASE_API_KEY: getEnvVar('FIREBASE_API_KEY'),
            FIREBASE_AUTH_DOMAIN: getEnvVar('FIREBASE_AUTH_DOMAIN'),
            FIREBASE_PROJECT_ID: getEnvVar('FIREBASE_PROJECT_ID'),
            FIREBASE_STORAGE_BUCKET: getEnvVar('FIREBASE_STORAGE_BUCKET'),
            FIREBASE_MESSAGING_SENDER_ID: getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
            FIREBASE_APP_ID: getEnvVar('FIREBASE_APP_ID'),
            ENABLE_FIREBASE: getEnvVar('ENABLE_FIREBASE') || 'false',
            DEFAULT_STORAGE_TYPE: getEnvVar('DEFAULT_STORAGE_TYPE') || 'local'
        };

        return config;
    }

    /**
     * Get a specific configuration value
     * @param {string} key - Configuration key
     * @param {string} defaultValue - Default value if key not found
     * @returns {string} Configuration value
     */
    get(key, defaultValue = '') {
        return this.config[key] || defaultValue;
    }

    /**
     * Check if Firebase is enabled
     * @returns {boolean} True if Firebase is enabled
     */
    isFirebaseEnabled() {
        return this.get('ENABLE_FIREBASE').toLowerCase() === 'true';
    }
}

// Export singleton instance
const envConfig = new EnvironmentConfig();