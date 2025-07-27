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
     * Load environment configuration from injected environment variables
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
     * @returns {Object} Configuration object
     */
    loadFromEnvironmentVariables() {
        // First try to get from injected environment variables (build-time)
        if (typeof window !== 'undefined' && window.__ENV__) {
            console.log('Using injected environment variables');
            return window.__ENV__;
        }

        // Fallback to checking other sources (though these won't work in static sites)
        const getEnvVar = (key) => {
            const envSources = [
                key,
                `NEXT_PUBLIC_${key}`,
                `VITE_${key}`,
                `REACT_APP_${key}`
            ];

            for (const envKey of envSources) {
                if (typeof process !== 'undefined' && process.env && process.env[envKey]) {
                    return process.env[envKey];
                }
                
                if (typeof window !== 'undefined' && window.process && window.process.env && window.process.env[envKey]) {
                    return window.process.env[envKey];
                }
            }

            return '';
        };

        console.log('Using fallback environment variable loading');
        return {
            FIREBASE_API_KEY: getEnvVar('FIREBASE_API_KEY'),
            FIREBASE_AUTH_DOMAIN: getEnvVar('FIREBASE_AUTH_DOMAIN'),
            FIREBASE_PROJECT_ID: getEnvVar('FIREBASE_PROJECT_ID'),
            FIREBASE_STORAGE_BUCKET: getEnvVar('FIREBASE_STORAGE_BUCKET'),
            FIREBASE_MESSAGING_SENDER_ID: getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
            FIREBASE_APP_ID: getEnvVar('FIREBASE_APP_ID'),
            ENABLE_FIREBASE: getEnvVar('ENABLE_FIREBASE') || 'false',
            DEFAULT_STORAGE_TYPE: getEnvVar('DEFAULT_STORAGE_TYPE') || 'local'
        };
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