/**
 * Premium Cache System
 * 
 * Provides O(1) lookups for premium user and group status.
 * Uses Map-based storage with lazy expiry cleanup.
 */

/**
 * Creates a premium cache instance with user and group storage
 * @returns {Object} Cache instance with lookup and management methods
 */
function createPremiumCache() {
  const users = new Map();  // phone -> { expiry: Date }
  const groups = new Map(); // groupId -> { isActive: bool, contact: string }
  
  return {
    /**
     * Check if a user has premium status (O(1) lookup)
     * Performs lazy cleanup of expired users
     * @param {string} phone - User's phone number
     * @returns {boolean} True if user is premium and not expired
     */
    isPremiumUser(phone) {
      const user = users.get(phone);
      if (!user) return false;
      
      // Lazy expiry cleanup
      if (user.expiry < new Date()) {
        users.delete(phone);
        return false;
      }
      
      return true;
    },
    
    /**
     * Check if a group has premium status (O(1) lookup)
     * @param {string} groupId - WhatsApp group ID
     * @returns {boolean} True if group is premium and active
     */
    isPremiumGroup(groupId) {
      const group = groups.get(groupId);
      return !!(group && group.isActive);
    },
    
    /**
     * Set a single user's premium status
     * @param {string} phone - User's phone number
     * @param {Date|string} expiry - Premium expiry date
     */
    setUser(phone, expiry) {
      users.set(phone, { expiry: new Date(expiry) });
    },
    
    /**
     * Set a single group's premium status
     * @param {string} groupId - WhatsApp group ID
     * @param {string} contact - Contact number for the group
     * @param {boolean} isActive - Whether the group is active
     */
    setGroup(groupId, contact, isActive) {
      groups.set(groupId, { contact, isActive });
    },
    
    /**
     * Bulk load premium users (clears existing cache)
     * Only loads users with future expiry dates
     * @param {Array} userList - Array of user objects with phone_number and premium_expiry
     */
    loadUsers(userList) {
      users.clear();
      const now = new Date();
      
      for (const u of userList) {
        const expiry = new Date(u.premium_expiry);
        if (expiry > now) {
          users.set(u.phone_number, { expiry });
        }
      }
    },
    
    /**
     * Bulk load premium groups (clears existing cache)
     * @param {Array} groupList - Array of group objects with group_id, contact_number, and isActive
     */
    loadGroups(groupList) {
      groups.clear();
      
      for (const g of groupList) {
        groups.set(g.group_id, { 
          contact: g.contact_number, 
          isActive: g.isActive 
        });
      }
    },
    
    /**
     * Get user premium info
     * @param {string} phone - User's phone number
     * @returns {Object|null} User object with expiry or null
     */
    getUser(phone) {
      return users.get(phone) || null;
    },
    
    /**
     * Get groups registered by a contact
     * @param {string} contact - Contact phone number
     * @returns {Array} Array of group objects with group_id, contact, isActive
     */
    getGroupsByContact(contact) {
      const result = [];
      for (const [groupId, data] of groups) {
        if (data.contact === contact) {
          result.push({ group_id: groupId, ...data });
        }
      }
      return result;
    },

    /**
     * Get all premium users
     * @returns {Array} Array of user objects with phone_number and expiry
     */
    getAllUsers() {
      return Array.from(users.entries()).map(([phone, data]) => ({
        phone_number: phone,
        ...data,
      }));
    },

    /**
     * Get cache statistics
     * @returns {Object} Object with user and group counts
     */
    stats() {
      return {
        users: users.size,
        groups: groups.size,
      };
    },
  };
}

export { createPremiumCache };
