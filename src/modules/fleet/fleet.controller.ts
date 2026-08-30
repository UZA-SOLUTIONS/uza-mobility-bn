import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedRequest } from '../../users/users.types';
import { CreateFleetRequestDto } from './dto/create-fleet-request.dto';
import { FilterFleetRequestsDto } from './dto/filter-fleet.dto';
import { FleetService } from './fleet.service';

@ApiTags('fleet')
@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Post('request')
  @Public()
  @ApiOperation({
    summary: 'Submit fleet request (no login required)',
    description:
      'Uses your JWT user when logged in; otherwise stored without a user until you register or sign in with the same email.',
  })
  submit(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateFleetRequestDto,
  ) {
    return this.fleetService.submitRequest(dto, request.user?.sub);
  }

  @Get('my')
  @ApiBearerAuth('JWT-access')
  @ApiOperation({ summary: 'My fleet requests (authenticated)' })
  findMine(
    @Req() request: AuthenticatedRequest,
    @Query() filters: FilterFleetRequestsDto,
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.fleetService.findMine(userId, filters);
  }
}
