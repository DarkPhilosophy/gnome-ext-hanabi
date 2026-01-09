/**
 * Performance monitoring and optimization utilities for Hanabi extension
 * Copyright (C) 2024 Optimized by Mistral AI
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import GLib from 'gi://GLib';

/**
 * Performance monitor and optimizer
 */
export class PerformanceMonitor {
    constructor() {
        this.frameTimes = [];
        this.maxFrameHistory = 60;
        this.targetFPS = 60;
        this.targetFrameTime = 1000 / this.targetFPS;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        this.lastFpsUpdate = 0;
        this.performanceWarnings = 0;
        this.cpuUsage = 0;

        // Start performance monitoring
        this._setupMonitoring();
    }

    _setupMonitoring() {
        // Monitor performance every 2 seconds (reduced from 1s for less overhead)
        this._monitorId = GLib.timeout_add(GLib.PRIORITY_LOW, 2000, () => {
            this._updatePerformanceMetrics();
            return true; // Continue monitoring
        });
    }

    _updatePerformanceMetrics() {
        try {
            // Calculate FPS
            const now = GLib.get_monotonic_time() / 1000;
            if (this.lastFpsUpdate > 0) {
                const elapsed = now - this.lastFpsUpdate;
                this.fps = this.frameCount / (elapsed / 1000);
            }
            this.lastFpsUpdate = now;
            this.frameCount = 0;

            // Check for performance issues
            if (this.frameTimes.length > 0) {
                // Optimized: Use running sum instead of reduce()
                let sum = 0;
                for (let i = 0; i < this.frameTimes.length; i++)
                    sum += this.frameTimes[i];

                const avgFrameTime = sum / this.frameTimes.length;

                // Warn if frame time is consistently too high
                if (avgFrameTime > this.targetFrameTime * 1.5) {
                    this.performanceWarnings++;
                    if (this.performanceWarnings % 10 === 0) { // Log every 10 warnings
                        console.warn(`Performance: High frame time detected: ${avgFrameTime.toFixed(2)}ms (target: ${this.targetFrameTime.toFixed(2)}ms)`);
                    }
                } else {
                    this.performanceWarnings = Math.max(0, this.performanceWarnings - 1);
                }
            }

            // Clear old frame times
            if (this.frameTimes.length > this.maxFrameHistory)
                this.frameTimes = this.frameTimes.slice(-this.maxFrameHistory);
        } catch (e) {
            console.error(`Performance monitoring error: ${e.message}`);
        }

        return true;
    }

    /**
     * Record frame time
     */
    recordFrame() {
        try {
            const now = GLib.get_monotonic_time() / 1000;
            if (this.lastFrameTime > 0) {
                const frameTime = now - this.lastFrameTime;
                this.frameTimes.push(frameTime);
            }
            this.lastFrameTime = now;
            this.frameCount++;
        } catch (e) {
            console.error(`Error recording frame: ${e.message}`);
        }
    }

    /**
     * Get current performance metrics
     */
    getMetrics() {
        // Optimized: Use loop instead of reduce()
        let avgFrameTime = 0;
        if (this.frameTimes.length > 0) {
            let sum = 0;
            for (let i = 0; i < this.frameTimes.length; i++)
                sum += this.frameTimes[i];

            avgFrameTime = sum / this.frameTimes.length;
        }

        return {
            fps: this.fps,
            avgFrameTime,
            targetFrameTime: this.targetFrameTime,
            performanceScore: this._calculatePerformanceScore(avgFrameTime),
            warnings: this.performanceWarnings,
        };
    }

    /**
     * Calculate performance score (0-100)
     *
     * @param avgFrameTime
     */
    _calculatePerformanceScore(avgFrameTime) {
        if (avgFrameTime <= this.targetFrameTime)
            return 100;
        if (avgFrameTime > this.targetFrameTime * 2)
            return 0;

        // Linear scale between target and 2x target
        const ratio = (avgFrameTime - this.targetFrameTime) / this.targetFrameTime;
        return Math.max(0, 100 - (ratio * 100));
    }

    /**
     * Optimize GLib operations by using appropriate priorities
     *
     * @param priority
     * @param delay
     * @param callback
     */
    static optimizeTimeout(priority, delay, callback) {
        // Use appropriate priority based on operation type
        const optimizedPriority = this._getOptimizedPriority(priority);
        return GLib.timeout_add(optimizedPriority, delay, callback);
    }

    static _getOptimizedPriority(originalPriority) {
        // Map standard priorities to optimized ones
        switch (originalPriority) {
        case GLib.PRIORITY_HIGH:
            return GLib.PRIORITY_DEFAULT; // Don't let anything block UI
        case GLib.PRIORITY_DEFAULT:
            return GLib.PRIORITY_DEFAULT_IDLE; // Most operations can be slightly deferred
        case GLib.PRIORITY_HIGH_IDLE:
            return GLib.PRIORITY_DEFAULT_IDLE;
        case GLib.PRIORITY_DEFAULT_IDLE:
            return GLib.PRIORITY_LOW; // Background operations
        case GLib.PRIORITY_LOW:
            return GLib.PRIORITY_LOW; // Keep as is
        default:
            return GLib.PRIORITY_DEFAULT_IDLE;
        }
    }

    /**
     * Create a throttled function to prevent excessive calls
     *
     * @param callback
     * @param limit
     */
    static throttle(callback, limit) {
        let waiting = false;
        return function (...args) {
            if (!waiting) {
                callback(...args);
                waiting = true;
                GLib.timeout_add(GLib.PRIORITY_LOW, limit, () => {
                    waiting = false;
                    return false;
                });
            }
        };
    }

    /**
     * Create a debounced function
     *
     * @param callback
     * @param delay
     */
    static debounce(callback, delay) {
        let timeoutId = 0;
        return function (...args) {
            if (timeoutId)
                GLib.source_remove(timeoutId);

            timeoutId = GLib.timeout_add(GLib.PRIORITY_LOW, delay, () => {
                callback(...args);
                timeoutId = 0;
                return false;
            });
        };
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this._monitorId) {
            GLib.source_remove(this._monitorId);
            this._monitorId = 0;
        }
    }
}

/**
 * Simple error logging with rate limiting
 *
 * @param message
 */
export function logError(message) {
    // Rate limit error logging to prevent spam
    if (!logError._lastErrorTime || !logError._errorCount) {
        logError._lastErrorTime = GLib.get_monotonic_time();
        logError._errorCount = 0;
    }

    const now = GLib.get_monotonic_time();
    const elapsed = (now - logError._lastErrorTime) / 1000;

    if (elapsed > 1000) { // Reset counter after 1 second
        logError._errorCount = 0;
        logError._lastErrorTime = now;
    }

    logError._errorCount++;

    // Only log every 10th error to prevent spam
    if (logError._errorCount <= 10)
        console.error(`[Hanabi Perf] ${message}`);
    else if (logError._errorCount === 11)
        console.error('[Hanabi Perf] Multiple errors occurred (suppressing further messages)');
}

// Initialize error tracking
logError._lastErrorTime = 0;
logError._errorCount = 0;
