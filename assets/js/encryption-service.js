/**
 * Encryption Service
 * Provides end-to-end encryption for user notes using AES-256-GCM
 * Users can optionally enable encryption with a master password
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
    }

    /**
     * Initialize encryption service and check if encryption is enabled
     * FIXED: Better cloud integration for cross-device encryption
     */
    async initialize() {
        console.log('🔧 Initializing encryption service...');
        
        // First check local storage
        const localEncryptionSettings = localStorage.getItem('NoteHub_EncryptionSettings');
        
        if (localEncryptionSettings) {
            const settings = JSON.parse(localEncryptionSettings);
            this.isEnabled = settings.enabled || false;
            console.log('✅ Local encryption settings found, enabled:', this.isEnabled);
            return; // Local settings found, use them
        }
        
        // If no local settings, check cloud (for cross-device sync)
        try {
            console.log('🔍 No local encryption settings, checking cloud...');
            await this.syncEncryptionSettingsFromCloud();
            
            if (this.isEnabled) {
                console.log('✅ Encryption settings synced from cloud, enabled:', this.isEnabled);
            } else {
                console.log('ℹ️ No encryption settings found in cloud either');
            }
        } catch (error) {
            console.warn('Could not sync encryption settings from cloud:', error);
            // Not a critical error, continue with encryption disabled
        }
    }

    /**
     * Enable encryption with a master password
     * @param {string} password - Master password for encryption
     * @returns {Promise<boolean>} True if encryption enabled successfully
     */
    async enableEncryption(password) {
        try {
            if (!password || password.length < 8) {
                throw new Error('Password must be at least 8 characters long');
            }

            // Generate a salt for key derivation
            const salt = crypto.getRandomValues(new Uint8Array(this.saltLength));
            
            // Derive encryption key from password
            this.encryptionKey = await this.deriveKey(password, salt);
            
            // Save encryption settings (salt only, never the password or key)
            const settings = {
                enabled: true,
                salt: Array.from(salt), // Convert to array for JSON storage
                algorithm: this.algorithm,
                iterations: this.keyDerivationIterations
            };
            
            localStorage.setItem('NoteHub_EncryptionSettings', JSON.stringify(settings));
            this.isEnabled = true;
            
            // NEW: Sync encryption settings to cloud for cross-device access
            await this.syncEncryptionSettingsToCloud(settings);
            
            // Encrypt existing plain text notes instead of deleting them
            await this.encryptExistingPlainTextNotes();
            
            return true;
        } catch (error) {
            console.error('Failed to enable encryption:', error);
            throw error;
        }
    }

    /**
     * NEW: Encrypt existing plain text notes when enabling encryption
     * FIXED: Better handling of existing plain text notes
     */
    async encryptExistingPlainTextNotes() {
        try {
            console.log('🔐 Encrypting existing plain text notes...');
            
            const noteKeys = [];
            
            // Check all localStorage keys for notes only
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                
                // Check individual notes for plain text (not encrypted)
                if (key && key.startsWith('NoteHub_Note_')) {
                    try {
                        const noteData = localStorage.getItem(key);
                        if (noteData) {
                            const parsed = JSON.parse(noteData);
                            // If note is not marked as encrypted AND doesn't have ENCRYPTED: data, it's plain text
                            const isPlainText = !parsed._encrypted && 
                                              (!parsed.title || !parsed.title.startsWith('ENCRYPTED:')) &&
                                              (!parsed.content || !parsed.content.startsWith('ENCRYPTED:'));
                            
                            if (isPlainText) {
                                noteKeys.push({ key, note: parsed });
                            }
                        }
                    } catch (error) {
                        console.warn(`Could not parse note ${key}, skipping:`, error);
                    }
                }
            }
            
            let encryptedCount = 0;
            
            // Encrypt each plain text note
            for (const { key, note } of noteKeys) {
                try {
                    console.log(`🔐 Encrypting plain text note: ${key}`);
                    console.log(`   Title: "${note.title || 'Untitled'}" (${note.title?.length || 0} chars)`);
                    console.log(`   Content: ${note.content?.length || 0} chars`);
                    
                    // Encrypt the note (this will only encrypt if encryption is enabled and key is available)
                    const encryptedNote = await this.encryptNote(note);
                    
                    // Verify encryption worked
                    if (encryptedNote._encrypted) {
                        // Save the encrypted version
                        localStorage.setItem(key, JSON.stringify(encryptedNote));
                        encryptedCount++;
                        console.log(`✅ Successfully encrypted: ${key}`);
                    } else {
                        console.warn(`⚠️ Note ${key} was not encrypted (encryption may be disabled)`);
                    }
                } catch (noteError) {
                    console.error(`❌ Failed to encrypt note ${key}:`, noteError);
                    // Continue with other notes even if one fails
                }
            }
            
            // Force clear any potential cached plain text
            if (typeof storageService !== 'undefined' && storageService.cache) {
                storageService.cache.clear();
                console.log('🧹 Cleared storage cache');
            }
            
            console.log(`🎉 Successfully encrypted ${encryptedCount} notes out of ${noteKeys.length} plain text notes found.`);
            
        } catch (error) {
            console.error('Failed to encrypt existing notes:', error);
            // Don't throw - this shouldn't prevent encryption from being enabled
        }
    }

    /**
     * Disable encryption (will require password verification)
     * FIXED: Now also removes encryption settings from cloud
     */
    async disableEncryption(password) {
        try {
            // Verify password before disabling
            const isValid = await this.verifyPassword(password);
            if (!isValid) {
                throw new Error('Invalid password');
            }

            // Remove encryption settings from local storage
            localStorage.removeItem('NoteHub_EncryptionSettings');
            this.isEnabled = false;
            this.encryptionKey = null;
            
            // NEW: Also remove encryption settings from cloud
            await this.removeEncryptionSettingsFromCloud();
            
            return true;
        } catch (error) {
            console.error('Failed to disable encryption:', error);
            throw error;
        }
    }

    /**
     * Unlock encryption with master password
     * FIXED: Better cloud integration and debugging
     */
    async unlockEncryption(password) {
        try {
            if (!this.isEnabled) {
                throw new Error('Encryption is not enabled');
            }

            const settings = JSON.parse(localStorage.getItem('NoteHub_EncryptionSettings'));
            if (!settings || !settings.salt) {
                throw new Error('Encryption settings not found');
            }

            console.log('🔓 Unlocking encryption with cloud support...');
            console.log('   Algorithm:', settings.algorithm);
            console.log('   Iterations:', settings.iterations);
            console.log('   Salt length:', settings.salt?.length);

            // Recreate salt from stored array
            const salt = new Uint8Array(settings.salt);
            
            // Derive key from password and stored salt
            const derivedKey = await this.deriveKey(password, salt);
            
            // Verify password by trying to decrypt any existing encrypted note (local or cloud)
            const verified = await this.verifyPasswordWithExistingData(derivedKey);
            if (!verified) {
                throw new Error('Invalid password');
            }
            
            // Set the verified key
            this.encryptionKey = derivedKey;
            console.log('✅ Encryption unlocked successfully');
            return true;
        } catch (error) {
            console.error('Failed to unlock encryption:', error);
            this.encryptionKey = null;
            throw error;
        }
    }

    /**
     * Verify if provided password is correct
     * @param {string} password - Password to verify
     * @returns {Promise<boolean>} True if password is correct
     */
    async verifyPassword(password) {
        try {
            if (!this.isEnabled) {
                return false;
            }

            const settings = JSON.parse(localStorage.getItem('NoteHub_EncryptionSettings'));
            if (!settings || !settings.salt) {
                return false;
            }

            const salt = new Uint8Array(settings.salt);
            const testKey = await this.deriveKey(password, salt);
            
            // Verify password by attempting to decrypt existing encrypted data
            return await this.verifyPasswordWithExistingData(testKey);
        } catch (error) {
            console.error('Password verification failed:', error);
            return false;
        }
    }

    /**
     * Verify password by attempting to decrypt existing encrypted data
     * FIXED: Better handling for cloud storage scenario
     */
    async verifyPasswordWithExistingData(key) {
        try {
            // Look for any encrypted note in localStorage first
            for (let i = 0; i < localStorage.length; i++) {
                const storageKey = localStorage.key(i);
                
                if (storageKey && storageKey.startsWith('NoteHub_Note_')) {
                    try {
                        const noteData = localStorage.getItem(storageKey);
                        if (noteData) {
                            const parsed = JSON.parse(noteData);
                            
                            // If this note is encrypted, try to decrypt it
                            if (parsed._encrypted && (parsed.title || parsed.content)) {
                                const testField = parsed.title || parsed.content;
                                if (testField && testField.startsWith('ENCRYPTED:')) {
                                    // Try to decrypt with the provided key
                                    const decryptedText = await this.decryptWithKey(testField, key);
                                    // Additional check: decrypted text should be meaningful
                                    if (decryptedText && decryptedText.length > 0) {
                                        return true; // Success - password is correct
                                    }
                                }
                            }
                        }
                    } catch (decryptError) {
                        // If decryption fails, password is wrong
                        console.log('Decryption failed for note, trying next...', decryptError);
                        continue;
                    }
                }
            }
            
            // If no local encrypted data found, try to load from cloud for verification
            if (typeof firebaseService !== 'undefined' && firebaseService.isAuthenticated && firebaseService.isAuthenticated()) {
                try {
                    console.log('🔍 No local encrypted data found, checking cloud for password verification...');
                    const cloudNotes = await firebaseService.loadAllUserNotes();
                    
                    for (const note of cloudNotes) {
                        if (note._encrypted && (note.title || note.content)) {
                            const testField = note.title || note.content;
                            if (testField && testField.startsWith('ENCRYPTED:')) {
                                try {
                                    const decryptedText = await this.decryptWithKey(testField, key);
                                    if (decryptedText && decryptedText.length > 0) {
                                        console.log('✅ Password verified successfully using cloud data');
                                        return true;
                                    }
                                } catch (cloudDecryptError) {
                                    console.log('Cloud note decryption failed, trying next...', cloudDecryptError);
                                    continue;
                                }
                            }
                        }
                    }
                } catch (cloudError) {
                    console.warn('Failed to load cloud data for password verification:', cloudError);
                }
            }
            
            // If no encrypted data found anywhere, password verification passes
            // This happens on first encryption enable - assume password is correct
            console.log('No encrypted notes found for password verification (neither local nor cloud)');
            return true;
        } catch (error) {
            console.error('Error verifying password with existing data:', error);
            return false;
        }
    }

    /**
     * Derive encryption key from password using PBKDF2
     * @param {string} password - User password
     * @param {Uint8Array} salt - Salt for key derivation
     * @returns {Promise<CryptoKey>} Derived crypto key
     */
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        
        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveKey']
        );

        // Derive AES key
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
     * @param {string} plaintext - Data to encrypt
     * @returns {Promise<string>} Encrypted data as base64 string
     */
    async encrypt(plaintext) {
        if (!this.isEnabled || !this.encryptionKey) {
            // Return plaintext if encryption is not enabled or unlocked
            return plaintext;
        }

        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(plaintext);
            
            // Generate random IV
            const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
            
            // Encrypt data
            const encryptedBuffer = await crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: iv,
                    tagLength: this.tagLength * 8 // Convert to bits
                },
                this.encryptionKey,
                data
            );
            
            // Combine IV and encrypted data
            const encryptedArray = new Uint8Array(encryptedBuffer);
            const combined = new Uint8Array(this.ivLength + encryptedArray.length);
            combined.set(iv, 0);
            combined.set(encryptedArray, this.ivLength);
            
            // Return as base64 string with encryption marker
            return 'ENCRYPTED:' + this.arrayBufferToBase64(combined);
        } catch (error) {
            console.error('Encryption failed:', error);
            throw error;
        }
    }

    /**
     * Decrypt data using AES-GCM
     * FIXED: Better handling of non-encrypted data
     */
    async decrypt(encryptedData) {
        // Return as-is if data is null, undefined, or empty
        if (!encryptedData) {
            return encryptedData;
        }
        
        // Return as-is if not encrypted (doesn't start with ENCRYPTED:)
        if (!encryptedData.startsWith('ENCRYPTED:')) {
            return encryptedData;
        }

        if (!this.isEnabled || !this.encryptionKey) {
            throw new Error('Encryption key not available. Please unlock encryption first.');
        }

        return await this.decryptWithKey(encryptedData, this.encryptionKey);
    }

    /**
     * Decrypt data with specific key (used for password verification)
     * @param {string} encryptedData - Encrypted data as base64 string
     * @param {CryptoKey} key - Decryption key
     * @returns {Promise<string>} Decrypted plaintext
     */
    async decryptWithKey(encryptedData, key) {
        try {
            // Remove encryption marker and decode base64
            const base64Data = encryptedData.replace('ENCRYPTED:', '');
            const combined = this.base64ToArrayBuffer(base64Data);
            
            // Validate combined buffer length
            if (combined.length < this.ivLength + this.tagLength) {
                throw new Error(`Invalid encrypted data length: ${combined.length}, expected at least ${this.ivLength + this.tagLength}`);
            }
            
            // Extract IV and encrypted data
            const iv = combined.slice(0, this.ivLength);
            const encryptedBuffer = combined.slice(this.ivLength);
            
            // Decrypt data
            const decryptedBuffer = await crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: iv,
                    tagLength: this.tagLength * 8 // Convert to bits
                },
                key,
                encryptedBuffer
            );
            
            // Convert to string
            const decoder = new TextDecoder();
            return decoder.decode(decryptedBuffer);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error(`Failed to decrypt data. Details: ${error.message}`);
        }
    }

    /**
     * Encrypt note data (including content and title)
     * @param {Object} note - Note object to encrypt
     * @returns {Promise<Object>} Note object with encrypted fields
     */
    async encryptNote(note) {
        if (!this.isEnabled || !this.encryptionKey) {
            return note;
        }

        try {
            const encryptedNote = { ...note };
            
            // Encrypt title and content
            if (note.title) {
                encryptedNote.title = await this.encrypt(note.title);
            }
            if (note.content) {
                encryptedNote.content = await this.encrypt(note.content);
            }
            
            // Add encryption metadata
            encryptedNote._encrypted = true;
            encryptedNote._encryptionVersion = '1.0';
            
            return encryptedNote;
        } catch (error) {
            console.error('Failed to encrypt note:', error);
            throw error;
        }
    }

    /**
     * Decrypt note data (including content and title)
     * FIXED: Better handling of plain text vs encrypted notes
     */
    async decryptNote(note) {
        if (!note) {
            return note;
        }

        // If note is not marked as encrypted, treat it as plain text
        if (!note._encrypted) {
            return note;
        }

        if (!this.isEnabled || !this.encryptionKey) {
            console.warn('Encryption key not available for decryption');
            return {
                ...note,
                title: '[🔒 Locked] ' + (note.title ? 'Encrypted Note' : 'Untitled'),
                content: '[🔒 This note is encrypted. Please unlock encryption to view the content.]',
                _decryptionError: true,
                _lockError: true
            };
        }

        try {
            const decryptedNote = { ...note };
            
            // Decrypt title and content with detailed error handling
            for (const field of ['title', 'content']) {
                if (note[field] && note[field].startsWith('ENCRYPTED:')) {
                    try {
                        decryptedNote[field] = await this.decrypt(note[field]);
                    } catch (error) {
                        console.error(`Failed to decrypt note ${field}:`, error);
                        decryptedNote[field] = `[❌ Decryption Failed]\n\nThis field could not be decrypted.\n\nPlease try:\n1. Unlock encryption again\n2. Verify you are using the correct password\n3. If problem persists, the data may be corrupted\n\nError: ${error.message}`;
                        decryptedNote[`_${field}DecryptError`] = true;
                    }
                } else {
                    // If the field doesn't start with ENCRYPTED:, keep it as is
                    decryptedNote[field] = note[field] || '';
                }
            }
            
            // Remove encryption metadata for UI
            delete decryptedNote._encrypted;
            delete decryptedNote._encryptionVersion;
            
            return decryptedNote;
        } catch (error) {
            console.error('Failed to decrypt note:', error);
            // Return note with helpful error message
            return {
                ...note,
                title: '[❌ Decryption Error] Encrypted Note',
                content: `[❌ Critical Decryption Error]\n\nThis note could not be decrypted.\n\nPossible causes:\n• Wrong password\n• Data corruption\n• Encryption key mismatch\n\nTroubleshooting:\n1. Ensure you're using the correct password\n2. Try unlocking encryption again\n3. Check browser console for technical details\n\nTechnical error: ${error.message}`,
                _decryptionError: true
            };
        }
    }

    /**
     * Convert base64 string to ArrayBuffer
     * @param {string} base64 - Base64 string to convert
     * @returns {Uint8Array} Converted array buffer
     */
    base64ToArrayBuffer(base64) {
        try {
            if (!base64 || typeof base64 !== 'string') {
                throw new Error('Invalid base64 input: empty or not a string');
            }
            
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            
            return bytes;
        } catch (error) {
            console.error('Base64 to ArrayBuffer conversion failed:', error);
            throw new Error(`Base64 conversion error: ${error.message}`);
        }
    }

    /**
     * Convert ArrayBuffer to base64 string
     * @param {ArrayBuffer} buffer - Buffer to convert
     * @returns {string} Base64 string
     */
    arrayBufferToBase64(buffer) {
        try {
            if (!buffer) {
                throw new Error('Invalid buffer: null or undefined');
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
     * @returns {boolean} True if encryption is available
     */
    isAvailable() {
        return typeof crypto !== 'undefined' && 
               typeof crypto.subtle !== 'undefined' &&
               typeof crypto.getRandomValues !== 'undefined';
    }

    /**
     * Get encryption status information
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            available: this.isAvailable(),
            enabled: this.isEnabled,
            unlocked: this.isEnabled && this.encryptionKey !== null,
            algorithm: this.algorithm,
            keyLength: this.keyLength
        };
    }

    /**
     * Lock encryption (clear encryption key from memory)
     */
    lock() {
        this.encryptionKey = null;
    }

    /**
     * Sync encryption settings to cloud for cross-device access
     * @param {Object} settings - Encryption settings to sync
     */
    async syncEncryptionSettingsToCloud(settings) {
        try {
            // Only sync if we have Firebase and user is authenticated
            if (typeof firebaseService !== 'undefined' && 
                firebaseService.isAuthenticated && 
                firebaseService.isAuthenticated()) {
                
                await firebaseService.saveEncryptionSettings(settings);
                console.log('✅ Encryption settings synced to cloud');
            }
        } catch (error) {
            console.warn('Failed to sync encryption settings to cloud:', error);
            // Don't throw - this shouldn't prevent encryption from being enabled
        }
    }

    /**
     * Sync encryption settings from cloud for cross-device access
     */
    async syncEncryptionSettingsFromCloud() {
        try {
            // Only sync if we have Firebase and user is authenticated
            if (typeof firebaseService !== 'undefined' && 
                firebaseService.isAuthenticated && 
                firebaseService.isAuthenticated()) {
                
                const cloudSettings = await firebaseService.loadEncryptionSettings();
                
                if (cloudSettings) {
                    // Save to local storage
                    localStorage.setItem('NoteHub_EncryptionSettings', JSON.stringify(cloudSettings));
                    this.isEnabled = cloudSettings.enabled || false;
                    console.log('✅ Encryption settings synced from cloud');
                }
            }
        } catch (error) {
            console.warn('Failed to sync encryption settings from cloud:', error);
            // Don't throw - this shouldn't prevent app from working
        }
    }

    /**
     * Remove encryption settings from cloud
     */
    async removeEncryptionSettingsFromCloud() {
        try {
            // Only remove if we have Firebase and user is authenticated
            if (typeof firebaseService !== 'undefined' && 
                firebaseService.isAuthenticated && 
                firebaseService.isAuthenticated()) {
                
                await firebaseService.deleteEncryptionSettings();
                console.log('✅ Encryption settings removed from cloud');
            }
        } catch (error) {
            console.warn('Failed to remove encryption settings from cloud:', error);
            // Don't throw - this shouldn't prevent encryption from being disabled
        }
    }
}

// Export singleton instance
const encryptionService = new EncryptionService();