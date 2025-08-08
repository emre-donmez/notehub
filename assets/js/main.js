/**
 * NoteHub - A modern note-taking application with cloud sync capabilities
 * Supports both local storage and Firebase cloud synchronization
 */
class NoteHub {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.draggedTab = null;
        this.isInitialized = false;

        // Initialize the application
        this.initializeApp();
    }

    /**
     * Initialize the application with cloud sync support
     */
    async initializeApp() {
        try {
            // Initialize Firebase if enabled
            if (appConfig.ENABLE_FIREBASE) {
                await firebaseService.initialize();
            }

            // Initialize storage service
            await storageService.initialize(appConfig.DEFAULT_STORAGE_TYPE);

            // Initialize UI components
            this.initializeElements();
            
            // Initialize cloud sync UI
            cloudSyncUI.initialize();

            // Load existing data
            await this.loadFromStorage();
            
            // Bind events
            this.bindEvents();

            // Create first tab if none exist
            if (this.tabs.length === 0) {
                this.createNewTab();
            }

            // Initialize keyboard shortcuts and help system
            this.initializeKeyboardAndHelp();

            this.isInitialized = true;
            console.log('NoteHub initialized successfully');
        } catch (error) {
            console.error('Failed to initialize NoteHub:', error);
            // Show error to user but don't fallback to basic mode
            alert('Failed to initialize NoteHub. Please refresh the page.');
        }
    }

    /**
     * Initialize keyboard shortcuts and help system
     */
    initializeKeyboardAndHelp() {
        // Initialize keyboard shortcuts
        if (typeof KeyboardShortcuts !== 'undefined') {
            this.keyboardShortcuts = new KeyboardShortcuts(this);
            
            // Initialize help system
            if (typeof HelpSystem !== 'undefined') {
                this.helpSystem = new HelpSystem(this.keyboardShortcuts);
            }
        }
    }

    /**
     * Initialize DOM elements and basic UI
     */
    initializeElements() {
        this.tabsList = document.getElementById('tabs-list');
        this.editorContainer = document.getElementById('editor-container');
        this.newTabBtn = document.getElementById('new-tab-btn');
        this.themeToggle = document.getElementById('theme-toggle');
        this.exportBtn = document.getElementById('export-btn');
        this.importBtn = document.getElementById('import-btn');
        this.importFile = document.getElementById('import-file');
        // Load theme
        this.loadTheme();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        this.newTabBtn.addEventListener('click', () => this.createNewTab());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.exportBtn.addEventListener('click', () => this.exportNotes());
        this.importBtn.addEventListener('click', () => this.importFile.click());
        this.importFile.addEventListener('change', (e) => this.importNotes(e));

        // Add dragover and drop events to tabs list for end-of-list dropping
        this.tabsList.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        this.tabsList.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.draggedTab) {
                const afterElement = this.getDragAfterElement(this.tabsList, e.clientX);
                
                if (afterElement == null) {
                    this.tabsList.appendChild(this.draggedTab);
                    
                    const draggedIndex = this.tabs.findIndex(t => t.id == this.draggedTab.dataset.tabId);
                    const draggedTabData = this.tabs.splice(draggedIndex, 1)[0];
                    this.tabs.push(draggedTabData);
                    
                    this.saveToStorage();
                }
            }
        });
    }

    /**
     * Scroll to make the active tab visible
     */
    scrollToActiveTab() {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const tabsListRect = this.tabsList.getBoundingClientRect();
            const activeTabRect = activeTab.getBoundingClientRect();
            
            if (activeTabRect.left < tabsListRect.left) {
                this.tabsList.scrollLeft -= (tabsListRect.left - activeTabRect.left) + 20;
            } else if (activeTabRect.right > tabsListRect.right) {
                this.tabsList.scrollLeft += (activeTabRect.right - tabsListRect.right) + 20;
            }
        }
    }

    /**
     * Get element after which dragged tab should be dropped
     * @param {HTMLElement} container - Container element
     * @param {number} x - X coordinate
     * @returns {HTMLElement|null} Element or null
     */
    getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.tab:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * Create a new tab
     */
    createNewTab() {
        // Generate next available ID instead of using counter
        const existingIds = this.tabs.map(tab => tab.id);
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        const id = maxId + 1;
        
        const tab = {
            id: id,
            title: `Note ${id}`,
            content: ''
        };

        this.tabs.push(tab);
        this.renderTab(tab);
        this.renderEditor(tab);
        this.switchToTab(id);
        
        // Save new note and update metadata
        this.saveNote(tab);
        this.saveMetadata();
        
        setTimeout(() => {
            this.scrollToActiveTab();
        }, 10);
    }

    /**
     * Render a tab in the UI
     * @param {Object} tab - Tab data object
     */
    renderTab(tab) {
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tab.id;
        tabElement.draggable = true;

        tabElement.innerHTML = `
            <span class="tab-title" data-tab-id="${tab.id}">${tab.title}</span>
            <button class="tab-close" data-tab-id="${tab.id}">×</button>
        `;

        // Event listeners
        tabElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.switchToTab(tab.id);
                this.scrollToActiveTab();
            }
        });

        const closeBtn = tabElement.querySelector('.tab-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tab.id);
        });

        // Tab title editing
        const titleElement = tabElement.querySelector('.tab-title');
        titleElement.addEventListener('dblclick', () => {
            this.editTabTitle(tab.id);
        });

        // Drag and drop events
        tabElement.addEventListener('dragstart', (e) => {
            this.draggedTab = tabElement;
            tabElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        tabElement.addEventListener('dragend', () => {
            tabElement.classList.remove('dragging');
            this.draggedTab = null;
        });

        tabElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        tabElement.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.draggedTab && this.draggedTab !== tabElement) {
                const draggedIndex = Array.from(this.tabsList.children).indexOf(this.draggedTab);
                const afterElement = this.getDragAfterElement(this.tabsList, e.clientX);
                
                if (afterElement === tabElement) {
                    tabElement.parentNode.insertBefore(this.draggedTab, tabElement);
                } else {
                    tabElement.parentNode.insertBefore(this.draggedTab, tabElement.nextSibling);
                }

                const draggedTabData = this.tabs.splice(draggedIndex, 1)[0];
                const newTargetIndex = Array.from(this.tabsList.children).indexOf(this.draggedTab);
                this.tabs.splice(newTargetIndex, 0, draggedTabData);

                this.switchToTab(draggedTabData.id);
                this.scrollToActiveTab();
                
                // Save updated tab order
                this.saveMetadata();
            }
        });

        this.tabsList.appendChild(tabElement);
    }

    /**
     * Render an editor for a tab
     * @param {Object} tab - Tab data object
     */
    renderEditor(tab) {
        const editor = document.createElement('textarea');
        editor.className = 'editor';
        editor.dataset.tabId = tab.id;
        editor.value = tab.content;
        editor.placeholder = 'Write your note here...';

        editor.addEventListener('input', () => {
            const tabData = this.tabs.find(t => t.id === tab.id);
            if (tabData) {
                tabData.content = editor.value;
                // Use individual note saving for better performance
                this.saveNote(tabData);
            }
        });

        this.editorContainer.appendChild(editor);
    }

    /**
     * Switch to a specific tab
     * @param {number} tabId - Tab ID to switch to
     */
    switchToTab(tabId) {
        // Remove active class from all tabs and editors
        document.querySelectorAll('.tab.active').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.editor.active').forEach(editor => {
            editor.classList.remove('active');
        });

        // Add active class to target tab and editor
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
        const editorElement = document.querySelector(`.editor[data-tab-id="${tabId}"]`);

        if (tabElement && editorElement) {
            tabElement.classList.add('active');
            editorElement.classList.add('active');
            editorElement.focus();
            
            // Update active tab ID and save metadata if changed
            if (this.activeTabId !== tabId) {
                this.activeTabId = tabId;
                this.saveMetadata();
            }
        }
    }

    /**
     * Close a tab
     * @param {number} tabId - Tab ID to close
     */
    closeTab(tabId) {
        const tabToClose = this.tabs.find(t => t.id === tabId);
        if (!tabToClose) return;

        // If this is the only tab and it's an empty "Note 1", don't allow closing
        if (this.tabs.length === 1) {
            const isEmptyNote1 = tabToClose.title === 'Note 1' && (!tabToClose.content || tabToClose.content.trim() === '');
            if (isEmptyNote1) {
                return; // Don't close empty "Note 1" if it's the only tab
            }
            
            // Show confirmation for closing the last tab
            const hasContent = tabToClose.content && tabToClose.content.trim() !== '';
            const confirmMessage = hasContent 
                ? 'This tab contains data that will be deleted. Are you sure you want to close it? A new tab will be created.'
                : 'Are you sure you want to close this tab? A new tab will be created.';
            
            if (!confirm(confirmMessage)) {
                return;
            }
            
            // Close the tab and create a new one
            this.performTabClose(tabId);
            this.createNewTab();
            return;
        }

        // Check if tab has content and show confirmation
        const hasContent = tabToClose.content && tabToClose.content.trim() !== '';
        if (hasContent) {
            const confirmMessage = 'This tab contains data that will be deleted. Are you sure you want to close it?';
            if (!confirm(confirmMessage)) {
                return;
            }
        }

        // Perform the actual tab closing
        this.performTabClose(tabId);
    }

    /**
     * Perform the actual tab closing operations
     * @param {number} tabId - Tab ID to close
     */
    performTabClose(tabId) {
        const tabIndex = this.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        // Remove DOM elements
        document.querySelector(`[data-tab-id="${tabId}"]`).remove();
        document.querySelector(`.editor[data-tab-id="${tabId}"]`).remove();

        // Delete note from storage
        this.deleteNote(tabId);

        // Remove from data array
        this.tabs.splice(tabIndex, 1);

        // Switch to another tab if this was the active one and there are tabs remaining
        if (this.activeTabId === tabId && this.tabs.length > 0) {
            const newActiveIndex = Math.min(tabIndex, this.tabs.length - 1);
            this.switchToTab(this.tabs[newActiveIndex].id);
            this.scrollToActiveTab();
        }

        // Save updated metadata
        this.saveMetadata();
    }

    /**
     * Enable inline editing of tab title
     * @param {number} tabId - Tab ID to edit
     */
    editTabTitle(tabId) {
        const titleElement = document.querySelector(`.tab-title[data-tab-id="${tabId}"]`);
        const currentTitle = titleElement.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentTitle;
        input.className = 'tab-title-input';

        const finishEdit = () => {
            const newTitle = input.value.trim() || currentTitle;
            titleElement.textContent = newTitle;
            titleElement.style.display = 'inline';
            input.remove();

            const tab = this.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.title = newTitle;
                // Use individual note saving for better performance
                this.saveNote(tab);
            }
        };

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                titleElement.style.display = 'inline';
                input.remove();
            }
        });

        titleElement.style.display = 'none';
        titleElement.parentNode.insertBefore(input, titleElement);
        input.focus();
        input.select();
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
        document.documentElement.setAttribute('data-theme', newTheme);
    
        const themeIcon = document.getElementById('theme-icon');
        themeIcon.src = newTheme === 'dark' ? 'assets/icons/light-mode.svg' : 'assets/icons/dark-mode.svg';
    
        localStorage.setItem('theme', newTheme);
    }

    /**
     * Load theme from localStorage or detect system preference
     */
    loadTheme() {
        let savedTheme = localStorage.getItem('theme');
        
        // If no theme is saved, detect system preference
        if (!savedTheme) {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            savedTheme = prefersDark ? 'dark' : 'light';
        }
        
        document.documentElement.setAttribute('data-theme', savedTheme);
        const themeIcon = document.getElementById('theme-icon');
        themeIcon.src = savedTheme === 'dark' ? 'assets/icons/light-mode.svg' : 'assets/icons/dark-mode.svg';
        
        // Listen for system theme changes only if no theme is manually saved
        if (!localStorage.getItem('theme') && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                // Only auto-update if user hasn't manually set a theme
                if (!localStorage.getItem('theme')) {
                    const newTheme = e.matches ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', newTheme);
                    themeIcon.src = newTheme === 'dark' ? 'assets/icons/light-mode.svg' : 'assets/icons/dark-mode.svg';
                }
            });
        }
    }

    /**
     * Save data to storage (cloud or local)
     */
    async saveToStorage() {
        try {
            const data = {
                tabs: this.tabs,
                activeTabId: this.activeTabId
            };
            
            // Use storage service if available, otherwise fallback to localStorage
            if (storageService && this.isInitialized) {
                await storageService.saveData(data);
            } else {
                localStorage.setItem('NoteHub', JSON.stringify(data));
            }
        } catch (error) {
            console.error('Failed to save data:', error);
            if (error.name === 'QuotaExceededError') {
                if (typeof notificationManager !== 'undefined') {
                    notificationManager.error('Storage quota exceeded! Please export your notes.');
                } else {
                    alert('Storage quota exceeded! Please export your notes.');
                }
            }
        }
    }

    /**
     * Save individual note to storage
     * @param {Object} note - Note object to save
     */
    async saveNote(note) {
        try {
            if (storageService && this.isInitialized) {
                await storageService.saveNote(note);
            } else {
                // Fallback to saving individual note to localStorage
                localStorage.setItem(`NoteHub_Note_${note.id}`, JSON.stringify(note));
            }
        } catch (error) {
            console.error('Failed to save note:', error);
            if (error.name === 'QuotaExceededError') {
                if (typeof notificationManager !== 'undefined') {
                    notificationManager.error('Storage quota exceeded! Please export your notes.');
                } else {
                    alert('Storage quota exceeded! Please export your notes.');
                }
            }
        }
    }

    /**
     * Delete note from storage
     * @param {number} noteId - Note ID to delete
     */
    async deleteNote(noteId) {
        try {
            if (storageService && this.isInitialized) {
                await storageService.deleteNote(noteId);
            } else {
                // Fallback to deleting from localStorage
                localStorage.removeItem(`NoteHub_Note_${noteId}`);
            }
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    }

    /**
     * Save metadata (tab order, active tab)
     */
    async saveMetadata() {
        try {
            const metadata = {
                activeTabId: this.activeTabId,
                noteOrder: this.tabs.map(tab => tab.id)
            };

            if (storageService && this.isInitialized) {
                // For cloud storage, save as profile
                if (storageService.storageType === 'cloud' && storageService.syncEnabled) {
                    await firebaseService.saveUserProfile(metadata);
                }
                // Always save to localStorage as well
                localStorage.setItem('NoteHub_Metadata', JSON.stringify(metadata));
            } else {
                localStorage.setItem('NoteHub_Metadata', JSON.stringify(metadata));
            }
        } catch (error) {
            console.error('Failed to save metadata:', error);
        }
    }

    /**
     * Load data from storage (cloud or local)
     */
    async loadFromStorage() {
        try {
            let data = null;

            // Use storage service if available
            if (storageService) {
                data = await storageService.loadData();
            } else {
                // Fallback to basic localStorage loading
                const savedData = localStorage.getItem('NoteHub');
                if (savedData) {
                    data = JSON.parse(savedData);
                }
            }

            if (data) {
                this.tabs = data.tabs || [];
                this.activeTabId = data.activeTabId;

                // Render loaded tabs and editors
                this.tabs.forEach(tab => {
                    this.renderTab(tab);
                    this.renderEditor(tab);
                });

                // Switch to the previously active tab
                if (this.activeTabId && this.tabs.find(t => t.id === this.activeTabId)) {
                    this.switchToTab(this.activeTabId);
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
            // If loading fails, just continue with empty state
        }
    }

    /**
     * Export notes to JSON file
     */
    async exportNotes() {
        try {
            // Collect all notes data
            const allNotes = [];
            
            for (const tab of this.tabs) {
                // Try to get fresh data from storage first
                let noteData = tab;
                if (storageService && this.isInitialized) {
                    const freshNote = await storageService.loadNote(tab.id);
                    if (freshNote) {
                        noteData = freshNote;
                    }
                }
                allNotes.push(noteData);
            }

            const data = {
                tabs: allNotes,
                activeTabId: this.activeTabId,
                exportDate: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `notehub-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();

            URL.revokeObjectURL(url);
            
            // Show success notification
            if (typeof notificationManager !== 'undefined') {
                notificationManager.success('Notes exported successfully!');
            } else if (typeof cloudSyncUI !== 'undefined' && cloudSyncUI.showNotification) {
                cloudSyncUI.showNotification('Notes exported successfully!', 'success');
            }
        } catch (error) {
            console.error('Export failed:', error);
            if (typeof notificationManager !== 'undefined') {
                notificationManager.error('Export failed: ' + error.message);
            } else {
                alert('Export failed: ' + error.message);
            }
        }
    }

    /**
     * Import notes from JSON file
     * @param {Event} event - File input change event
     */
    importNotes(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (!data.tabs || !Array.isArray(data.tabs)) {
                    if (typeof notificationManager !== 'undefined') {
                        notificationManager.error('Invalid file format! Please select a valid NoteHub export file.');
                    } else {
                        alert('Invalid file format! Please select a valid NoteHub export file.');
                    }
                    return;
                }

                // Show confirmation dialog
                const confirmMessage = `This will replace all your current notes with ${data.tabs.length} imported note(s). Are you sure you want to continue?`;
                if (!confirm(confirmMessage)) {
                    return;
                }

                try {
                    // Clear existing UI
                    this.tabsList.innerHTML = '';
                    this.editorContainer.innerHTML = '';

                    // Delete all existing notes from storage
                    for (const tab of this.tabs) {
                        await this.deleteNote(tab.id);
                    }

                    // Import new data
                    this.tabs = data.tabs;
                    
                    // Update activeTabId if needed
                    if (data.activeTabId && this.tabs.find(t => t.id === data.activeTabId)) {
                        this.activeTabId = data.activeTabId;
                    } else if (this.tabs.length > 0) {
                        this.activeTabId = this.tabs[0].id;
                    }

                    // Save all imported notes
                    for (const tab of this.tabs) {
                        await this.saveNote(tab);
                    }

                    // Save metadata
                    await this.saveMetadata();

                    // Render imported tabs and editors
                    this.tabs.forEach(tab => {
                        this.renderTab(tab);
                        this.renderEditor(tab);
                    });

                    // Switch to appropriate tab
                    if (this.tabs.length > 0) {
                        this.switchToTab(this.activeTabId || this.tabs[0].id);
                    }
                    
                    setTimeout(() => {
                        this.scrollToActiveTab();
                    }, 10);
                    
                    // Show success notification
                    if (typeof notificationManager !== 'undefined') {
                        notificationManager.success(`${data.tabs.length} notes imported successfully!`);
                    } else if (typeof cloudSyncUI !== 'undefined' && cloudSyncUI.showNotification) {
                        cloudSyncUI.showNotification(`${data.tabs.length} notes imported successfully!`, 'success');
                    } else {
                        alert(`${data.tabs.length} notes imported successfully!`);
                    }
                } catch (error) {
                    console.error('Import process failed:', error);
                    if (typeof notificationManager !== 'undefined') {
                        notificationManager.error('Import failed during processing: ' + error.message);
                    } else {
                        alert('Import failed during processing: ' + error.message);
                    }
                }
            } catch (error) {
                console.error('Import file parsing failed:', error);
                if (typeof notificationManager !== 'undefined') {
                    notificationManager.error('File reading error: ' + error.message);
                } else {
                    alert('File reading error: ' + error.message);
                }
            }
        };

        reader.readAsText(file);
        event.target.value = '';
    }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NoteHub();
});