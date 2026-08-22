import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { BankFileGeneratorService } from './bank-file-generator.service';

@ApiTags('bank-files')
@ApiBearerAuth('JWT-access')
@UseGuards(PermissionsGuard)
@Controller('bank-files')
export class BankFilesController {
  constructor(private readonly generator: BankFileGeneratorService) {}

  @Get('bottleneck')
  @RequirePermission('financing:read')
  @ApiOperation({
    summary: 'Where the pipeline is stuck',
    description:
      'Splits outstanding items by source. `uploaded` and `external` are somebody\u2019s job today; ' +
      '`generated` items that will not generate are a missing upstream fact, and chasing an officer ' +
      'for those wastes everyone\u2019s time.',
  })
  bottleneck() {
    return this.generator.bottleneck();
  }

  @Post('generate')
  @RequirePermission('financing:send-to-bank')
  @ApiOperation({
    summary: 'Generate every generatable item across all open files',
    description:
      'Idempotent. Items already present are untouched, and nothing that needs a human upload or an ' +
      'external fetch is ever marked present \u2014 pretending a national ID exists is worse than knowing it does not.',
  })
  generateAll() {
    return this.generator.generateForAll();
  }

  @Post(':ref/generate')
  @RequirePermission('financing:send-to-bank')
  @ApiOperation({ summary: 'Generate what can be generated for one file' })
  generateOne(@Param('ref') ref: string) {
    return this.generator.generateForFile(ref);
  }
}
