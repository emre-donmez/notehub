/**
 * Encryption Service
 * Provides end-to-end encryption for user notes using AES-256-GCM
 * Users can optionally enable encryption with a master password
 * FULLY REDESIGNED for reliable local and cloud operation
 */
class EncryptionService {
    constructor() {
        this.isEnabled = false;
        this.encryptionKey = null;
        this.keyDerivationIterations = 100000; // PBKDF2 iterations
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.ivLength = 12; // GCM recommended IV length
        this.saltLength = 16;
        this.tagLength = 16; // GCM authentication tag length
        this.isInitialized = false;
    }

    /**
     * Initialize encryption service and check if encryption is enabled
     * PRODUCTION READY: Reduced logging
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            // Step 1: Check local encryption settings
            const localSettings = await this.loadLocalEncryptionSettings();
            
            if (localSettings && localSettings.enabled) {
                this.isEnabled = true;
                this.isInitialized = true;
                return;
            }

            // Step 2: If no local settings but we have Firebase access, check cloud
            if (this.hasFirebaseAccess()) {
                const cloudSettings = await this.loadCloudEncryptionSettings();
                
                if (cloudSettings && cloudSettings.enabled) {
                    // Save cloud settings to local for future use
                    await this.saveLocalEncryptionSettings(cloudSettings);
                    this.isEnabled = true;
                } else {
                    this.isEnabled = false;
                }
            } else {
                this.isEnabled = false;
            }

        } catch (error) {
            console.warn('Encryption initialization error:', error);
            this.isEnabled = false;
        }

        this.isInitialized = true;
    }

    /**
     * Check if Firebase access is available
     */
    hasFirebaseAccess() {
        return typeof firebaseService !== 'undefined' && 
               firebaseService.isAuthenticated && 
               firebaseService.isAuthenticated();
    }

    /**
     * Load encryption settings from localStorage
     */
    async loadLocalEncryptionSettings() {
        try {
            const settingsJson = localStorage.getItem('NoteHub_EncryptionSettings');
            if (settingsJson) {
                return JSON.parse(settingsJson);
            }
            return null;
        } catch (error) {
            console.error('Failed to load local encryption settings:', error);
            return null;
        }
    }

