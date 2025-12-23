// Jest manual mock for @prisma/client to prevent real DB initialization
import { prisma } from '@/__tests__/lib/prisma.mock';

export class PrismaClient {
  // Return the shared mocked prisma object
  [key: string]: any;
  constructor() {
    return prisma as any;
  }
}

export default PrismaClient as any;
