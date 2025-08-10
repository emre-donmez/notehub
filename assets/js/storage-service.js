/**
 * Storage Service
 * Unified storage interface that handles both localStorage and Firebase storage
 * Now supports document-based storage for better scalability
 */
class StorageService {
    constructor() {
        this.storageType = 'local'; // 'local' or 'cloud'
        this.syncEnabled = false;
        this.lastSyncTime = null;
        this.syncStatusCallbacks = [];
        this.cache = new Map(); // Note cache for better performance
        this.isPageVisible = true;
        this.lastFocusTime = Date.now();
        this.isPageLoad = false; // Flag to track if this is initial page load
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

        console.log(`Storage service initialized with type: ${this.storageType}`);

        // Set up page visibility and focus listeners for cloud data refresh
        this.setupPageVisibilityListeners();
        
        // Check for page refresh and handle it
        this.handlePageRefresh();
    }

    /**
     * Set up page visibility and window focus listeners
     * This ensures cloud data is refreshed when user returns to the tab
     */
    setupPageVisibilityListeners() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Page became visible
                this.isPageVisible = true;
                this.handlePageBecameVisible();
            } else {
                // Page became hidden
                this.isPageVisible = false;
            }
        });

        // Handle window focus events (for cases where visibilitychange doesn't fire)
        window.addEventListener('focus', () => {
            this.handlePageBecameVisible();
        });

        // Track when page loses focus
        window.addEventListener('blur', () => {
            this.lastFocusTime = Date.now();
        });
    }

    /**
     * Handle when page becomes visible or focused
     * Refresh cloud data if using cloud storage and enough time has passed
     */
    async handlePageBecameVisible() {
        // Only refresh if using cloud storage, authenticated, and enough time has passed
        if (this.storageType === 'cloud' && 
            this.syncEnabled && 
            firebaseService.isAuthenticated()) {
            
            const timeSinceLastFocus = Date.now() - this.lastFocusTime;
            const shouldRefresh = timeSinceLastFocus > 5000; // 5 seconds threshold
            
            if (shouldRefresh) {
                console.log('Page became visible, refreshing cloud data...');
                await this.refreshDataFromCloud();
            }
        }
        
        this.lastFocusTime = Date.now();
    }

    /**
     * Refresh data from cloud and notify main app
     */
    async refreshDataFromCloud() {
        try {
            console.log('Refreshing data from cloud...');
            
            // Load fresh data from cloud
            const cloudData = await firebaseService.loadUserNotes();
            
            if (cloudData) {
                // Cache the fresh data to localStorage for offline access
                this.saveToLocalStorage(cloudData);
                
                // Clear in-memory cache to ensure fresh data
                this.cache.clear();
                
                // Notify the main app that fresh data is available
                // We'll emit a custom event for this
                const event = new CustomEvent('cloudDataRefreshed', {
                    detail: { data: cloudData }
                });
                document.dispatchEvent(event);
                
                console.log('Cloud data refreshed successfully');
                return true;
            } else {
                console.log('No cloud data found during refresh');
                return false;
            }
        } catch (error) {
            console.error('Failed to refresh cloud data:', error);
            return false;
        }
    }

    /**
     * Handle page refresh/reload scenario
     * This ensures fresh data is loaded when page is reloaded
     */
    async handlePageRefresh() {
        // Set a flag that page was just loaded
        this.isPageLoad = true;
        
        // Check immediately if we should refresh data - no need to wait
        this.checkForInitialCloudRefresh();
    }

    /**
     * Check if we should perform initial cloud refresh on page load
     */
    async checkForInitialCloudRefresh() {
        if (this.storageType === 'cloud' && 
            this.syncEnabled && 
            firebaseService.isAuthenticated() && 
            this.isPageLoad) {
            
            console.log('Page loaded with cloud storage, checking for fresh data...');
            await this.refreshDataFromCloud();
            this.isPageLoad = false; // Reset flag
        }
    }

    /**
     * Handle authentication state changes
     * @param {Object|null} user - Firebase user object
     */
    async handleAuthStateChange(user) {
        if (user) {
            // User signed in
            console.log('User authenticated:', user.email);
            if (this.storageType === 'cloud') {
                const syncEnabled = await this.enableSync();
                if (syncEnabled) {
                    console.log('Cloud sync enabled after authentication');
                    
                    // If this is during page load, check for fresh data immediately
                    if (this.isPageLoad) {
                        this.checkForInitialCloudRefresh();
                    }
                }
            }
        } else {
            // User signed out - disable cloud sync and clear cache
            console.log('User signed out, disabling cloud sync');
            this.disableSync();
            this.cache.clear();
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
     * Compare two data objects to check if they are identical
     * @param {Object} data1 - First data object
     * @param {Object} data2 - Second data object
     * @returns {boolean} True if data is identical
     */
    compareData(data1, data2) {
        if (!data1 || !data2) return false;
        
        // Compare basic properties
        if (data1.activeTabId !== data2.activeTabId) {
            return false;
        }
        
        // Compare tabs array
        const tabs1 = data1.tabs || [];
        const tabs2 = data2.tabs || [];
        
        if (tabs1.length !== tabs2.length) {
            return false;
        }
        
        // Sort tabs by id to ensure consistent comparison
        const sortedTabs1 = [...tabs1].sort((a, b) => a.id - b.id);
        const sortedTabs2 = [...tabs2].sort((a, b) => a.id - b.id);
        
        // Compare each tab
        for (let i = 0; i < sortedTabs1.length; i++) {
            const tab1 = sortedTabs1[i];
            const tab2 = sortedTabs2[i];
            
            if (tab1.id !== tab2.id || 
                tab1.title !== tab2.title || 
                tab1.content !== tab2.content) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Check if data contains meaningful content (not just empty tabs)
     * @param {Object} data - Data object to check
     * @returns {boolean} True if data has meaningful content
     */
    hasMeaningfulData(data) {
        if (!data || !data.tabs || !Array.isArray(data.tabs) || data.tabs.length === 0) {
            return false;
        }
        
        // Check if any tab has non-empty content or non-default title
        return data.tabs.some(tab => {
            const hasContent = tab.content && tab.content.trim().length > 0;
            const hasCustomTitle = tab.title && !tab.title.match(/^Note \d+$/);
            return hasContent || hasCustomTitle;
        });
    }

    /**
     * Perform smart sync for storage type switching
     * Only used when switching from local to cloud
     * @returns {Promise<Object>} Sync result
     */
    async performSmartSync() {
        if (!this.syncEnabled || !firebaseService.isAuthenticated()) {
            throw new Error('Smart sync not available - user not authenticated');
        }

        try {
            const localData = this.loadFromLocalStorage();
            const cloudData = await firebaseService.loadUserNotes();

            // Check if both local and cloud have meaningful data
            const hasLocalData = this.hasMeaningfulData(localData);
            const hasCloudData = this.hasMeaningfulData(cloudData);

            let syncResult = {
                success: false,
                action: 'none',
                message: '',
                requiresUserInput: false
            };

            if (!hasLocalData && !hasCloudData) {
                // No meaningful data anywhere - nothing to sync
                syncResult = {
                    success: true,
                    action: 'none',
                    message: 'No notes found. Start writing your first note!',
                    requiresUserInput: false
                };
            } else if (!hasLocalData && hasCloudData) {
                // Only cloud has meaningful data - no need to do anything since we'll load from cloud
                syncResult = {
                    success: true,
                    action: 'none',
                    message: 'Cloud notes ready to load',
                    requiresUserInput: false
                };
            } else if (hasLocalData && !hasCloudData) {
                // Only local has meaningful data - upload it automatically
                await firebaseService.saveUserNotes(localData);
                syncResult = {
                    success: true,
                    action: 'upload',
                    message: 'Your local notes have been uploaded to cloud',
                    requiresUserInput: false
                };
                
                // Show notification
                this.showSmartSyncNotification(syncResult.message, 'success');
            } else {
                // Both have meaningful data - check if they are identical
                if (this.compareData(localData, cloudData)) {
                    // Data is identical - no conflict
                    syncResult = {
                        success: true,
                        action: 'none',
                        message: 'Local and cloud data are already in sync!',
                        requiresUserInput: false
                    };
                } else {
                    // Data is different - ask user what to do
                    syncResult = await this.handleDataConflict(localData, cloudData);
                }
            }

            if (syncResult.success && !syncResult.requiresUserInput) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem('NoteHub_LastSyncTime', this.lastSyncTime);
            }

            return syncResult;
        } catch (error) {
            console.error('Smart sync failed:', error);
            this.showSmartSyncNotification('Smart sync failed. Please try manual sync.', 'error');
            throw error;
        }
    }

    /**
     * Show smart sync notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type ('success', 'error', 'info', 'warning')
     */
    showSmartSyncNotification(message, type) {
        // Use global notification manager if available
        if (typeof notificationManager !== 'undefined') {
            notificationManager.show(message, type);
        } else if (typeof cloudSyncUI !== 'undefined' && cloudSyncUI.showNotification) {
            // Fallback to cloud sync UI notification
            cloudSyncUI.showNotification(message, type);
        } else {
            // Final fallback to console log
            console.log(`Smart Sync [${type}]: ${message}`);
        }
    }

    /**
     * Handle data conflicts when both local and cloud have data
     * @param {Object} localData - Local storage data
     * @param {Object} cloudData - Cloud storage data
     * @returns {Promise<Object>} Sync result
     */
    async handleDataConflict(localData, cloudData) {
        return new Promise((resolve) => {
            // Show conflict modal and set up data
            this.showConflictModal(localData, cloudData, resolve);
        });
    }

    /**
     * Show conflict modal with data and event handlers
     * @param {Object} localData - Local storage data
     * @param {Object} cloudData - Cloud storage data
     * @param {Function} resolve - Promise resolve function
     */
    showConflictModal(localData, cloudData, resolve) {
        const modal = document.getElementById('conflict-modal');
        if (!modal) {
            console.error('Conflict modal not found in DOM');
            resolve({
                success: false,
                action: 'none',
                message: 'Conflict modal not available',
                requiresUserInput: false
            });
            return;
        }

        // Update modal content with note counts
        const localNoteCount = localData.tabs ? localData.tabs.length : 0;
        const cloudNoteCount = cloudData.tabs ? cloudData.tabs.length : 0;

        const localCountElement = document.getElementById('local-note-count');
        const cloudCountElement = document.getElementById('cloud-note-count');

        if (localCountElement) {
            localCountElement.textContent = `${localNoteCount} note${localNoteCount !== 1 ? 's' : ''}`;
        }
        if (cloudCountElement) {
            cloudCountElement.textContent = `${cloudNoteCount} note${cloudNoteCount !== 1 ? 's' : ''}`;
        }

        // Get buttons
        const keepLocalBtn = document.getElementById('keep-local-btn');
        const keepCloudBtn = document.getElementById('keep-cloud-btn');

        // Remove existing event listeners by cloning nodes
        const newKeepLocalBtn = keepLocalBtn.cloneNode(true);
        const newKeepCloudBtn = keepCloudBtn.cloneNode(true);
        keepLocalBtn.parentNode.replaceChild(newKeepLocalBtn, keepLocalBtn);
        keepCloudBtn.parentNode.replaceChild(newKeepCloudBtn, keepCloudBtn);

        // Add event listeners
        newKeepLocalBtn.addEventListener('click', async () => {
            try {
                // Upload local data to cloud (replace cloud data)
                await firebaseService.saveUserNotes(localData);
                this.hideConflictModal();
                resolve({
                    success: true,
                    action: 'upload',
                    message: 'Local notes uploaded to cloud. Cloud data has been replaced.',
                    requiresUserInput: false
                });
            } catch (error) {
                console.error('Failed to upload local data:', error);
                this.hideConflictModal();
                resolve({
                    success: false,
                    action: 'upload',
                    message: 'Failed to upload local notes to cloud',
                    requiresUserInput: false
                });
            }
        });

        newKeepCloudBtn.addEventListener('click', async () => {
            try {
                // We don't need to download here, just resolve - app will load from cloud
                this.hideConflictModal();
                resolve({
                    success: true,
                    action: 'download',
                    message: 'Cloud notes will be loaded.',
                    requiresUserInput: false,
                    shouldReload: true
                });
            } catch (error) {
                console.error('Failed to process cloud selection:', error);
                this.hideConflictModal();
                resolve({
                    success: false,
                    action: 'download',
                    message: 'Failed to select cloud notes',
                    requiresUserInput: false
                });
            }
        });

        // Show modal
        modal.style.display = 'flex';

        // Prevent closing modal without making a choice
        // Add escape key prevention
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                // Show a brief notification that user must make a choice
                this.showSmartSyncNotification('Please choose which notes to keep - you cannot cancel this operation.', 'warning');
            }
        };
        
        document.addEventListener('keydown', handleKeyPress);
        
        // Store the handler so we can remove it later
        modal._keyHandler = handleKeyPress;
    }

    /**
     * Hide conflict modal
     */
    hideConflictModal() {
        const modal = document.getElementById('conflict-modal');
        if (modal) {
            modal.style.display = 'none';
            
            // Remove the keydown event listener if it exists
            if (modal._keyHandler) {
                document.removeEventListener('keydown', modal._keyHandler);
                delete modal._keyHandler;
            }
        }
    }

    /**
     * Add sync status change listener
     * @param {Function} callback - Callback function
     */
    onSyncStatusChange(callback) {
        this.syncStatusCallbacks.push(callback);
    }

    /**
     * Set storage type with improved cloud switching logic
     * @param {string} type - Storage type ('local' or 'cloud')
     * @returns {Promise<Object>} Result object with status and reload flag
     */
    async setStorageType(type) {
        if (type === this.storageType) return { success: true, shouldReload: false };

        const oldType = this.storageType;
        this.storageType = type;
        
        // Save preference
        localStorage.setItem('NoteHub_StorageType', type);

        let result = { success: true, shouldReload: false };

        if (type === 'cloud') {
            const syncEnabled = await this.enableSync();
            
            if (syncEnabled && firebaseService.isAuthenticated()) {
                try {
                    // Show notification that we're switching
                    this.showSmartSyncNotification('Switching to cloud storage...', 'info');
                    
                    // Perform smart sync only to handle conflicts
                    const syncResult = await this.performSmartSync();
                    
                    if (syncResult.success) {
                        if (syncResult.action === 'upload') {
                            // Local data was uploaded to cloud
                            this.showSmartSyncNotification('Successfully switched to cloud storage!', 'success');
                        } else {
                            // Either no conflict or cloud data selected
                            this.showSmartSyncNotification('Switched to cloud storage! Loading cloud notes...', 'success');
                            result.shouldReload = true;
                        }

                        // If conflict was resolved with reload needed
                        if (syncResult.shouldReload) {
                            result.shouldReload = true;
                        }
                    }
                } catch (error) {
                    console.error('Smart sync failed during storage type change:', error);
                    this.showSmartSyncNotification('Switched to cloud storage, but sync failed.', 'warning');
                }
            } else if (!firebaseService.isAuthenticated()) {
                this.showSmartSyncNotification('Cloud storage selected. Please sign in to sync your notes.', 'info');
            }
        } else {
            // Switching to local
            this.disableSync();
            this.showSmartSyncNotification('Switched to local storage.', 'info');
            result.shouldReload = true; // Reload to show local data
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

        return result;
    }

    /**
     * Enable cloud sync
     * @returns {Promise<boolean>}
     */
    async enableSync() {
        if (!firebaseService.isInitialized) {
            console.warn('Firebase not initialized, cannot enable sync');
            return false;
        }

        if (!firebaseService.isAuthenticated()) {
            // Don't show warning during initial load - auth might still be loading
            console.log('Waiting for user authentication to enable cloud sync');
            return false;
        }

        this.syncEnabled = true;
        console.log('Cloud sync enabled successfully');
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
     * Save individual note to current storage
     * @param {Object} note - Note object to save
     * @returns {Promise<boolean} True if saved successfully
     */
    async saveNote(note) {
        try {
            // Update local storage with single note
            this.saveNoteToLocalStorage(note);

            // Also save to cloud if sync is enabled
            if (this.syncEnabled && this.storageType === 'cloud') {
                await firebaseService.saveNote(note);
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem('NoteHub_LastSyncTime', this.lastSyncTime);
            }

            // Update cache
            this.cache.set(note.id, note);

            return true;
        } catch (error) {
            console.error('Failed to save note:', error);
            return this.storageType === 'local';
        }
    }

    /**
     * Load note from current storage
     * @param {number} noteId - Note ID to load
     * @returns {Promise<Object|null>} Note data or null
     */
    async loadNote(noteId) {
        try {
            // Check cache first
            if (this.cache.has(noteId)) {
                return this.cache.get(noteId);
            }

            let note = null;

            if (this.syncEnabled && this.storageType === 'cloud') {
                // Try to load from cloud first
                note = await firebaseService.loadNote(noteId);
            }

            if (!note) {
                // Fallback to localStorage
                note = this.loadNoteFromLocalStorage(noteId);
            }

            // Update cache
            if (note) {
                this.cache.set(noteId, note);
            }

            return note;
        } catch (error) {
            console.error('Failed to load note:', error);
            return this.loadNoteFromLocalStorage(noteId);
        }
    }

    /**
     * Delete note from current storage
     * @param {number} noteId - Note ID to delete
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async deleteNote(noteId) {
        try {
            // Delete from local storage
            this.deleteNoteFromLocalStorage(noteId);

            // Also delete from cloud if sync is enabled
            if (this.syncEnabled && this.storageType === 'cloud') {
                await firebaseService.deleteNote(noteId);
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem('NoteHub_LastSyncTime', this.lastSyncTime);
            }

            // Remove from cache
            this.cache.delete(noteId);

            return true;
        } catch (error) {
            console.error('Failed to delete note:', error);
            return this.storageType === 'local';
        }
    }

    /**
     * Load data from current storage
     * Primary method for loading data - respects storage type preference
     * @param {boolean} forceCloudRefresh - Force refresh from cloud even if local cache exists
     * @returns {Promise<Object|null>} Loaded data or null
     */
    async loadData(forceCloudRefresh = false) {
        try {
            // If cloud storage is selected and sync is enabled, load from cloud
            if (this.storageType === 'cloud' && this.syncEnabled && firebaseService.isAuthenticated()) {
                console.log('Loading data from cloud storage');
                const cloudData = await firebaseService.loadUserNotes();
                if (cloudData) {
                    // Cache cloud data to localStorage for offline access
                    this.saveToLocalStorage(cloudData);
                    return cloudData;
                } else {
                    console.log('No cloud data found, checking local storage');
                }
            }

            // Load from localStorage (either as primary source or fallback)
            console.log('Loading data from local storage');
            return this.loadFromLocalStorage();
        } catch (error) {
            console.error('Failed to load data from cloud, using localStorage:', error);
            return this.loadFromLocalStorage();
        }
    }

    /**
     * Sync data between local and cloud storage
     * Uses smart sync logic for better user experience
     * @returns {Promise<Object>} Sync result object
     */
    async syncData() {
        if (!this.syncEnabled || !firebaseService.isAuthenticated()) {
            throw new Error('Sync not available');
        }

        try {
            // Use smart sync for manual sync operations too
            const result = await this.performSmartSync();
            
            // If reload is needed (for conflict resolution), do it
            if (result.shouldReload) {
                setTimeout(() => window.location.reload(), 1000);
            }
            
            return result;
        } catch (error) {
            console.error('Sync failed:', error);
            throw error;
        }
    }

    /**
     * Save data to localStorage using document-based approach
     * @param {Object} data - Data to save
     */
    saveToLocalStorage(data) {
        try {
            // Save metadata
            const metadata = {
                activeTabId: data.activeTabId,
                noteOrder: data.tabs ? data.tabs.map(tab => tab.id) : []
            };
            localStorage.setItem('NoteHub_Metadata', JSON.stringify(metadata));

            // Save individual notes
            if (data.tabs && Array.isArray(data.tabs)) {
                data.tabs.forEach(tab => {
                    localStorage.setItem(`NoteHub_Note_${tab.id}`, JSON.stringify(tab));
                });
            }
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            throw error;
        }
    }

    /**
     * Save individual note to localStorage
     * @param {Object} note - Note to save
     */
    saveNoteToLocalStorage(note) {
        try {
            localStorage.setItem(`NoteHub_Note_${note.id}`, JSON.stringify(note));
        } catch (error) {
            console.error('Failed to save note to localStorage:', error);
            throw error;
        }
    }

    /**
     * Load individual note from localStorage
     * @param {number} noteId - Note ID to load
     * @returns {Object|null} Note data or null
     */
    loadNoteFromLocalStorage(noteId) {
        try {
            const savedNote = localStorage.getItem(`NoteHub_Note_${noteId}`);
            return savedNote ? JSON.parse(savedNote) : null;
        } catch (error) {
            console.error('Failed to load note from localStorage:', error);
            return null;
        }
    }

    /**
     * Delete note from localStorage
     * @param {number} noteId - Note ID to delete
     */
    deleteNoteFromLocalStorage(noteId) {
        try {
            localStorage.removeItem(`NoteHub_Note_${noteId}`);
            
            // Update metadata to remove from noteOrder
            const metadata = this.loadMetadataFromLocalStorage();
            if (metadata && metadata.noteOrder) {
                metadata.noteOrder = metadata.noteOrder.filter(id => id !== noteId);
                localStorage.setItem('NoteHub_Metadata', JSON.stringify(metadata));
            }
        } catch (error) {
            console.error('Failed to delete note from localStorage:', error);
        }
    }

    /**
     * Load metadata from localStorage
     * @returns {Object|null} Metadata or null
     */
    loadMetadataFromLocalStorage() {
        try {
            const savedMetadata = localStorage.getItem('NoteHub_Metadata');
            return savedMetadata ? JSON.parse(savedMetadata) : null;
        } catch (error) {
            console.error('Failed to load metadata from localStorage:', error);
            return null;
        }
    }

    /**
     * Load data from localStorage using new document-based approach
     * @returns {Object|null} Loaded data or null
     */
    loadFromLocalStorage() {
        try {
            // Try new format first (document-based)
            const metadata = this.loadMetadataFromLocalStorage();
            
            if (metadata && metadata.noteOrder) {
                // Load individual notes
                const tabs = [];
                for (const noteId of metadata.noteOrder) {
                    const note = this.loadNoteFromLocalStorage(noteId);
                    if (note) {
                        tabs.push(note);
                    }
                }

                return {
                    tabs: tabs,
                    activeTabId: metadata.activeTabId
                };
            }

            // Fallback to old format (single document)
            const savedData = localStorage.getItem('NoteHub');
            if (savedData) {
                const data = JSON.parse(savedData);
                
                // Migrate to new format
                if (data.tabs && Array.isArray(data.tabs)) {
                    this.saveToLocalStorage(data);
                    // Remove old format
                    localStorage.removeItem('NoteHub');
                }
                
                return data;
            }
            
            return null;
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