/**
 * Event Manager
 * Centralized event handling with automatic cleanup and delegation
 */
class EventManager {
    constructor() {
        this.listeners = new Map();
        this.delegatedEvents = new Map();
        this.listenerCounter = 0;
    }

    /**
     * Add event listener with automatic cleanup tracking
     * @param {HTMLElement|string} element - Element or selector
     * @param {string} eventType - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     * @returns {string} Listener ID for removal
     */
    addEventListener(element, eventType, handler, options = {}) {
        const el = typeof element === 'string' ? DOMUtils.querySelector(element) : element;
        if (!el) {
            performanceMonitor.log('warn', `?? Element not found for event listener: ${element}`);
            return null;
        }

        const listenerId = `listener_${++this.listenerCounter}`;
        
        // Wrap handler for performance monitoring
        const wrappedHandler = this.wrapHandler(handler, `${eventType}_${listenerId}`);
        
        el.addEventListener(eventType, wrappedHandler, options);

        // Store for cleanup
        this.listeners.set(listenerId, {
            element: el,
            eventType,
            handler: wrappedHandler,
            originalHandler: handler,
            options,
            timestamp: Date.now()
        });

        performanceMonitor.log('debug', `?? Added event listener: ${eventType} on`, el);
        return listenerId;
    }

    /**
     * Remove event listener by ID
     * @param {string} listenerId - Listener ID to remove
     * @returns {boolean} Success status
     */
    removeEventListener(listenerId) {
        const listener = this.listeners.get(listenerId);
        if (!listener) {
            performanceMonitor.log('warn', `?? Listener not found: ${listenerId}`);
            return false;
        }

        listener.element.removeEventListener(
            listener.eventType, 
            listener.handler, 
            listener.options
        );

        this.listeners.delete(listenerId);
        performanceMonitor.log('debug', `??? Removed event listener: ${listenerId}`);
        return true;
    }

    /**
     * Add delegated event listener (for dynamic elements)
     * @param {HTMLElement|string} container - Container element
     * @param {string} selector - Target selector
     * @param {string} eventType - Event type
     * @param {Function} handler - Event handler
     * @returns {string} Delegation ID
     */
    addDelegatedListener(container, selector, eventType, handler) {
        const containerEl = typeof container === 'string' ? DOMUtils.querySelector(container) : container;
        if (!containerEl) {
            performanceMonitor.log('warn', `?? Container not found for delegated listener: ${container}`);
            return null;
        }

        const delegationId = `delegation_${++this.listenerCounter}`;
        
        const delegatedHandler = (event) => {
            const target = event.target.closest(selector);
            if (target && containerEl.contains(target)) {
                performanceMonitor.startTimer(`delegated_${eventType}`);
                try {
                    handler.call(target, event);
                } catch (error) {
                    performanceMonitor.recordError(error, `delegated_${eventType}`);
                } finally {
                    performanceMonitor.endTimer(`delegated_${eventType}`);
                }
            }
        };

        containerEl.addEventListener(eventType, delegatedHandler);

        this.delegatedEvents.set(delegationId, {
            container: containerEl,
            selector,
            eventType,
            handler: delegatedHandler,
            originalHandler: handler,
            timestamp: Date.now()
        });

        performanceMonitor.log('debug', `?? Added delegated listener: ${eventType} for ${selector} in`, containerEl);
        return delegationId;
    }

    /**
     * Remove delegated event listener
     * @param {string} delegationId - Delegation ID to remove
     * @returns {boolean} Success status
     */
    removeDelegatedListener(delegationId) {
        const delegation = this.delegatedEvents.get(delegationId);
        if (!delegation) {
            performanceMonitor.log('warn', `?? Delegation not found: ${delegationId}`);
            return false;
        }

        delegation.container.removeEventListener(delegation.eventType, delegation.handler);
        this.delegatedEvents.delete(delegationId);
        
        performanceMonitor.log('debug', `??? Removed delegated listener: ${delegationId}`);
        return true;
    }

    /**
     * Add multiple event listeners to the same element
     * @param {HTMLElement|string} element - Element or selector
     * @param {Object} events - Object with eventType: handler pairs
     * @param {Object} options - Shared options
     * @returns {Array} Array of listener IDs
     */
    addMultipleListeners(element, events, options = {}) {
        const listenerIds = [];
        
        Object.entries(events).forEach(([eventType, handler]) => {
            const id = this.addEventListener(element, eventType, handler, options);
            if (id) listenerIds.push(id);
        });

        return listenerIds;
    }

    /**
     * Remove multiple event listeners
     * @param {Array} listenerIds - Array of listener IDs to remove
     * @returns {number} Number of successfully removed listeners
     */
    removeMultipleListeners(listenerIds) {
        let removedCount = 0;
        
        listenerIds.forEach(id => {
            if (this.removeEventListener(id)) {
                removedCount++;
            }
        });

        return removedCount;
    }

    /**
     * Wrap handler for performance monitoring and error handling
     * @param {Function} handler - Original handler
     * @param {string} name - Handler name for monitoring
     * @returns {Function} Wrapped handler
     */
    wrapHandler(handler, name) {
        return (event) => {
            performanceMonitor.startTimer(`event_${name}`);
            try {
                return handler(event);
            } catch (error) {
                performanceMonitor.recordError(error, `event_${name}`, {
                    eventType: event.type,
                    target: event.target?.tagName
                });
                
                // Don't throw - prevent event handler errors from breaking the app
                notificationManager.error('An error occurred while handling user interaction');
            } finally {
                performanceMonitor.endTimer(`event_${name}`);
            }
        };
    }

