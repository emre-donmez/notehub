/**
 * Notification Manager
 * Centralized notification system for user feedback
 */
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.maxNotifications = 5;
        this.defaultDuration = 5000; // 5 seconds
    }

    /**
     * Initialize notification manager
     */
    initialize() {
        this.createNotificationContainer();
    }

    /**
     * Create notification container if it doesn't exist
     */
    createNotificationContainer() {
        if (this.container) return;

        this.container = DOMUtils.createElement('div', {
            className: 'notification-container',
            id: 'notification-container'
        });

        // Add styles if not already added
        this.addNotificationStyles();
        
        document.body.appendChild(this.container);
    }

    /**
     * Add notification styles
     */
    addNotificationStyles() {
        if (document.getElementById('notification-styles')) return;

        const styles = `
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            }

            .notification {
                background: var(--background-color, #fff);
                border: 1px solid var(--border-color, #ddd);
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 8px;
                min-width: 300px;
                max-width: 400px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                transform: translateX(100%);
                transition: all 0.3s ease;
                pointer-events: auto;
                position: relative;
            }

            .notification.show {
                transform: translateX(0);
            }

            .notification.success {
                border-left: 4px solid #10b981;
                background: var(--success-bg, #f0fdf4);
                color: var(--success-color, #059669);
            }

            .notification.error {
                border-left: 4px solid #ef4444;
                background: var(--error-bg, #fef2f2);
                color: var(--error-color, #dc2626);
            }

            .notification.warning {
                border-left: 4px solid #f59e0b;
                background: var(--warning-bg, #fffbeb);
                color: var(--warning-color, #d97706);
            }

            .notification.info {
                border-left: 4px solid #3b82f6;
                background: var(--info-bg, #eff6ff);
                color: var(--info-color, #2563eb);
            }

            .notification-content {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .notification-icon {
                font-size: 16px;
                flex-shrink: 0;
            }

            .notification-message {
                flex: 1;
                font-size: 14px;
                line-height: 1.4;
            }

            .notification-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                opacity: 0.6;
                margin-left: 8px;
                padding: 0;
                color: inherit;
            }

            .notification-close:hover {
                opacity: 1;
            }

            @media (max-width: 480px) {
                .notification-container {
                    left: 20px;
                    right: 20px;
                }
                
                .notification {
                    min-width: auto;
                    transform: translateY(-100%);
                }
                
                .notification.show {
                    transform: translateY(0);
                }
            }
        `;

        const styleSheet = DOMUtils.createElement('style', {
            id: 'notification-styles'
        }, styles);

        document.head.appendChild(styleSheet);
    }

    /**
     * Show a notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, warning, info)
     * @param {Object} options - Additional options
     */
    show(message, type = 'info', options = {}) {
        if (!this.container) {
            this.initialize();
        }

        const notification = this.createNotification(message, type, options);
        this.addNotification(notification);

        return notification;
    }

    /**
     * Show success notification
     * @param {string} message - Success message
     * @param {Object} options - Additional options
     */
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }

    /**
     * Show error notification
     * @param {string} message - Error message
     * @param {Object} options - Additional options
     */
    error(message, options = {}) {
        return this.show(message, 'error', { duration: 8000, ...options });
    }

    /**
     * Show warning notification
     * @param {string} message - Warning message
     * @param {Object} options - Additional options
     */
    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }

    /**
     * Show info notification
     * @param {string} message - Info message
     * @param {Object} options - Additional options
     */
    info(message, options = {}) {
        return this.show(message, 'info', options);
    }

    /**
     * Create notification element
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     * @param {Object} options - Additional options
     * @returns {HTMLElement} Notification element
     */
    createNotification(message, type, options) {
        const {
            duration = this.defaultDuration,
            closable = true,
            persistent = false
        } = options;

        const icons = {
            success: '?',
            error: '?',
            warning: '??',
            info: '??'
        };

        const notificationEl = DOMUtils.createElement('div', {
            className: `notification ${type}`,
            dataset: { type, timestamp: Date.now() }
        });

        const content = DOMUtils.createElement('div', {
            className: 'notification-content'
        });

        const icon = DOMUtils.createElement('span', {
            className: 'notification-icon'
        }, icons[type] || icons.info);

        const messageEl = DOMUtils.createElement('div', {
            className: 'notification-message'
        }, message);

        content.appendChild(icon);
        content.appendChild(messageEl);

        if (closable) {
            const closeBtn = DOMUtils.createElement('button', {
                className: 'notification-close',
                title: 'Close notification'
            }, '×');

            closeBtn.addEventListener('click', () => {
                this.removeNotification(notificationEl);
            });

            content.appendChild(closeBtn);
        }

        notificationEl.appendChild(content);

        // Auto-remove after duration (unless persistent)
        if (!persistent && duration > 0) {
            setTimeout(() => {
                this.removeNotification(notificationEl);
            }, duration);
        }

        return notificationEl;
    }

    /**
     * Add notification to container
     * @param {HTMLElement} notification - Notification element
     */
    addNotification(notification) {
        // Remove oldest notification if we're at max capacity
        while (this.notifications.length >= this.maxNotifications) {
            const oldest = this.notifications.shift();
            this.removeNotification(oldest, false);
        }

        this.container.appendChild(notification);
        this.notifications.push(notification);

        // Trigger animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
    }

    /**
     * Remove notification
     * @param {HTMLElement} notification - Notification element
     * @param {boolean} updateArray - Whether to update notifications array
     */
    removeNotification(notification, updateArray = true) {
        if (!notification || !notification.parentNode) return;

        notification.style.transform = window.innerWidth <= 480 
            ? 'translateY(-100%)' 
            : 'translateX(100%)';
        
        notification.style.opacity = '0';

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }

            if (updateArray) {
                const index = this.notifications.indexOf(notification);
                if (index > -1) {
                    this.notifications.splice(index, 1);
                }
            }
        }, 300);
    }

    /**
     * Clear all notifications
     */
    clearAll() {
        this.notifications.forEach(notification => {
            this.removeNotification(notification, false);
        });
        this.notifications = [];
    }

    /**
     * Get notification count by type
     * @param {string} type - Notification type
     * @returns {number} Count of notifications
     */
    getCount(type = null) {
        if (!type) return this.notifications.length;
        
        return this.notifications.filter(n => 
            n.dataset.type === type
        ).length;
    }

    /**
     * Set maximum number of notifications
     * @param {number} max - Maximum notifications
     */
    setMaxNotifications(max) {
        this.maxNotifications = Math.max(1, max);
    }

    /**
     * Set default duration for notifications
     * @param {number} duration - Duration in milliseconds
     */
    setDefaultDuration(duration) {
        this.defaultDuration = Math.max(1000, duration);
    }
}

// Create global instance
window.NotificationManager = NotificationManager;
window.notificationManager = new NotificationManager();