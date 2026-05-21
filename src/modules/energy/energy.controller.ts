import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CreateEnergyRequestDto } from './dto/create-energy-request.dto';
import { EnergyService } from './energy.service';

@ApiTags('energy')
@Controller('energy')
export class EnergyController {
  constructor(private readonly energyService: EnergyService) {}

  @Get('products')
  @Public()
  @ApiOperation({ summary: 'Browse active charging products' })
  browseProducts() {
    return this.energyService.browseProducts();
  }

  @Get('products/:id')
  @Public()
  @ApiOperation({ summary: 'Charging product detail' })
  findProduct(@Param('id') id: string) {
    return this.energyService.findProductById(id);
  }

  @Post('request')
  @Public()
  @ApiOperation({
    summary: 'Submit energy/charging quote request (no login required)',
  })
  submitRequest(@Body() dto: CreateEnergyRequestDto) {
    return this.energyService.submitRequest(dto);
  }
}
