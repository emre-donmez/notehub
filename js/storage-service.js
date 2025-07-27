/**
 * Storage Service
 * Unified storage interface that handles both localStorage and Firebase storage
 */
class StorageService {
    constructor() {
        this.storageType = 'local'; // 'local' or 'cloud'
        this.syncEnabled = false;
        this.lastSyncTime = null;
        this.syncStatusCallbacks = [];
    }

    /**
     * Initialize storage service
     * @param {string} defaultType - Default storage type ('local' or 'cloud')
     * @returns {Promise<void>}
     */
    async initialize(defaultType = 'local') {
        // Load user preference from localStorage
        const savedType = localStorage.getItem('NoteHub_StorageType') || defaultType;
        this.storageType = savedType;
        
        // Load last sync time
        this.lastSyncTime = localStorage.getItem('NoteHub_LastSyncTime');
        
        // Set up Firebase auth state listener if Firebase is initialized
        if (firebaseService.isInitialized) {
            firebaseService.onAuthStateChange((user) => {
                this.handleAuthStateChange(user);
            });
        }
    }

    /**
     * Handle authentication state changes
     * @param {Object|null} user - Firebase user object
     */
    handleAuthStateChange(user) {
        if (user) {
            // User signed in - enable cloud sync if needed
            if (this.storageType === 'cloud') {
                this.enableSync();
            }
        } else {
            // User signed out - disable cloud sync
            this.disableSync();
        }
        
        // Notify listeners
        this.syncStatusCallbacks.forEach(callback => {
            callback({
                isAuthenticated: user !== null,
                syncEnabled: this.syncEnabled,
                storageType: this.storageType
            });
        });
    }

    /**
     * Add sync status change listener
     * @param {Function} callback - Callback function
     */
    onSyncStatusChange(callback) {
        this.syncStatusCallbacks.push(callback);
    }

    /**
     * Set storage type
     * @param {string} type - Storage type ('local' or 'cloud')
     * @returns {Promise<void>}
     */
    async setStorageType(type) {
        if (type === this.storageType) return;

        const oldType = this.storageType;
        this.storageType = type;
        
        // Save preference
        localStorage.setItem('NoteHub_StorageType', type);

        if (type === 'cloud') {
            await this.enableSync();
        } else {
            this.disableSync();
        }

        // Notify listeners
        this.syncStatusCallbacks.forEach(callback => {
            callback({
                isAuthenticated: firebaseService.isAuthenticated(),
                syncEnabled: this.syncEnabled,
                storageType: this.storageType,
                changed: true,
                oldType: oldType
            });
        });
    }

    /**
     * Enable cloud sync
     * @returns {Promise<boolean>} True if sync enabled successfully
     */
    async enableSync() {
        if (!firebaseService.isInitialized) {
            console.warn('Firebase not initialized, cannot enable sync');
            return false;
        }

        if (!firebaseService.isAuthenticated()) {
            console.warn('User not authenticated, cannot enable sync');
            return false;
        }

        this.syncEnabled = true;
        return true;
    }

    /**
     * Disable cloud sync
     */
    disableSync() {
        this.syncEnabled = false;
    }

    /**
     * Save data to current storage
     * @param {Object} data - Data to save
     * @returns {Promise<boolean>} True if saved successfully
     */
    async saveData(data) {
        try {
            // Always save to localStorage as backup
            this.saveToLocalStorage(data);

            // Also save to cloud if sync is enabled
            if (this.syncEnabled && this.storageType === 'cloud') {
                await firebaseService.saveUserNotes(data);
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem('NoteHub_LastSyncTime', this.lastSyncTime);
            }

            return true;
        } catch (error) {
            console.error('Failed to save data:', error);
            // If cloud save fails, at least we have localStorage backup
            return this.storageType === 'local';
        }
    }

    /**
     * Load data from current storage
     * @returns {Promise<Object|null>} Loaded data or null
     */
    async loadData() {
        try {
            if (this.syncEnabled && this.storageType === 'cloud') {
                // Try to load from cloud first
                const cloudData = await firebaseService.loadUserNotes();
                if (cloudData) {
                    // Also update localStorage with cloud data
                    this.saveToLocalStorage(cloudData);
                    return cloudData;
                }
            }

            // Fallback to localStorage
            return this.loadFromLocalStorage();
        } catch (error) {
            console.error('Failed to load data from cloud, using localStorage:', error);
            return this.loadFromLocalStorage();
        }
    }

    /**
     * Sync data between local and cloud storage
     * @returns {Promise<Object>} Sync result object
     */
    async syncData() {
        if (!this.syncEnabled || !firebaseService.isAuthenticated()) {
            throw new Error('Sync not available');
        }

        try {
            const localData = this.loadFromLocalStorage();
            const cloudData = await firebaseService.loadUserNotes();

            let syncResult = {
                success: false,
                action: 'none',
                message: ''
            };

            if (!cloudData && localData) {
                // Upload local data to cloud
                await firebaseService.saveUserNotes(localData);
                syncResult = {
                    success: true,
                    action: 'upload',
                    message: 'Local data uploaded to cloud'
                };
            } else if (cloudData && !localData) {
                // Download cloud data to local
                this.saveToLocalStorage(cloudData);
                syncResult = {
                    success: true,
                    action: 'download',
                    message: 'Cloud data downloaded to local'
                };
            } else if (cloudData && localData) {
                // Both exist - need to merge or choose
                // For now, we'll use cloud data as source of truth
                this.saveToLocalStorage(cloudData);
                syncResult = {
                    success: true,
                    action: 'download',
                    message: 'Cloud data synchronized to local'
                };
            } else {
                syncResult = {
                    success: true,
                    action: 'none',
                    message: 'No data to sync'
                };
            }

            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('NoteHub_LastSyncTime', this.lastSyncTime);

            return syncResult;
        } catch (error) {
            console.error('Sync failed:', error);
            throw error;
        }
    }

    /**
     * Save data to localStorage
     * @param {Object} data - Data to save
     */
    saveToLocalStorage(data) {
        try {
            localStorage.setItem('NoteHub', JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            throw error;
        }
    }

    /**
     * Load data from localStorage
     * @returns {Object|null} Loaded data or null
     */
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('NoteHub');
            return savedData ? JSON.parse(savedData) : null;
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return null;
        }
    }

    /**
     * Get storage status information
     * @returns {Object} Status information
     */
    getStorageStatus() {
        return {
            storageType: this.storageType,
            syncEnabled: this.syncEnabled,
            isAuthenticated: firebaseService.isAuthenticated(),
            lastSyncTime: this.lastSyncTime,
            user: firebaseService.getCurrentUser()
        };
    }
}

// Export singleton instance
const storageService = new StorageService();