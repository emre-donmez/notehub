/**
 * Cloud Sync UI Components
 * Handles all UI elements related to cloud synchronization
 */
class CloudSyncUI {
    constructor() {
        this.syncModal = null;
        this.statusIndicator = null;
        this.syncButton = null;
        this.isModalOpen = false;
    }

    /**
     * Initialize cloud sync UI components
     */
    initialize() {
        try {
            // Get references to existing HTML elements
            this.syncModal = document.getElementById('sync-modal');
            this.statusIndicator = document.getElementById('sync-status');
            this.syncButton = document.getElementById('sync-btn');
            this.conflictModal = document.getElementById('conflict-modal');
            
            // Check if elements exist
            if (!this.syncModal || !this.statusIndicator || !this.syncButton) {
                console.error('Cloud sync UI elements not found in DOM');
                return false;
            }
            
            // Show the elements
            this.statusIndicator.style.display = 'flex';
            this.syncButton.style.display = 'flex';
            
            this.bindEvents();
            console.log('Cloud sync UI initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize cloud sync UI:', error);
            return false;
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
        // Update status indicator
        const statusText = document.querySelector('.sync-status-text');
        const statusIconContainer = document.getElementById('sync-status-icon');
        const statusIcon = statusIconContainer ? statusIconContainer.querySelector('img') : null;

        if (status.storageType === 'cloud' && status.isAuthenticated) {
            statusText.textContent = 'Cloud Sync';
            statusIcon.src = 'assets/icons/cloud.svg';
            statusIcon.alt = 'Cloud Sync';
        } else if (status.storageType === 'cloud' && !status.isAuthenticated) {
            statusText.textContent = 'Sign In Required';
            statusIcon.src = 'assets/icons/lock.svg';
            statusIcon.alt = 'Sign In Required';
        } else {
            statusText.textContent = 'Local Storage';
            statusIcon.src = 'assets/icons/user.svg';
            statusIcon.alt = 'Local Storage';
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
                await storageService.setStorageType(type);
                this.updateModalContent();
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