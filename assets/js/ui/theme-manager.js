/**
 * Theme Manager - Handles theme switching and persistence
 * Supports both light and dark themes with system preference detection
 */
class ThemeManager {
    constructor() {
        this.themeToggle = null;
        this.themeIcon = null;
        this.themeColorMeta = null;
        
        this.initialize();
    }

    /**
     * Initialize theme manager
     */
    initialize() {
        this.initializeElements();
        this.bindEvents();
        this.loadTheme();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.themeToggle = document.getElementById('theme-toggle');
        this.themeIcon = document.getElementById('theme-icon');
        this.themeColorMeta = document.getElementById('theme-color-meta');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
        this.updateTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    }

    /**
     * Update theme and related UI elements
     * @param {string} theme - Theme name ('light' or 'dark')
     */
    updateTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        if (this.themeIcon) {
            this.themeIcon.src = theme === 'dark' ? 'assets/icons/light-mode.svg' : 'assets/icons/dark-mode.svg';
        }
        
        if (this.themeColorMeta) {
            this.themeColorMeta.content = theme === 'dark' ? '#1e1e1e' : '#ffffff';
        }
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
        
        this.updateTheme(savedTheme);
        
        // Listen for system theme changes only if no theme is manually saved
        if (!localStorage.getItem('theme') && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                if (!localStorage.getItem('theme')) {
                    this.updateTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    /**
     * Get current theme
     * @returns {string} Current theme ('light' or 'dark')
     */
    getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }

    /**
     * Set theme programmatically
     * @param {string} theme - Theme to set ('light' or 'dark')
     * @param {boolean} persist - Whether to save to localStorage
     */
    setTheme(theme, persist = true) {
        this.updateTheme(theme);
        if (persist) {
            localStorage.setItem('theme', theme);
        }
    }
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}