/**
 * ImportExportManager - Handles importing and exporting notes for NoteHub
 * Provides functionality to save notes as JSON files and load them back
 */
class ImportExportManager {
    constructor(noteHub) {
        this.noteHub = noteHub;
        this.initialize();
    }

    /**
     * Initialize the import/export manager and bind events
     */
    initialize() {
        this.exportBtn = document.getElementById('export-btn');
        this.importBtn = document.getElementById('import-btn');
        this.importFile = document.getElementById('import-file');
        this.exportBtn.addEventListener('click', () => this.exportNotes());
        this.importBtn.addEventListener('click', () => this.importFile.click());
        this.importFile.addEventListener('change', (e) => this.importNotes(e));
    }

    /**
     * Export notes to JSON file
     */
    async exportNotes() {
        try {
            const allNotes = [];
            
            for (const tab of this.noteHub.tabs) {
                let noteData = tab;
                if (storageService && this.noteHub.isInitialized) {
                    const freshNote = await storageService.loadNote(tab.id);
                    if (freshNote) {
                        noteData = freshNote;
                    }
                }
                allNotes.push(noteData);
            }

            const data = {
                tabs: allNotes,
                activeTabId: this.noteHub.activeTabId,
                exportDate: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `notehub-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();

            URL.revokeObjectURL(url);
            notificationManager.success('Notes exported successfully!');
        } catch (error) {
            console.error('Export failed:', error);
            notificationManager.error('Export failed: ' + error.message);
        }
    }

    /**
     * Import notes from JSON file
     * @param {Event} event - File input change event
     * @param {boolean} showNotification - Whether to show success notification
     */
    importNotes(event, showNotification = true) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (!data.tabs || !Array.isArray(data.tabs)) {
                    notificationManager.error('Invalid file format! Please select a valid NoteHub export file.');
                    return;
                }

                const confirmMessage = `This will replace all your current notes with ${data.tabs.length} imported note(s). Are you sure you want to continue?`;
                if (!confirm(confirmMessage)) return;

                try {
                    // Clear existing UI
                    this.noteHub.tabsList.innerHTML = '';
                    this.noteHub.editorContainer.innerHTML = '';

                    // Delete all existing notes from storage
                    for (const tab of this.noteHub.tabs) {
                        await this.noteHub.deleteNote(tab.id);
                    }

                    // Import new data
                    this.noteHub.tabs = data.tabs;
                    
                    // Update activeTabId if needed
                    if (data.activeTabId && this.noteHub.tabs.find(t => t.id === data.activeTabId)) {
                        this.noteHub.activeTabId = data.activeTabId;
                    } else if (this.noteHub.tabs.length > 0) {
                        this.noteHub.activeTabId = this.noteHub.tabs[0].id;
                    }

                    // Save all imported notes
                    for (const tab of this.noteHub.tabs) {
                        await this.noteHub.saveNote(tab);
                    }

                    await this.noteHub.saveMetadata();

                    // Render imported tabs and editors
                    this.noteHub.tabs.forEach(tab => {
                        this.noteHub.renderTab(tab);
                        this.noteHub.renderEditor(tab);
                    });

                    // Switch to appropriate tab
                    if (this.noteHub.tabs.length > 0) {
                        this.noteHub.switchToTab(this.noteHub.activeTabId || this.noteHub.tabs[0].id);
                    }
                    
                    setTimeout(() => this.noteHub.scrollToActiveTab(), 10);
                    
                    if (showNotification) {
                        notificationManager.success(`${data.tabs.length} notes imported successfully!`);
                    }
                } catch (error) {
                    console.error('Import process failed:', error);
                    notificationManager.error('Import failed during processing: ' + error.message);
                }
            } catch (error) {
                console.error('Import file parsing failed:', error);
                notificationManager.error('File reading error: ' + error.message);
            }
        };

        reader.readAsText(file);
        event.target.value = '';
    }

    /**
     * Validate imported data format
     * @param {Object} data - Imported data object
     * @returns {boolean} True if data is valid
     */
    validateImportData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }

        if (!Array.isArray(data.tabs)) {
            return false;
        }

        // Validate each tab structure
        for (const tab of data.tabs) {
            if (!tab.id || typeof tab.id !== 'number') {
                return false;
            }
            if (!tab.title || typeof tab.title !== 'string') {
                return false;
            }
            if (typeof tab.content !== 'string') {
                return false;
            }
        }

        return true;
    }

    /**
     * Create export data with additional metadata
     * @returns {Object} Export data object
     */
    async createExportData() {
        const allNotes = [];
        
        for (const tab of this.noteHub.tabs) {
            let noteData = tab;
            if (storageService && this.noteHub.isInitialized) {
                const freshNote = await storageService.loadNote(tab.id);
                if (freshNote) {
                    noteData = freshNote;
                }
            }
            allNotes.push(noteData);
        }

        return {
            tabs: allNotes,
            activeTabId: this.noteHub.activeTabId,
            exportDate: new Date().toISOString(),
            version: '1.0',
            noteCount: allNotes.length
        };
    }

    /**
     * Generate export filename with timestamp
     * @returns {string} Export filename
     */
    generateExportFilename() {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
        return `notehub-export-${dateStr}-${timeStr}.json`;
    }
}