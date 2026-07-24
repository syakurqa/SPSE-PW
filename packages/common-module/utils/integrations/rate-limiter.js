/* eslint-disable no-console */

/**
 * Rate Limiter using Token Bucket Algorithm
 * Ensures API requests stay within defined limits (e.g., 500 requests per 60 seconds)
 * @param {number} maxRequests - Maximum number of requests allowed in the time window
 * @param {number} timeWindowSeconds - Time window in seconds (minimum: 1)
 */
export class RateLimiter {
  constructor(maxRequests = 500, timeWindowSeconds = 60) {
    if (timeWindowSeconds < 1) {
      throw new Error('timeWindowSeconds must be at least 1 second');
    }

    this.maxRequests = maxRequests;
    this.timeWindowSeconds = timeWindowSeconds;
    this.timeWindowMs = timeWindowSeconds * 1000;
    this.requestTimestamps = [];
    this.minInterval = this.timeWindowMs / maxRequests; // Time between requests in ms
  }

  /**
   * Wait if necessary to stay within rate limit
   * @param {string} apiName - Name of the API being called (for logging)
   * @returns {Promise<void>}
   */
  async waitForAvailability(apiName = 'API') {
    const now = Date.now();

    // Remove timestamps older than the time window
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.timeWindowMs
    );

    // Check if we've hit the limit
    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = oldestRequest + this.timeWindowMs - now;

      console.log(`[Rate Limiter] ${apiName} limit reached (${this.maxRequests} req/${this.timeWindowSeconds}s). Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await this.sleep(waitTime);

      // Clean up old timestamps after waiting
      this.requestTimestamps = this.requestTimestamps.filter(
        timestamp => Date.now() - timestamp < this.timeWindowMs
      );
    }

    // Ensure minimum interval between requests
    if (this.requestTimestamps.length > 0) {
      const lastRequest = this.requestTimestamps[this.requestTimestamps.length - 1];
      const timeSinceLastRequest = now - lastRequest;

      if (timeSinceLastRequest < this.minInterval) {
        const waitTime = this.minInterval - timeSinceLastRequest;
        await this.sleep(waitTime);
      }
    }

    // Record this request
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current usage statistics
   * @returns {Object} Current rate limit usage
   */
  getStatus() {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.timeWindowMs
    );

    return {
      used: recentRequests.length,
      limit: this.maxRequests,
      remaining: this.maxRequests - recentRequests.length,
      percentageUsed: ((recentRequests.length / this.maxRequests) * 100).toFixed(1)
    };
  }

  /**
   * Log current rate limit status
   * @param {string} prefix - Optional prefix for the log message
   */
  logStatus(prefix = '[Rate Limiter]') {
    const status = this.getStatus();
    console.log(`${prefix} ${status.used}/${status.limit} requests per ${this.timeWindowSeconds}s used (${status.percentageUsed}%)`);
  }
}
