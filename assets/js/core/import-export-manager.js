/**
 * Import/Export Manager
 * Handles note import and export functionality
 */
class ImportExportManager {
    constructor(noteHub) {
        this.noteHub = noteHub; // Reference to main app
        this.exportBtn = null;
        this.importBtn = null;
        this.importFile = null;
    }

    /**
     * Initialize import/export manager
     */
    initialize() {
        this.exportBtn = DOMUtils.getElementById('export-btn');
        this.importBtn = DOMUtils.getElementById('import-btn');
        this.importFile = DOMUtils.getElementById('import-file');

        this.bindEvents();
    }

    /**
     * Bind import/export events
     */
    bindEvents() {
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportNotes());
        }

        if (this.importBtn && this.importFile) {
            this.importBtn.addEventListener('click', () => this.importFile.click());
            this.importFile.addEventListener('change', (e) => this.importNotes(e));
        }
    }

    /**
     * Export notes with encryption awareness
     */
    async exportNotes() {
        try {
            // Check if encryption unlock is needed
            if (this.needsEncryptionUnlock()) {
                const unlocked = await this.promptEncryptionUnlock();
                if (!unlocked) {
                    this.showNotification('Export cancelled - encryption not unlocked', 'info');
                    return;
                }
            }

            // Collect all notes data (decrypted for export)
            const allNotes = await this.collectAllNotes();
            
            const exportData = {
                tabs: allNotes,
                activeTabId: this.noteHub.tabManager.getActiveTabId(),
                exportDate: new Date().toISOString(),
                encrypted: false, // Exported data is always decrypted
                version: '2.0' // Version for future compatibility
            };

            this.downloadJSON(exportData);
            this.showNotification('Notes exported successfully!', 'success');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.handleExportError(error);
        }
    }

    /**
     * Import notes with validation and encryption support
     * @param {Event} event - File input change event
     */
    importNotes(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = await this.parseImportData(e.target.result);
                await this.processImportData(data);
            } catch (error) {
                console.error('Import failed:', error);
                this.handleImportError(error);
            }
        };

        reader.readAsText(file);
        event.target.value = ''; // Clear file input
    }

    /**
     * Parse and validate import data
     * @param {string} jsonString - JSON string from file
     * @returns {Object} Parsed and validated data
     */
    async parseImportData(jsonString) {
        let data;
        
        try {
            data = JSON.parse(jsonString);
        } catch (e) {
            throw new Error('Invalid JSON format. Please select a valid NoteHub export file.');
        }

        // Validate structure
        if (!data.tabs || !Array.isArray(data.tabs)) {
            throw new Error('Invalid file format. Missing or invalid tabs data.');
        }

        // Validate each tab
        data.tabs.forEach((tab, index) => {
            if (!tab.id || typeof tab.title !== 'string') {
                throw new Error(`Invalid tab at position ${index + 1}. Missing required fields.`);
            }
        });

        return data;
    }

    /**
     * Process import data and replace current notes
     * @param {Object} data - Validated import data
     */
    async processImportData(data) {
        // Show confirmation dialog
        const confirmMessage = `This will replace all your current notes with ${data.tabs.length} imported note(s). Are you sure you want to continue?`;
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            // Clear existing UI and data
            await this.clearExistingData();

            // Import new data
            await this.importNewData(data);

            // Show success message
            const message = `${data.tabs.length} notes imported successfully!`;
            this.showNotification(message, 'success');
            
        } catch (error) {
            throw new Error(`Import processing failed: ${error.message}`);
        }
    }

    /**
     * Clear existing tabs and data
     */
    async clearExistingData() {
        const currentTabs = this.noteHub.tabManager.getAllTabs();
        
        // Clear UI
        this.noteHub.tabManager.clearUI();

        // Delete all existing notes from storage
        for (const tab of currentTabs) {
            await this.noteHub.deleteNote(tab.id);
        }
    }

    /**
     * Import new data and render UI
     * @param {Object} data - Import data
     */
    async importNewData(data) {
        // Set tab data
        const activeTabId = data.activeTabId && data.tabs.find(t => t.id === data.activeTabId) 
            ? data.activeTabId 
            : (data.tabs.length > 0 ? data.tabs[0].id : null);

        // Save all imported notes (will be encrypted if encryption is enabled)
        for (const tab of data.tabs) {
            await this.noteHub.saveNote(tab);
        }

        // Save metadata
        await this.noteHub.saveMetadata();

        // Load tabs in UI
        this.noteHub.tabManager.loadTabs(data.tabs, activeTabId);
    }

    /**
     * Collect all notes data for export
     * @returns {Array} Array of note objects
     */
    async collectAllNotes() {
        const allNotes = [];
        const tabs = this.noteHub.tabManager.getAllTabs();
        
        for (const tab of tabs) {
            // Try to get fresh data from storage first
            let noteData = tab;
            if (this.noteHub.storageService && this.noteHub.isInitialized) {
                const freshNote = await this.noteHub.storageService.loadNote(tab.id);
                if (freshNote) {
                    noteData = freshNote;
                }
            }
            allNotes.push(noteData);
        }
        
        return allNotes;
    }

    /**
     * Download JSON data as file
     * @param {Object} data - Data to export
     */
    downloadJSON(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `notehub-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Check if encryption unlock is needed
     * @returns {boolean} True if unlock needed
     */
    needsEncryptionUnlock() {
        return typeof encryptionUI !== 'undefined' && encryptionUI.needsUnlock();
    }

    /**
     * Prompt for encryption unlock
     * @returns {Promise<boolean>} True if unlocked
     */
    async promptEncryptionUnlock() {
        if (typeof encryptionUI !== 'undefined') {
            return await encryptionUI.promptUnlockIfNeeded();
        }
        return true;
    }

    /**
     * Show notification message
     * @param {string} message - Message to show
     * @param {string} type - Notification type
     */
    showNotification(message, type) {
        if (typeof cloudSyncUI !== 'undefined' && cloudSyncUI.showNotification) {
            cloudSyncUI.showNotification(message, type);
        } else {
            // Fallback to alert
            alert(message);
        }
    }

    /**
     * Handle export errors
     * @param {Error} error - Export error
     */
    handleExportError(error) {
        if (error.message && error.message.includes('decrypt')) {
            alert('Export failed: Unable to decrypt notes. Please check your encryption password.');
        } else {
            alert('Export failed: ' + error.message);
        }
    }

    /**
     * Handle import errors
     * @param {Error} error - Import error
     */
    handleImportError(error) {
        if (error.message && error.message.includes('encrypt')) {
            alert('Import failed: Unable to encrypt imported notes. Please check your encryption settings.');
        } else {
            alert('Import failed: ' + error.message);
        }
    }

    /**
     * Get import/export statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        const tabs = this.noteHub.tabManager.getAllTabs();
        
        return {
            totalNotes: tabs.length,
            totalCharacters: tabs.reduce((sum, tab) => sum + (tab.content?.length || 0), 0),
            lastModified: tabs.reduce((latest, tab) => {
                const tabModified = new Date(tab.lastModified || 0).getTime();
                return Math.max(latest, tabModified);
            }, 0)
        };
    }
}

// Export for global use
window.ImportExportManager = ImportExportManager;