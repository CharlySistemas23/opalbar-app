// ─────────────────────────────────────────────
//  WalletService — Unit Tests
// ─────────────────────────────────────────────
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WalletService } from '../wallet.service';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

const mockUser = {
  id: 'user-123',
  points: 450,
  profile: { loyaltyLevel: { name: 'Bronce', minPoints: 0, maxPoints: 499 } },
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  walletTransaction: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  loyaltyLevel: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  userProfile: { updateMany: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn((ops) => Promise.all(Array.isArray(ops) ? ops : [])),
};

const mockNotifications = {
  createNotification: jest.fn().mockResolvedValue({}),
};

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    jest.clearAllMocks();
  });

  describe('getWallet', () => {
    it('should return user wallet with points and level', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      mockPrisma.loyaltyLevel.findFirst.mockResolvedValueOnce({ name: 'Plata', minPoints: 500 });

      const result = await service.getWallet('user-123');
      expect(result.points).toBe(450);
      expect(result.nextLevel?.name).toBe('Plata');
    });

    it('should throw NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.getWallet('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLoyaltyLevels', () => {
    it('should return all active loyalty levels', async () => {
      const levels = [
        { name: 'Bronce', minPoints: 0 },
        { name: 'Plata', minPoints: 500 },
        { name: 'Oro', minPoints: 1500 },
        { name: 'Diamante', minPoints: 5000 },
      ];
      mockPrisma.loyaltyLevel.findMany.mockResolvedValueOnce(levels);
      const result = await service.getLoyaltyLevels();
      expect(result).toHaveLength(4);
    });
  });

  describe('addPoints', () => {
    it('should add points and create wallet transaction', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser, points: 450 });
      const mockTx = { id: 'tx-001', points: 100, balance: 550 };
      mockPrisma.$transaction.mockResolvedValueOnce([mockTx, { points: 550 }]);
      mockPrisma.loyaltyLevel.findFirst.mockResolvedValueOnce(null);

      const result = await service.addPoints('user-123', 100, 'Test bonus');
      expect(result).toBeDefined();
    });
  });
});
