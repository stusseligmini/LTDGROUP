import { prisma } from '@/server/db/client';
import { randomBytes } from 'crypto';
import { logger } from '@/lib/logger';

export class PaymentRequestService {
  /**
   * Create payment request
   */
  async createPaymentRequest(
    senderId: string,
    receiverId: string,
    amount: string,
    blockchain: string,
    memo?: string,
    tokenSymbol?: string
  ): Promise<any> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

      const request = await prisma.paymentRequest.create({
        data: {
          senderId,
          receiverId,
          amount,
          blockchain,
          tokenSymbol,
          memo,
          requestType: 'single',
          expiresAt,
        },
      });

      // Notify receiver
      await this.notifyReceiver(request);

      return request;
    } catch (error) {
      logger.error('Error creating payment request', error, { senderId, receiverId, amount });
      throw error;
    }
  }

  /**
   * Create split bill request
   */
  async createSplitBill(
    creatorId: string,
    totalAmount: number,
    participants: Array<{ userId: string; amount: number }>,
    blockchain: string,
    description: string
  ): Promise<any[]> {
    try {
      const splitBillId = randomBytes(16).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const requests = [];

      for (const participant of participants) {
        const request = await prisma.paymentRequest.create({
          data: {
            senderId: creatorId,
            receiverId: participant.userId,
            amount: participant.amount.toString(),
            blockchain,
            memo: description,
            requestType: 'split_bill',
            splitBillId,
            expiresAt,
          },
        });

        requests.push(request);
        await this.notifyReceiver(request);
      }

      return requests;
    } catch (error) {
      logger.error('Error creating split bill', error, { creatorId, totalAmount, participantCount: participants.length });
      throw error;
    }
  }

  /**
   * Fulfill payment request
   */
  async fulfillRequest(
    requestId: string,
    txHash: string
  ): Promise<any> {
    try {
      const request = await prisma.paymentRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new Error('Payment request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('Payment request is not pending');
      }

      if (new Date() > request.expiresAt) {
        throw new Error('Payment request has expired');
      }

      const updatedRequest = await prisma.paymentRequest.update({
        where: { id: requestId },
        data: {
          status: 'fulfilled',
          fulfilledTxHash: txHash,
          fulfilledAt: new Date(),
        },
      });

      // Notify sender that request was fulfilled
      await this.notifySenderFulfilled(updatedRequest);

      return updatedRequest;
    } catch (error) {
      logger.error('Error fulfilling request', error, { requestId, txHash });
      throw error;
    }
  }

  /**
   * Cancel payment request
   */
  async cancelRequest(requestId: string, userId: string): Promise<void> {
    try {
      const request = await prisma.paymentRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new Error('Payment request not found');
      }

      // Only sender or receiver can cancel
      if (request.senderId !== userId && request.receiverId !== userId) {
        throw new Error('Not authorized to cancel this request');
      }

      await prisma.paymentRequest.update({
        where: { id: requestId },
        data: { status: 'cancelled' },
      });
    } catch (error) {
      logger.error('Error cancelling request', error, { requestId, userId });
      throw error;
    }
  }

  /**
   * Get pending requests for user
   */
  async getPendingRequests(userId: string): Promise<any[]> {
    const requests = await prisma.paymentRequest.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        receiver: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests;
  }

  /**
   * Get split bill details
   */
  async getSplitBillDetails(splitBillId: string): Promise<any> {
    const requests = await prisma.paymentRequest.findMany({
      where: { splitBillId },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
          },
        },
        receiver: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    if (requests.length === 0) {
      return null;
    }

    const totalAmount = requests.reduce(
      (sum, req) => sum + parseFloat(req.amount),
      0
    );

    const fulfilledCount = requests.filter(r => r.status === 'fulfilled').length;

    return {
      splitBillId,
      description: requests[0].memo,
      totalAmount,
      participantCount: requests.length,
      fulfilledCount,
      requests,
    };
  }

  /**
   * Notify receiver of payment request
   */
  private async notifyReceiver(request: any): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          userId: request.receiverId,
          type: 'transaction',
          title: 'Payment Request',
          body: `You have a payment request for ${request.amount} ${request.blockchain}`,
          channels: ['push', 'in-app'],
          priority: 'normal',
          actionUrl: `/payment-requests/${request.id}`,
          actionLabel: 'View Request',
          metadata: { requestId: request.id },
        },
      });
    } catch (error) {
      logger.error('Error notifying receiver', error, { requestId: request.id, receiverId: request.receiverId });
    }
  }

  /**
   * Notify sender that request was fulfilled
   */
  private async notifySenderFulfilled(request: any): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          userId: request.senderId,
          type: 'transaction',
          title: 'Payment Received',
          body: `Your payment request for ${request.amount} ${request.blockchain} was fulfilled!`,
          channels: ['push', 'in-app'],
          priority: 'normal',
          metadata: {
            requestId: request.id,
            txHash: request.fulfilledTxHash,
          },
        },
      });
    } catch (error) {
      logger.error('Error notifying sender', error, { requestId: request.id, senderId: request.senderId });
    }
  }
}

export default new PaymentRequestService();