    /**
     * Add once event listener (auto-removes after first trigger)
     * @param {HTMLElement|string} element - Element or selector
     * @param {string} eventType - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     * @returns {string} Listener ID
     */
    addOnceListener(element, eventType, handler, options = {}) {
        const onceHandler = (event) => {
            handler(event);
            this.removeEventListener(listenerId);
        };

        const listenerId = this.addEventListener(element, eventType, onceHandler, {
            ...options,
            once: true
        });

        return listenerId;
    }

    /**
     * Add throttled event listener
     * @param {HTMLElement|string} element - Element or selector
     * @param {string} eventType - Event type
     * @param {Function} handler - Event handler
     * @param {number} delay - Throttle delay in ms
     * @param {Object} options - Event options
     * @returns {string} Listener ID
     */
    addThrottledListener(element, eventType, handler, delay = 100, options = {}) {
        let isThrottled = false;
        
        const throttledHandler = (event) => {
            if (isThrottled) return;
            
            isThrottled = true;
            handler(event);
            
            setTimeout(() => {
                isThrottled = false;
            }, delay);
        };

        return this.addEventListener(element, eventType, throttledHandler, options);
    }

    /**
     * Add debounced event listener
     * @param {HTMLElement|string} element - Element or selector
     * @param {string} eventType - Event type
     * @param {Function} handler - Event handler
     * @param {number} delay - Debounce delay in ms
     * @param {Object} options - Event options
     * @returns {string} Listener ID
     */
    addDebouncedListener(element, eventType, handler, delay = 300, options = {}) {
        let timeoutId;
        
        const debouncedHandler = (event) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => handler(event), delay);
        };

        return this.addEventListener(element, eventType, debouncedHandler, options);
    }

    /**
     * Get statistics about event listeners
     * @returns {Object} Statistics object
     */
    getStatistics() {
        return {
            totalListeners: this.listeners.size,
            totalDelegations: this.delegatedEvents.size,
            oldestListener: this.getOldestTimestamp(this.listeners),
            oldestDelegation: this.getOldestTimestamp(this.delegatedEvents),
            memoryUsage: (this.listeners.size + this.delegatedEvents.size) * 0.001 // Rough estimate in KB
        };
    }

    /**
     * Get oldest timestamp from a collection
     * @param {Map} collection - Collection to check
     * @returns {number|null} Oldest timestamp
     */
    getOldestTimestamp(collection) {
        let oldest = null;
        for (const item of collection.values()) {
            if (!oldest || item.timestamp < oldest) {
                oldest = item.timestamp;
            }
        }
        return oldest;
    }

    /**
     * Clean up old or orphaned listeners
     * @param {number} maxAge - Maximum age in milliseconds
     */
    cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        const cutoff = Date.now() - maxAge;
        let cleanedUp = 0;

        // Clean up regular listeners
        for (const [id, listener] of this.listeners) {
            if (listener.timestamp < cutoff || !document.contains(listener.element)) {
                this.removeEventListener(id);
                cleanedUp++;
            }
        }

        // Clean up delegated listeners
        for (const [id, delegation] of this.delegatedEvents) {
            if (delegation.timestamp < cutoff || !document.contains(delegation.container)) {
                this.removeDelegatedListener(id);
                cleanedUp++;
            }
        }

        if (cleanedUp > 0) {
            performanceMonitor.log('info', `?? Cleaned up ${cleanedUp} old event listeners`);
        }
    }

    /**
     * Remove all event listeners
     */
    removeAll() {
        const totalListeners = this.listeners.size;
        const totalDelegations = this.delegatedEvents.size;

        // Remove all regular listeners
        for (const id of this.listeners.keys()) {
            this.removeEventListener(id);
        }

        // Remove all delegated listeners
        for (const id of this.delegatedEvents.keys()) {
            this.removeDelegatedListener(id);
        }

        performanceMonitor.log('info', `?? Removed all event listeners: ${totalListeners} regular, ${totalDelegations} delegated`);
    }

    /**
     * Create a scoped event manager for components
     * @param {string} scope - Scope name
     * @returns {Object} Scoped event manager
     */
    createScope(scope) {
        const scopedListeners = [];

        return {
            addEventListener: (element, eventType, handler, options) => {
                const id = this.addEventListener(element, eventType, handler, options);
                if (id) scopedListeners.push(id);
                return id;
            },
            
            addDelegatedListener: (container, selector, eventType, handler) => {
                const id = this.addDelegatedListener(container, selector, eventType, handler);
                if (id) scopedListeners.push(id);
                return id;
            },

            cleanup: () => {
                const removed = this.removeMultipleListeners(scopedListeners);
                scopedListeners.length = 0;
                performanceMonitor.log('info', `?? Cleaned up ${removed} listeners in scope: ${scope}`);
                return removed;
            },

            getListenerCount: () => scopedListeners.length
        };
    }
}

// Create global instance
window.EventManager = EventManager;
window.eventManager = new EventManager();