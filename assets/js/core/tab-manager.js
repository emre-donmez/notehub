/**
 * Tab Manager
 * Handles tab creation, rendering, drag&drop, and management
 */
class TabManager {
    constructor(noteHub) {
        this.noteHub = noteHub; // Reference to main app
        this.tabs = [];
        this.activeTabId = null;
        this.draggedTab = null;
        
        // DOM elements
        this.tabsList = null;
        this.editorContainer = null;
        this.newTabBtn = null;
        this.scrollLeftBtn = null;
        this.scrollRightBtn = null;
    }

    /**
     * Initialize tab manager
     */
    initialize() {
        this.tabsList = DOMUtils.getElementById('tabs-list');
        this.editorContainer = DOMUtils.getElementById('editor-container');
        this.newTabBtn = DOMUtils.getElementById('new-tab-btn');
        this.scrollLeftBtn = DOMUtils.getElementById('scroll-left');
        this.scrollRightBtn = DOMUtils.getElementById('scroll-right');

        this.bindEvents();
        this.updateScrollButtons();
    }

    /**
     * Bind tab-related events
     */
    bindEvents() {
        if (this.newTabBtn) {
            this.newTabBtn.addEventListener('click', () => this.createNewTab());
        }

        if (this.scrollLeftBtn) {
            this.scrollLeftBtn.addEventListener('click', () => this.scrollTabs('left'));
        }

        if (this.scrollRightBtn) {
            this.scrollRightBtn.addEventListener('click', () => this.scrollTabs('right'));
        }

        if (this.tabsList) {
            // Scroll event for button visibility
            this.tabsList.addEventListener('scroll', () => this.updateScrollButtons());

            // Drag and drop for tab reordering
            this.setupTabsDragAndDrop();
        }
    }

