import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ExchangeRateService } from './exchange-rate.service';

@ApiTags('exchange-rate')
@Controller('exchange-rate')
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Public USDT→RWF effective rate (API rate + markup)',
  })
  getRate() {
    return this.exchangeRateService.getSnapshot({ refreshIfStale: true });
  }
}
