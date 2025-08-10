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

            // Listen for storage type changes and reload data accordingly
            storageService.onSyncStatusChange((status) => {
                if (status.changed && !status.shouldReload) {
                    this.reloadDataFromCurrentStorage();
                }
            });

            // Listen for cloud data refresh events
            document.addEventListener('cloudDataRefreshed', (event) => {
                this.handleCloudDataRefreshed(event.detail.data);
            });

            // Load existing data - always force refresh from cloud on page load
            await this.loadFromStorage(true);
            
            // Bind events
            this.bindEvents();

            // Create first tab if none exist
            if (this.tabs.length === 0) {
                this.createNewTab();
            }

            // Initialize keyboard shortcuts and help system
            this.initializeKeyboardAndHelp();

            // Initialize import/export manager
            this.initializeImportExport();

            // Initialize theme manager
            this.initializeThemeManager();

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize NoteHub:', error);
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
     * Initialize import/export manager
     */
    initializeImportExport() {
        if (typeof ImportExportManager !== 'undefined') {
            this.importExportManager = new ImportExportManager(this);
        }
    }

    /**
     * Initialize theme manager
     */
    initializeThemeManager() {
        if (typeof ThemeManager !== 'undefined') {
            this.themeManager = new ThemeManager();
        }
    }

    /**
     * Initialize DOM elements and basic UI
     */
    initializeElements() {
        this.tabsList = document.getElementById('tabs-list');
        this.editorContainer = document.getElementById('editor-container');
        this.newTabBtn = document.getElementById('new-tab-btn');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        this.newTabBtn.addEventListener('click', () => this.createNewTab());

        // Add dragover and drop events to tabs list for end-of-list dropping
        this.tabsList.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        this.tabsList.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.draggedTab && !this.getDragAfterElement(this.tabsList, e.clientX)) {
                this.tabsList.appendChild(this.draggedTab);
                
                const draggedIndex = this.tabs.findIndex(t => t.id == this.draggedTab.dataset.tabId);
                const draggedTabData = this.tabs.splice(draggedIndex, 1)[0];
                this.tabs.push(draggedTabData);
                
                this.saveToStorage();
            }
        });
    }

    /**
     * Scroll to make the active tab visible
     */
    scrollToActiveTab() {
        const activeTab = document.querySelector('.tab.active');
        if (!activeTab) return;

        const tabsListRect = this.tabsList.getBoundingClientRect();
        const activeTabRect = activeTab.getBoundingClientRect();
        
        if (activeTabRect.left < tabsListRect.left) {
            this.tabsList.scrollLeft -= (tabsListRect.left - activeTabRect.left) + 20;
        } else if (activeTabRect.right > tabsListRect.right) {
            this.tabsList.scrollLeft += (activeTabRect.right - tabsListRect.right) + 20;
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
        // Generate next available ID
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
        this.scrollToActiveTab();
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

        tabElement.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tab.id);
        });

        // Tab title editing
        tabElement.querySelector('.tab-title').addEventListener('dblclick', () => {
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
        document.querySelectorAll('.tab.active, .editor.active').forEach(el => {
            el.classList.remove('active');
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
            if (isEmptyNote1) return;
            
            // Show confirmation for closing the last tab
            const hasContent = tabToClose.content && tabToClose.content.trim() !== '';
            const confirmMessage = hasContent 
                ? 'This tab contains data that will be deleted. Are you sure you want to close it? A new tab will be created.'
                : 'Are you sure you want to close this tab? A new tab will be created.';
            
            if (!confirm(confirmMessage)) return;
            
            this.performTabClose(tabId);
            this.createNewTab();
            return;
        }

        // Check if tab has content and show confirmation
        const hasContent = tabToClose.content && tabToClose.content.trim() !== '';
        if (hasContent && !confirm('This tab contains data that will be deleted. Are you sure you want to close it?')) {
            return;
        }

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
     * Save data to storage (cloud or local)
     */
    async saveToStorage() {
        try {
            const data = {
                tabs: this.tabs,
                activeTabId: this.activeTabId
            };
            
            if (storageService && this.isInitialized) {
                await storageService.saveData(data);
            } else {
                localStorage.setItem('NoteHub', JSON.stringify(data));
            }
        } catch (error) {
            console.error('Failed to save data:', error);
            if (error.name === 'QuotaExceededError') {
                notificationManager.error('Storage quota exceeded! Please export your notes.');
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
                localStorage.setItem(`NoteHub_Note_${note.id}`, JSON.stringify(note));
            }
        } catch (error) {
            console.error('Failed to save note:', error);
            if (error.name === 'QuotaExceededError') {
                notificationManager.error('Storage quota exceeded! Please export your notes.');
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
                if (storageService.storageType === 'cloud' && storageService.syncEnabled) {
                    await firebaseService.saveUserProfile(metadata);
                }
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
     * @param {boolean} forceCloudRefresh - Force refresh from cloud storage
     */
    async loadFromStorage(forceCloudRefresh = false) {
        try {
            let data = null;

            if (storageService) {
                data = await storageService.loadData(forceCloudRefresh);
            } else {
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
        }
    }

    /**
     * Reload data from current storage
     */
    async reloadDataFromCurrentStorage() {
        if (!this.isInitialized) return;

        try {
            // Clear existing UI
            this.tabsList.innerHTML = '';
            this.editorContainer.innerHTML = '';
            
            // Reset data arrays
            this.tabs = [];
            this.activeTabId = null;

            // Load fresh data from current storage
            await this.loadFromStorage(true);

            // Create first tab if none exist
            if (this.tabs.length === 0) {
                this.createNewTab();
            } else {
                // Switch to active tab or first tab
                const activeTab = this.tabs.find(t => t.id === this.activeTabId) || this.tabs[0];
                if (activeTab) {
                    this.switchToTab(activeTab.id);
                }
            }

            setTimeout(() => this.scrollToActiveTab(), 100);
        } catch (error) {
            console.error('Error reloading data:', error);
        }
    }

    /**
     * Handle cloud data refreshed event
     * @param {Object} freshData - Fresh data from cloud
     */
    async handleCloudDataRefreshed(freshData) {
        if (!this.isInitialized || !freshData) return;

        try {
            const dataChanged = freshData.tabs.length !== this.tabs.length ||
                               freshData.activeTabId !== this.activeTabId ||
                               this.hasContentChanges(freshData.tabs, this.tabs);

            if (dataChanged) {
                notificationManager.info('Fresh notes loaded from cloud!');
                
                // Clear existing UI
                this.tabsList.innerHTML = '';
                this.editorContainer.innerHTML = '';
                
                // Update data
                this.tabs = freshData.tabs || [];
                this.activeTabId = freshData.activeTabId;

                // Render fresh tabs and editors
                this.tabs.forEach(tab => {
                    this.renderTab(tab);
                    this.renderEditor(tab);
                });

                // Switch to appropriate tab
                if (this.tabs.length > 0) {
                    const activeTab = this.tabs.find(t => t.id === this.activeTabId) || this.tabs[0];
                    this.switchToTab(activeTab.id);
                } else {
                    this.createNewTab();
                }

                setTimeout(() => this.scrollToActiveTab(), 100);
            }
        } catch (error) {
            console.error('Error handling cloud data refresh:', error);
        }
    }

    /**
     * Check if there are content changes between two tab arrays
     * @param {Array} newTabs - New tabs array
     * @param {Array} currentTabs - Current tabs array
     * @returns {boolean} True if there are content changes
     */
    hasContentChanges(newTabs, currentTabs) {
        if (!newTabs || !currentTabs) return true;
        
        const newTabsMap = new Map(newTabs.map(tab => [tab.id, tab]));
        const currentTabsMap = new Map(currentTabs.map(tab => [tab.id, tab]));
        
        for (const [id, newTab] of newTabsMap) {
            const currentTab = currentTabsMap.get(id);
            if (!currentTab || 
                currentTab.title !== newTab.title || 
                currentTab.content !== newTab.content) {
                return true;
            }
        }
        
        return false;
    }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NoteHub();
});