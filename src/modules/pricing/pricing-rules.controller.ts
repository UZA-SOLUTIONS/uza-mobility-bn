import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';
import { PricingService } from './pricing.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/pricing-rules')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class PricingRulesController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  @ApiOperation({ summary: 'List all pricing rules' })
  findAll() {
    return this.pricingService.findAllRules();
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Preview price breakdown for inputs' })
  calculate(@Body() dto: CalculatePriceDto) {
    return this.pricingService.calculateFromDto(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create pricing rule' })
  create(@Body() dto: CreatePricingRuleDto) {
    return this.pricingService.createRule(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update pricing rule' })
  update(@Param('id') id: string, @Body() dto: UpdatePricingRuleDto) {
    return this.pricingService.updateRule(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate pricing rule' })
  deactivate(@Param('id') id: string) {
    return this.pricingService.deactivateRule(id);
  }
}
