/**
 * Main message handler for WhatsApp Bot
 * 
 * Wires together all components in a linear flow:
 * Parse → Check Permission → Execute → Respond → Log
 */

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { loadConfig } from './config.ts';
import { createPremiumCache } from './storage/premium-cache.ts';
import { createDatabase } from './storage/database.ts';
import { parseMessage } from './core/parser.ts';
import { checkPermission } from './core/permissions.ts';
import { executeCommand } from './core/executor.ts';
import { sendResponse, sendError } from './core/responder.ts';
import logger from './utils/logger.ts';

/**
 * Initialize the bot with all dependencies
 */
async function initializeBot() {
  // 1. Load and validate config (fail fast)
  logger.info('Loading configuration...');
  const config = loadConfig();
  logger.info('Configuration loaded');

  // 2. Create database connection (fail fast)
  logger.info('Connecting to database...');
  const db = createDatabase(config);
  logger.info('Database connected');

  // 3. Create premium cache
  logger.info('Initializing premium cache...');
  const cache = createPremiumCache();
  
  // 4. Load initial premium data (fail fast)
  logger.info('Loading premium data...');
  try {
    const [users, groups] = await Promise.all([
      db.getPremiumUsers(),
      db.getPremiumGroups(),
    ]);
    
    cache.loadUsers(users);
    cache.loadGroups(groups);
    
    const stats = cache.stats();
    logger.info('Premium cache loaded', { users: stats.users, groups: stats.groups });
  } catch (err) {
    logger.error('Failed to load premium data', err);
    throw new Error('Cannot start bot without premium data');
  }

  // 5. Initialize WhatsApp client
  logger.info('Initializing WhatsApp client...');
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    },
  });

  // QR code handler
  client.on('qr', (qr) => {
    logger.info('QR code generated for authentication');
    console.log('Scan this QR code to authenticate:');
    qrcode.generate(qr, { small: true });
  });

  // Authentication failure handler
  client.on('auth_failure', (msg) => {
    logger.error('Authentication failed', new Error(msg));
  });

  // Ready handler
  client.on('ready', () => {
    const stats = cache.stats();
    logger.info('WhatsApp client ready', { users: stats.users, groups: stats.groups });
  });

  // 6. Set up message handler
  client.on('message', async (msg) => {
    await handleMessage(msg, { config, cache, db, client });
  });

  // 7. Start cache refresh background task
  startCacheRefresh(cache, db, config.cacheRefreshInterval);

  // 8. Initialize client
  await client.initialize();

  return { client, cache, db, config };
}

/**
 * Handle incoming WhatsApp message
 * Linear flow: Parse → Check → Execute → Respond → Log
 */
async function handleMessage(msg, context) {
  const startTime = Date.now();
  const { config, cache, db, client } = context;

  try {
    // 1. Parse message (fail fast if not a command)
    const parsed = parseMessage(msg, config.prefix, config.adminPrefix);
    if (!parsed) {
      return; // Not a command, ignore
    }

    logger.commandStart(parsed, parsed.sender);

    // 2. Check permission (fail fast if denied)
    const allowed = checkPermission(parsed, cache);
    if (!allowed) {
      await sendError(msg, 'Esta función está únicamente disponible para usuarios premium. Contacta al administrador para más información.');
      
      // Log denied command
      await db.logCommand(
        parsed.sender.phone,
        parsed.command,
        parsed.chat.isGroup ? parsed.chat.id : null,
        false,
        'Permission denied'
      );
      
      logger.commandEnd(parsed, Date.now() - startTime, false);
      return;
    }

    // 3. Execute command
    const ctx = { parsed, db, client, config, cache, message: msg };
    const result = await executeCommand(ctx);

    // 4. Send response
    if (result.error) {
      await sendError(msg, result.error);
      
      // Log failed command
      await db.logCommand(
        parsed.sender.phone,
        parsed.command,
        parsed.chat.isGroup ? parsed.chat.id : null,
        false,
        result.error
      );
      
      logger.commandEnd(parsed, Date.now() - startTime, false);
    } else {
      await sendResponse(msg, result.data);
      
      // React with checkmark
      await msg.react('✅').catch(err => {
        logger.error('Failed to react to message', err, { command: parsed.command });
      });
      
      // Log successful command
      await db.logCommand(
        parsed.sender.phone,
        parsed.command,
        parsed.chat.isGroup ? parsed.chat.id : null,
        true,
        null
      );
      
      logger.commandEnd(parsed, Date.now() - startTime, true);
    }

  } catch (err) {
    logger.error('Error handling message', err, {
      from: msg.from,
      body: msg.body?.substring(0, 100), // Truncate long messages
    });

    // Try to send error to user
    try {
      await sendError(msg, 'Ha ocurrido un error. Por favor intenta de nuevo.');
    } catch (sendErr) {
      logger.error('Failed to send error message', sendErr);
    }
  }
}

/**
 * Start background task to refresh premium cache
 */
function startCacheRefresh(cache, db, intervalMs) {
  logger.info('Starting cache refresh background task', { intervalMinutes: intervalMs / 1000 / 60 });

  const refresh = async () => {
    const startTime = Date.now();
    try {
      logger.info('Refreshing premium cache');

      const [users, groups] = await Promise.all([
        db.getPremiumUsers(),
        db.getPremiumGroups(),
      ]);

      cache.loadUsers(users);
      cache.loadGroups(groups);

      const stats = cache.stats();
      const duration = Date.now() - startTime;

      logger.cacheRefresh('premium', stats.users + stats.groups, duration);
    } catch (err) {
      logger.cacheRefreshError('premium', err);
    }
  };

  // Run refresh on interval
  setInterval(refresh, intervalMs);
}

// Start the bot
initializeBot().catch(err => {
  logger.error('Failed to initialize bot', err);
  process.exit(1);
});


