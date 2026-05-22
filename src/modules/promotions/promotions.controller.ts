import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SkipAudit } from '../../common/audit/decorators/skip-audit.decorator';
import { PromotionsService } from './promotions.service';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('active')
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'Active promotions (homepage / campaigns)' })
  findActive() {
    return this.promotionsService.findActivePublic();
  }

  @Get('banners')
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'Active homepage banner promotions' })
  banners() {
    return this.promotionsService.findActiveBanners();
  }
}
