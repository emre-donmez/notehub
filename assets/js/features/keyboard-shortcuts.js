/**
 * Keyboard Shortcuts Manager for NoteHub
 * Handles all keyboard shortcuts and quick tab selector
 */
class KeyboardShortcuts {
    constructor(noteHub) {
        this.noteHub = noteHub;
        this.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        this.modifierKey = this.isMac ? 'ctrlKey' : 'altKey'; 
        this.isQuickSelectorOpen = false;
        
        this.init();
    }

    /**
     * Initialize keyboard shortcuts
     */
    init() {
        this.bindGlobalShortcuts();
        this.bindQuickSelectorEvents();
    }

    /**
     * Bind global keyboard event listeners
     */
    bindGlobalShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Check if we're typing in an input or textarea (except our editors)
            const isTyping = e.target.tagName === 'INPUT' && e.target.type === 'text';
            const isEditing = e.target.classList.contains('tab-title-input');
            
            // Don't interfere with normal typing except for escape key
            if ((isTyping || isEditing) && e.key !== 'Escape') {
                return;
            }
            
            // Handle shortcuts - Ctrl on Mac, Alt on Windows/Linux
            if (e[this.modifierKey] && !e.shiftKey && !(this.isMac ? e.altKey : e.ctrlKey) && !e.metaKey) {
                this.handleModifierShortcuts(e);
            }
        });
    }

    /**
     * Handle Ctrl (Mac) / Alt (Windows/Linux) key shortcuts
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleModifierShortcuts(e) {
        // Check for number keys (1-9) for direct tab switching
        if (/^[1-9]$/.test(e.key)) {
            e.preventDefault();
            this.switchToTabByNumber(parseInt(e.key));
            return;
        }

        const shortcuts = {
            't': () => this.noteHub.createNewTab(),
            'w': () => {
                if (this.noteHub.activeTabId) {
                    this.noteHub.closeTab(this.noteHub.activeTabId);
                }
            },
            'r': () => {
                if (this.noteHub.activeTabId) {
                    this.noteHub.editTabTitle(this.noteHub.activeTabId);
                }
            },
            'q': () => this.toggleQuickSelector(),
            'arrowleft': () => this.switchToPreviousTab(),
            'arrowright': () => this.switchToNextTab()
        };

        const action = shortcuts[e.key.toLowerCase()];
        if (action) {
            e.preventDefault();
            action();
        }
    }

    /**
     * Switch to tab by number (1-9)
     * @param {number} tabNumber - Tab number (1-based index)
     */
    switchToTabByNumber(tabNumber) {
        const tabs = this.noteHub.tabs;
        if (tabNumber < 1 || tabNumber > tabs.length) return;

        const tabIndex = tabNumber - 1; // Convert to 0-based index
        const targetTab = tabs[tabIndex];
        
        if (targetTab) {
            this.noteHub.switchToTab(targetTab.id);
            this.noteHub.scrollToActiveTab();
        }
    }

    /**
     * Switch to the previous tab
     */
    switchToPreviousTab() {
        const tabs = this.noteHub.tabs;
        if (tabs.length <= 1) return;

        const currentIndex = tabs.findIndex(tab => tab.id === this.noteHub.activeTabId);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        
        this.noteHub.switchToTab(tabs[prevIndex].id);
        this.noteHub.scrollToActiveTab();
    }

    /**
     * Switch to the next tab
     */
    switchToNextTab() {
        const tabs = this.noteHub.tabs;
        if (tabs.length <= 1) return;

        const currentIndex = tabs.findIndex(tab => tab.id === this.noteHub.activeTabId);
        const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        
        this.noteHub.switchToTab(tabs[nextIndex].id);
        this.noteHub.scrollToActiveTab();
    }

    /**
     * Bind quick selector modal events
     */
    bindQuickSelectorEvents() {
        const modal = document.getElementById('quick-selector-modal');
        const closeBtn = document.getElementById('quick-selector-close');
        const searchInput = document.getElementById('tab-search');
        let selectedIndex = 0;

        if (!modal || !closeBtn || !searchInput) {
            console.warn('Quick selector modal elements not found');
            return;
        }

        // Close events
        closeBtn.addEventListener('click', () => this.closeQuickSelector());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeQuickSelector();
            }
        });

        // Search input events
        searchInput.addEventListener('input', (e) => {
            this.filterTabs(e.target.value);
            selectedIndex = 0;
            this.updateSelection(selectedIndex);
        });

        const keyActions = {
            'ArrowDown': (e, tabItems) => {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, tabItems.length - 1);
                this.updateSelection(selectedIndex);
            },
            'ArrowUp': (e, tabItems) => {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                this.updateSelection(selectedIndex);
            },
            'Enter': (e, tabItems) => {
                e.preventDefault();
                if (tabItems[selectedIndex]) {
                    const tabId = parseInt(tabItems[selectedIndex].dataset.tabId);
                    this.selectTab(tabId);
                }
            },
            'Escape': (e) => {
                e.preventDefault();
                this.closeQuickSelector();
            }
        };

        searchInput.addEventListener('keydown', (e) => {
            const tabItems = document.querySelectorAll('.quick-tab-item:not([style*="display: none"])');
            const action = keyActions[e.key];
            if (action) {
                action(e, tabItems);
            }
        });
    }

    /**
     * Toggle quick selector modal
     */
    toggleQuickSelector() {
        if (this.isQuickSelectorOpen) {
            this.closeQuickSelector();
        } else {
            this.openQuickSelector();
        }
    }

    /**
     * Open quick selector modal
     */
    openQuickSelector() {
        const modal = document.getElementById('quick-selector-modal');
        const searchInput = document.getElementById('tab-search');
        
        if (!modal || !searchInput) return;
        
        this.populateTabList();
        modal.style.display = 'flex';
        
        // Focus and select all text in search input
        setTimeout(() => {
            searchInput.focus();
            searchInput.select();
        }, 100);
        
        this.isQuickSelectorOpen = true;
    }

    /**
     * Close quick selector modal
     */
    closeQuickSelector() {
        const modal = document.getElementById('quick-selector-modal');
        const searchInput = document.getElementById('tab-search');
        
        if (!modal || !searchInput) return;
        
        modal.style.display = 'none';
        searchInput.value = '';
        this.isQuickSelectorOpen = false;
    }

    /**
     * Populate the tab list in quick selector
     */
    populateTabList() {
        const tabList = document.getElementById('quick-tab-list');
        if (!tabList) return;
        
        const tabs = this.noteHub.tabs;
        
        tabList.innerHTML = '';
        
        tabs.forEach((tab) => {
            const tabItem = document.createElement('div');
            tabItem.className = 'quick-tab-item';
            tabItem.dataset.tabId = tab.id;
            
            const isActive = tab.id === this.noteHub.activeTabId;
            if (isActive) {
                tabItem.classList.add('active');
            }
            
            const preview = tab.content.length > 50 
                ? tab.content.substring(0, 50) + '...' 
                : tab.content || 'Empty note';
                
            tabItem.innerHTML = `
                <div class="tab-item-header">
                    <span class="tab-item-title">${this.escapeHtml(tab.title)}</span>
                    ${isActive ? '<span class="active-indicator">●</span>' : ''}
                </div>
                <div class="tab-item-preview">${this.escapeHtml(preview)}</div>
            `;
            
            tabItem.addEventListener('click', () => this.selectTab(tab.id));
            tabList.appendChild(tabItem);
        });
        
        // Select first item by default
        this.updateSelection(0);
    }

    /**
     * Filter tabs based on search query
     * @param {string} query - Search query
     */
    filterTabs(query) {
        const tabItems = document.querySelectorAll('.quick-tab-item');
        const lowerQuery = query.toLowerCase();
        
        tabItems.forEach(item => {
            const title = item.querySelector('.tab-item-title').textContent.toLowerCase();
            const preview = item.querySelector('.tab-item-preview').textContent.toLowerCase();
            
            const isVisible = title.includes(lowerQuery) || preview.includes(lowerQuery);
            item.style.display = isVisible ? 'block' : 'none';
        });
    }

    /**
     * Update selection highlight
     * @param {number} index - Selected index
     */
    updateSelection(index) {
        const visibleItems = document.querySelectorAll('.quick-tab-item:not([style*="display: none"])');
        
        // Remove previous selection
        document.querySelectorAll('.quick-tab-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selection to current item
        if (visibleItems[index]) {
            visibleItems[index].classList.add('selected');
            visibleItems[index].scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Select a tab and close modal
     * @param {number} tabId - Tab ID to select
     */
    selectTab(tabId) {
        this.noteHub.switchToTab(tabId);
        this.noteHub.scrollToActiveTab();
        this.closeQuickSelector();
    }

    /**
     * Escape HTML content
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get shortcut display text for current platform
     * @param {string} key - Key combination
     * @returns {string} Platform-specific shortcut text
     */
    getShortcutText(key) {
        const prefix = this.isMac ? '⌃ Control' : 'Alt';
        return `${prefix} + ${key}`;
    }

    /**
     * Get all available shortcuts
     * @returns {Object} Shortcuts object
     */
    getShortcuts() {
        return {
            'Quick Tab Selector': this.getShortcutText('Q'),
            'New Tab': this.getShortcutText('T'),
            'Close Tab': this.getShortcutText('W'),
            'Rename Tab': this.getShortcutText('R'),
            'Previous Tab': this.getShortcutText('←'),
            'Next Tab': this.getShortcutText('→'),
            'Go to Tab 1-9': this.getShortcutText('1-9')
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyboardShortcuts;
}