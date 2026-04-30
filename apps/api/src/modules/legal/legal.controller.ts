// ─────────────────────────────────────────────
//  Legal — sirve política de privacidad y términos como HTML público.
//  · Necesario para cumplir requisito de Google Play (Privacy Policy URL)
//  · Sin auth, content-type text/html, layout sobrio
//  · Las URLs públicas son:
//      https://opalbar-app-production.up.railway.app/api/v1/legal/privacy
//      https://opalbar-app-production.up.railway.app/api/v1/legal/terms
// ─────────────────────────────────────────────
import { Controller, Get, Header, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { PRIVACY_POLICY_HTML, TERMS_OF_SERVICE_HTML } from './legal.html';

@ApiTags('Legal')
@Controller('legal')
export class LegalController {
  @Get('privacy')
  @Public()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({ summary: 'Política de privacidad (HTML público)' })
  privacy(): string {
    return PRIVACY_POLICY_HTML;
  }

  @Get('terms')
  @Public()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({ summary: 'Términos de servicio (HTML público)' })
  terms(): string {
    return TERMS_OF_SERVICE_HTML;
  }
}
