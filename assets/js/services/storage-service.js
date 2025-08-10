/**
 * Storage Service
 * Unified storage interface that handles both localStorage and Firebase storage
 * Now supports document-based storage for better scalability
 */
class StorageService {
    constructor() {
        this.storageType = 'local';
        this.syncEnabled = false;
        this.lastSyncTime = null;
        this.syncStatusCallbacks = [];
        this.cache = new Map();
        this.isPageVisible = true;
        this.lastFocusTime = Date.now();
        this.isPageLoad = false;
    }

    /**
     * Initialize storage service
     * @param {string} defaultType - Default storage type ('local' or 'cloud')
     * @returns {Promise<void>}
     */
    async initialize(defaultType = 'local') {
        const savedType = localStorage.getItem('NoteHub_StorageType') || defaultType;
        this.storageType = savedType;
        this.lastSyncTime = localStorage.getItem('NoteHub_LastSyncTime');
        
        if (firebaseService.isInitialized) {
            firebaseService.onAuthStateChange((user) => {
                this.handleAuthStateChange(user);
            });
        }

        this.setupPageVisibilityListeners();
        this.handlePageRefresh();
    }

    /**
     * Set up page visibility and window focus listeners
     */
    setupPageVisibilityListeners() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.isPageVisible = true;
                this.handlePageBecameVisible();
            } else {
                this.isPageVisible = false;
            }
        });

        window.addEventListener('focus', () => {
            this.handlePageBecameVisible();
        });

        window.addEventListener('blur', () => {
            this.lastFocusTime = Date.now();
        });
    }

    /**
     * Handle when page becomes visible or focused
     */
    async handlePageBecameVisible() {
        if (this.storageType === 'cloud' && 
            this.syncEnabled && 
            firebaseService.isAuthenticated()) {
            
            const timeSinceLastFocus = Date.now() - this.lastFocusTime;
            const shouldRefresh = timeSinceLastFocus > 1000; 
            
            if (shouldRefresh) {
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
            const cloudData = await firebaseService.loadUserNotes();
            
            if (cloudData) {
                this.saveToLocalStorage(cloudData);
                this.cache.clear();
                
                const event = new CustomEvent('cloudDataRefreshed', {
                    detail: { data: cloudData }
                });
                document.dispatchEvent(event);
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Failed to refresh cloud data:', error);
            return false;
        }
    }

    /**
     * Handle page refresh/reload scenario
     */
    async handlePageRefresh() {
        this.isPageLoad = true;
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
            
            await this.refreshDataFromCloud();
            this.isPageLoad = false;
        }
    }

    /**
     * Handle authentication state changes
     * @param {Object|null} user - Firebase user object
     */
    async handleAuthStateChange(user) {
        if (user) {
            if (this.storageType === 'cloud') {
                const syncEnabled = await this.enableSync();
                if (syncEnabled && this.isPageLoad) {
                    this.checkForInitialCloudRefresh();
                }
            }
        } else {
            this.disableSync();
            this.cache.clear();
        }
        
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
     */
    compareData(data1, data2) {
        if (!data1 || !data2) return false;
        
        if (data1.activeTabId !== data2.activeTabId) return false;
        
        const tabs1 = data1.tabs || [];
        const tabs2 = data2.tabs || [];
        
        if (tabs1.length !== tabs2.length) return false;
        
        const sortedTabs1 = [...tabs1].sort((a, b) => a.id - b.id);
        const sortedTabs2 = [...tabs2].sort((a, b) => a.id - b.id);
        
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
     * Check if data contains meaningful content
     */
    hasMeaningfulData(data) {
        if (!data || !data.tabs || !Array.isArray(data.tabs) || data.tabs.length === 0) {
            return false;
        }
        
        return data.tabs.some(tab => {
            const hasContent = tab.content && tab.content.trim().length > 0;
            const hasCustomTitle = tab.title && !tab.title.match(/^Note \d+$/);
            return hasContent || hasCustomTitle;
        });
    }

    /**
     * Perform smart sync for storage type switching
     */
    async performSmartSync() {
        if (!this.syncEnabled || !firebaseService.isAuthenticated()) {
            throw new Error('Smart sync not available - user not authenticated');
        }

        try {
            const localData = this.loadFromLocalStorage();
            const cloudData = await firebaseService.loadUserNotes();

            const hasLocalData = this.hasMeaningfulData(localData);
            const hasCloudData = this.hasMeaningfulData(cloudData);

            let syncResult = {
                success: false,
                action: 'none',
                message: '',
                requiresUserInput: false
            };

            if (!hasLocalData && !hasCloudData) {
                syncResult = {
                    success: true,
                    action: 'none',
                    message: 'No notes found. Start writing your first note!',
                    requiresUserInput: false
                };
            } else if (!hasLocalData && hasCloudData) {
                syncResult = {
                    success: true,
                    action: 'none',
                    message: 'Cloud notes ready to load',
                    requiresUserInput: false
                };
            } else if (hasLocalData && !hasCloudData) {
                await firebaseService.saveUserNotes(localData);
                syncResult = {
                    success: true,
                    action: 'upload',
                    message: 'Your local notes have been uploaded to cloud',
                    requiresUserInput: false
                };
                
                notificationManager.success(syncResult.message);
            } else {
                if (this.compareData(localData, cloudData)) {
                    syncResult = {
                        success: true,
                        action: 'none',
                        message: 'Local and cloud data are already in sync!',
                        requiresUserInput: false
                    };
                } else {
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
            notificationManager.error('Smart sync failed. Please try manual sync.');
            throw error;
        }
    }

    /**
     * Handle data conflicts when both local and cloud have data
     */
    async handleDataConflict(localData, cloudData) {
        return new Promise((resolve) => {
            this.showConflictModal(localData, cloudData, resolve);
        });
    }

    /**
     * Show conflict modal with data and event handlers
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
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                notificationManager.warning('Please choose which notes to keep - you cannot cancel this operation.');
            }
        };
        
        document.addEventListener('keydown', handleKeyPress);
        modal._keyHandler = handleKeyPress;
    }

    /**
     * Hide conflict modal
     */
    hideConflictModal() {
        const modal = document.getElementById('conflict-modal');
        if (modal) {
            modal.style.display = 'none';
            
            if (modal._keyHandler) {
                document.removeEventListener('keydown', modal._keyHandler);
                delete modal._keyHandler;
            }
        }
    }

    /**
     * Add sync status change listener
     */
    onSyncStatusChange(callback) {
        this.syncStatusCallbacks.push(callback);
    }

    /**
     * Set storage type with improved cloud switching logic
     */
    async setStorageType(type) {
        if (type === this.storageType) return { success: true, shouldReload: false };

        const oldType = this.storageType;
        this.storageType = type;
        
        localStorage.setItem('NoteHub_StorageType', type);

        let result = { success: true, shouldReload: false };

        if (type === 'cloud') {
            const syncEnabled = await this.enableSync();
            
            if (syncEnabled && firebaseService.isAuthenticated()) {
                try {
                    notificationManager.info('Switching to cloud storage...');
                    
                    const syncResult = await this.performSmartSync();
                    
                    if (syncResult.success) {
                        if (syncResult.action === 'upload') {
                            notificationManager.success('Successfully switched to cloud storage!');
                        } else {
                            notificationManager.success('Switched to cloud storage! Loading cloud notes...');
                            result.shouldReload = true;
                        }

                        if (syncResult.shouldReload) {
                            result.shouldReload = true;
                        }
                    }
                } catch (error) {
                    console.error('Smart sync failed during storage type change:', error);
                    notificationManager.warning('Switched to cloud storage, but sync failed.');
                }
            } else if (!firebaseService.isAuthenticated()) {
                notificationManager.info('Cloud storage selected. Please sign in to sync your notes.');
            }
        } else {
            this.disableSync();
            notificationManager.info('Switched to local storage.');
            result.shouldReload = true;
        }

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
     */
    async enableSync() {
        if (!firebaseService.isInitialized) {
            console.warn('Firebase not initialized, cannot enable sync');
            return false;
        }

        if (!firebaseService.isAuthenticated()) {
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
     */
    async saveData(data) {
        try {
            this.saveToLocalStorage(data);

            if (this.syncEnabled && this.storageType === 'cloud') {
                await firebaseService.saveUserNotes(data);
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem('NoteHub_LastSyncTime', this.lastSyncTime);
            }

            return true;
        } catch (error) {
            console.error('Failed to save data:', error);
            return this.storageType === 'local';
        }
    }

    /**
     * Save individual note to current storage
     */
    async saveNote(note) {
        try {
            this.saveNoteToLocalStorage(note);

            if (this.syncEnabled && this.storageType === 'cloud') {
                await firebaseService.saveNote(note);
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem('NoteHub_LastSyncTime', this.lastSyncTime);
            }

            this.cache.set(note.id, note);
            return true;
        } catch (error) {
            console.error('Failed to save note:', error);
            return this.storageType === 'local';
        }
    }

    /**
     * Load note from current storage
     */
    async loadNote(noteId) {
        try {
            if (this.cache.has(noteId)) {
                return this.cache.get(noteId);
            }

            let note = null;

            if (this.syncEnabled && this.storageType === 'cloud') {
                note = await firebaseService.loadNote(noteId);
            }

            if (!note) {
                note = this.loadNoteFromLocalStorage(noteId);
            }

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
     */
    async deleteNote(noteId) {
        try {
            this.deleteNoteFromLocalStorage(noteId);

            if (this.syncEnabled && this.storageType === 'cloud') {
                await firebaseService.deleteNote(noteId);
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem('NoteHub_LastSyncTime', this.lastSyncTime);
            }

            this.cache.delete(noteId);
            return true;
        } catch (error) {
            console.error('Failed to delete note:', error);
            return this.storageType === 'local';
        }
    }

    /**
     * Load data from current storage
     */
    async loadData(forceCloudRefresh = false) {
        try {
            if (this.storageType === 'cloud' && this.syncEnabled && firebaseService.isAuthenticated()) {
                const cloudData = await firebaseService.loadUserNotes();
                if (cloudData) {
                    this.saveToLocalStorage(cloudData);
                    return cloudData;
                }
            }

            return this.loadFromLocalStorage();
        } catch (error) {
            console.error('Failed to load data from cloud, using localStorage:', error);
            return this.loadFromLocalStorage();
        }
    }

    /**
     * Sync data between local and cloud storage
     */
    async syncData() {
        if (!this.syncEnabled || !firebaseService.isAuthenticated()) {
            throw new Error('Sync not available');
        }

        try {
            const result = await this.performSmartSync();
            
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
     */
    saveToLocalStorage(data) {
        try {
            const metadata = {
                activeTabId: data.activeTabId,
                noteOrder: data.tabs ? data.tabs.map(tab => tab.id) : []
            };
            localStorage.setItem('NoteHub_Metadata', JSON.stringify(metadata));

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
     */
    deleteNoteFromLocalStorage(noteId) {
        try {
            localStorage.removeItem(`NoteHub_Note_${noteId}`);
            
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
     */
    loadFromLocalStorage() {
        try {
            const metadata = this.loadMetadataFromLocalStorage();
            
            if (metadata && metadata.noteOrder) {
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

            // Fallback to old format
            const savedData = localStorage.getItem('NoteHub');
            if (savedData) {
                const data = JSON.parse(savedData);
                
                if (data.tabs && Array.isArray(data.tabs)) {
                    this.saveToLocalStorage(data);
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