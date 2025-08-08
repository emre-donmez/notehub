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
        const helpBtn = document.getElementById('help-btn');
        const modal = document.getElementById('help-modal');
        const closeBtn = document.getElementById('help-modal-close');

        // Help button click event
        if (helpBtn) {
            helpBtn.addEventListener('click', () => this.openHelpModal());
        }

        // Close events
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeHelpModal());
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeHelpModal();
                }
            });
        }

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
        const renameShortcut = document.getElementById('rename-shortcut');
        const searchShortcut = document.getElementById('search-shortcut');
        
        if (renameShortcut) {
            renameShortcut.textContent = this.keyboardShortcuts.getShortcutText('R');
        }
        
        if (searchShortcut) {
            searchShortcut.textContent = this.keyboardShortcuts.getShortcutText('Q');
        }
    }

    /**
     * Open help modal
     */
    openHelpModal() {
        const modal = document.getElementById('help-modal');
        if (modal) {
            this.populateShortcuts();
            modal.style.display = 'flex';
        }
    }

    /**
     * Close help modal
     */
    closeHelpModal() {
        const modal = document.getElementById('help-modal');
        if (modal) {
            modal.style.display = 'none';
        }
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