/**
 * Notification Manager
 * Handles all notification display and management functionality
 * Standalone utility class for showing toast notifications
 */
class NotificationManager {
    constructor() {
        this.notifications = []; // Track active notifications
        this.notificationCounter = 0; // Unique ID counter for notifications
        this.init();
    }

    /**
     * Initialize notification manager
     */
    init() {
        // Handle window resize for notification positioning
        window.addEventListener('resize', () => {
            this.updateNotificationStyles();
        });
    }

    /**
     * Calculate notification position based on existing notifications
     * @returns {number} Top position in pixels
     */
    calculateNotificationPosition() {
        let topPosition = 20; // Base position from top
        
        // Add space for each existing notification
        this.notifications.forEach(notification => {
            if (notification.parentNode) {
                topPosition += notification.offsetHeight + 12; // 12px gap between notifications
            }
        });
        
        return topPosition;
    }

    /**
     * Update positions of all existing notifications
     */
    updateNotificationPositions() {
        let currentTop = 20;
        
        this.notifications.forEach(notification => {
            if (notification.parentNode) {
                notification.style.top = `calc(${currentTop}px + var(--safe-area-inset-top))`;
                currentTop += notification.offsetHeight + 12;
            }
        });
    }

    /**
     * Remove notification from tracking array
     * @param {HTMLElement} notification - Notification element to remove
     */
    removeNotificationFromTracking(notification) {
        const index = this.notifications.indexOf(notification);
        if (index > -1) {
            this.notifications.splice(index, 1);
            // Update positions of remaining notifications
            this.updateNotificationPositions();
        }
    }

    /**
     * Show notification to user
     * @param {string} message - Notification message
     * @param {string} type - Notification type ('success', 'error', 'info', 'warning')
     * @param {Object} options - Optional configuration
     * @param {number} options.duration - Custom duration in milliseconds
     * @param {boolean} options.clickToDismiss - Whether clicking dismisses notification (default: true)
     * @param {boolean} options.autoHide - Whether to auto-hide notification (default: true)
     * @returns {HTMLElement} The notification element
     */
    show(message, type = 'info', options = {}) {
        const {
            duration = this.getDefaultDuration(type),
            clickToDismiss = true,
            autoHide = true
        } = options;

        const notification = document.createElement('div');
        const notificationId = ++this.notificationCounter;
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.dataset.notificationId = notificationId;
        
        // Calculate position for this notification
        const topPosition = this.calculateNotificationPosition();
        
        // Set notification styles
        this.applyNotificationStyles(notification, type, topPosition);

        // Add to tracking array
        this.notifications.push(notification);
        document.body.appendChild(notification);

        // Add click to dismiss if enabled
        if (clickToDismiss) {
            notification.addEventListener('click', () => {
                this.dismiss(notification);
            });
        }

        // Add entrance animation
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 10);

        // Auto-dismiss notification if enabled
        if (autoHide) {
            setTimeout(() => {
                this.dismiss(notification);
            }, duration);
        }

        return notification;
    }

    /**
     * Get default duration based on notification type
     * @param {string} type - Notification type
     * @returns {number} Duration in milliseconds
     */
    getDefaultDuration(type) {
        switch (type) {
            case 'error':
                return 6000; // Errors stay longer
            case 'warning':
                return 5000; // Warnings stay a bit longer
            case 'success':
                return 4000; // Success messages
            case 'info':
            default:
                return 3500; // Info messages
        }
    }

    /**
     * Apply styles to notification element
     * @param {HTMLElement} notification - Notification element
     * @param {string} type - Notification type
     * @param {number} topPosition - Top position in pixels
     */
    applyNotificationStyles(notification, type, topPosition) {
        // Determine background color based on type
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };

        const isMobile = window.innerWidth <= 768;

        Object.assign(notification.style, {
            position: 'fixed',
            top: `calc(${topPosition}px + var(--safe-area-inset-top))`,
            right: isMobile ? `calc(10px + var(--safe-area-inset-right))` : `calc(20px + var(--safe-area-inset-right))`,
            left: isMobile ? `calc(10px + var(--safe-area-inset-left))` : 'auto',
            padding: '12px 18px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            fontSize: '14px',
            zIndex: '10001',
            maxWidth: isMobile ? 'calc(100vw - 20px - var(--safe-area-inset-left) - var(--safe-area-inset-right))' : '320px',
            backgroundColor: colors[type] || colors.info,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transform: 'translateX(100%)', // Start off-screen
            opacity: '0',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'pointer',
            userSelect: 'none',
            wordWrap: 'break-word',
            lineHeight: '1.4'
        });
    }

    /**
     * Dismiss a specific notification with animation
     * @param {HTMLElement} notification - Notification element to dismiss
     */
    dismiss(notification) {
        if (!notification || !notification.parentNode) return;
        
        // Exit animation
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
                this.removeNotificationFromTracking(notification);
            }
        }, 300);
    }

    /**
     * Dismiss all notifications
     */
    dismissAll() {
        // Create a copy of the array to avoid issues during iteration
        const notificationsToRemove = [...this.notifications];
        notificationsToRemove.forEach(notification => {
            this.dismiss(notification);
        });
    }

    /**
     * Update notification styles on window resize (for mobile responsiveness)
     */
    updateNotificationStyles() {
        this.notifications.forEach(notification => {
            if (notification.parentNode) {
                const isMobile = window.innerWidth <= 768;
                
                Object.assign(notification.style, {
                    left: isMobile ? `calc(10px + var(--safe-area-inset-left))` : 'auto',
                    right: isMobile ? `calc(10px + var(--safe-area-inset-right))` : `calc(20px + var(--safe-area-inset-right))`,
                    maxWidth: isMobile ? 'calc(100vw - 20px - var(--safe-area-inset-left) - var(--safe-area-inset-right))' : '320px'
                });
            }
        });
    }

    /**
     * Convenience methods for different notification types
     */
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }

    error(message, options = {}) {
        return this.show(message, 'error', options);
    }

    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }

    info(message, options = {}) {
        return this.show(message, 'info', options);
    }

    /**
     * Get the number of active notifications
     * @returns {number} Number of active notifications
     */
    getActiveCount() {
        return this.notifications.filter(n => n.parentNode).length;
    }

    /**
     * Check if there are any active notifications
     * @returns {boolean} True if there are active notifications
     */
    hasActiveNotifications() {
        return this.getActiveCount() > 0;
    }
}

// Export singleton instance
const notificationManager = new NotificationManager();