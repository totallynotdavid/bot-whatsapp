/**
 * Permission checker module
 * Validates user and group access to commands
 */

/**
 * Checks if a sender has permission to execute a command
 * 
 * Permission rules:
 * - Admin commands require premium user
 * - Regular commands in groups require premium group
 * - Regular commands in DMs require premium user
 * 
 * @param {Object} parsed - Parsed command object from parser
 * @param {Object} cache - Premium cache instance
 * @returns {boolean} True if sender has permission, false otherwise
 */
function checkPermission(parsed, cache) {
  // Admin commands require premium user
  if (parsed.isAdmin) {
    return cache.isPremiumUser(parsed.sender.phone);
  }
  
  // Regular commands in group chats require premium group
  if (parsed.chat.isGroup) {
    return cache.isPremiumGroup(parsed.chat.id);
  }
  
  // Regular commands in DMs require premium user
  return cache.isPremiumUser(parsed.sender.phone);
}

export { checkPermission };


