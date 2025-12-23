import { prisma } from '@/server/db/client';
import { logger } from '@/lib/logger';

export class ContactService {
  /**
   * Resolve username to wallet address
   */
  async resolveUsername(username: string): Promise<{ address: string; blockchain: string } | null> {
    try {
      // Find user with this username
      const user = await prisma.user.findUnique({
        where: { username },
        include: {
          wallets: {
            where: { isDefault: true },
            take: 1,
          },
        },
      });

      if (!user || user.wallets.length === 0) {
        return null;
      }

      return {
        address: user.wallets[0].address,
        blockchain: user.wallets[0].blockchain,
      };
    } catch (error) {
      logger.error('Error resolving username', error, { username });
      return null;
    }
  }

  /**
   * Resolve phone number to wallet address
   */
  async resolvePhone(phoneNumber: string): Promise<{ address: string; blockchain: string } | null> {
    try {
      const user = await prisma.user.findFirst({
        where: { phoneNumber },
        include: {
          wallets: {
            where: { isDefault: true },
            take: 1,
          },
        },
      });

      if (!user || user.wallets.length === 0) {
        return null;
      }

      return {
        address: user.wallets[0].address,
        blockchain: user.wallets[0].blockchain,
      };
    } catch (error) {
      logger.error('Error resolving phone', error, { phoneNumber });
      return null;
    }
  }

  /**
   * Add a contact
   */
  async addContact(
    userId: string,
    contactType: 'username' | 'phone' | 'email',
    contactValue: string,
    nickname?: string
  ): Promise<any> {
    try {
      // Resolve the contact
      let resolved: { address: string; blockchain: string } | null = null;
      if (contactType === 'username') {
        resolved = await this.resolveUsername(contactValue);
      } else if (contactType === 'phone') {
        resolved = await this.resolvePhone(contactValue);
      }

      const contact = await prisma.userContact.create({
        data: {
          userId,
          contactType,
          contactValue,
          resolvedAddress: resolved?.address,
          resolvedBlockchain: resolved?.blockchain,
          nickname,
        },
      });

      return contact;
    } catch (error) {
      logger.error('Error adding contact', error, { userId, contactType, contactValue });
      throw error;
    }
  }

  /**
   * Get user's contacts
   */
  async getContacts(userId: string): Promise<any[]> {
    try {
      const contacts = await prisma.userContact.findMany({
        where: { userId },
        orderBy: { lastUsedAt: 'desc' },
      });

      return contacts;
    } catch (error) {
      logger.error('Error getting contacts', error, { userId });
      return [];
    }
  }
}

export default new ContactService();

