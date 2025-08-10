/**
 * Cloud Sync UI Components
 * Handles all UI elements related to cloud synchronization
 */
class CloudSyncUI {
    constructor() {
        this.syncModal = null;
        this.syncButton = null;
        this.syncIcon = null;
        this.isModalOpen = false;
        this.initialized = false;
    }

    /**
     * Initialize cloud sync UI components
     */
    initialize() {
        if (this.initialized) {
            this.ensureElementsVisible();
            return true;
        }
        
        try {
            // Get references to existing HTML elements
            this.syncModal = document.getElementById('sync-modal');
            this.syncButton = document.getElementById('sync-btn');
            this.syncIcon = document.getElementById('sync-icon');
            this.conflictModal = document.getElementById('conflict-modal');
            
            // Check if elements exist
            if (!this.syncModal || !this.syncButton || !this.syncIcon) {
                console.error('Cloud sync UI elements not found in DOM');
                return false;
            }
            
            // Always show sync button if Firebase is configured
            this.ensureElementsVisible();
            
            this.bindEvents();
            
            // Initialize UI state after a short delay to ensure Firebase is ready
            setTimeout(() => {
                this.updateInitialUI();
            }, 100);
            
            this.initialized = true;
            console.log('Cloud sync UI initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize cloud sync UI:', error);
            return false;
        }
    }

    /**
     * Ensure cloud sync elements are visible
     */
    ensureElementsVisible() {
        if (!this.syncButton) return;
        
        // Check if Firebase is enabled
        const firebaseEnabled = typeof appConfig !== 'undefined' && appConfig.ENABLE_FIREBASE;
        
        if (firebaseEnabled) {
            // Remove inline style attribute completely to clear 'display: none'
            this.syncButton.removeAttribute('style');
            
            // Add force-visible CSS class
            this.syncButton.classList.add('force-visible');
            
            // Also set inline styles as backup
            this.syncButton.style.setProperty('display', 'inline-flex', 'important');
            this.syncButton.style.setProperty('visibility', 'visible', 'important');
            this.syncButton.style.setProperty('opacity', '1', 'important');
        } else {
            this.syncButton.classList.remove('force-visible');
            this.syncButton.style.setProperty('display', 'none', 'important');
        }
    }

