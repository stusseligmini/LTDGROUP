import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

export class PhysicalCardService {
  /**
   * Order physical card
   */
  async orderPhysicalCard(
    cardId: string,
    shippingAddress: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    }
  ): Promise<any> {
    try {
      const card = await prisma.card.findUnique({
        where: { id: cardId },
      });

      if (!card) {
        throw new Error('Card not found');
      }

      if (card.physicalCardOrdered) {
        throw new Error('Physical card already ordered for this card');
      }

      // In production, call card provider API to order physical card
      // For now, update database
      await prisma.card.update({
        where: { id: cardId },
        data: {
          physicalCardOrdered: true,
          type: 'physical',
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: card.userId,
          action: 'physical_card_ordered',
          resource: 'card',
          resourceId: cardId,
          platform: 'api',
          status: 'success',
          metadata: { shippingAddress },
        },
      });

      // Send notification
      await prisma.notification.create({
        data: {
          userId: card.userId,
          type: 'system',
          title: 'Physical Card Ordered',
          body: 'Your physical card has been ordered and will be shipped soon!',
          channels: ['push', 'in-app'],
        },
      });

      return {
        success: true,
        estimatedDelivery: this.calculateEstimatedDelivery(shippingAddress.country),
      };
    } catch (error) {
      logger.error('Error ordering physical card', error, { cardId, shippingAddress });
      throw error;
    }
  }

  /**
   * Update shipping status
   */
  async updateShippingStatus(
    cardId: string,
    trackingNumber: string
  ): Promise<void> {
    try {
      await prisma.card.update({
        where: { id: cardId },
        data: {
          physicalCardShippedAt: new Date(),
        },
      });

      const card = await prisma.card.findUnique({
        where: { id: cardId },
      });

      if (card) {
        await prisma.notification.create({
          data: {
            userId: card.userId,
            type: 'system',
            title: 'Physical Card Shipped',
            body: `Your physical card has been shipped! Tracking: ${trackingNumber}`,
            channels: ['push', 'in-app', 'email'],
            metadata: { trackingNumber },
          },
        });
      }
    } catch (error) {
      logger.error('Error updating shipping status', error, { cardId, trackingNumber });
      throw error;
    }
  }

  /**
   * Activate physical card
   */
  async activatePhysicalCard(
    cardId: string,
    activationCode: string
  ): Promise<boolean> {
    try {
      const card = await prisma.card.findUnique({
        where: { id: cardId },
      });

      if (!card) {
        throw new Error('Card not found');
      }

      if (!card.physicalCardOrdered) {
        throw new Error('No physical card ordered for this card');
      }

      // In production, verify activation code with provider
      // For now, simply activate
      await prisma.card.update({
        where: { id: cardId },
        data: {
          status: 'active',
          activatedAt: new Date(),
        },
      });

      return true;
    } catch (error) {
      logger.error('Error activating physical card', error, { cardId });
      return false;
    }
  }

  /**
   * Calculate estimated delivery date
   */
  private calculateEstimatedDelivery(country: string): Date {
    const deliveryDays = country === 'US' ? 7 : 14; // 7 days domestic, 14 international
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + deliveryDays);
    return estimatedDate;
  }
}

export default new PhysicalCardService();

