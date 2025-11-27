/**
 * Structured logger for the WhatsApp Bot
 * Provides consistent logging with JSON format for easy parsing and monitoring
 */

class Logger {
  constructor() {
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    this.currentLevel = process.env.LOG_LEVEL ? this.levels[process.env.LOG_LEVEL.toLowerCase()] || 1 : 1;
  }

  /**
   * Log a message at the specified level
   * @param {string} level - Log level (debug, info, warn, error)
   * @param {string} message - Log message
   * @param {Object} data - Additional structured data
   */
  log(level, message, data = {}) {
    if (this.levels[level] < this.currentLevel) {
      return;
    }

    const logEntry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      ...data,
    };

    console.log(JSON.stringify(logEntry));
  }

  /**
   * Log debug information
   * @param {string} message
   * @param {Object} data
   */
  debug(message, data = {}) {
    this.log('debug', message, data);
  }

  /**
   * Log informational message
   * @param {string} message
   * @param {Object} data
   */
  info(message, data = {}) {
    this.log('info', message, data);
  }

  /**
   * Log warning message
   * @param {string} message
   * @param {Object} data
   */
  warn(message, data = {}) {
    this.log('warn', message, data);
  }

  /**
   * Log error with full context
   * @param {string} message
   * @param {Error} error - Error object
   * @param {Object} data - Additional context
   */
  error(message, error, data = {}) {
    const errorData = {
      ...data,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    };
    this.log('error', message, errorData);
  }

  /**
   * Time an async operation and log its duration
   * @param {string} label - Operation label
   * @param {Function} fn - Async function to time
   * @param {Object} data - Additional context data
   * @returns {Promise} Result of the function
   */
  async time(label, fn, data = {}) {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.info(`${label} completed`, { duration, ...data });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${label} failed`, error, { duration, ...data });
      throw error;
    }
  }

  /**
   * Time a sync operation and log its duration
   * @param {string} label - Operation label
   * @param {Function} fn - Sync function to time
   * @param {Object} data - Additional context data
   * @returns {*} Result of the function
   */
  timeSync(label, fn, data = {}) {
    const start = Date.now();
    try {
      const result = fn();
      const duration = Date.now() - start;
      this.info(`${label} completed`, { duration, ...data });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${label} failed`, error, { duration, ...data });
      throw error;
    }
  }

  /**
   * Log command processing start
   * @param {Object} parsed - Parsed command data
   * @param {Object} sender - Sender information
   */
  commandStart(parsed, sender) {
    this.info('Command processing started', {
      command: parsed.command,
      args: parsed.args,
      isAdmin: parsed.isAdmin,
      sender: {
        phone: sender.phone,
        name: sender.name,
      },
      chat: {
        id: sender.chat.id,
        isGroup: sender.chat.isGroup,
      },
    });
  }

  /**
   * Log command processing completion
   * @param {Object} parsed - Parsed command data
   * @param {number} duration - Processing duration in ms
   * @param {boolean} success - Whether command succeeded
   */
  commandEnd(parsed, duration, success) {
    this.info('Command processing completed', {
      command: parsed.command,
      duration,
      success,
    });
  }

  /**
   * Log cache refresh operation
   * @param {string} type - Type of cache being refreshed (users, groups)
   * @param {number} count - Number of items loaded
   * @param {number} duration - Refresh duration in ms
   */
  cacheRefresh(type, count, duration) {
    this.info('Cache refreshed', {
      type,
      count,
      duration,
    });
  }

  /**
   * Log cache refresh error
   * @param {string} type - Type of cache
   * @param {Error} error - Error that occurred
   */
  cacheRefreshError(type, error) {
    this.error('Cache refresh failed', error, { type });
  }
}

// Export singleton instance
const logger = new Logger();

export default logger;