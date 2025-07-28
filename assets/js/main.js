/**
 * NoteHub - Main Application
 * A modern note-taking application with cloud sync and encryption support
 * 
 * This is the main application class that orchestrates all components
 */
class NoteHub {
    constructor() {
        this.isInitialized = false;
        
        // Component managers
        this.themeManager = null;
        this.tabManager = null;
        this.importExportManager = null;
        
        // Initialize the application
        this.initializeApp();
    }

    /**
     * Initialize the application with all components
     */
    async initializeApp() {
        try {
            performanceMonitor.startTimer('app_initialization');
            performanceMonitor.log('info', '🚀 Starting NoteHub initialization...');

            // Initialize utilities first
            await this.initializeUtilities();

            // Initialize core services
            await this.initializeServices();

            // Initialize UI components
            await this.initializeUIComponents();

            // Check encryption and load data
            await this.initializeDataAndEncryption();

            // Finalize initialization
            this.finalizeInitialization();

            const initTime = performanceMonitor.endTimer('app_initialization');
            performanceMonitor.log('info', `✅ NoteHub initialized successfully in ${initTime.toFixed(2)}ms`);
            
        } catch (error) {
            performanceMonitor.recordError(error, 'app_initialization');
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize utility systems
     */
    async initializeUtilities() {
        // Initialize performance monitoring
        performanceMonitor.initialize({
            enabled: true,
            logLevel: 'info'
        });

        // Initialize notification system
        if (typeof notificationManager !== 'undefined') {
            notificationManager.initialize();
        }

        performanceMonitor.log('debug', '🔧 Utilities initialized');
    }

    /**
     * Initialize core services (Firebase, Storage, Encryption)
     */
    async initializeServices() {
        performanceMonitor.startTimer('services_initialization');

        // Initialize Firebase if enabled
        if (appConfig.ENABLE_FIREBASE) {
            await performanceMonitor.wrapAsync('firebase_init', 
                () => firebaseService.initialize()
            )();
        }

        // Initialize encryption service FIRST
        if (typeof encryptionService !== 'undefined') {
            await performanceMonitor.wrapAsync('encryption_init',
                () => encryptionService.initialize()
            )();
        }

        // Initialize storage service
        await performanceMonitor.wrapAsync('storage_init',
            () => storageService.initialize(appConfig.DEFAULT_STORAGE_TYPE)
        )();

        performanceMonitor.endTimer('services_initialization');
        performanceMonitor.log('debug', '⚙️ Services initialized');
    }

    /**
     * Initialize UI components and managers
     */
    async initializeUIComponents() {
        performanceMonitor.startTimer('ui_initialization');

        // Initialize theme manager
        this.themeManager = new ThemeManager();
        this.themeManager.initialize();

        // Initialize tab manager
        this.tabManager = new TabManager(this);
        this.tabManager.initialize();

        // Initialize import/export manager
        this.importExportManager = new ImportExportManager(this);
        this.importExportManager.initialize();

        // Initialize cloud sync UI
        if (typeof cloudSyncUI !== 'undefined') {
            cloudSyncUI.initialize();
        }

        // Initialize encryption UI AFTER encryptionService
        if (typeof encryptionUI !== 'undefined') {
            encryptionUI.initialize();
        }

        performanceMonitor.endTimer('ui_initialization');
        performanceMonitor.log('debug', '🎨 UI components initialized');
    }

    /**
     * Handle encryption and data loading
     */
    async initializeDataAndEncryption() {
        performanceMonitor.startTimer('data_initialization');

        // Check if encryption unlock is needed before loading data
        const needsUnlock = encryptionUI && encryptionUI.needsUnlock();
        if (needsUnlock) {
            const unlocked = await encryptionUI.promptUnlockIfNeeded();
            if (!unlocked) {
                // User cancelled unlock, show message and don't load encrypted data
                this.showEncryptionLockedMessage();
                this.isInitialized = true;
                performanceMonitor.endTimer('data_initialization', { encrypted: true, unlocked: false });
                return;
            }
        }

        // Load existing data
        await this.loadFromStorage();

        // Create first tab if none exist
        if (!this.tabManager.hasTabs()) {
            performanceMonitor.recordUserAction('create_first_tab');
            this.tabManager.createNewTab();
        }

        performanceMonitor.endTimer('data_initialization', { 
            tabCount: this.tabManager.getAllTabs().length 
        });
    }

    /**
     * Finalize initialization process
     */
    finalizeInitialization() {
        // Setup encryption state change handler
        this.setupEncryptionStateHandler();

        // Setup periodic cleanup
        this.setupPeriodicCleanup();

        // Mark as initialized
        this.isInitialized = true;
        
        // Dispatch initialization complete event
        const stats = this.getStatistics();
        document.dispatchEvent(new CustomEvent('notehub-initialized', {
            detail: { 
                timestamp: Date.now(),
                statistics: stats
            }
        }));

        performanceMonitor.recordMetric('app_state', 'initialized', stats);
        performanceMonitor.log('info', '🎉 NoteHub ready for use', stats);
    }

    /**
     * Setup periodic cleanup tasks
     */
    setupPeriodicCleanup() {
        // Clean up old metrics and event listeners every 5 minutes
        setInterval(() => {
            performanceMonitor.cleanup();
            eventManager.cleanup();
            
            // Force garbage collection if available (only in dev)
            if (window.gc && typeof window.gc === 'function') {
                window.gc();
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Handle initialization errors
     * @param {Error} error - Initialization error
     */
    handleInitializationError(error) {
        const errorMessage = 'Failed to initialize NoteHub. Please refresh the page.';
        
        if (typeof notificationManager !== 'undefined') {
            notificationManager.error(errorMessage, { persistent: true });
        } else {
            alert(errorMessage);
        }

        // Try to provide more specific error info
        if (error.message.includes('storage')) {
            notificationManager.warning('Storage initialization failed. Your notes may not save properly.');
        } else if (error.message.includes('encryption')) {
            notificationManager.warning('Encryption initialization failed. Your notes will not be encrypted.');
        }
    }

    /**
     * Setup encryption state change handler
     */
    setupEncryptionStateHandler() {
        if (typeof encryptionService !== 'undefined') {
            const originalLock = encryptionService.lock.bind(encryptionService);
            encryptionService.lock = () => {
                originalLock();
                performanceMonitor.recordUserAction('encryption_locked');
                this.handleEncryptionStateChange();
            };
        }
    }

    /**
     * Show message when encryption is locked
     */
    showEncryptionLockedMessage() {
        const editorContainer = DOMUtils.getElementById('editor-container');
        if (editorContainer) {
            editorContainer.innerHTML = `
                <div class="encryption-locked-message">
                    <div class="lock-icon">🔒</div>
                    <h2>Notes are Encrypted</h2>
                    <p>Your notes are protected with end-to-end encryption.</p>
                    <p>Click the encryption button in the toolbar to unlock them.</p>
                    <div class="encryption-stats">
                        <small>🛡️ Using AES-256-GCM encryption</small>
                    </div>
                </div>
            `;
        }
        
        performanceMonitor.recordMetric('app_state', 'encryption_locked', {
            hasEncryptedData: true
        });
    }

    /**
     * Handle when encryption is locked/unlocked
     */
    handleEncryptionStateChange() {
        if (encryptionUI && encryptionUI.needsUnlock()) {
            // Encryption is locked, show locked message
            this.showEncryptionLockedMessage();
            // Clear tabs from UI but keep data
            this.tabManager.clearUI();
            // Clear memory cache for security
            if (storageService && storageService.cache) {
                storageService.cache.clear();
            }
            performanceMonitor.recordMetric('security', 'data_locked', { timestamp: Date.now() });
        } else {
            // Encryption is unlocked or disabled, reload data
            performanceMonitor.recordUserAction('encryption_unlocked');
            this.loadFromStorage();
        }
    }

    /**
     * Refresh UI after encryption unlock without page reload
     */
    async refreshAfterUnlock() {
        performanceMonitor.startTimer('refresh_after_unlock');
        
        try {
            // Clear existing UI
            this.tabManager.clearUI();
            
            // Clear cache to force fresh data load
            if (storageService && storageService.cache) {
                storageService.cache.clear();
            }
            
            // Load fresh data
            await this.loadFromStorage();
            
            // Create first tab if none exist
            if (!this.tabManager.hasTabs()) {
                this.tabManager.createNewTab();
            }

            performanceMonitor.endTimer('refresh_after_unlock', { success: true });
            performanceMonitor.recordUserAction('app_refreshed_after_unlock');
            
        } catch (error) {
            performanceMonitor.recordError(error, 'refresh_after_unlock');
            performanceMonitor.log('error', 'Failed to refresh after unlock, falling back to reload');
            // Fallback to reload
            window.location.reload();
        }
    }

    /**
     * Load data from storage with comprehensive error handling
     */
    async loadFromStorage() {
        performanceMonitor.startTimer('load_data');
        
        try {
            let data = null;

            // Use storage service if available
            if (storageService) {
                data = await storageService.loadData();
            }

            if (data && data.tabs) {
                // Validate data before loading
                const validation = ValidationManager.validateNotesCollection(data);
                if (!validation.valid) {
                    performanceMonitor.log('warn', '⚠️ Data validation failed:', validation.errors);
                    notificationManager.warning('Some notes may have data issues and might not display correctly.');
                }

                // Load tabs in tab manager
                this.tabManager.loadTabs(data.tabs, data.activeTabId);
                
                performanceMonitor.endTimer('load_data', { 
                    tabCount: data.tabs.length,
                    hasActiveTab: !!data.activeTabId,
                    validationPassed: validation.valid
                });
            } else {
                performanceMonitor.endTimer('load_data', { noData: true });
            }
        } catch (error) {
            performanceMonitor.recordError(error, 'load_data');
            this.handleLoadError(error);
        }
    }

    /**
     * Handle data loading errors with specific messaging
     * @param {Error} error - Load error
     */
    handleLoadError(error) {
        // Check if it's an encryption error
        if (error.message && error.message.includes('decrypt')) {
            if (typeof encryptionUI !== 'undefined') {
                notificationManager.error('Failed to decrypt notes. Please verify your password.');
                encryptionUI.openPasswordModal();
                performanceMonitor.recordMetric('error', 'decryption_failure', {
                    context: 'data_load'
                });
            }
        } else if (error.message && error.message.includes('storage')) {
            notificationManager.error('Storage error occurred. Some data may be unavailable.');
            performanceMonitor.recordMetric('error', 'storage_failure', {
                context: 'data_load'
            });
        } else {
            performanceMonitor.log('error', 'General load error:', error);
            notificationManager.warning('Some data could not be loaded. Your notes may be incomplete.');
        }
    }

    /**
     * Save individual note to storage with performance tracking
     * @param {Object} note - Note object to save
     */
    async saveNote(note) {
        performanceMonitor.startTimer('save_note');
        
        try {
            // Validate note before saving
            const validation = ValidationManager.validateNote(note);
            if (!validation.valid) {
                throw new Error(`Invalid note data: ${validation.errors.join(', ')}`);
            }

            if (storageService && this.isInitialized) {
                await storageService.saveNote(validation.note);
                performanceMonitor.endTimer('save_note', { success: true, noteId: note.id });
                performanceMonitor.recordUserAction('note_saved', { noteId: note.id });
            }
        } catch (error) {
            performanceMonitor.recordError(error, 'save_note', { noteId: note.id });
            this.handleSaveError(error);
        }
    }

    /**
     * Delete note from storage with confirmation
     * @param {number} noteId - Note ID to delete
     */
    async deleteNote(noteId) {
        performanceMonitor.startTimer('delete_note');
        
        try {
            if (storageService && this.isInitialized) {
                await storageService.deleteNote(noteId);
                performanceMonitor.endTimer('delete_note', { success: true, noteId });
                performanceMonitor.recordUserAction('note_deleted', { noteId });
            }
        } catch (error) {
            performanceMonitor.recordError(error, 'delete_note', { noteId });
            notificationManager.error('Failed to delete note. Please try again.');
        }
    }

    /**
     * Save metadata with performance tracking
     */
    async saveMetadata() {
        try {
            const metadata = {
                activeTabId: this.tabManager.getActiveTabId(),
                noteOrder: this.tabManager.getAllTabs().map(tab => tab.id),
                lastUpdated: new Date().toISOString()
            };

            if (storageService && this.isInitialized) {
                // For cloud storage, save as profile
                if (storageService.storageType === 'cloud' && storageService.syncEnabled) {
                    await firebaseService.saveUserProfile(metadata);
                }
                // Always save to localStorage as well
                StorageUtils.setItem('NoteHub_Metadata', metadata);
            } else {
                StorageUtils.setItem('NoteHub_Metadata', metadata);
            }
        } catch (error) {
            performanceMonitor.recordError(error, 'save_metadata');
        }
    }

    /**
     * Handle save errors with user feedback and retry logic
     * @param {Error} error - Save error
     */
    handleSaveError(error) {
        if (error.name === 'QuotaExceededError') {
            notificationManager.error('Storage quota exceeded! Please export your notes to free up space.');
            performanceMonitor.recordMetric('error', 'quota_exceeded', {
                storageUsage: StorageUtils.getUsageInfo()
            });
        } else if (error.message.includes('encryption')) {
            notificationManager.error('Failed to encrypt data. Please check your encryption settings.');
        } else if (error.message.includes('validation')) {
            notificationManager.error('Data validation failed. Please check your note content.');
        } else {
            notificationManager.error('Failed to save data. Your changes may not be preserved.');
        }
    }

    /**
     * Get comprehensive application statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        const baseStats = {
            isInitialized: this.isInitialized,
            tabCount: this.tabManager ? this.tabManager.getAllTabs().length : 0,
            activeTabId: this.tabManager ? this.tabManager.getActiveTabId() : null,
            theme: this.themeManager ? this.themeManager.getCurrentTheme() : null,
            storageType: storageService ? storageService.storageType : 'unknown',
            timestamp: new Date().toISOString()
        };

        // Add encryption statistics if available
        if (encryptionService && typeof encryptionService.getStatistics === 'function') {
            baseStats.encryption = encryptionService.getStatistics();
        }

        // Add storage usage if available
        if (typeof StorageUtils !== 'undefined') {
            baseStats.storage = StorageUtils.getUsageInfo();
        }

        // Add performance statistics
        if (performanceMonitor.isEnabled) {
            baseStats.performance = performanceMonitor.getReport('timing');
        }

        // Add event statistics
        baseStats.events = eventManager.getStatistics();

        return baseStats;
    }

    /**
     * Cleanup method for proper shutdown
     */
    destroy() {
        performanceMonitor.log('info', '🧹 Cleaning up NoteHub...');

        if (this.themeManager) {
            this.themeManager.destroy();
        }
        
        // Clean up event listeners
        eventManager.removeAll();
        
        // Clear references
        this.themeManager = null;
        this.tabManager = null;
        this.importExportManager = null;
        this.isInitialized = false;

        // Dispatch cleanup event
        document.dispatchEvent(new CustomEvent('notehub-destroyed'));
        
        performanceMonitor.log('info', '🗑️ NoteHub cleanup completed');
    }
}

/**
 * Initialize application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    // Create global reference for the app
    window.noteHubApp = new NoteHub();
});

/**
 * Enhanced global error handler
 */
window.addEventListener('error', (event) => {
    if (typeof performanceMonitor !== 'undefined') {
        performanceMonitor.recordError(event.error, 'global_error', {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    }
    
    if (typeof notificationManager !== 'undefined') {
        notificationManager.error('An unexpected error occurred. Please refresh the page if problems persist.');
    }
});

/**
 * Enhanced unhandled promise rejection handler
 */
window.addEventListener('unhandledrejection', (event) => {
    if (typeof performanceMonitor !== 'undefined') {
        performanceMonitor.recordError(
            new Error(event.reason), 
            'unhandled_promise_rejection'
        );
    }
    
    if (typeof notificationManager !== 'undefined') {
        notificationManager.error('A background operation failed. Some features may not work correctly.');
    }
});

/**
 * Handle page visibility change to manage resources
 */
document.addEventListener('visibilitychange', () => {
    if (window.noteHubApp && window.noteHubApp.isInitialized) {
        if (document.hidden) {
            performanceMonitor.log('debug', '📱 App hidden - pausing non-critical operations');
            performanceMonitor.recordMetric('app_state', 'hidden', { timestamp: Date.now() });
        } else {
            performanceMonitor.log('debug', '📱 App visible - resuming operations');
            performanceMonitor.recordMetric('app_state', 'visible', { timestamp: Date.now() });
        }
    }
});

/**
 * Handle before unload to cleanup resources
 */
window.addEventListener('beforeunload', () => {
    if (window.noteHubApp) {
        window.noteHubApp.destroy();
    }
});