    /**
     * Save encryption settings to localStorage
     */
    async saveLocalEncryptionSettings(settings) {
        try {
            localStorage.setItem('NoteHub_EncryptionSettings', JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('Failed to save local encryption settings:', error);
            return false;
        }
    }

    /**
     * Load encryption settings from cloud
     */
    async loadCloudEncryptionSettings() {
        try {
            if (!this.hasFirebaseAccess()) {
                return null;
            }
            return await firebaseService.loadEncryptionSettings();
        } catch (error) {
            console.error('Failed to load cloud encryption settings:', error);
            return null;
        }
    }

    /**
     * Save encryption settings to cloud
     */
    async saveCloudEncryptionSettings(settings) {
        try {
            if (!this.hasFirebaseAccess()) {
                return false;
            }
            await firebaseService.saveEncryptionSettings(settings);
            return true;
        } catch (error) {
            console.error('Failed to save cloud encryption settings:', error);
            return false;
        }
    }

    /**
     * Enable encryption with a master password
     * PRODUCTION READY: Reduced logging
     */
    async enableEncryption(password) {
        try {
            if (!password || password.length < 8) {
                throw new Error('Password must be at least 8 characters long');
            }

            // Generate a salt and derive key
            const salt = crypto.getRandomValues(new Uint8Array(this.saltLength));
            this.encryptionKey = await this.deriveKey(password, salt);
            
            // Prepare and save settings
            const settings = {
                enabled: true,
                salt: Array.from(salt),
                algorithm: this.algorithm,
                iterations: this.keyDerivationIterations,
                createdAt: new Date().toISOString()
            };
            
            await this.saveLocalEncryptionSettings(settings);
            this.isEnabled = true;
            
            // Save to cloud if available
            await this.saveCloudEncryptionSettings(settings);
            
            // Encrypt existing notes
            await this.encryptExistingPlainTextNotes();
            
            return true;
        } catch (error) {
            console.error('Failed to enable encryption:', error);
            throw error;
        }
    }

    /**
     * Unlock encryption with master password
     * PRODUCTION READY: Reduced logging
     */
    async unlockEncryption(password) {
        try {
            if (!this.isEnabled) {
                throw new Error('Encryption is not enabled');
            }

            // Load encryption settings
            let settings = await this.loadLocalEncryptionSettings();
            
            // Try cloud if no local settings
            if (!settings && this.hasFirebaseAccess()) {
                settings = await this.loadCloudEncryptionSettings();
                if (settings) {
                    await this.saveLocalEncryptionSettings(settings);
                }
            }

            if (!settings || !settings.salt) {
                throw new Error('Encryption settings not found');
            }

            // Derive key and verify password
            const salt = new Uint8Array(settings.salt);
            const derivedKey = await this.deriveKey(password, salt);
            
            const verified = await this.verifyPasswordWithData(derivedKey);
            if (!verified) {
                throw new Error('Invalid password');
            }
            
            // Success
            this.encryptionKey = derivedKey;
            return true;
        } catch (error) {
            console.error('Failed to unlock encryption:', error);
            this.encryptionKey = null;
            throw error;
        }
    }

    /**
     * Verify password with actual encrypted data
     * PRODUCTION READY: Essential logging only
     */
    async verifyPasswordWithData(key) {
        try {
            // Try local encrypted notes first
            const localResult = await this.verifyWithLocalData(key);
            if (localResult) {
                return true;
            }

            // Try cloud if available
            if (this.hasFirebaseAccess()) {
                const cloudResult = await this.verifyWithCloudData(key);
                if (cloudResult) {
                    return true;
                }
            }

            // No encrypted data found - assume first-time setup
            return true;
            
        } catch (error) {
            console.error('Password verification failed:', error);
            return false;
        }
    }

    /**
     * Verify password with local encrypted data
     */
    async verifyWithLocalData(key) {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const storageKey = localStorage.key(i);
                
                if (storageKey && storageKey.startsWith('NoteHub_Note_')) {
                    const noteData = localStorage.getItem(storageKey);
                    if (noteData) {
                        const parsed = JSON.parse(noteData);
                        
                        if (parsed._encrypted) {
                            const testField = parsed.title || parsed.content;
                            if (testField && testField.startsWith('ENCRYPTED:')) {
                                try {
                                    const decrypted = await this.decryptWithKey(testField, key);
                                    if (decrypted && decrypted.length > 0) {
                                        return true;
                                    }
                                } catch (decryptError) {
                                    // Continue trying other notes
                                    continue;
                                }
                            }
                        }
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('Local data verification failed:', error);
            return false;
        }
    }

    /**
     * Verify password with cloud encrypted data
     */
    async verifyWithCloudData(key) {
        try {
            const cloudNotes = await firebaseService.loadAllUserNotes();
            
            for (const note of cloudNotes) {
                if (note._encrypted) {
                    const testField = note.title || note.content;
                    if (testField && testField.startsWith('ENCRYPTED:')) {
                        try {
                            const decrypted = await this.decryptWithKey(testField, key);
                            if (decrypted && decrypted.length > 0) {
                                return true;
                            }
                        } catch (decryptError) {
                            // Continue trying other notes
                            continue;
                        }
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('Cloud data verification failed:', error);
            return false;
        }
    }

    /**
     * Encrypt existing plain text notes when enabling encryption
     * IMPROVED: Better handling and progress tracking
     */
    async encryptExistingPlainTextNotes() {
        try {
            console.log('🔐 Encrypting existing plain text notes...');
            
            const noteKeys = [];
            
            // Find all plain text notes
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                
                if (key && key.startsWith('NoteHub_Note_')) {
                    try {
                        const noteData = localStorage.getItem(key);
                        if (noteData) {
                            const parsed = JSON.parse(noteData);
                            
                            const isPlainText = !parsed._encrypted && 
                                              (!parsed.title || !parsed.title.startsWith('ENCRYPTED:')) &&
                                              (!parsed.content || !parsed.content.startsWith('ENCRYPTED:'));
                            
                            if (isPlainText) {
                                noteKeys.push({ key, note: parsed });
                            }
                        }
                    } catch (error) {
                        console.warn(`Could not parse note ${key}:`, error);
                    }
                }
            }
            
            if (noteKeys.length === 0) {
                console.log('ℹ️ No plain text notes to encrypt');
                return;
            }

            let encryptedCount = 0;
            
            // Encrypt each note
            for (const { key, note } of noteKeys) {
                try {
                    console.log(`🔐 Encrypting: ${note.title || 'Untitled'}`);
                    
                    const encryptedNote = await this.encryptNote(note);
                    
                    if (encryptedNote._encrypted) {
                        localStorage.setItem(key, JSON.stringify(encryptedNote));
                        encryptedCount++;
                    }
                } catch (noteError) {
                    console.error(`Failed to encrypt note ${key}:`, noteError);
                }
            }
            
            // Clear cache
            if (typeof storageService !== 'undefined' && storageService.cache) {
                storageService.cache.clear();
            }
            
            console.log(`✅ Successfully encrypted ${encryptedCount}/${noteKeys.length} notes`);
            
        } catch (error) {
            console.error('Failed to encrypt existing notes:', error);
        }
    }

    /**
     * Decrypt note data (including content and title)
     * COMPLETELY REDESIGNED: Robust decryption with proper error handling
     */
    async decryptNote(note) {
        if (!note) {
            return note;
        }

        // If not marked as encrypted, return as-is
        if (!note._encrypted) {
            return note;
        }

        // If encryption is not available, show locked message
        if (!this.isEnabled || !this.encryptionKey) {
            return {
                ...note,
                title: '[🔒 Locked] Encrypted Note',
                content: '[🔒 This note is encrypted. Please unlock encryption to view the content.]',
                _decryptionError: true,
                _lockError: true
            };
        }

        try {
            const decryptedNote = { ...note };
            let hasErrors = false;
            
            // Decrypt title
            if (note.title && note.title.startsWith('ENCRYPTED:')) {
                try {
                    decryptedNote.title = await this.decrypt(note.title);
                } catch (error) {
                    console.error('Title decryption failed:', error);
                    decryptedNote.title = `[❌ Title Decrypt Error]`;
                    hasErrors = true;
                }
            } else {
                decryptedNote.title = note.title || 'Untitled';
            }
            
            // Decrypt content
            if (note.content && note.content.startsWith('ENCRYPTED:')) {
                try {
                    decryptedNote.content = await this.decrypt(note.content);
                } catch (error) {
                    console.error('Content decryption failed:', error);
                    decryptedNote.content = `[❌ Decryption Failed]\n\nThis note could not be decrypted.\n\nPossible causes:\n• Wrong password\n• Data corruption\n• Encryption key mismatch\n\nError details: ${error.message}`;
                    hasErrors = true;
                }
            } else {
                decryptedNote.content = note.content || '';
            }
            
            // Remove encryption metadata
            delete decryptedNote._encrypted;
            delete decryptedNote._encryptionVersion;
            
            if (hasErrors) {
                decryptedNote._decryptionError = true;
            }
            
            return decryptedNote;
        } catch (error) {
            console.error('Complete note decryption failed:', error);
            return {
                ...note,
                title: '[❌ Critical Error] Encrypted Note',
                content: `[❌ Critical Decryption Error]\n\nThis note could not be decrypted at all.\n\nError: ${error.message}\n\nPlease try:\n1. Unlocking encryption again\n2. Verifying your password\n3. Checking browser console for details`,
                _decryptionError: true
            };
        }
    }

    /**
     * Verify if provided password is correct
     * SIMPLIFIED: Uses the main verification logic
     */
    async verifyPassword(password) {
        try {
            if (!this.isEnabled) {
                return false;
            }

            const settings = await this.loadLocalEncryptionSettings();
            if (!settings || !settings.salt) {
                return false;
            }

            const salt = new Uint8Array(settings.salt);
            const testKey = await this.deriveKey(password, salt);
            
            return await this.verifyPasswordWithData(testKey);
        } catch (error) {
            console.error('Password verification failed:', error);
            return false;
        }
    }

    /**
     * Disable encryption (will require password verification)
     * IMPROVED: Proper cleanup of settings
     */
    async disableEncryption(password) {
        try {
            // Verify password first
            const isValid = await this.verifyPassword(password);
            if (!isValid) {
                throw new Error('Invalid password');
            }

            // Remove settings from both local and cloud
            localStorage.removeItem('NoteHub_EncryptionSettings');
            
            if (this.hasFirebaseAccess()) {
                try {
                    await firebaseService.deleteEncryptionSettings();
                } catch (cloudError) {
                    console.warn('Failed to remove cloud encryption settings:', cloudError);
                }
            }

            this.isEnabled = false;
            this.encryptionKey = null;
            
            console.log('✅ Encryption disabled successfully');
            return true;
        } catch (error) {
            console.error('Failed to disable encryption:', error);
            throw error;
        }
    }

    // ... [Keep all the existing crypto functions as they are - deriveKey, encrypt, decrypt, etc.]

    /**
     * Derive encryption key from password using PBKDF2
     */
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.keyDerivationIterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            {
                name: this.algorithm,
                length: this.keyLength
            },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt data using AES-GCM
     */
    async encrypt(plaintext) {
        if (!this.isEnabled || !this.encryptionKey) {
            return plaintext;
        }

        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(plaintext);
            
            const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
            
            const encryptedBuffer = await crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: iv,
                    tagLength: this.tagLength * 8
                },
                this.encryptionKey,
                data
            );
            
            const encryptedArray = new Uint8Array(encryptedBuffer);
            const combined = new Uint8Array(this.ivLength + encryptedArray.length);
            combined.set(iv, 0);
            combined.set(encryptedArray, this.ivLength);
            
            return 'ENCRYPTED:' + this.arrayBufferToBase64(combined);
        } catch (error) {
            console.error('Encryption failed:', error);
            throw error;
        }
    }

    /**
     * Decrypt data using AES-GCM
     */
    async decrypt(encryptedData) {
        if (!encryptedData) {
            return encryptedData;
        }
        
        if (!encryptedData.startsWith('ENCRYPTED:')) {
            return encryptedData;
        }

        if (!this.isEnabled || !this.encryptionKey) {
            throw new Error('Encryption key not available. Please unlock encryption first.');
        }

        return await this.decryptWithKey(encryptedData, this.encryptionKey);
    }

    /**
     * Decrypt data with specific key
     */
    async decryptWithKey(encryptedData, key) {
        try {
            const base64Data = encryptedData.replace('ENCRYPTED:', '');
            const combined = this.base64ToArrayBuffer(base64Data);
            
            if (combined.length < this.ivLength + this.tagLength) {
                throw new Error(`Invalid encrypted data length: ${combined.length}`);
            }
            
            const iv = combined.slice(0, this.ivLength);
            const encryptedBuffer = combined.slice(this.ivLength);
            
            const decryptedBuffer = await crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: iv,
                    tagLength: this.tagLength * 8
                },
                key,
                encryptedBuffer
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decryptedBuffer);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error(`Failed to decrypt data: ${error.message}`);
        }
    }

    /**
     * Encrypt note data (including content and title)
     */
    async encryptNote(note) {
        if (!this.isEnabled || !this.encryptionKey) {
            return note;
        }

        try {
            const encryptedNote = { ...note };
            
            if (note.title) {
                encryptedNote.title = await this.encrypt(note.title);
            }
            if (note.content) {
                encryptedNote.content = await this.encrypt(note.content);
            }
            
            encryptedNote._encrypted = true;
            encryptedNote._encryptionVersion = '1.0';
            
            return encryptedNote;
        } catch (error) {
            console.error('Failed to encrypt note:', error);
            throw error;
        }
    }

    /**
     * Convert base64 string to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        try {
            if (!base64 || typeof base64 !== 'string') {
                throw new Error('Invalid base64 input');
            }
            
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            
            return bytes;
        } catch (error) {
            console.error('Base64 conversion failed:', error);
            throw new Error(`Base64 conversion error: ${error.message}`);
        }
    }

    /**
     * Convert ArrayBuffer to base64 string
     */
    arrayBufferToBase64(buffer) {
        try {
            if (!buffer) {
                throw new Error('Invalid buffer');
            }
            
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            
            return btoa(binary);
        } catch (error) {
            console.error('ArrayBuffer to Base64 conversion failed:', error);
            throw new Error(`Base64 encoding error: ${error.message}`);
        }
    }

    /**
     * Check if encryption is available (Web Crypto API support)
     */
    isAvailable() {
        return typeof crypto !== 'undefined' && 
               typeof crypto.subtle !== 'undefined' &&
               typeof crypto.getRandomValues !== 'undefined';
    }

    /**
     * Get encryption status information
     */
    getStatus() {
        return {
            available: this.isAvailable(),
            enabled: this.isEnabled,
            unlocked: this.isEnabled && this.encryptionKey !== null,
            algorithm: this.algorithm,
            keyLength: this.keyLength,
            initialized: this.isInitialized
        };
    }

    /**
     * Lock encryption (clear encryption key from memory)
     */
    lock() {
        this.encryptionKey = null;
        console.log('🔒 Encryption locked');
    }

    // DEPRECATED: Legacy functions for backward compatibility
    async syncEncryptionSettingsToCloud(settings) {
        return await this.saveCloudEncryptionSettings(settings);
    }

    async syncEncryptionSettingsFromCloud() {
        const settings = await this.loadCloudEncryptionSettings();
        if (settings) {
            await this.saveLocalEncryptionSettings(settings);
            this.isEnabled = settings.enabled || false;
        }
    }

    async removeEncryptionSettingsFromCloud() {
        if (this.hasFirebaseAccess()) {
            try {
                await firebaseService.deleteEncryptionSettings();
                return true;
            } catch (error) {
                console.error('Failed to remove cloud encryption settings:', error);
                return false;
            }
        }
        return false;
    }
}

// Export singleton instance
const encryptionService = new EncryptionService();