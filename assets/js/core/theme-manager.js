/**
 * Theme Manager
 * Handles light/dark theme switching and persistence
 */
class ThemeManager {
    constructor() {
        this.currentTheme = null;
        this.themeToggleBtn = null;
        this.themeIcon = null;
        this.mediaQuery = null;
        this.systemChangeHandler = null;
    }

    /**
     * Initialize theme manager
     */
    initialize() {
        this.themeToggleBtn = DOMUtils.getElementById('theme-toggle');
        this.themeIcon = DOMUtils.getElementById('theme-icon');
        
        if (this.themeToggleBtn) {
            this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        }

        this.loadTheme();
        this.setupSystemThemeListener();
    }

    /**
     * Load theme from localStorage or detect system preference
     */
    loadTheme() {
        let savedTheme = localStorage.getItem('theme');
        
        // If no theme is saved, detect system preference
        if (!savedTheme) {
            const prefersDark = this.getSystemThemePreference();
            savedTheme = prefersDark ? 'dark' : 'light';
        }
        
        this.applyTheme(savedTheme);
    }

    /**
     * Get system theme preference
     * @returns {boolean} True if dark theme is preferred
     */
    getSystemThemePreference() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    /**
     * Apply theme to document and update UI
     * @param {string} theme - Theme name ('light' or 'dark')
     */
    applyTheme(theme) {
        if (!['light', 'dark'].includes(theme)) {
            console.warn('Invalid theme:', theme);
            return;
        }

        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        if (this.themeIcon) {
            const iconSrc = theme === 'dark' 
                ? 'assets/icons/light-mode.svg' 
                : 'assets/icons/dark-mode.svg';
            this.themeIcon.src = iconSrc;
        }

        // Dispatch custom event for other components
        this.dispatchThemeChangeEvent(theme);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Once user manually sets theme, stop listening to system changes
        this.removeSystemThemeListener();
    }

    /**
     * Setup system theme change listener
     */
    setupSystemThemeListener() {
        // Only listen if no manual theme is set
        if (localStorage.getItem('theme') || !window.matchMedia) {
            return;
        }

        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.systemChangeHandler = (e) => {
            // Only auto-update if user hasn't manually set a theme
            if (!localStorage.getItem('theme')) {
                const newTheme = e.matches ? 'dark' : 'light';
                this.applyTheme(newTheme);
            }
        };

        this.mediaQuery.addEventListener('change', this.systemChangeHandler);
    }

    /**
     * Remove system theme change listener
     */
    removeSystemThemeListener() {
        if (this.mediaQuery && this.systemChangeHandler) {
            this.mediaQuery.removeEventListener('change', this.systemChangeHandler);
            this.mediaQuery = null;
            this.systemChangeHandler = null;
        }
    }

    /**
     * Dispatch theme change event
     * @param {string} theme - New theme name
     */
    dispatchThemeChangeEvent(theme) {
        const event = new CustomEvent('themechange', {
            detail: { theme, previousTheme: this.currentTheme }
        });
        document.dispatchEvent(event);
    }

    /**
     * Get current theme
     * @returns {string} Current theme name
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Set theme programmatically
     * @param {string} theme - Theme to set
     * @param {boolean} persist - Whether to save to localStorage
     */
    setTheme(theme, persist = true) {
        this.applyTheme(theme);
        if (persist) {
            localStorage.setItem('theme', theme);
            this.removeSystemThemeListener();
        }
    }

    /**
     * Reset to system theme
     */
    resetToSystemTheme() {
        localStorage.removeItem('theme');
        const systemTheme = this.getSystemThemePreference() ? 'dark' : 'light';
        this.applyTheme(systemTheme);
        this.setupSystemThemeListener();
    }

    /**
     * Cleanup method
     */
    destroy() {
        this.removeSystemThemeListener();
        if (this.themeToggleBtn) {
            this.themeToggleBtn.removeEventListener('click', this.toggleTheme);
        }
    }
}

// Export for global use
window.ThemeManager = ThemeManager;