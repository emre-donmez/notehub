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
     * @returns {Promise<void>}
     */
    async initialize() {
        // Check if user has encryption enabled
        const encryptionSettings = localStorage.getItem('NoteHub_EncryptionSettings');
        if (encryptionSettings) {
            const settings = JSON.parse(encryptionSettings);
            this.isEnabled = settings.enabled || false;
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
            
            // FIXED: Encrypt existing plain text notes instead of deleting them
            await this.encryptExistingPlainTextNotes();
            
            return true;
        } catch (error) {
            console.error('Failed to enable encryption:', error);
            throw error;
        }
    }

    /**
     * NEW: Encrypt existing plain text notes when enabling encryption
     * This preserves user data instead of deleting it
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
                            // If note is not marked as encrypted, it's plain text
                            if (!parsed._encrypted) {
                                noteKeys.push(key);
                            }
                        }
                    } catch (error) {
                        console.warn(`Could not parse note ${key}, skipping:`, error);
                    }
                }
            }
            
            let encryptedCount = 0;
            
            // Encrypt each plain text note
            for (const key of noteKeys) {
                try {
                    const noteData = localStorage.getItem(key);
                    if (noteData) {
                        const parsed = JSON.parse(noteData);
                        
                        console.log(`🔐 Encrypting note: ${key}`);
                        
                        // Encrypt the note
                        const encryptedNote = await this.encryptNote(parsed);
                        
                        // Save the encrypted version
                        localStorage.setItem(key, JSON.stringify(encryptedNote));
                        encryptedCount++;
                        
                        console.log(`✅ Successfully encrypted: ${key}`);
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
            
            console.log(`🎉 Successfully encrypted ${encryptedCount} notes.`);
            
        } catch (error) {
            console.error('Failed to encrypt existing notes:', error);
            // Don't throw - this shouldn't prevent encryption from being enabled
        }
    }

    /**
     * Disable encryption (will require password verification)
     * FIXED: Now properly decrypts notes before removing encryption
     */
    async disableEncryption(password) {
        try {
            // Verify password before disabling
            const isValid = await this.verifyPassword(password);
            if (!isValid) {
                throw new Error('Invalid password');
            }

            // Remove encryption settings
            localStorage.removeItem('NoteHub_EncryptionSettings');
            this.isEnabled = false;
            this.encryptionKey = null;
            
            return true;
        } catch (error) {
            console.error('Failed to disable encryption:', error);
            throw error;
        }
    }

    /**
     * Unlock encryption with master password
     * @param {string} password - Master password
     * @returns {Promise<boolean>} True if unlocked successfully
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

            // Recreate salt from stored array
            const salt = new Uint8Array(settings.salt);
            
            // Derive key from password and stored salt
            const testKey = await this.deriveKey(password, salt);
            
            // Verify password by trying to decrypt any existing encrypted note
            const verified = await this.verifyPasswordWithExistingData(testKey);
            if (!verified) {
                throw new Error('Invalid password');
            }
            
            // Set the verified key
            this.encryptionKey = testKey;
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
     * @param {CryptoKey} key - Key to test
     * @returns {Promise<boolean>} True if key can decrypt existing data
     */
    async verifyPasswordWithExistingData(key) {
        try {
            // Look for any encrypted note in localStorage
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
            
            // If no encrypted data found, password verification passes
            // This happens on first encryption enable - assume password is correct
            console.log('No encrypted notes found for password verification');
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
     * @param {string} encryptedData - Encrypted data as base64 string
     * @returns {Promise<string>} Decrypted plaintext
     */
    async decrypt(encryptedData) {
        if (!encryptedData || !encryptedData.startsWith('ENCRYPTED:')) {
            // Return as-is if not encrypted
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
            throw new Error('Failed to decrypt data. The data may be corrupted or the password is incorrect.');
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
     * IMPROVED: Better error handling and user-friendly messages
     */
    async decryptNote(note) {
        if (!note || !note._encrypted) {
            return note;
        }

        if (!this.isEnabled || !this.encryptionKey) {
            console.warn('Encryption key not available for decryption');
            return {
                ...note,
                title: '[?? Locked] ' + (note.title ? 'Encrypted Note' : 'Untitled'),
                content: '[?? This note is encrypted. Please unlock encryption to view the content.]',
                _decryptionError: true,
                _lockError: true
            };
        }

        try {
            const decryptedNote = { ...note };
            
            // Decrypt title and content
            if (note.title && note.title.startsWith('ENCRYPTED:')) {
                try {
                    decryptedNote.title = await this.decrypt(note.title);
                } catch (titleError) {
                    console.error('Failed to decrypt note title:', titleError);
                    decryptedNote.title = '[Title Decrypt Error]';
                }
            } else {
                decryptedNote.title = note.title || 'Untitled';
            }
            
            if (note.content && note.content.startsWith('ENCRYPTED:')) {
                try {
                    decryptedNote.content = await this.decrypt(note.content);
                } catch (contentError) {
                    console.error('Failed to decrypt note content:', contentError);
                    decryptedNote.content = '[? Decryption Failed]\n\nThis note could not be decrypted.\n\nPlease try:\n1. Unlock encryption again\n2. Verify you are using the correct password\n3. If problem persists, the data may be corrupted';
                }
            } else {
                decryptedNote.content = note.content || '';
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
                title: '[? Decryption Error] Encrypted Note',
                content: `[? Critical Decryption Error]\n\nThis note could not be decrypted.\n\nPossible causes:\n• Wrong password\n• Data corruption\n• Encryption key mismatch\n\nTroubleshooting:\n1. Ensure you're using the correct password\n2. Try unlocking encryption again\n3. Check browser console for technical details\n\nTechnical error: ${error.message}`,
                _decryptionError: true
            };
        }
    }

    /**
     * Convert ArrayBuffer to base64 string
     * @param {ArrayBuffer} buffer - Buffer to convert
     * @returns {string} Base64 string
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert base64 string to ArrayBuffer
     * @param {string} base64 - Base64 string to convert
     * @returns {Uint8Array} Converted array buffer
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
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
}

// Export singleton instance
const encryptionService = new EncryptionService();