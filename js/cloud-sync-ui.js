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
        if (this.syncButton) {
            this.syncButton.addEventListener('click', () => {
                this.openSyncModal();
            });
        }

        // Modal close events
        const closeBtn = document.getElementById('sync-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeSyncModal();
            });
        }

        // Click outside modal to close
        if (this.syncModal) {
            this.syncModal.addEventListener('click', (e) => {
                if (e.target === this.syncModal) {
                    this.closeSyncModal();
                }
            });
        }

        // Storage type change
        document.querySelectorAll('input[name="storage-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleStorageTypeChange(e.target.value);
            });
        });

        // Authentication buttons
        const googleBtn = document.getElementById('sign-in-google');
        if (googleBtn) {
            googleBtn.addEventListener('click', () => {
                this.signInWithGoogle();
            });
        }

        const signOutBtn = document.getElementById('sign-out-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
                this.signOut();
            });
        }

        // Sync action buttons
        const manualSyncBtn = document.getElementById('manual-sync-btn');
        if (manualSyncBtn) {
            manualSyncBtn.addEventListener('click', () => {
                this.performManualSync();
            });
        }

        const downloadBtn = document.getElementById('download-cloud-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadFromCloud();
            });
        }

        const uploadBtn = document.getElementById('upload-local-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                this.uploadToCloud();
            });
        }

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
        if (element) {
            if (lastSyncTime) {
                const date = new Date(lastSyncTime);
                element.textContent = date.toLocaleString();
            } else {
                element.textContent = 'Never';
            }
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

        if (statusText && statusIcon) {
            if (status.storageType === 'cloud' && status.isAuthenticated) {
                statusText.textContent = 'Cloud Sync';
                statusIcon.src = 'icons/cloud.svg';
                statusIcon.alt = 'Cloud Sync';
            } else if (status.storageType === 'cloud' && !status.isAuthenticated) {
                statusText.textContent = 'Sign In Required';
                statusIcon.src = 'icons/lock.svg';
                statusIcon.alt = 'Sign In Required';
            } else {
                statusText.textContent = 'Local Storage';
                statusIcon.src = 'icons/user.svg';
                statusIcon.alt = 'Local Storage';
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
                this.showNotification('Signed in successfully! Checking for sync...', 'success');
                
                // Listen for sync results
                setTimeout(() => {
                    // The smart sync might have completed by now
                    if (storageService.syncEnabled) {
                        this.showNotification('Cloud sync is now active!', 'info');
                    }
                }, 2000);
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
     * Perform manual sync
     */
    async performManualSync() {
        try {
            if (typeof storageService !== 'undefined' && storageService.syncData) {
                // Show loading state
                this.showNotification('Syncing...', 'info');
                
                const result = await storageService.syncData();
                
                // Show result based on action taken
                if (result.success) {
                    if (result.action === 'none') {
                        this.showNotification('Everything is already in sync!', 'info');
                    } else {
                        this.showNotification(result.message, 'success');
                    }
                    this.updateLastSyncTime(new Date().toISOString());
                } else {
                    this.showNotification(result.message || 'Sync failed', 'error');
                }
            }
        } catch (error) {
            console.error('Manual sync failed:', error);
            this.showNotification('Sync failed. Please try again.', 'error');
        }
    }

    /**
     * Download data from cloud
     */
    async downloadFromCloud() {
        if (!confirm('This will replace your local notes with cloud data. Continue?')) {
            return;
        }

        try {
            if (typeof firebaseService !== 'undefined' && firebaseService.loadUserNotes) {
                const cloudData = await firebaseService.loadUserNotes();
                if (cloudData) {
                    if (typeof storageService !== 'undefined' && storageService.saveToLocalStorage) {
                        storageService.saveToLocalStorage(cloudData);
                        // Trigger app reload to reflect changes
                        window.location.reload();
                    }
                } else {
                    this.showNotification('No cloud data found', 'info');
                }
            }
        } catch (error) {
            console.error('Download failed:', error);
            this.showNotification('Download failed. Please try again.', 'error');
        }
    }

    /**
     * Upload local data to cloud
     */
    async uploadToCloud() {
        if (!confirm('This will replace your cloud data with local notes. Continue?')) {
            return;
        }

        try {
            if (typeof storageService !== 'undefined' && storageService.loadFromLocalStorage && 
                typeof firebaseService !== 'undefined' && firebaseService.saveUserNotes) {
                
                const localData = storageService.loadFromLocalStorage();
                if (localData) {
                    await firebaseService.saveUserNotes(localData);
                    this.showNotification('Local data uploaded to cloud!', 'success');
                } else {
                    this.showNotification('No local data found', 'info');
                }
            }
        } catch (error) {
            console.error('Upload failed:', error);
            this.showNotification('Upload failed. Please try again.', 'error');
        }
    }

    /**
     * Show notification to user
     * @param {string} message - Notification message
     * @param {string} type - Notification type ('success', 'error', 'info')
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Set basic styles
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '10px 20px',
            borderRadius: '5px',
            color: 'white',
            fontWeight: 'bold',
            zIndex: '10000',
            maxWidth: '300px',
            backgroundColor: type === 'success' ? '#4CAF50' : 
                             type === 'error' ? '#f44336' : '#2196F3'
        });

        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// Export singleton instance
const cloudSyncUI = new CloudSyncUI();