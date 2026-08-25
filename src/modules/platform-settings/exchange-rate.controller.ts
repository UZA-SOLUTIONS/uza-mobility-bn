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
    summary: 'Frozen USDT→RWF rate for leftover USD listing display',
  })
  getRate() {
    return this.exchangeRateService.getSnapshot();
  }
}
