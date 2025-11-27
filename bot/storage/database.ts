/**
 * Database layer for Supabase operations
 * Provides simple, focused queries for premium users, groups, and conversation history
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Creates a database client with configured Supabase connection
 * @param {Object} config - Configuration object with supabaseUrl and supabaseKey
 * @returns {Object} Database interface with query methods
 */
function createDatabase(config) {
  const client = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  return {
    /**
     * Fetches all premium users from the database
     * @returns {Promise<Array>} Array of premium users with phone_number and premium_expiry
     * @throws {Error} If database query fails
     */
    async getPremiumUsers() {
      const { data, error } = await client
        .from('paid_users')
        .select('phone_number, premium_expiry');

      if (error) throw error;
      return data || [];
    },

    /**
     * Fetches all premium groups from the database
     * @returns {Promise<Array>} Array of premium groups with group_id, contact_number, and isActive
     * @throws {Error} If database query fails
     */
    async getPremiumGroups() {
      const { data, error } = await client
        .from('premium_groups')
        .select('group_id, contact_number, isActive');

      if (error) throw error;
      return data || [];
    },

    /**
     * Fetches a single premium group by group ID
     * @param {string} groupId - The group ID to fetch
     * @returns {Promise<Object|null>} Group data or null if not found
     * @throws {Error} If database query fails
     */
    async getPremiumGroup(groupId) {
      const { data, error } = await client
        .from('premium_groups')
        .select('*')
        .eq('group_id', groupId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      return data || null;
    },

    /**
     * Adds or updates a premium user with additional days
     * @param {string} phone - The user phone number
     * @param {string} name - The customer name
     * @param {number} days - Number of days to add
     * @throws {Error} If database operation fails
     */
    async addPremiumUser(phone, name, days) {
      // Get existing user
      const existing = await this.getPremiumUser(phone);
      const baseDate = existing ? new Date(existing.premium_expiry) : new Date();

      // Add days
      baseDate.setDate(baseDate.getDate() + days);
      const premiumExpiry = baseDate.toISOString();

      const { error } = await client
        .from('paid_users')
        .upsert({
          phone_number: phone,
          customer_name: name,
          premium_expiry: premiumExpiry,
        }, { onConflict: 'phone_number' });

      if (error) throw error;
    },

    /**
     * Fetches a single premium user by phone number
     * @param {string} phone - The user phone number
     * @returns {Promise<Object|null>} User data or null if not found
     * @throws {Error} If database query fails
     */
    async getPremiumUser(phone) {
      const { data, error } = await client
        .from('paid_users')
        .select('*')
        .eq('phone_number', phone)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },

    /**
     * Updates the active status of a premium group
     * @param {string} groupId - The group ID to update
     * @param {boolean} isActive - The new active status
     * @throws {Error} If database update fails
     */
    async updateGroupStatus(groupId, isActive) {
      const { error } = await client
        .from('premium_groups')
        .update({ isActive })
        .eq('group_id', groupId);

      if (error) throw error;
    },

    /**
     * Fetches conversation history for a given conversation ID
     * Returns messages in chronological order (oldest first)
     * @param {string} conversationId - The conversation ID to fetch messages for
     * @param {number} limit - Maximum number of messages to fetch (default: 50)
     * @returns {Promise<Array>} Array of messages in chronological order
     * @throws {Error} If database query fails
     */
    async getMessages(conversationId, limit = 50) {
      const { data, error } = await client
        .from('gpt_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).reverse(); // Reverse to get oldest first
    },

    /**
     * Adds a new message to the conversation history
     * @param {string} conversationId - The conversation ID
     * @param {string} sender - The sender identifier (user/bot)
     * @param {string} content - The message content
     * @throws {Error} If database insert fails
     */
    async addMessage(conversationId, sender, content) {
      const { error } = await client
        .from('gpt_messages')
        .insert({
          conversation_id: conversationId,
          sender,
          content,
          timestamp: new Date().toISOString(),
        });

      if (error) throw error;
    },

    /**
     * Logs a command execution (fire-and-forget)
     * Does not throw errors, only logs them to console
     * @param {string} phone - User phone number
     * @param {string} command - Command name
     * @param {string} groupId - Group ID (null for DMs)
     * @param {boolean} success - Whether command succeeded
     * @param {string} error - Error message if command failed
     */
    async logCommand(phone, command, groupId, success, error) {
      try {
        await client
          .from('users')
          .insert({
            phone_number: phone,
            command,
            group_id: groupId,
            timestamp: new Date().toISOString(),
            success,
            error,
          });
      } catch (err) {
        // Fire and forget - log but don't throw
        console.error('Failed to log command:', err);
      }
    },
  };
}

export { createDatabase };


