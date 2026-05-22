import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SkipAudit } from '../../common/audit/decorators/skip-audit.decorator';
import { SustainabilityService } from './sustainability.service';

@ApiTags('sustainability')
@Controller('sustainability')
export class SustainabilityController {
  constructor(private readonly sustainabilityService: SustainabilityService) {}

  @Get('impact')
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'Public homepage impact counters' })
  impact() {
    return this.sustainabilityService.getPublicImpactCounters();
  }
}
