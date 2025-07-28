/**
 * Data Validation Manager
 * Centralized validation for notes, settings, and import/export data
 */
class ValidationManager {
    /**
     * Validate note data structure
     * @param {Object} note - Note object to validate
     * @returns {Object} Validation result
     */
    static validateNote(note) {
        const errors = [];
        const warnings = [];

        if (!note || typeof note !== 'object') {
            errors.push('Note must be an object');
            return { valid: false, errors, warnings, note: null };
        }

        // Required fields
        if (!note.id) {
            errors.push('Note must have an id');
        } else if (typeof note.id !== 'number') {
            errors.push('Note id must be a number');
        }

        if (typeof note.title !== 'string') {
            warnings.push('Note title should be a string');
        }

        if (typeof note.content !== 'string') {
            warnings.push('Note content should be a string');
        }

        // Optional fields validation
        if (note.lastModified && !this.isValidDate(note.lastModified)) {
            warnings.push('Invalid lastModified date');
        }

        if (note._encrypted && typeof note._encrypted !== 'boolean') {
            warnings.push('_encrypted should be a boolean');
        }

        if (note._encryptionVersion && typeof note._encryptionVersion !== 'string') {
            warnings.push('_encryptionVersion should be a string');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            note: errors.length === 0 ? this.sanitizeNote(note) : null
        };
    }

    /**
     * Validate collection of notes (tabs array)
     * @param {Object} data - Data object to validate
     * @returns {Object} Validation result
     */
    static validateNotesCollection(data) {
        const errors = [];
        const warnings = [];

        if (!data || typeof data !== 'object') {
            errors.push('Data must be an object');
            return { valid: false, errors, warnings };
        }

        // Validate tabs array
        if (!Array.isArray(data.tabs)) {
            errors.push('Data must have a tabs array');
        } else {
            data.tabs.forEach((tab, index) => {
                const validation = this.validateNote(tab);
                if (!validation.valid) {
                    errors.push(`Tab ${index + 1}: ${validation.errors.join(', ')}`);
                }
                if (validation.warnings.length > 0) {
                    warnings.push(`Tab ${index + 1}: ${validation.warnings.join(', ')}`);
                }
            });
        }

        // Validate activeTabId
        if (data.activeTabId !== null && data.activeTabId !== undefined) {
            if (typeof data.activeTabId !== 'number') {
                warnings.push('activeTabId should be a number or null');
            } else if (data.tabs && !data.tabs.find(tab => tab.id === data.activeTabId)) {
                warnings.push('activeTabId does not match any tab id');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate import file structure
     * @param {Object} importData - Imported data to validate
     * @returns {Object} Validation result
     */
    static validateImportData(importData) {
        const errors = [];
        const warnings = [];

        if (!importData || typeof importData !== 'object') {
            errors.push('Import data must be an object');
            return { valid: false, errors, warnings };
        }

        // Check for required structure
        if (!importData.tabs || !Array.isArray(importData.tabs)) {
            errors.push('Import data must contain a tabs array');
            return { valid: false, errors, warnings };
        }

        // Validate version compatibility
        if (importData.version && !this.isVersionCompatible(importData.version)) {
            warnings.push(`Import data version ${importData.version} may not be fully compatible`);
        }

        // Validate export metadata
        if (importData.exportDate && !this.isValidDate(importData.exportDate)) {
            warnings.push('Invalid export date in import data');
        }

        // Validate each note in the import
        const notesValidation = this.validateNotesCollection(importData);
        errors.push(...notesValidation.errors);
        warnings.push(...notesValidation.warnings);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            noteCount: importData.tabs.length
        };
    }

    /**
     * Validate encryption settings
     * @param {Object} settings - Encryption settings to validate
     * @returns {Object} Validation result
     */
    static validateEncryptionSettings(settings) {
        const errors = [];
        const warnings = [];

        if (!settings || typeof settings !== 'object') {
            errors.push('Settings must be an object');
            return { valid: false, errors, warnings };
        }

        // Required fields for encryption settings
        if (typeof settings.enabled !== 'boolean') {
            errors.push('Settings must have enabled boolean field');
        }

        if (settings.enabled) {
            if (!settings.salt || !Array.isArray(settings.salt)) {
                errors.push('Enabled encryption must have salt array');
            }

            if (!settings.algorithm || typeof settings.algorithm !== 'string') {
                errors.push('Enabled encryption must have algorithm string');
            }

            if (!settings.iterations || typeof settings.iterations !== 'number') {
                errors.push('Enabled encryption must have iterations number');
            } else if (settings.iterations < 10000) {
                warnings.push('Low iteration count may be insecure');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} Validation result with strength score
     */
    static validatePassword(password) {
        const errors = [];
        const warnings = [];
        let score = 0;

        if (!password || typeof password !== 'string') {
            errors.push('Password must be a string');
            return { valid: false, errors, warnings, score: 0 };
        }

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        } else {
            score += 1;
        }

        // Strength checks
        if (password.length >= 12) score += 1;
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^a-zA-Z0-9]/.test(password)) score += 1;

        // Warnings for weak passwords
        if (score < 3) {
            warnings.push('Password is weak. Consider using uppercase, lowercase, numbers, and symbols');
        }

        if (password.toLowerCase().includes('password') || 
            password.toLowerCase().includes('123456') ||
            password.toLowerCase().includes('qwerty')) {
            warnings.push('Password contains common patterns and may be easily guessed');
            score = Math.max(0, score - 2);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            score: Math.min(5, score),
            strength: this.getPasswordStrengthLabel(score)
        };
    }

    /**
     * Sanitize note data for storage
     * @param {Object} note - Note to sanitize
     * @returns {Object} Sanitized note
     */
    static sanitizeNote(note) {
        const sanitized = {
            id: Number(note.id) || 0,
            title: String(note.title || '').trim(),
            content: String(note.content || ''),
            lastModified: note.lastModified || new Date().toISOString()
        };

        // Preserve encryption metadata
        if (note._encrypted) {
            sanitized._encrypted = Boolean(note._encrypted);
        }
        if (note._encryptionVersion) {
            sanitized._encryptionVersion = String(note._encryptionVersion);
        }

        return sanitized;
    }

    /**
     * Check if a date string is valid
     * @param {string} dateString - Date string to validate
     * @returns {boolean} Validity status
     */
    static isValidDate(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date) && dateString.includes('T');
    }

