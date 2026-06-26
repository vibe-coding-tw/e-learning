/**
 * Student Performance Quantifier System
 * Phase 1: Foundation - Data Collection & Metrics
 */

class StudentQuantifier {
    constructor() {
        this.session = {
            startTime: Date.now(),
            endTime: null,
            events: [],
            metrics: {
                connectionAttempts: 0,
                connectionSuccess: 0,
                connectionDuration: 0,
                commandsSent: 0,
                customEvents: {}
            }
        };

        this.config = {
            // Default targets (can be overridden per lesson)
            targets: {
                connectionStability: 60 * 1000, // 60 seconds
                maxLatency: 100, // ms
            }
        };

        console.log("🎓 StudentQuantifier Initialized");
    }

    /**
     * Log a standardized event
     * @param {string} type - 'CONNECTION', 'COMMAND', 'SYSTEM', 'ACHIEVEMENT'
     * @param {object} data - Payload
     */
    logEvent(type, data = {}) {
        const event = {
            timestamp: Date.now(),
            type: type.toUpperCase(),
            data: data
        };
        this.session.events.push(event);
        this._updateMetrics(event);

        // Debug output
        console.log(`[Quantifier] ${event.type}:`, event.data);
    }

    /**
     * Update internal counters based on events
     * @param {object} event 
     */
    _updateMetrics(event) {
        switch (event.type) {
            case 'CONNECTION':
                if (event.data.status === 'connected') {
                    this.session.metrics.connectionSuccess++;
                    this._connectionStartTime = Date.now();
                } else if (event.data.status === 'disconnected') {
                    if (this._connectionStartTime) {
                        const duration = Date.now() - this._connectionStartTime;
                        this.session.metrics.connectionDuration += duration;
                        this._connectionStartTime = null;
                    }
                } else if (event.data.status === 'attempt') {
                    this.session.metrics.connectionAttempts++;
                }
                break;
            case 'COMMAND':
                this.session.metrics.commandsSent++;
                break;
        }
    }

    /**
     * Get current session summary
     */
    getReport() {
        // Calculate current connection duration if still connected
        let currentDuration = this.session.metrics.connectionDuration;
        if (this._connectionStartTime) {
            currentDuration += (Date.now() - this._connectionStartTime);
        }

        return {
            duration: (Date.now() - this.session.startTime) / 1000, // seconds
            metrics: {
                ...this.session.metrics,
                connectionDuration: currentDuration / 1000 // seconds
            },
            score: this._calculatePreliminaryScore()
        };
    }

    /**
     * Simple scoring logic (Placeholder for Phase 4)
     */
    _calculatePreliminaryScore() {
        let score = 0;
        // 1. Connection Effort: 10 points for every successful connection
        score += this.session.metrics.connectionSuccess * 10;
        // 2. Persistence: 1 point for every minute of connection
        const minutesConnected = (this.session.metrics.connectionDuration / 1000) / 60;
        score += Math.floor(minutesConnected) * 5;

        return Math.min(score, 100); // Cap at 100
    }
}

// Export as global instance for now (simplest for vanilla JS integration)
window.quantifier = new StudentQuantifier();
