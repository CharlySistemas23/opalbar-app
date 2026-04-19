// ─────────────────────────────────────────────
//  AuthService — Unit Tests
// ─────────────────────────────────────────────
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';

// ── Mocks ─────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  session: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  loginAttempt: { create: jest.fn() },
  $transaction: jest.fn((ops) => Promise.all(Array.isArray(ops) ? ops : [ops(mockPrisma)])),
};

const mockRedis = {
  exists: jest.fn().mockResolvedValue(false),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  sadd: jest.fn().mockResolvedValue(undefined),
  srem: jest.fn().mockResolvedValue(undefined),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  decode: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, defaultValue?: unknown) => {
    const config: Record<string, unknown> = {
      'jwt.accessSecret': 'test_access_secret_32_chars_min_ok',
      'jwt.refreshSecret': 'test_refresh_secret_32_chars_min_ok',
      'jwt.accessExpiresIn': '15m',
      'jwt.refreshExpiresIn': '30d',
    };
    return config[key] ?? defaultValue;
  }),
};

// ── Tests ─────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ── register ────────────────────────────────

  describe('register', () => {
    it('should throw BadRequestException if no email or phone', async () => {
      await expect(service.register({ firstName: 'Test', lastName: 'User', password: 'Test@1234' } as any)).rejects.toThrow();
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' });
      await expect(
        service.register({ firstName: 'T', lastName: 'U', email: 'test@test.com', password: 'Test@1234' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user successfully with email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValueOnce({ id: 'new-user-id', email: 'test@test.com' });
      const result = await service.register({
        firstName: 'Carlos', lastName: 'Test',
        email: 'test@test.com', password: 'Secure@1234',
      });
      expect(result.message).toContain('created');
    });
  });

  // ── login ────────────────────────────────────

  describe('login', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@test.com',
      passwordHash: bcrypt.hashSync('Secure@1234', 1),
      status: 'ACTIVE',
      role: 'USER',
      profile: null,
    };

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser);
      mockPrisma.loginAttempt.create.mockResolvedValue({});
      await expect(
        service.login({ email: 'test@test.com', password: 'WrongPassword@1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for banned user', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({ ...mockUser, status: 'BANNED' });
      mockPrisma.loginAttempt.create.mockResolvedValue({});
      await expect(
        service.login({ email: 'test@test.com', password: 'Secure@1234' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens on successful login', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser);
      mockPrisma.loginAttempt.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });
      mockPrisma.session.update.mockResolvedValue({});
      mockRedis.sadd.mockResolvedValue(undefined);

      const result = await service.login({ email: 'test@test.com', password: 'Secure@1234' });
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.user['passwordHash']).toBeUndefined();
    });
  });

  // ── sanitizeUser ─────────────────────────────

  describe('sanitizeUser', () => {
    it('should remove passwordHash from user object', () => {
      const user = { id: '1', email: 'a@b.com', passwordHash: 'secret', role: 'USER' };
      const sanitized = service.sanitizeUser(user as any);
      expect(sanitized['passwordHash']).toBeUndefined();
      expect(sanitized['email']).toBe('a@b.com');
    });
  });
});