    /**
     * Setup drag and drop for tabs list
     */
    setupTabsDragAndDrop() {
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
                    
                    this.noteHub.saveMetadata();
                }
            }
        });
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
        
        // Save new note
        this.noteHub.saveNote(tab);
        this.noteHub.saveMetadata();
        
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
        const tabElement = DOMUtils.createElement('div', {
            className: 'tab',
            dataset: { tabId: tab.id },
            draggable: true
        }, `
            <span class="tab-title" data-tab-id="${tab.id}">${tab.title}</span>
            <button class="tab-close" data-tab-id="${tab.id}">×</button>
        `);

        this.setupTabEvents(tabElement, tab);
        this.tabsList.appendChild(tabElement);
    }

    /**
     * Setup events for a tab element
     * @param {HTMLElement} tabElement - Tab DOM element
     * @param {Object} tab - Tab data
     */
    setupTabEvents(tabElement, tab) {
        // Tab click (switch)
        tabElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.switchToTab(tab.id);
                this.scrollToActiveTab();
            }
        });

        // Close button
        const closeBtn = tabElement.querySelector('.tab-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tab.id);
        });

        // Title editing
        const titleElement = tabElement.querySelector('.tab-title');
        titleElement.addEventListener('dblclick', () => {
            this.editTabTitle(tab.id);
        });

        // Drag and drop
        this.setupTabDragEvents(tabElement);
    }

    /**
     * Setup drag events for a tab
     * @param {HTMLElement} tabElement - Tab element
     */
    setupTabDragEvents(tabElement) {
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
                this.handleTabDrop(tabElement);
            }
        });
    }

    /**
     * Handle tab drop for reordering
     * @param {HTMLElement} targetTab - Target tab element
     */
    handleTabDrop(targetTab) {
        const draggedIndex = Array.from(this.tabsList.children).indexOf(this.draggedTab);
        const afterElement = this.getDragAfterElement(this.tabsList, event.clientX);
        
        if (afterElement === targetTab) {
            targetTab.parentNode.insertBefore(this.draggedTab, targetTab);
        } else {
            targetTab.parentNode.insertBefore(this.draggedTab, targetTab.nextSibling);
        }

        const draggedTabData = this.tabs.splice(draggedIndex, 1)[0];
        const newTargetIndex = Array.from(this.tabsList.children).indexOf(this.draggedTab);
        this.tabs.splice(newTargetIndex, 0, draggedTabData);

        this.switchToTab(parseInt(this.draggedTab.dataset.tabId));
        this.scrollToActiveTab();
        this.noteHub.saveMetadata();
    }

    /**
     * Get element after which dragged tab should be dropped
     * @param {HTMLElement} container - Container element
     * @param {number} x - X coordinate
     * @returns {HTMLElement|null}
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
     * Render an editor for a tab
     * @param {Object} tab - Tab data object
     */
    renderEditor(tab) {
        const editor = DOMUtils.createElement('textarea', {
            className: 'editor',
            dataset: { tabId: tab.id },
            placeholder: 'Write your note here...'
        });

        editor.value = tab.content;

        editor.addEventListener('input', () => {
            const tabData = this.tabs.find(t => t.id === tab.id);
            if (tabData) {
                tabData.content = editor.value;
                this.noteHub.saveNote(tabData);
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
        this.tabsList.querySelectorAll('.tab.active').forEach(tab => {
            tab.classList.remove('active');
        });
        this.editorContainer.querySelectorAll('.editor.active').forEach(editor => {
            editor.classList.remove('active');
        });

        // Add active class to target tab and editor
        const tabElement = this.tabsList.querySelector(`[data-tab-id="${tabId}"]`);
        const editorElement = this.editorContainer.querySelector(`.editor[data-tab-id="${tabId}"]`);

        if (tabElement && editorElement) {
            tabElement.classList.add('active');
            editorElement.classList.add('active');
            DOMUtils.focusElement(editorElement);
            
            // Update active tab ID
            if (this.activeTabId !== tabId) {
                this.activeTabId = tabId;
                this.noteHub.saveMetadata();
            }
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
        DOMUtils.removeElement(this.tabsList.querySelector(`[data-tab-id="${tabId}"]`));
        DOMUtils.removeElement(this.editorContainer.querySelector(`.editor[data-tab-id="${tabId}"]`));

        // Delete note from storage
        this.noteHub.deleteNote(tabId);

        // Remove from data array
        this.tabs.splice(tabIndex, 1);

        // Switch to another tab if this was the active one
        if (this.activeTabId === tabId) {
            const newActiveIndex = Math.min(tabIndex, this.tabs.length - 1);
            this.switchToTab(this.tabs[newActiveIndex].id);
            this.scrollToActiveTab();
        }

        this.noteHub.saveMetadata();
        
        setTimeout(() => {
            this.updateScrollButtons();
        }, 10);
    }

    /**
     * Enable inline editing of tab title
     * @param {number} tabId - Tab ID to edit
     */
    editTabTitle(tabId) {
        const titleElement = this.tabsList.querySelector(`.tab-title[data-tab-id="${tabId}"]`);
        if (!titleElement) return;

        const currentTitle = titleElement.textContent;
        const input = DOMUtils.createElement('input', {
            type: 'text',
            className: 'tab-title-input'
        });
        input.value = currentTitle;

        const finishEdit = () => {
            const newTitle = input.value.trim() || currentTitle;
            titleElement.textContent = newTitle;
            titleElement.style.display = 'inline';
            DOMUtils.removeElement(input);

            const tab = this.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.title = newTitle;
                this.noteHub.saveNote(tab);
            }
        };

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                titleElement.style.display = 'inline';
                DOMUtils.removeElement(input);
            }
        });

        titleElement.style.display = 'none';
        titleElement.parentNode.insertBefore(input, titleElement);
        DOMUtils.focusElement(input);
        input.select();
    }

    /**
     * Scroll tabs container
     * @param {string} direction - 'left' or 'right'
     */
    scrollTabs(direction = 'right') {
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
        if (!this.tabsList || !this.scrollLeftBtn || !this.scrollRightBtn) return;

        const canScrollLeft = this.tabsList.scrollLeft > 0;
        const canScrollRight = this.tabsList.scrollLeft < (this.tabsList.scrollWidth - this.tabsList.clientWidth);
        
        this.scrollLeftBtn.style.display = canScrollLeft ? 'block' : 'none';
        this.scrollRightBtn.style.display = canScrollRight ? 'block' : 'none';
    }

    /**
     * Scroll to make the active tab visible
     */
    scrollToActiveTab() {
        const activeTab = this.tabsList.querySelector('.tab.active');
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
     * Clear all tabs and editors from UI
     */
    clearUI() {
        DOMUtils.clearElement(this.tabsList);
        DOMUtils.clearElement(this.editorContainer);
    }

    /**
     * Load tabs data
     * @param {Array} tabsData - Array of tab objects
     * @param {number} activeTabId - ID of active tab
     */
    loadTabs(tabsData, activeTabId) {
        this.tabs = tabsData || [];
        this.activeTabId = activeTabId;

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

    /**
     * Get all tabs data
     * @returns {Array} Array of tab objects
     */
    getAllTabs() {
        return this.tabs;
    }

    /**
     * Get active tab ID
     * @returns {number|null} Active tab ID
     */
    getActiveTabId() {
        return this.activeTabId;
    }

    /**
     * Check if tabs exist
     * @returns {boolean} True if tabs exist
     */
    hasTabs() {
        return this.tabs.length > 0;
    }
}

// Export for global use
window.TabManager = TabManager;