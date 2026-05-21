import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import type { AuthenticatedRequest } from '../../users/users.types';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateFleetInvoiceDto } from './dto/create-fleet-invoice.dto';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesService } from './invoices.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/invoices')
export class AdminInvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  private requireAdmin(
    request: AuthenticatedRequest,
    handler: (
      adminId: string,
      ctx: ReturnType<typeof getRequestAuditContext>,
    ) => unknown,
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return handler(userId, getRequestAuditContext(request));
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('invoices:read')
  @ApiOperation({ summary: 'List all invoices (finance admin)' })
  findAll(@Query() filters: FilterInvoicesDto) {
    return this.invoicesService.adminFindAll(filters);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('invoices:read')
  @ApiOperation({ summary: 'Invoice detail (admin)' })
  findOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.invoicesService.findByIdForUser(userId, id, true);
  }

  @Get(':id/document')
  @UseGuards(PermissionsGuard)
  @RequirePermission('invoices:read')
  @ApiOperation({ summary: 'Download invoice HTML document (admin)' })
  @Header('Content-Type', 'text/html; charset=utf-8')
  async document(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<string> {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    await this.invoicesService.findByIdForUser(userId, id, true);
    const html = await this.invoicePdfService.readHtml(id);
    if (!html) {
      throw new NotFoundException('Invoice document not found');
    }
    return html;
  }

  @Patch(':id/cancel')
  @UseGuards(PermissionsGuard)
  @RequirePermission('invoices:cancel')
  @ApiOperation({ summary: 'Cancel invoice and release listing reservation' })
  cancel(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.invoicesService.cancelInvoice(adminId, id, ctx),
    );
  }

  @Post('fleet')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('FLEET_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('invoices:send')
  @ApiOperation({ summary: 'Create fleet invoice manually' })
  createFleet(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateFleetInvoiceDto,
  ) {
    return this.requireAdmin(request, (adminId, ctx) =>
      this.invoicesService.createFleetInvoice(adminId, dto, ctx),
    );
  }
}
