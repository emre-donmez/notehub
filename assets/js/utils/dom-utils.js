/**
 * DOM Utilities
 * Common DOM manipulation and query functions
 */
class DOMUtils {
    /**
     * Get element by ID with null check
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    static getElementById(id) {
        return document.getElementById(id);
    }

    /**
     * Get elements by selector with null check
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    static querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }

    /**
     * Get single element by selector
     * @param {string} selector - CSS selector
     * @returns {HTMLElement|null}
     */
    static querySelector(selector) {
        return document.querySelector(selector);
    }

    /**
     * Create element with optional attributes and content
     * @param {string} tag - HTML tag name
     * @param {Object} attributes - Element attributes
     * @param {string} content - Inner content
     * @returns {HTMLElement}
     */
    static createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else {
                element.setAttribute(key, value);
            }
        });

        if (content) {
            element.innerHTML = content;
        }

        return element;
    }

    /**
     * Remove element safely
     * @param {HTMLElement|string} element - Element or selector
     */
    static removeElement(element) {
        const el = typeof element === 'string' ? this.querySelector(element) : element;
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }

    /**
     * Clear all children from element
     * @param {HTMLElement|string} element - Element or selector
     */
    static clearElement(element) {
        const el = typeof element === 'string' ? this.querySelector(element) : element;
        if (el) {
            el.innerHTML = '';
        }
    }

    /**
     * Add event listener with automatic cleanup
     * @param {HTMLElement} element - Target element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    static addEventListenerWithCleanup(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        
        // Return cleanup function
        return () => {
            element.removeEventListener(event, handler, options);
        };
    }

    /**
     * Toggle class on element
     * @param {HTMLElement|string} element - Element or selector
     * @param {string} className - Class name to toggle
     * @param {boolean} force - Force add/remove
     */
    static toggleClass(element, className, force) {
        const el = typeof element === 'string' ? this.querySelector(element) : element;
        if (el) {
            el.classList.toggle(className, force);
        }
    }

    /**
     * Check if element has class
     * @param {HTMLElement|string} element - Element or selector
     * @param {string} className - Class name to check
     * @returns {boolean}
     */
    static hasClass(element, className) {
        const el = typeof element === 'string' ? this.querySelector(element) : element;
        return el ? el.classList.contains(className) : false;
    }

    /**
     * Get element position relative to page
     * @param {HTMLElement} element - Target element
     * @returns {Object} Position object with x, y coordinates
     */
    static getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + window.pageXOffset,
            y: rect.top + window.pageYOffset,
            width: rect.width,
            height: rect.height
        };
    }

    /**
     * Scroll element into view smoothly
     * @param {HTMLElement|string} element - Element or selector
     * @param {Object} options - Scroll options
     */
    static scrollIntoView(element, options = { behavior: 'smooth' }) {
        const el = typeof element === 'string' ? this.querySelector(element) : element;
        if (el && el.scrollIntoView) {
            el.scrollIntoView(options);
        }
    }

    /**
     * Focus element with optional delay
     * @param {HTMLElement|string} element - Element or selector
     * @param {number} delay - Delay in milliseconds
     */
    static focusElement(element, delay = 0) {
        const el = typeof element === 'string' ? this.querySelector(element) : element;
        if (el) {
            if (delay > 0) {
                setTimeout(() => el.focus(), delay);
            } else {
                el.focus();
            }
        }
    }
}

// Export for global use
window.DOMUtils = DOMUtils;