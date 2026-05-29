import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import type { AuthenticatedRequest } from '../../users/users.types';
import { ChargingStationsService } from './charging-stations.service';
import { CreateOperatorProfileDto } from './dto/create-operator-profile.dto';
import { UpdateOperatorProfileDto } from './dto/update-operator-profile.dto';

@ApiTags('charging-stations/operators')
@ApiBearerAuth('JWT-access')
@Controller('charging-stations/operators')
export class OperatorsController {
  constructor(private readonly stationsService: ChargingStationsService) {}

  private requireUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply as charging station operator' })
  apply(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateOperatorProfileDto,
  ) {
    const userId = this.requireUserId(request);
    return this.stationsService.applyOperator(
      userId,
      dto,
      getRequestAuditContext(request),
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'My operator profile' })
  me(@Req() request: AuthenticatedRequest) {
    return this.stationsService.getOperatorProfileByUser(
      this.requireUserId(request),
    );
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update my operator profile' })
  updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateOperatorProfileDto,
  ) {
    return this.stationsService.updateOperatorProfileByUser(
      this.requireUserId(request),
      dto,
      getRequestAuditContext(request),
    );
  }
}
