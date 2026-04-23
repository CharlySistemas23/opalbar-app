// ─────────────────────────────────────────────
//  OtpService — genera, envía y verifica OTPs
//  Canal email → Nodemailer | Canal SMS → Twilio
// ─────────────────────────────────────────────
import {
  BadRequestException,
  Injectable,
  Logger,
  TooManyRequestsException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpType } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('email.host'),
      port: config.get<number>('email.port'),
      secure: config.get<boolean>('email.secure'),
      auth: {
        user: config.get<string>('email.user'),
        pass: config.get<string>('email.pass'),
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    this.transporter.verify().then(
      () => this.logger.log(`[SMTP] SMTP connected (${config.get<string>('email.user')})`),
      (err) => this.logger.error(`[SMTP] Connection failed: ${err?.message ?? err}`),
    );
  }

  // ─────────────────────────────────────────
  //  SEND OTP
  // ─────────────────────────────────────────

  async sendOtp(dto: SendOtpDto): Promise<{ message: string; expiresIn: number }> {
    const identifier = dto.email || dto.phone;
    if (!identifier) {
      throw new BadRequestException('Email or phone is required');
    }

    const isEmail = !!dto.email;

    // Rate limit check
    const attemptsKey = RedisService.otpAttemptsKey(identifier, dto.type);
    const attempts = await this.redis.incr(attemptsKey);

    if (attempts === 1) {
      await this.redis.expire(attemptsKey, 300);
    }

    const maxAttempts = this.config.get<number>('otp.maxAttempts', 5);
    if (attempts > maxAttempts) {
      throw new TooManyRequestsException(
        `Too many OTP requests. Please wait before requesting a new code.`,
      );
    }

    const expiresMinutes = this.config.get<number>('otp.expiresMinutes', 10);

    if (isEmail) {
      // EMAIL: generate locally, persist in DB/Redis, send via SMTP
      const otpLength = this.config.get<number>('otp.length', 6);
      const code = this.generateCode(otpLength);
      const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

      await this.prisma.otp.updateMany({
        where: { identifier, type: dto.type, verified: false },
        data: { verified: true },
      });

      await this.prisma.otp.create({
        data: { identifier, code, type: dto.type, expiresAt },
      });

      const otpKey = RedisService.otpKey(identifier, dto.type);
      await this.redis.setJson(
        otpKey,
        { code, expiresAt: expiresAt.toISOString() },
        expiresMinutes * 60,
      );

      await this.sendEmailOtp(dto.email!, code, dto.type, expiresMinutes);

      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(`[DEV] OTP code for ${identifier}: ${code}`);
      }
    } else {
      // PHONE: delegate generation + storage to Twilio Verify
      await this.sendSmsOtpViaVerify(dto.phone!, dto.type);
    }

    this.logger.log(`OTP sent to ${identifier} (type: ${dto.type})`);

    return {
      message: isEmail
        ? `Verification code sent to ${this.maskEmail(dto.email!)}`
        : `Verification code sent to ${this.maskPhone(dto.phone!)}`,
      expiresIn: expiresMinutes * 60,
    };
  }

  // ─────────────────────────────────────────
  //  VERIFY OTP
  // ─────────────────────────────────────────

  async verifyOtp(dto: VerifyOtpDto): Promise<boolean> {
    const isEmail = dto.identifier.includes('@');

    if (isEmail) {
      const otpKey = RedisService.otpKey(dto.identifier, dto.type);

      // Try Redis first (fast path)
      const cached = await this.redis.getJson<{ code: string; expiresAt: string }>(otpKey);
      if (cached) {
        if (new Date(cached.expiresAt) < new Date()) {
          await this.redis.del(otpKey);
          throw new BadRequestException('OTP has expired. Please request a new code.');
        }
        if (cached.code !== dto.code) {
          throw new BadRequestException('Invalid OTP code');
        }
        await this.redis.del(otpKey);
      } else {
        const otp = await this.prisma.otp.findFirst({
          where: {
            identifier: dto.identifier,
            type: dto.type,
            verified: false,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!otp) {
          throw new BadRequestException('OTP not found or expired. Please request a new code.');
        }

        if (otp.attempts >= this.config.get<number>('otp.maxAttempts', 5)) {
          throw new TooManyRequestsException('Too many failed attempts. Please request a new code.');
        }

        if (otp.code !== dto.code) {
          await this.prisma.otp.update({
            where: { id: otp.id },
            data: { attempts: { increment: 1 } },
          });
          throw new BadRequestException('Invalid OTP code');
        }

        await this.prisma.otp.update({
          where: { id: otp.id },
          data: { verified: true },
        });
      }
    } else {
      // Phone: delegate verification to Twilio Verify
      await this.checkSmsOtpViaVerify(dto.identifier, dto.code);
    }

    // Clear rate limit
    const attemptsKey = RedisService.otpAttemptsKey(dto.identifier, dto.type);
    await this.redis.del(attemptsKey);

    // If email verification — mark user as verified
    if (dto.type === OtpType.EMAIL_VERIFICATION) {
      await this.prisma.user.updateMany({
        where: { email: dto.identifier, status: 'PENDING_VERIFICATION' },
        data: { status: 'ACTIVE', isVerified: true },
      });
    } else if (dto.type === OtpType.PHONE_VERIFICATION) {
      await this.prisma.user.updateMany({
        where: { phone: dto.identifier, status: 'PENDING_VERIFICATION' },
        data: { status: 'ACTIVE', isVerified: true },
      });
    }

    this.logger.log(`OTP verified for ${dto.identifier} (type: ${dto.type})`);
    return true;
  }

  // ─────────────────────────────────────────
  //  EMAIL SENDER
  // ─────────────────────────────────────────

  private async sendEmailOtp(
    email: string,
    code: string,
    type: OtpType,
    expiresMinutes: number,
  ): Promise<void> {
    const subject = this.getEmailSubject(type);
    const html = this.buildEmailHtml(code, type, expiresMinutes);
    const text = this.buildEmailText(code, type, expiresMinutes);
    const fromAddr = this.config.get<string>('email.user');

    try {
      const info = await this.transporter.sendMail({
        from: this.config.get<string>('email.from'),
        to: email,
        replyTo: fromAddr,
        subject,
        html,
        text,
        headers: {
          'X-Entity-Ref-ID': `otp-${Date.now()}`,
          'List-Unsubscribe': `<mailto:${fromAddr}?subject=unsubscribe>`,
        },
      });
      this.logger.log(`[OTP] Sent to ${email} - messageId=${info.messageId}`);
    } catch (error: any) {
      this.logger.error(`[OTP] Failed to send to ${email}: ${error?.message ?? error}`);
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(`[DEV] Fallback — OTP for ${email}: ${code}`);
      }
    }
  }

  private buildEmailText(code: string, type: OtpType, expiresMinutes: number): string {
    const purpose = this.getEmailSubject(type).replace('OPALBAR — ', '');
    return [
      `OPALBAR`,
      ``,
      `${purpose}`,
      ``,
      `Tu código de verificación es: ${code}`,
      ``,
      `Expira en ${expiresMinutes} minutos.`,
      ``,
      `Si no solicitaste este código, ignora este correo. Nunca lo compartas con nadie.`,
      ``,
      `— Equipo OPALBAR`,
    ].join('\n');
  }

  // ─────────────────────────────────────────
  //  SMS SENDER (Twilio Verify)
  // ─────────────────────────────────────────

  private async getTwilioClient() {
    const accountSid = this.config.get<string>('twilio.accountSid');
    const authToken = this.config.get<string>('twilio.authToken');
    const serviceSid = this.config.get<string>('twilio.verifyServiceSid');

    if (!accountSid || !authToken || !serviceSid) {
      return null;
    }

    const twilio = await import('twilio');
    return {
      client: twilio.default(accountSid, authToken),
      serviceSid,
    };
  }

  private async sendSmsOtpViaVerify(phone: string, type: OtpType): Promise<void> {
    const twilio = await this.getTwilioClient();
    if (!twilio) {
      this.logger.warn('Twilio Verify not configured — SMS not sent');
      if (process.env.NODE_ENV !== 'production') {
        throw new BadRequestException(
          'SMS OTP no está configurado. Configura TWILIO_VERIFY_SERVICE_SID.',
        );
      }
      return;
    }

    const locale = this.config.get<string>('twilio.verifyLocale', 'es');

    try {
      await twilio.client.verify.v2
        .services(twilio.serviceSid)
        .verifications.create({
          to: phone,
          channel: 'sms',
          locale,
        });
      this.logger.log(`[Verify] SMS OTP sent to ${phone} (type: ${type})`);
    } catch (error: any) {
      this.logger.error(
        `[Verify] Failed to send SMS OTP to ${phone}: ${error?.message ?? error}`,
      );
      throw new BadRequestException(
        error?.message || 'No se pudo enviar el código SMS. Intenta de nuevo.',
      );
    }
  }

  private async checkSmsOtpViaVerify(phone: string, code: string): Promise<void> {
    const twilio = await this.getTwilioClient();
    if (!twilio) {
      throw new BadRequestException('SMS OTP no está configurado.');
    }

    try {
      const result = await twilio.client.verify.v2
        .services(twilio.serviceSid)
        .verificationChecks.create({ to: phone, code });

      if (result.status !== 'approved') {
        throw new BadRequestException('Invalid OTP code');
      }
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      // Twilio 404 = no pending verification (expired or never sent)
      if (error?.status === 404) {
        throw new BadRequestException(
          'OTP not found or expired. Please request a new code.',
        );
      }
      this.logger.error(
        `[Verify] Check failed for ${phone}: ${error?.message ?? error}`,
      );
      throw new BadRequestException(error?.message || 'Invalid OTP code');
    }
  }

  // ─────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────

  private generateCode(length: number): string {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += digits[Math.floor(Math.random() * digits.length)];
    }
    return code;
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    const masked = local.slice(0, 2) + '***';
    return `${masked}@${domain}`;
  }

  private maskPhone(phone: string): string {
    return phone.slice(0, 4) + '****' + phone.slice(-3);
  }

  private getEmailSubject(type: OtpType): string {
    const subjects: Record<OtpType, string> = {
      EMAIL_VERIFICATION: 'OPALBAR — Verifica tu correo electrónico',
      PHONE_VERIFICATION: 'OPALBAR — Verifica tu número de teléfono',
      PASSWORD_RESET: 'OPALBAR — Recupera tu contraseña',
      LOGIN_2FA: 'OPALBAR — Código de verificación',
      CHANGE_EMAIL: 'OPALBAR — Confirma tu nuevo correo',
      CHANGE_PHONE: 'OPALBAR — Confirma tu nuevo número',
    };
    return subjects[type];
  }

  private buildEmailHtml(code: string, type: OtpType, expiresMinutes: number): string {
    const descriptions: Record<OtpType, string> = {
      EMAIL_VERIFICATION: 'para verificar tu dirección de correo electrónico',
      PHONE_VERIFICATION: 'para verificar tu número de teléfono',
      PASSWORD_RESET: 'para restablecer tu contraseña',
      LOGIN_2FA: 'para confirmar tu inicio de sesión',
      CHANGE_EMAIL: 'para confirmar tu nuevo correo electrónico',
      CHANGE_PHONE: 'para confirmar tu nuevo número de teléfono',
    };

    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>OPALBAR</title></head>
<body style="margin:0;padding:0;background:#0D0D0F;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#17171B;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#F4A340;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#0D0D0F;font-size:24px;font-weight:700;">OPALBAR</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px;text-align:center;">
              <p style="color:#B4B4BB;font-size:16px;margin:0 0 24px;">
                Usa este código ${descriptions[type]}:
              </p>
              <div style="background:#0D0D0F;border-radius:12px;padding:24px;margin:0 0 24px;">
                <span style="color:#F4A340;font-size:42px;font-weight:700;letter-spacing:12px;">
                  ${code}
                </span>
              </div>
              <p style="color:#B4B4BB;font-size:14px;margin:0 0 8px;">
                Este código expira en <strong style="color:#F4F4F5;">${expiresMinutes} minutos</strong>.
              </p>
              <p style="color:#B4B4BB;font-size:13px;margin:0;">
                Si no solicitaste este código, ignora este mensaje.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;border-top:1px solid #2A2A30;text-align:center;">
              <p style="color:#B4B4BB;font-size:12px;margin:0;">
                © ${new Date().getFullYear()} OPALBAR · Siempre hay algo pasando.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

}