    /**
     * Check if version is compatible
     * @param {string} version - Version string to check
     * @returns {boolean} Compatibility status
     */
    static isVersionCompatible(version) {
        const compatibleVersions = ['1.0', '2.0'];
        return compatibleVersions.includes(version);
    }

    /**
     * Get password strength label
     * @param {number} score - Password strength score
     * @returns {string} Strength label
     */
    static getPasswordStrengthLabel(score) {
        const labels = {
            0: 'Very Weak',
            1: 'Weak', 
            2: 'Fair',
            3: 'Good',
            4: 'Strong',
            5: 'Very Strong'
        };
        return labels[score] || 'Unknown';
    }

    /**
     * Validate and clean imported notes
     * @param {Array} notes - Array of notes to validate and clean
     * @returns {Object} Validation result with cleaned notes
     */
    static validateAndCleanNotes(notes) {
        if (!Array.isArray(notes)) {
            return { valid: false, errors: ['Notes must be an array'], cleanedNotes: [] };
        }

        const cleanedNotes = [];
        const errors = [];
        const warnings = [];

        notes.forEach((note, index) => {
            const validation = this.validateNote(note);
            
            if (validation.valid && validation.note) {
                cleanedNotes.push(validation.note);
            } else {
                errors.push(`Note ${index + 1}: ${validation.errors.join(', ')}`);
            }

            if (validation.warnings.length > 0) {
                warnings.push(`Note ${index + 1}: ${validation.warnings.join(', ')}`);
            }
        });

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            cleanedNotes,
            processedCount: notes.length,
            validCount: cleanedNotes.length
        };
    }

    /**
     * Create a comprehensive validation report
     * @param {Object} data - Data to validate
     * @returns {Object} Comprehensive validation report
     */
    static createValidationReport(data) {
        const report = {
            timestamp: new Date().toISOString(),
            overallValid: true,
            sections: {}
        };

        // Validate main data structure
        if (data.tabs) {
            const notesValidation = this.validateNotesCollection(data);
            report.sections.notes = notesValidation;
            if (!notesValidation.valid) report.overallValid = false;
        }

        // Validate encryption settings if present
        if (data.encryptionSettings) {
            const encryptionValidation = this.validateEncryptionSettings(data.encryptionSettings);
            report.sections.encryption = encryptionValidation;
            if (!encryptionValidation.valid) report.overallValid = false;
        }

        // Summary
        report.summary = {
            totalErrors: Object.values(report.sections).reduce((sum, section) => sum + section.errors.length, 0),
            totalWarnings: Object.values(report.sections).reduce((sum, section) => sum + section.warnings.length, 0),
            sectionsChecked: Object.keys(report.sections).length
        };

        return report;
    }
}

// Export for global use
window.ValidationManager = ValidationManager;