    /**
     * Update initial UI state
     */
    updateInitialUI() {
        if (typeof storageService !== 'undefined') {
            const status = storageService.getStorageStatus();
            this.updateUI(status);
        } else {
            // If storage service not ready, show basic local storage state
            this.updateUI({
                storageType: 'local',
                syncEnabled: false,
                isAuthenticated: false
            });
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Sync button click
        this.syncButton.addEventListener('click', () => {
            this.openSyncModal();
        });
        
        // Modal close events
        const closeBtn = document.getElementById('sync-modal-close');
        closeBtn.addEventListener('click', () => {
            this.closeSyncModal();
        });
        
        // Click outside modal to close
        this.syncModal.addEventListener('click', (e) => {
            if (e.target === this.syncModal) {
                this.closeSyncModal();
            }
        });

        // Storage type change
        document.querySelectorAll('input[name="storage-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleStorageTypeChange(e.target.value);
            });
        });

        // Authentication buttons
        const googleBtn = document.getElementById('sign-in-google');
        googleBtn.addEventListener('click', () => {
            this.signInWithGoogle();
        });

        const signOutBtn = document.getElementById('sign-out-btn');
        signOutBtn.addEventListener('click', () => {
            this.signOut();
        });

        // Listen to storage service status changes
        if (typeof storageService !== 'undefined' && storageService.onSyncStatusChange) {
            storageService.onSyncStatusChange((status) => {
                this.updateUI(status);
            });
        }
    }

    /**
     * Open sync modal
     */
    openSyncModal() {
        if (this.syncModal) {
            this.syncModal.style.display = 'flex';
            this.isModalOpen = true;
            this.updateModalContent();
        }
    }

    /**
     * Close sync modal
     */
    closeSyncModal() {
        if (this.syncModal) {
            this.syncModal.style.display = 'none';
            this.isModalOpen = false;
        }
    }

    /**
     * Update modal content based on current state
     */
    updateModalContent() {
        if (typeof storageService === 'undefined') {
            return;
        }

        const status = storageService.getStorageStatus();
        
        // Update storage type radio buttons
        const localRadio = document.getElementById('storage-local');
        const cloudRadio = document.getElementById('storage-cloud');
        
        if (localRadio && cloudRadio) {
            localRadio.checked = status.storageType === 'local';
            cloudRadio.checked = status.storageType === 'cloud';
        }

        // Show/hide sections based on storage type
        const authSection = document.getElementById('auth-section');
        const syncActions = document.getElementById('sync-actions');

        if (status.storageType === 'cloud') {
            if (authSection) authSection.style.display = 'block';
            
            if (status.isAuthenticated) {
                this.updateAuthenticatedUI(status.user);
                if (syncActions) syncActions.style.display = 'block';
                this.updateLastSyncTime(status.lastSyncTime);
            } else {
                this.updateSignedOutUI();
                if (syncActions) syncActions.style.display = 'none';
            }
        } else {
            if (authSection) authSection.style.display = 'none';
            if (syncActions) syncActions.style.display = 'none';
        }
    }

    /**
     * Update UI for authenticated user
     * @param {Object} user - Firebase user object
     */
    updateAuthenticatedUI(user) {
        const signedOut = document.getElementById('auth-signed-out');
        const signedIn = document.getElementById('auth-signed-in');

        if (signedOut && signedIn) {
            signedOut.style.display = 'none';
            signedIn.style.display = 'block';
        }

        // Update user info
        const avatar = document.getElementById('user-avatar');
        const name = document.getElementById('user-name');
        const email = document.getElementById('user-email');

        if (user && user.photoURL && avatar) {
            avatar.src = user.photoURL;
            avatar.style.display = 'block';
        } else if (avatar) {
            avatar.style.display = 'none';
        }

        if (name) name.textContent = (user && user.displayName) || 'User';
        if (email) email.textContent = (user && user.email) || '';
    }

    /**
     * Update UI for signed out state
     */
    updateSignedOutUI() {
        const signedOut = document.getElementById('auth-signed-out');
        const signedIn = document.getElementById('auth-signed-in');

        if (signedOut && signedIn) {
            signedOut.style.display = 'block';
            signedIn.style.display = 'none';
        }
    }

    /**
     * Update last sync time display
     * @param {string} lastSyncTime - ISO timestamp or null
     */
    updateLastSyncTime(lastSyncTime) {
        const element = document.getElementById('last-sync-time');
        if (lastSyncTime) {
            const date = new Date(lastSyncTime);
            element.textContent = date.toLocaleString();
        } else {
            element.textContent = 'Never';
        }        
    }

    /**
     * Update main UI based on sync status
     * @param {Object} status - Sync status object
     */
    updateUI(status) {
        // Update sync button icon and title based on storage status
        if (this.syncIcon && this.syncButton) {
            // Ensure sync button is visible (only if Firebase is enabled)
            if (typeof appConfig !== 'undefined' && appConfig.ENABLE_FIREBASE) {
                this.syncButton.style.display = 'inline-flex';
                this.syncButton.style.visibility = 'visible';
            }

            // Update icon and title based on current status
            if (status.storageType === 'cloud' && status.isAuthenticated) {
                this.syncIcon.src = 'assets/icons/cloud.svg';
                this.syncIcon.alt = 'Cloud Sync';
                this.syncButton.title = 'Cloud Sync (Connected)';
            } else if (status.storageType === 'cloud' && !status.isAuthenticated) {
                this.syncIcon.src = 'assets/icons/lock.svg';
                this.syncIcon.alt = 'Sign In Required';
                this.syncButton.title = 'Cloud Sync (Sign In Required)';
            } else {
                this.syncIcon.src = 'assets/icons/user.svg';
                this.syncIcon.alt = 'Local Storage';
                this.syncButton.title = 'Cloud Sync (Local Storage)';
            }
        }

        // Update modal if open
        if (this.isModalOpen) {
            this.updateModalContent();
        }
    }

    /**
     * Handle storage type change
     * @param {string} type - New storage type
     */
    async handleStorageTypeChange(type) {
        try {
            if (typeof storageService !== 'undefined' && storageService.setStorageType) {
                // Show loading notification
                this.showNotification('Changing storage type...', 'info');
                
                const result = await storageService.setStorageType(type);
                
                if (result.success) {
                    this.updateModalContent();
                    
                    // If reload is needed, close modal and reload after a short delay
                    if (result.shouldReload) {
                        this.closeSyncModal();
                        
                        // Show notification before reload
                        this.showNotification('Storage type changed! Loading notes...', 'success');
                        
                        // Reload the page to load data from the new storage
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to change storage type:', error);
            this.showNotification('Failed to change storage type', 'error');
        }
    }

    /**
     * Sign in with Google
     */
    async signInWithGoogle() {
        try {
            if (typeof firebaseService !== 'undefined' && firebaseService.signInWithGoogle) {
                await firebaseService.signInWithGoogle();
                
                // Smart sync will be triggered automatically by auth state change
                // Show a brief notification about successful sign-in
                this.showNotification('Signed in successfully! Your notes will sync automatically.', 'success');
            }
        } catch (error) {
            console.error('Google sign-in failed:', error);
            this.showNotification('Sign-in failed. Please try again.', 'error');
        }
    }

    /**
     * Sign out current user
     */
    async signOut() {
        try {
            if (typeof firebaseService !== 'undefined' && firebaseService.signOut) {
                await firebaseService.signOut();
                this.showNotification('Signed out successfully!', 'success');
            }
        } catch (error) {
            console.error('Sign-out failed:', error);
            this.showNotification('Sign-out failed. Please try again.', 'error');
        }
    }

    /**
     * Show notification using the global notification manager
     * @param {string} message - Notification message
     * @param {string} type - Notification type ('success', 'error', 'info', 'warning')
     * @param {Object} options - Optional configuration
     */
    showNotification(message, type = 'info', options = {}) {
        if (typeof notificationManager !== 'undefined') {
            return notificationManager.show(message, type, options);
        } else {
            // Fallback to console log if notification manager is not available
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
}

// Export singleton instance
const cloudSyncUI = new CloudSyncUI();