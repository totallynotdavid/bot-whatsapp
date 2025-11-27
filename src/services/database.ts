import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env';
import type { User } from '../types/models';
import { Rank } from '../types/permissions';
import { logger } from '../utils/logger';

export class DatabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
      auth: { persistSession: false }
    });
  }

  /**
   * Get or create a user and determine their rank
   */
  async getUser(phoneNumber: string, name: string): Promise<User> {
    // Check if owner
    const normalizedPhone = phoneNumber.replace('@c.us', '');
    if (normalizedPhone === config.ADMIN_NUMBER) {
      return { id: phoneNumber, phoneNumber, name, rank: Rank.OWNER };
    }

    try {
      // Check subscription table (legacy 'paid_users')
      const { data: premiumUser } = await this.client
        .from('paid_users')
        .select('premium_expiry')
        .eq('phone_number', phoneNumber)
        .single();

      let rank = Rank.REGULAR;
      let premiumExpiry: Date | undefined;

      if (premiumUser && premiumUser.premium_expiry) {
        const expiry = new Date(premiumUser.premium_expiry);
        if (expiry > new Date()) {
          rank = Rank.PREMIUM;
          premiumExpiry = expiry;
        }
      }

      return {
        id: phoneNumber,
        phoneNumber,
        name,
        rank,
        premiumExpiry
      };
    } catch (err) {
      logger.error('Database error fetching user', err);
      return { id: phoneNumber, phoneNumber, name, rank: Rank.REGULAR };
    }
  }

  /**
   * Log command usage for analytics
   */
  async logCommandUsage(user: User, command: string, success: boolean): Promise<void> {
    this.client.from('command_logs').insert({
      user_id: user.phoneNumber,
      command,
      success,
      timestamp: new Date().toISOString()
    }).then(({ error }) => {
      if (error) logger.warn('Failed to log command usage', { error });
    });
  }
}
