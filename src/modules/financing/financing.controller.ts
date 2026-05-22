import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import type { AuthenticatedRequest } from '../../users/users.types';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateFinancingRequestDto } from './dto/create-financing-request.dto';
import { FinancingService } from './financing.service';

@ApiTags('financing')
@ApiBearerAuth('JWT-access')
@Controller('financing')
export class FinancingController {
  constructor(private readonly financingService: FinancingService) {}

  private requireUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.sub;
    if (!userId) throw new UnauthorizedException();
    return userId;
  }

  @Post('request')
  @UseGuards(PermissionsGuard)
  @RequirePermission('financing:submit')
  @ApiOperation({
    summary: 'Request financing facilitation support (not a loan application)',
  })
  submit(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateFinancingRequestDto,
  ) {
    return this.financingService.submitRequest(
      this.requireUserId(request),
      dto,
      getRequestAuditContext(request),
    );
  }

  @Get('my')
  @UseGuards(PermissionsGuard)
  @RequirePermission('financing:submit')
  @ApiOperation({ summary: 'My financing support requests' })
  findMine(@Req() request: AuthenticatedRequest) {
    return this.financingService.findMine(this.requireUserId(request));
  }
}
