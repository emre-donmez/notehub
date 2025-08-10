/**
 * Help System for NoteHub
 * Provides application information and keyboard shortcuts
 */
class HelpSystem {
    constructor(keyboardShortcuts) {
        this.keyboardShortcuts = keyboardShortcuts;
        this.init();
    }

    /**
     * Initialize help system
     */
    init() {
        this.bindEvents();
        this.updateShortcutTexts();
    }

    /**
     * Bind help modal and button events
     */
    bindEvents() {   
        document.getElementById('help-btn').addEventListener('click', () => this.openHelpModal());
        document.getElementById('help-modal-close').addEventListener('click', () => this.closeHelpModal());
        document.getElementById('help-modal').addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeHelpModal();
            }
        });
      // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
                this.closeHelpModal();
            }
        });
    }

    /**
     * Update shortcut texts for current platform
     */
    updateShortcutTexts() {
        document.getElementById('rename-shortcut').textContent = this.keyboardShortcuts.getShortcutText('R');
        document.getElementById('search-shortcut').textContent = this.keyboardShortcuts.getShortcutText('Q');
    }

    /**
     * Open help modal
     */
    openHelpModal() {       
        this.populateShortcuts();
        document.getElementById('help-modal').style.display = 'flex';      
    }

    /**
     * Close help modal
     */
    closeHelpModal() {
        document.getElementById('help-modal').style.display = 'none';
    }

    /**
     * Populate keyboard shortcuts in the modal
     */
    populateShortcuts() {
        const shortcutsGrid = document.getElementById('shortcuts-grid');
        if (!shortcutsGrid) return;
        
        const shortcuts = this.keyboardShortcuts.getShortcuts();
        
        shortcutsGrid.innerHTML = '';
        Object.entries(shortcuts).forEach(([action, shortcut]) => {
            const shortcutItem = document.createElement('div');
            shortcutItem.className = 'shortcut-item';
            shortcutItem.innerHTML = `
                <span class="shortcut-action">${action}</span>
                <kbd class="shortcut-key">${shortcut}</kbd>
            `;
            shortcutsGrid.appendChild(shortcutItem);
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HelpSystem;
}