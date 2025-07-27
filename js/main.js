/**
 * NoteHub - A modern note-taking application with cloud sync capabilities
 * Supports both local storage and Firebase cloud synchronization
 */
class NoteHub {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.tabCounter = 0;
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
            // Load environment configuration
            const config = await envConfig.loadConfig();
            
            // Initialize Firebase if enabled
            if (envConfig.isFirebaseEnabled() && config.FIREBASE_API_KEY) {
                await firebaseService.initialize(config);
            }

            // Initialize storage service
            await storageService.initialize(config.DEFAULT_STORAGE_TYPE);

            // Initialize UI components
            this.initializeElements();
            
            // Always initialize cloud sync UI (it handles both local and cloud modes)
            cloudSyncUI.initialize();

            // Load existing data
            await this.loadFromStorage();
            
            // Bind events
            this.bindEvents();

            // Create first tab if none exist
            if (this.tabs.length === 0) {
                this.createNewTab();
            }

            this.isInitialized = true;
            console.log('NoteHub initialized successfully');
        } catch (error) {
            console.error('Failed to initialize NoteHub:', error);
            // Fallback to basic initialization without cloud features
            this.initializeBasic();
        }
    }

    /**
     * Basic initialization without cloud features (fallback)
     */
    initializeBasic() {
        this.initializeElements();
        
        // Try to initialize cloud sync UI even in basic mode
        try {
            cloudSyncUI.initialize();
        } catch (error) {
            console.warn('Cloud sync UI not available in basic mode:', error);
        }
        
        this.loadFromStorageBasic();
        this.bindEvents();
        
        if (this.tabs.length === 0) {
            this.createNewTab();
        }

        this.isInitialized = true;
        console.log('NoteHub initialized in basic mode');
    }

    /**
     * Initialize DOM elements and basic UI
     */
    initializeElements() {
        this.tabsList = document.getElementById('tabs-list');
        this.editorContainer = document.getElementById('editor-container');
        this.newTabBtn = document.getElementById('new-tab-btn');
        this.scrollLeftBtn = document.getElementById('scroll-left');
        this.scrollRightBtn = document.getElementById('scroll-right');
        this.themeToggle = document.getElementById('theme-toggle');
        this.exportBtn = document.getElementById('export-btn');
        this.importBtn = document.getElementById('import-btn');
        this.importFile = document.getElementById('import-file');

        // Load theme
        this.loadTheme();
        this.updateScrollButtons();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        this.newTabBtn.addEventListener('click', () => this.createNewTab());
        this.scrollLeftBtn.addEventListener('click', () => this.scrollTabs('left'));
        this.scrollRightBtn.addEventListener('click', () => this.scrollTabs('right'));
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.exportBtn.addEventListener('click', () => this.exportNotes());
        this.importBtn.addEventListener('click', () => this.importFile.click());
        this.importFile.addEventListener('change', (e) => this.importNotes(e));

        // Add scroll event listener to update scroll buttons
        this.tabsList.addEventListener('scroll', () => {
            this.updateScrollButtons();
        });

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
     * Scroll tabs container
     * @param {string} direction - 'left' or 'right'
     */
    scrollTabs(direction) {
        const scrollAmount = 200;
        if (direction === 'left') {
            this.tabsList.scrollLeft -= scrollAmount;
        } else {
            this.tabsList.scrollLeft += scrollAmount;
        }
    }

    /**
     * Update scroll button visibility
     */
    updateScrollButtons() {
        const canScrollLeft = this.tabsList.scrollLeft > 0;
        const canScrollRight = this.tabsList.scrollLeft < (this.tabsList.scrollWidth - this.tabsList.clientWidth);
        
        this.scrollLeftBtn.style.display = canScrollLeft ? 'block' : 'none';
        this.scrollRightBtn.style.display = canScrollRight ? 'block' : 'none';
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
        const id = ++this.tabCounter;
        const tab = {
            id: id,
            title: `Note ${id}`,
            content: ''
        };

        this.tabs.push(tab);
        this.renderTab(tab);
        this.renderEditor(tab);
        this.switchToTab(id);
        this.saveToStorage();
        
        setTimeout(() => {
            this.updateScrollButtons();
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

                this.saveToStorage();
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
                this.saveToStorage();
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
            this.activeTabId = tabId;
        }
    }

    /**
     * Close a tab
     * @param {number} tabId - Tab ID to close
     */
    closeTab(tabId) {
        if (this.tabs.length <= 1) return;

        const tabIndex = this.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        // Remove DOM elements
        document.querySelector(`[data-tab-id="${tabId}"]`).remove();
        document.querySelector(`.editor[data-tab-id="${tabId}"]`).remove();

        // Remove from data array
        this.tabs.splice(tabIndex, 1);

        // Switch to another tab if this was the active one
        if (this.activeTabId === tabId) {
            const newActiveIndex = Math.min(tabIndex, this.tabs.length - 1);
            this.switchToTab(this.tabs[newActiveIndex].id);
            this.scrollToActiveTab();
        }

        this.saveToStorage();
        
        setTimeout(() => {
            this.updateScrollButtons();
        }, 10);
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
                this.saveToStorage();
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
        themeIcon.src = newTheme === 'dark' ? 'icons/light-mode.svg' : 'icons/dark-mode.svg';
    
        localStorage.setItem('theme', newTheme);
    }

    /**
     * Load theme from localStorage
     */
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        const themeIcon = document.getElementById('theme-icon');
        themeIcon.src = savedTheme === 'dark' ? 'icons/light-mode.svg' : 'icons/dark-mode.svg';
    }

    /**
     * Save data to storage (cloud or local)
     */
    async saveToStorage() {
        try {
            const data = {
                tabs: this.tabs,
                activeTabId: this.activeTabId,
                tabCounter: this.tabCounter
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
                alert('Storage quota exceeded! Please export your notes.');
            }
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
                data = this.loadFromStorageBasic();
            }

            if (data) {
                this.tabs = data.tabs || [];
                this.activeTabId = data.activeTabId;
                this.tabCounter = data.tabCounter || 0;

                // Render loaded tabs and editors
                this.tabs.forEach(tab => {
                    this.renderTab(tab);
                    this.renderEditor(tab);
                });

                // Switch to the previously active tab
                if (this.activeTabId && this.tabs.find(t => t.id === this.activeTabId)) {
                    this.switchToTab(this.activeTabId);
                }

                setTimeout(() => {
                    this.updateScrollButtons();
                    this.scrollToActiveTab();
                }, 10);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            // Fallback to basic loading
            this.loadFromStorageBasic();
        }
    }

    /**
     * Basic localStorage loading (fallback method)
     * @returns {Object|null} Loaded data or null
     */
    loadFromStorageBasic() {
        const savedData = localStorage.getItem('NoteHub');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.tabs = data.tabs || [];
                this.activeTabId = data.activeTabId;
                this.tabCounter = data.tabCounter || 0;

                this.tabs.forEach(tab => {
                    this.renderTab(tab);
                    this.renderEditor(tab);
                });

                if (this.activeTabId && this.tabs.find(t => t.id === this.activeTabId)) {
                    this.switchToTab(this.activeTabId);
                }

                setTimeout(() => {
                    this.updateScrollButtons();
                    this.scrollToActiveTab();
                }, 10);

                return data;
            } catch (error) {
                console.error('Error loading data from localStorage:', error);
                return null;
            }
        }
        return null;
    }

    /**
     * Export notes to JSON file
     */
    exportNotes() {
        const data = {
            tabs: this.tabs,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `my-notes-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Import notes from JSON file
     * @param {Event} event - File input change event
     */
    importNotes(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (data.tabs && Array.isArray(data.tabs)) {
                    // Clear existing UI
                    this.tabsList.innerHTML = '';
                    this.editorContainer.innerHTML = '';

                    // Load imported data
                    this.tabs = data.tabs;
                    this.tabCounter = Math.max(...this.tabs.map(t => t.id), 0);

                    // Render imported tabs and editors
                    this.tabs.forEach(tab => {
                        this.renderTab(tab);
                        this.renderEditor(tab);
                    });

                    // Switch to first tab
                    if (this.tabs.length > 0) {
                        this.switchToTab(this.tabs[0].id);
                    }

                    // Save imported data
                    this.saveToStorage();
                    
                    setTimeout(() => {
                        this.updateScrollButtons();
                        this.scrollToActiveTab();
                    }, 10);
                    
                    alert('Notes imported successfully!');
                } else {
                    alert('Invalid file format!');
                }
            } catch (error) {
                alert('File reading error: ' + error.message);
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