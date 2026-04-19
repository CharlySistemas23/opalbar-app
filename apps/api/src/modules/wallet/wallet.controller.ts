import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get() @ApiOperation({ summary: 'Get my wallet: points, level, next level' })
  getWallet(@CurrentUser() user: User) { return this.walletService.getWallet(user.id); }

  @Get('transactions') @ApiOperation({ summary: 'Get my points transaction history' })
  getTransactions(@CurrentUser() user: User, @Query() pagination: PaginationDto) {
    return this.walletService.getTransactions(user.id, pagination);
  }

  @Get('levels') @Public() @ApiOperation({ summary: 'Get all loyalty levels and benefits' })
  getLevels() { return this.walletService.getLoyaltyLevels(); }
}
