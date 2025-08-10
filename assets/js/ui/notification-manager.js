/**
 * Notification Manager
 * Handles all notification display and management functionality
 * Standalone utility class for showing toast notifications
 */
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.notificationCounter = 0;
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
     */
    calculateNotificationPosition() {
        let topPosition = 20;
        
        this.notifications.forEach(notification => {
            if (notification.parentNode) {
                topPosition += notification.offsetHeight + 12;
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
     */
    removeNotificationFromTracking(notification) {
        const index = this.notifications.indexOf(notification);
        if (index > -1) {
            this.notifications.splice(index, 1);
            this.updateNotificationPositions();
        }
    }

    /**
     * Show notification to user
     * @param {string} message - Notification message
     * @param {string} type - Notification type ('success', 'error', 'info', 'warning')
     * @param {Object} options - Optional configuration
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
     */
    getDefaultDuration(type) {
        const durations = {
            error: 6000,
            warning: 5000,
            success: 4000,
            info: 3500
        };
        return durations[type] || durations.info;
    }

    /**
     * Apply styles to notification element
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
            transform: 'translateX(100%)',
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
        const notificationsToRemove = [...this.notifications];
        notificationsToRemove.forEach(notification => {
            this.dismiss(notification);
        });
    }

    /**
     * Update notification styles on window resize
     */
    updateNotificationStyles() {
        const isMobile = window.innerWidth <= 768;
        
        this.notifications.forEach(notification => {
            if (notification.parentNode) {
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
     */
    getActiveCount() {
        return this.notifications.filter(n => n.parentNode).length;
    }

    /**
     * Check if there are any active notifications
     */
    hasActiveNotifications() {
        return this.getActiveCount() > 0;
    }
}

// Export singleton instance
const notificationManager = new NotificationManager();