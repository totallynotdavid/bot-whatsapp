/**
 * Configuration module with fail-fast validation
 * Loads and validates all required environment variables at startup
 */

import dotenv from 'dotenv';
dotenv.config();

/**
 * Required environment variables with their descriptions
 */
const REQUIRED_ENV_VARS = {
  NODE_ENV: 'Environment (dev/prod)',
  SUPABASE_API_KEY: 'Supabase API key',
  SUPABASE_BASE_URL: 'Supabase base URL',
  OPENAI_API_KEY: 'OpenAI API key',
  ADMIN_NUMBER: 'Admin phone number',
};

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS = {
  COMMAND_PREFIX: '/',
  ADMIN_COMMAND_PREFIX: '#',
  CACHE_REFRESH_INTERVAL: '900000', // 15 minutes in ms
  LOG_LEVEL: 'info',
};

/**
 * Validates that all required environment variables are present
 * @throws {Error} If any required variable is missing
 */
function validateEnvironment() {
  const missing: string[] = [];
  
  for (const [key, description] of Object.entries(REQUIRED_ENV_VARS)) {
    if (!process.env[key] || process.env[key].trim() === '') {
      missing.push(`${key} (${description})`);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}`
    );
  }
}

/**
 * Loads configuration from environment variables
 * Fails fast if required variables are missing
 * @returns {Object} Configuration object
 */
function loadConfig() {
  // Validate required variables first (fail fast)
  validateEnvironment();
  
  return {
    // Environment
    nodeEnv: process.env.NODE_ENV,
    isProduction: process.env.NODE_ENV === 'prod',
    
    // Command prefixes
    prefix: process.env.COMMAND_PREFIX || OPTIONAL_ENV_VARS.COMMAND_PREFIX,
    adminPrefix: process.env.ADMIN_COMMAND_PREFIX || OPTIONAL_ENV_VARS.ADMIN_COMMAND_PREFIX,
    
    // Database
    supabaseUrl: process.env.SUPABASE_BASE_URL,
    supabaseKey: process.env.SUPABASE_API_KEY,
    
    // APIs
    openaiApiKey: process.env.OPENAI_API_KEY,
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    youtubeApiKeys: getYoutubeApiKeys(),
    stabilityApiKey: process.env.STABILITY_API_KEY,
    bingImageCookie: process.env.BING_IMAGE_COOKIE,
    imgurClientId: process.env.IMGUR_CLIENT_ID,
    
    // Admin
    adminNumber: process.env.ADMIN_NUMBER,
    
    // Google Drive
    driveFolderId: process.env.DRIVE_FOLDER_ID,
    
    // Facebook
    facebookAccessToken: process.env.FACEBOOK_ACCESS_TOKEN,
    facebookPageId: process.env.FACEBOOK_PAGE_ID,
    
    // Performance
    cacheRefreshInterval: parseInt(
      process.env.CACHE_REFRESH_INTERVAL || OPTIONAL_ENV_VARS.CACHE_REFRESH_INTERVAL,
      10
    ),
    
    // Logging
    logLevel: process.env.LOG_LEVEL || OPTIONAL_ENV_VARS.LOG_LEVEL,
  };
}

/**
 * Extracts YouTube API keys from environment variables
 * Supports multiple keys in format YOUTUBE_API_KEY_1, YOUTUBE_API_KEY_2, etc.
 * @returns {string[]} Array of YouTube API keys
 */
function getYoutubeApiKeys() {
  const keys: string[] = [];
  let index = 1;
  
  while (process.env[`YOUTUBE_API_KEY_${index}`]) {
    const key = process.env[`YOUTUBE_API_KEY_${index}`].trim();
    if (key) {
      keys.push(key);
    }
    index++;
  }
  
  return keys;
}

export {
  loadConfig,
  validateEnvironment,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS,
};


