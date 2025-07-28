/**
 * Performance Monitor
 * Tracks application performance, memory usage, and provides debugging information
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.timers = new Map();
        this.isEnabled = false;
        this.maxMetrics = 1000; // Prevent memory leaks
        this.logLevel = 'info'; // 'debug', 'info', 'warn', 'error'
    }

    /**
     * Initialize performance monitoring
     * @param {Object} options - Configuration options
     */
    initialize(options = {}) {
        this.isEnabled = options.enabled !== false;
        this.logLevel = options.logLevel || 'info';
        this.maxMetrics = options.maxMetrics || 1000;

        if (this.isEnabled) {
            this.startMemoryMonitoring();
            this.log('info', '?? Performance monitoring initialized');
        }
    }

    /**
     * Start timing an operation
     * @param {string} name - Operation name
     * @param {Object} metadata - Additional metadata
     */
    startTimer(name, metadata = {}) {
        if (!this.isEnabled) return;

        const startTime = performance.now();
        this.timers.set(name, {
            startTime,
            metadata,
            timestamp: new Date().toISOString()
        });

        this.log('debug', `?? Started timer: ${name}`, metadata);
    }

    /**
     * End timing an operation and record the metric
     * @param {string} name - Operation name
     * @param {Object} additionalData - Additional data to record
     */
    endTimer(name, additionalData = {}) {
        if (!this.isEnabled) return;

        const timer = this.timers.get(name);
        if (!timer) {
            this.log('warn', `?? Timer '${name}' not found`);
            return;
        }

        const endTime = performance.now();
        const duration = endTime - timer.startTime;
        
        this.recordMetric('timing', name, {
            duration,
            startTime: timer.startTime,
            endTime,
            ...timer.metadata,
            ...additionalData
        });

        this.timers.delete(name);
        
        this.log('debug', `?? Completed timer: ${name} (${duration.toFixed(2)}ms)`);
        
        return duration;
    }

    /**
     * Record a custom metric
     * @param {string} type - Metric type
     * @param {string} name - Metric name
     * @param {*} value - Metric value
     */
    recordMetric(type, name, value) {
        if (!this.isEnabled) return;

        // Prevent memory leaks
        if (this.metrics.size >= this.maxMetrics) {
            this.cleanup();
        }

        const metric = {
            type,
            name,
            value,
            timestamp: Date.now(),
            memoryUsage: this.getCurrentMemoryUsage()
        };

        this.metrics.set(`${type}_${name}_${Date.now()}`, metric);
        
        // Log significant metrics
        if (type === 'error' || (type === 'timing' && value.duration > 100)) {
            this.log('info', `?? Metric recorded: ${type}/${name}`, value);
        }
    }

    /**
     * Record user interaction
     * @param {string} action - User action
     * @param {Object} details - Action details
     */
    recordUserAction(action, details = {}) {
        this.recordMetric('user_action', action, {
            ...details,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Record error with context
     * @param {Error} error - Error object
     * @param {string} context - Error context
     * @param {Object} additionalData - Additional error data
     */
    recordError(error, context, additionalData = {}) {
        const errorData = {
            message: error.message,
            stack: error.stack,
            context,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            ...additionalData
        };

        this.recordMetric('error', context, errorData);
        this.log('error', `? Error in ${context}: ${error.message}`, errorData);
    }

    /**
     * Get current memory usage (if available)
     * @returns {Object} Memory usage information
     */
    getCurrentMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }

    /**
     * Start periodic memory monitoring
     */
    startMemoryMonitoring() {
        if (!performance.memory) return;

        setInterval(() => {
            const memory = this.getCurrentMemoryUsage();
            this.recordMetric('memory', 'usage', memory);

            // Warn if memory usage is high
            if (memory.used > memory.limit * 0.8) {
                this.log('warn', '?? High memory usage detected', memory);
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Cleanup old metrics to prevent memory leaks
     */
    cleanup() {
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        const keysToDelete = [];

        for (const [key, metric] of this.metrics) {
            if (metric.timestamp < cutoffTime) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.metrics.delete(key));
        
        if (keysToDelete.length > 0) {
            this.log('info', `?? Cleaned up ${keysToDelete.length} old metrics`);
        }
    }

    /**
     * Get performance report
     * @param {string} type - Metric type filter
     * @returns {Object} Performance report
     */
    getReport(type = null) {
        if (!this.isEnabled) return { enabled: false };

        const report = {
            enabled: true,
            generatedAt: new Date().toISOString(),
            totalMetrics: this.metrics.size,
            activeTimers: this.timers.size,
            currentMemory: this.getCurrentMemoryUsage(),
            metrics: {}
        };

        // Group metrics by type
        for (const [key, metric] of this.metrics) {
            if (type && metric.type !== type) continue;

            if (!report.metrics[metric.type]) {
                report.metrics[metric.type] = [];
            }
            report.metrics[metric.type].push(metric);
        }

        // Calculate statistics for timing metrics
        if (report.metrics.timing) {
            report.timingStats = this.calculateTimingStats(report.metrics.timing);
        }

        return report;
    }

    /**
     * Calculate timing statistics
     * @param {Array} timingMetrics - Array of timing metrics
     * @returns {Object} Timing statistics
     */
    calculateTimingStats(timingMetrics) {
        const durations = timingMetrics.map(m => m.value.duration).sort((a, b) => a - b);
        
        return {
            count: durations.length,
            min: durations[0],
            max: durations[durations.length - 1],
            average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            median: durations[Math.floor(durations.length / 2)],
            p95: durations[Math.floor(durations.length * 0.95)]
        };
    }

    /**
     * Log message with appropriate level
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {*} data - Additional data
     */
    log(level, message, data = null) {
        if (!this.isEnabled) return;

        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        const currentLevel = levels[this.logLevel] || 1;
        const messageLevel = levels[level] || 1;

        if (messageLevel < currentLevel) return;

        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;

        switch (level) {
            case 'debug':
                console.debug(logMessage, data);
                break;
            case 'info':
                console.info(logMessage, data);
                break;
            case 'warn':
                console.warn(logMessage, data);
                break;
            case 'error':
                console.error(logMessage, data);
                break;
            default:
                console.log(logMessage, data);
        }
    }

    /**
     * Enable or disable monitoring
     * @param {boolean} enabled - Enable status
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.log('info', `?? Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set log level
     * @param {string} level - Log level
     */
    setLogLevel(level) {
        this.logLevel = level;
        this.log('info', `?? Log level set to: ${level}`);
    }

    /**
     * Create a performance-aware wrapper for async functions
     * @param {string} name - Operation name
     * @param {Function} fn - Function to wrap
     * @returns {Function} Wrapped function
     */
    wrapAsync(name, fn) {
        if (!this.isEnabled) return fn;

        return async (...args) => {
            this.startTimer(name);
            try {
                const result = await fn(...args);
                this.endTimer(name, { success: true });
                return result;
            } catch (error) {
                this.endTimer(name, { success: false, error: error.message });
                this.recordError(error, name);
                throw error;
            }
        };
    }

    /**
     * Export metrics as JSON
     * @returns {string} JSON string of metrics
     */
    exportMetrics() {
        return JSON.stringify(this.getReport(), null, 2);
    }

    /**
     * Clear all metrics and timers
     */
    clear() {
        this.metrics.clear();
        this.timers.clear();
        this.log('info', '?? All metrics and timers cleared');
    }
}

// Create global instance
window.PerformanceMonitor = PerformanceMonitor;
window.performanceMonitor = new PerformanceMonitor();