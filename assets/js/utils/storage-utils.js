/**
 * Storage Utilities
 * Helper functions for localStorage operations and data validation
 */
class StorageUtils {
    /**
     * Safely get item from localStorage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} Parsed value or default
     */
    static getItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Failed to parse localStorage item "${key}":`, error);
            return defaultValue;
        }
    }

    /**
     * Safely set item to localStorage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {boolean} Success status
     */
    static setItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Failed to save to localStorage "${key}":`, error);
            
            if (error.name === 'QuotaExceededError') {
                notificationManager.error('Storage quota exceeded! Please export your data.');
            }
            
            return false;
        }
    }

    /**
     * Safely remove item from localStorage
     * @param {string} key - Storage key
     * @returns {boolean} Success status
     */
    static removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Failed to remove from localStorage "${key}":`, error);
            return false;
        }
    }

    /**
     * Check if localStorage is available
     * @returns {boolean} Availability status
     */
    static isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get localStorage usage information
     * @returns {Object} Usage statistics
     */
    static getUsageInfo() {
        if (!this.isAvailable()) {
            return { available: false };
        }

        try {
            let totalSize = 0;
            let itemCount = 0;
            const items = {};

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                const size = new Blob([value]).size;
                
                totalSize += size;
                itemCount++;
                
                if (key.startsWith('NoteHub_')) {
                    items[key] = size;
                }
            }

            return {
                available: true,
                totalSize,
                itemCount,
                noteHubSize: Object.values(items).reduce((sum, size) => sum + size, 0),
                items
            };
        } catch (error) {
            console.error('Failed to get storage usage info:', error);
            return { available: true, error: error.message };
        }
    }

    /**
     * Clear all NoteHub data from localStorage
     * @returns {boolean} Success status
     */
    static clearNoteHubData() {
        try {
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('NoteHub_')) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
            });

            console.log(`Cleared ${keysToRemove.length} NoteHub items from localStorage`);
            return true;
        } catch (error) {
            console.error('Failed to clear NoteHub data:', error);
            return false;
        }
    }

    /**
     * Validate note data structure using ValidationManager
     * @param {Object} note - Note object to validate
     * @returns {Object} Validation result
     */
    static validateNote(note) {
        return ValidationManager.validateNote(note);
    }

    /**
     * Validate data structure (collection of tabs) using ValidationManager
     * @param {Object} data - Data object to validate
     * @returns {Object} Validation result
     */
    static validateData(data) {
        return ValidationManager.validateNotesCollection(data);
    }

    /**
     * Sanitize note data for storage using ValidationManager
     * @param {Object} note - Note to sanitize
     * @returns {Object} Sanitized note
     */
    static sanitizeNote(note) {
        return ValidationManager.sanitizeNote(note);
    }

    /**
     * Generate a backup of all NoteHub data
     * @returns {Object} Backup data
     */
    static generateBackup() {
        const backup = {
            timestamp: new Date().toISOString(),
            version: '2.0',
            data: {}
        };

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('NoteHub_')) {
                    backup.data[key] = localStorage.getItem(key);
                }
            }

            backup.usage = this.getUsageInfo();
            return backup;
        } catch (error) {
            console.error('Failed to generate backup:', error);
            backup.error = error.message;
            return backup;
        }
    }

    /**
     * Restore from backup
     * @param {Object} backup - Backup data
     * @returns {boolean} Success status
     */
    static restoreFromBackup(backup) {
        if (!backup || !backup.data) {
            console.error('Invalid backup data');
            return false;
        }

        try {
            // Clear existing NoteHub data
            this.clearNoteHubData();

            // Restore from backup
            Object.entries(backup.data).forEach(([key, value]) => {
                if (key.startsWith('NoteHub_')) {
                    localStorage.setItem(key, value);
                }
            });

            console.log('Successfully restored from backup');
            return true;
        } catch (error) {
            console.error('Failed to restore from backup:', error);
            return false;
        }
    }

    /**
     * Compress data for storage (simple string compression)
     * @param {string} data - Data to compress
     * @returns {string} Compressed data
     */
    static compress(data) {
        // Simple LZ-string style compression for repeated patterns
        try {
            const patterns = {};
            let compressed = data;
            let patternId = 0;

            // Find common patterns (3+ characters, appearing 2+ times)
            const minLength = 3;
            const minOccurrences = 2;

            for (let length = minLength; length <= 20; length++) {
                for (let i = 0; i <= data.length - length; i++) {
                    const pattern = data.substr(i, length);
                    const occurrences = (data.match(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                    
                    if (occurrences >= minOccurrences && !patterns[pattern]) {
                        patterns[pattern] = `§${patternId++}§`;
                    }
                }
            }

            // Replace patterns with placeholders
            Object.entries(patterns).forEach(([pattern, placeholder]) => {
                compressed = compressed.split(pattern).join(placeholder);
            });

            // Add pattern dictionary
            const dict = Object.entries(patterns).map(([pattern, placeholder]) => 
                `${placeholder}:${pattern}`
            ).join('|');

            return dict ? `COMPRESSED:${dict}:${compressed}` : data;
        } catch (error) {
            console.warn('Compression failed, using original data:', error);
            return data;
        }
    }

    /**
     * Decompress data from storage
     * @param {string} data - Compressed data
     * @returns {string} Decompressed data
     */
    static decompress(data) {
        if (!data.startsWith('COMPRESSED:')) {
            return data;
        }

        try {
            const parts = data.split(':');
            const dict = parts[1];
            const compressed = parts.slice(2).join(':');

            if (!dict) return compressed;

            let decompressed = compressed;
            const patterns = dict.split('|');

            patterns.forEach(patternDef => {
                const [placeholder, pattern] = patternDef.split(':');
                decompressed = decompressed.split(placeholder).join(pattern);
            });

            return decompressed;
        } catch (error) {
            console.warn('Decompression failed, using compressed data:', error);
            return data;
        }
    }
}

// Export for global use
window.StorageUtils = StorageUtils;