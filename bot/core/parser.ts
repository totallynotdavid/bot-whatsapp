/**
 * Message parser module
 * Extracts command information from WhatsApp messages
 */

/**
 * Parses a WhatsApp message to extract command information
 * Returns null for non-command messages
 * 
 * @param {Object} msg - WhatsApp message object
 * @param {string} prefix - Regular command prefix (e.g., '/')
 * @param {string} adminPrefix - Admin command prefix (e.g., '#')
 * @returns {Object|null} Parsed command object or null if not a command
 */
function parseMessage(msg, prefix, adminPrefix) {
  // Validate input
  if (!msg || !msg.body) {
    return null;
  }

  const body = msg.body.trim();

  // Check if message starts with a command prefix
  if (!body.startsWith(prefix) && !body.startsWith(adminPrefix)) {
    return null;
  }

  // Determine if this is an admin command
  const isAdmin = body.startsWith(adminPrefix);
  const actualPrefix = isAdmin ? adminPrefix : prefix;

  // Extract command and arguments
  const withoutPrefix = body.slice(actualPrefix.length).trim();
  
  // If nothing after prefix, not a valid command
  if (!withoutPrefix) {
    return null;
  }

  const parts = withoutPrefix.split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);

  // Extract sender information
  const sender = {
    phone: msg.id.participant || msg.id.remote,
    name: msg._data?.notifyName || 'Unknown',
  };

  // Extract chat information
  const chat = {
    id: msg.from,
    isGroup: msg.from.endsWith('@g.us'),
  };

  return {
    command,
    args,
    isAdmin,
    sender,
    chat,
  };
}

export { parseMessage };


