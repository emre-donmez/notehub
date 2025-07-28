/**
 * Encryption UI Manager
 * Handles user interface for encryption settings and password management
 */
class EncryptionUI {
    constructor() {
        this.isInitialized = false;
        this.encryptionModal = null;
        this.passwordModal = null;
    }

    /**
     * Initialize encryption UI components
     */
    initialize() {
        this.encryptionModal = document.getElementById('encryption-modal');
        this.passwordModal = document.getElementById('password-modal');
        
        if (this.encryptionModal) {
            this.setupEncryptionModal();
        }

        if (this.passwordModal) {
            this.setupPasswordModal();
        }

        // Set up encryption button event listener
        const encryptionBtn = document.getElementById('encryption-btn');
        if (encryptionBtn) {
            encryptionBtn.addEventListener('click', () => {
                this.openEncryptionModal();
            });
        }

        this.isInitialized = true;
        this.updateEncryptionStatus();
    }

    /**
     * Set up encryption settings modal
     */
    setupEncryptionModal() {
        // Close button
        const closeBtn = this.encryptionModal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeEncryptionModal();
            });
        }

        // Click outside to close
        this.encryptionModal.addEventListener('click', (e) => {
            if (e.target === this.encryptionModal) {
                this.closeEncryptionModal();
            }
        });

        // Enable encryption button
        const enableBtn = document.getElementById('enable-encryption-btn');
        if (enableBtn) {
            enableBtn.addEventListener('click', () => {
                this.showEnableEncryptionForm();
            });
        }

        // Disable encryption buttons (now with unique IDs)
        const disableLockedBtn = document.getElementById('disable-encryption-locked-btn');
        if (disableLockedBtn) {
            disableLockedBtn.addEventListener('click', () => {
                this.showDisableEncryptionForm();
            });
        }

        const disableUnlockedBtn = document.getElementById('disable-encryption-unlocked-btn');
        if (disableUnlockedBtn) {
            disableUnlockedBtn.addEventListener('click', () => {
                this.handleQuickDisableEncryption();
            });
        }

        // Enable encryption form submission
        const enableForm = document.getElementById('enable-encryption-form');
        if (enableForm) {
            enableForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEnableEncryption();
            });
        }

        // Disable encryption form submission
        const disableForm = document.getElementById('disable-encryption-form');
        if (disableForm) {
            disableForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleDisableEncryption();
            });
        }
    }

    /**
     * Set up password unlock modal
     */
    setupPasswordModal() {
        // Close button - PREVENT CLOSING if encryption is locked and required
        const closeBtn = this.passwordModal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                // Check if encryption is required and locked
                if (this.needsUnlock()) {
                    // Show warning instead of closing
                    this.showError('unlock-error', 'Password is required to access encrypted notes. You cannot close this dialog.');
                } else {
                    this.closePasswordModal();
                }
            });
        }

        // PREVENT clicking outside to close if encryption is required
        this.passwordModal.addEventListener('click', (e) => {
            if (e.target === this.passwordModal) {
                if (this.needsUnlock()) {
                    // Show warning instead of closing
                    this.showError('unlock-error', 'Password is required to access encrypted notes. Please enter your password.');
                } else {
                    this.closePasswordModal();
                }
            }
        });

        // Password form submission
        const passwordForm = document.getElementById('unlock-password-form');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleUnlockEncryption();
            });
        }
    }

    /**
     * Open encryption settings modal
     */
    openEncryptionModal() {
        if (!this.encryptionModal) return;

        this.updateEncryptionModalContent();
        this.encryptionModal.style.display = 'flex';
    }

    /**
     * Close encryption settings modal
     */
    closeEncryptionModal() {
        if (!this.encryptionModal) return;

        this.encryptionModal.style.display = 'none';
        // Reset all forms
        this.resetForms();
    }

    /**
     * Open password unlock modal
     */
    openPasswordModal() {
        if (!this.passwordModal) return;

        // Reset password form
        const passwordInput = document.getElementById('unlock-password');
        if (passwordInput) {
            passwordInput.value = '';
        }
        
        this.clearError('unlock-error');
        this.passwordModal.style.display = 'flex';
        
        // Focus on password input
        setTimeout(() => {
            if (passwordInput) passwordInput.focus();
        }, 100);
    }

    /**
     * Close password unlock modal
     */
    closePasswordModal() {
        if (!this.passwordModal) return;

        this.passwordModal.style.display = 'none';
    }

    /**
     * Update encryption modal content based on current state
     */
    updateEncryptionModalContent() {
        if (!encryptionService || typeof encryptionService.getStatus !== 'function') {
            performanceMonitor.log('warn', 'EncryptionService not yet available for modal content update');
            return;
        }

        const status = encryptionService.getStatus();
        
        // Show/hide sections based on encryption status
        const disabledSection = DOMUtils.getElementById('encryption-disabled');
        const enabledSection = DOMUtils.getElementById('encryption-enabled');
        const unlockedSection = DOMUtils.getElementById('encryption-unlocked');

        if (disabledSection && enabledSection && unlockedSection) {
            if (!status.enabled) {
                disabledSection.style.display = 'block';
                enabledSection.style.display = 'none';
                unlockedSection.style.display = 'none';
            } else if (!status.unlocked) {
                disabledSection.style.display = 'none';
                enabledSection.style.display = 'block';
                unlockedSection.style.display = 'none';
            } else {
                disabledSection.style.display = 'none';
                enabledSection.style.display = 'none';
                unlockedSection.style.display = 'block';
            }
        }

        // Update status information with improved messages
        const statusElement = DOMUtils.getElementById('encryption-status-info');
        if (statusElement) {
            let statusText = '';
            if (!status.available) {
                statusText = '❌ Encryption not available (Web Crypto API not supported)';
            } else if (!status.enabled) {
                statusText = '🔓 Encryption disabled - Your notes are stored in plain text';
            } else if (!status.unlocked) {
                statusText = '🔒 Encryption enabled but locked - Enter password to access your encrypted notes';
            } else {
                statusText = '🛡️ Encryption active and unlocked - Your notes are protected with end-to-end encryption';
            }
            statusElement.textContent = statusText;
        }

        // Update algorithm info with better visibility
        const algorithmElement = DOMUtils.getElementById('encryption-algorithm');
        if (algorithmElement && status.enabled) {
            algorithmElement.textContent = `🔐 Algorithm: ${status.algorithm}, Key Length: ${status.keyLength} bits`;
            algorithmElement.style.display = 'block';
        } else if (algorithmElement) {
            algorithmElement.style.display = 'none';
        }
    }

    /**
     * Update encryption status in main UI
     */
    updateEncryptionStatus() {
        if (!encryptionService || typeof encryptionService.getStatus !== 'function') {
            performanceMonitor.log('warn', 'EncryptionService not yet available');
            return;
        }

        const status = encryptionService.getStatus();
        const encryptionBtn = DOMUtils.getElementById('encryption-btn');
        const encryptionIcon = DOMUtils.getElementById('encryption-icon');
        
        if (!encryptionBtn || !encryptionIcon) return;

        // Update button appearance and tooltip
        if (!status.available) {
            encryptionBtn.style.display = 'none';
        } else if (!status.enabled) {
            encryptionBtn.style.display = 'block';
            encryptionIcon.src = 'assets/icons/unlock.svg';
            encryptionBtn.title = 'Enable Encryption';
            encryptionBtn.classList.remove('encrypted', 'locked');
        } else if (!status.unlocked) {
            encryptionBtn.style.display = 'block';
            encryptionIcon.src = 'assets/icons/lock.svg';
            encryptionBtn.title = 'Unlock Encryption';
            encryptionBtn.classList.remove('encrypted');
            encryptionBtn.classList.add('locked');
        } else {
            encryptionBtn.style.display = 'block';
            encryptionIcon.src = 'assets/icons/shield.svg';
            encryptionBtn.title = 'Encryption Active';
            encryptionBtn.classList.add('encrypted');
            encryptionBtn.classList.remove('locked');
        }
    }

    /**
     * Show enable encryption form
     */
    showEnableEncryptionForm() {
        this.hideAllForms();
        const form = document.getElementById('enable-encryption-form');
        if (form) {
            form.style.display = 'block';
            const passwordInput = document.getElementById('enable-password');
            if (passwordInput) passwordInput.focus();
        }
    }

    /**
     * Show disable encryption form
     */
    showDisableEncryptionForm() {
        this.hideAllForms();
        const form = document.getElementById('disable-encryption-form');
        if (form) {
            form.style.display = 'block';
            const passwordInput = document.getElementById('disable-password');
            if (passwordInput) passwordInput.focus();
        }
    }

    /**
     * Hide all forms in encryption modal
     */
    hideAllForms() {
        const forms = [
            'enable-encryption-form',
            'disable-encryption-form'
        ];

        forms.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                form.style.display = 'none';
            }
        });

        this.clearAllErrors();
    }

    /**
     * Reset all forms
     */
    resetForms() {
        const forms = document.querySelectorAll('.encryption-modal form');
        forms.forEach(form => {
            form.reset();
            form.style.display = 'none';
        });
        this.clearAllErrors();
    }

    /**
     * Handle enable encryption form submission
     * FIXED: Now preserves existing notes
     */
    async handleEnableEncryption() {
        const passwordInput = document.getElementById('enable-password');
        const confirmInput = document.getElementById('enable-password-confirm');
        
        if (!passwordInput || !confirmInput) return;

        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;

        // Validate inputs
        if (!password) {
            this.showError('enable-error', 'Please enter a password');
            return;
        }

        if (password.length < 8) {
            this.showError('enable-error', 'Password must be at least 8 characters long');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('enable-error', 'Passwords do not match');
            return;
        }

        try {
            this.showLoading('enable-encryption-btn', 'Enabling encryption and encrypting existing notes...');
            
            await encryptionService.enableEncryption(password);
            
            this.showSuccess('enable-success', 'Encryption enabled successfully! Your existing notes have been encrypted.');
            this.updateEncryptionStatus();
            
            // Close modal after success and refresh to show encrypted notes
            setTimeout(() => {
                this.closeEncryptionModal();
                window.location.reload();
            }, 2000); // Longer delay to show success message

        } catch (error) {
            this.showError('enable-error', error.message);
        } finally {
            this.hideLoading('enable-encryption-btn', 'Enable Encryption');
        }
    }

    /**
     * Handle disable encryption form submission
     */
    async handleDisableEncryption() {
        const passwordInput = document.getElementById('disable-password');
        
        if (!passwordInput) return;

        const password = passwordInput.value;

        if (!password) {
            this.showError('disable-error', 'Please enter your password');
            return;
        }

        try {
            this.showLoading('disable-encryption-submit-btn', 'Disabling encryption...');
            
            // FIRST: Verify password
            const isValidPassword = await encryptionService.verifyPassword(password);
            if (!isValidPassword) {
                throw new Error('Invalid password');
            }

            // SECOND: Decrypt all encrypted notes and save as plain text BEFORE disabling encryption
            await this.decryptAndSaveAllNotes();
            
            // THIRD: Now disable encryption (this will only remove settings, not data)
            await encryptionService.disableEncryption(password);
            
            this.showSuccess('disable-success', 'Encryption disabled successfully!');
            this.updateEncryptionStatus();
            
            // Close modal after success
            setTimeout(() => {
                this.closeEncryptionModal();
                // Refresh page to load decrypted notes
                window.location.reload();
            }, 1500);

        } catch (error) {
            this.showError('disable-error', error.message);
        } finally {
            this.hideLoading('disable-encryption-submit-btn', 'Disable Encryption');
        }
    }

    /**
     * Handle unlock encryption form submission
     */
    async handleUnlockEncryption() {
        const passwordInput = document.getElementById('unlock-password');
        
        if (!passwordInput) return;

        const password = passwordInput.value;

        if (!password) {
            this.showError('unlock-error', 'Please enter your password');
            return;
        }

        try {
            this.showLoading('unlock-encryption-btn', 'Unlocking...');
            
            await encryptionService.unlockEncryption(password);
            
            this.updateEncryptionStatus();
            this.closePasswordModal();
            
            // Show success notification
            this.showNotification('Encryption unlocked successfully!', 'success');
            
            // INSTEAD OF RELOADING: Trigger app to load decrypted data
            if (window.noteHubApp && typeof window.noteHubApp.refreshAfterUnlock === 'function') {
                // Load data without page reload
                await window.noteHubApp.refreshAfterUnlock();
            } else {
                // Fallback to reload only if needed
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }

        } catch (error) {
            this.showError('unlock-error', error.message);
        } finally {
            this.hideLoading('unlock-encryption-btn', 'Unlock');
        }
    }

    /**
     * Handle quick disable encryption (directly from unlocked state)
     */
    async handleQuickDisableEncryption() {
        // Show a confirmation dialog first
        const confirmed = confirm('⚠️ Are you sure you want to disable encryption?\n\nThis will remove encryption from all your notes and they will be stored as plain text.\n\nClick OK to continue and enter your password.');
        
        if (!confirmed) {
            return; // User cancelled
        }

        // Prompt for password
        const password = prompt('🔐 Enter your master password to disable encryption:');
        
        if (!password) {
            return; // User cancelled or entered empty password
        }

        try {
            // Show loading notification
            this.showNotification('Disabling encryption and decrypting notes...', 'info');
            
            // FIRST: Verify password
            const isValidPassword = await encryptionService.verifyPassword(password);
            if (!isValidPassword) {
                throw new Error('Invalid password');
            }

            // SECOND: Decrypt all encrypted notes and save as plain text BEFORE disabling encryption
            await this.decryptAndSaveAllNotes();
            
            // THIRD: Now disable encryption (this will only remove settings, not data)
            await encryptionService.disableEncryption(password);
            
            // Show success notification
            this.showNotification('🔓 Encryption disabled successfully! Your notes are now stored as plain text.', 'success');
            this.updateEncryptionStatus();
            
            // Close modal and refresh page
            setTimeout(() => {
                this.closeEncryptionModal();
                window.location.reload();
            }, 1500);

        } catch (error) {
            // Show error notification
            this.showNotification(`❌ Failed to disable encryption: ${error.message}`, 'error');
        }
    }

    /**
     * Decrypt all encrypted notes and save them as plain text
     * This prevents data loss when disabling encryption
     */
    async decryptAndSaveAllNotes() {
        performanceMonitor.startTimer('decrypt_all_notes');

        try {
            performanceMonitor.log('info', '🔓 Decrypting and saving all notes as plain text');
            
            // Get all localStorage keys that are notes
            const noteKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('NoteHub_Note_')) {
                    noteKeys.push(key);
                }
            }

            let decryptedCount = 0;
            
            // Process each note
            for (const key of noteKeys) {
                try {
                    const noteData = StorageUtils.getItem(key);
                    if (noteData && noteData._encrypted) {
                        performanceMonitor.log('debug', `🔓 Decrypting note: ${key}`);
                        
                        const decryptedNote = await encryptionService.decryptNote(noteData);
                        
                        // Remove encryption metadata and save as plain text
                        const plainTextNote = ValidationManager.sanitizeNote({
                            id: decryptedNote.id,
                            title: decryptedNote.title,
                            content: decryptedNote.content,
                            lastModified: new Date().toISOString()
                        });
                        
                        // Save the plain text version
                        StorageUtils.setItem(key, plainTextNote);
                        decryptedCount++;
                        
                        performanceMonitor.log('debug', `✅ Successfully decrypted and saved: ${key}`);
                    }
                } catch (noteError) {
                    performanceMonitor.recordError(noteError, `decrypt_note_${key}`);
                }
            }
            
            const duration = performanceMonitor.endTimer('decrypt_all_notes', {
                notesProcessed: noteKeys.length,
                notesDecrypted: decryptedCount
            });
            
            performanceMonitor.log('info', `🎉 Successfully decrypted ${decryptedCount} notes in ${duration.toFixed(2)}ms`);
            
        } catch (error) {
            performanceMonitor.recordError(error, 'decrypt_all_notes');
            throw new Error('Failed to decrypt notes before disabling encryption. Your data is still encrypted and safe.');
        }
    }

    /**
     * Check if encryption needs to be unlocked for note access
     * @returns {boolean} True if unlock is needed
     */
    needsUnlock() {
        // Güvenli kontrol: encryptionService var mı?
        if (!encryptionService || typeof encryptionService.getStatus !== 'function') {
            return false;
        }
        
        const status = encryptionService.getStatus();
        return status.enabled && !status.unlocked;
    }

    /**
     * Prompt user to unlock encryption if needed
     * @returns {Promise<boolean>} True if unlocked or not needed
     */
    async promptUnlockIfNeeded() {
        if (!this.needsUnlock()) return true;

        return new Promise((resolve) => {
            this.openPasswordModal();
            
            // Create a persistent unlock handler that cannot be cancelled
            this.handleUnlockEncryption = async () => {
                try {
                    const passwordInput = document.getElementById('unlock-password');
                    if (!passwordInput) return;

                    const password = passwordInput.value;
                    if (!password) {
                        this.showError('unlock-error', 'Please enter your password');
                        return;
                    }

                    this.showLoading('unlock-encryption-btn', 'Unlocking...');
                    
                    await encryptionService.unlockEncryption(password);
                    
                    this.updateEncryptionStatus();
                    this.closePasswordModal();
                    
                    // Show success notification
                    this.showNotification('Encryption unlocked successfully!', 'success');
                    
                    // Resolve the promise with success - NO RELOAD!
                    resolve(true);

                } catch (error) {
                    this.showError('unlock-error', error.message);
                    this.hideLoading('unlock-encryption-btn', 'Unlock');
                }
            };
        });
    }

    /**
     * Show error message
     * @param {string} elementId - Error element ID
     * @param {string} message - Error message
     */
    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            errorElement.className = 'form-message error-message';
        }
    }

    /**
     * Show success message
     * @param {string} elementId - Success element ID
     * @param {string} message - Success message
     */
    showSuccess(elementId, message) {
        const successElement = document.getElementById(elementId);
        if (successElement) {
            successElement.textContent = message;
            successElement.style.display = 'block';
            successElement.className = 'form-message success-message';
        }
    }

    /**
     * Clear error message
     * @param {string} elementId - Error element ID
     */
    clearError(elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }
    }

    /**
     * Clear all error messages
     */
    clearAllErrors() {
        const errorElements = document.querySelectorAll('.form-message');
        errorElements.forEach(element => {
            element.style.display = 'none';
            element.textContent = '';
        });
    }

    /**
     * Show loading state on button
     * @param {string} buttonId - Button element ID
     * @param {string} loadingText - Loading text
     */
    showLoading(buttonId, loadingText) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = loadingText;
        }
    }

    /**
     * Hide loading state on button
     * @param {string} buttonId - Button element ID
     * @param {string} originalText - Original button text
     */
    hideLoading(buttonId, originalText) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    /**
     * Show notification message using NotificationManager
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     */
    showNotification(message, type) {
        if (typeof notificationManager !== 'undefined') {
            notificationManager.show(message, type);
        } else if (typeof cloudSyncUI !== 'undefined' && cloudSyncUI.showNotification) {
            cloudSyncUI.showNotification(message, type);
        } else {
            // Fallback to console and alert
            console.log(`[${type}] ${message}`);
            if (type === 'error') {
                alert(message);
            }
        }
    }
}

// Export singleton instance
const encryptionUI = new EncryptionUI();const encryptionUI = new EncryptionUI();