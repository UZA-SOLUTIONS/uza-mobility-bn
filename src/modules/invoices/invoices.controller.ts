import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedRequest } from '../../users/users.types';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';
import { RequestInvoiceDto } from './dto/request-invoice.dto';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth('JWT-access')
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  private requireUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  }

  @Post('request')
  @UseGuards(PermissionsGuard)
  @RequirePermission('invoices:create')
  @ApiOperation({ summary: 'Request proforma invoice for a published listing' })
  request(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RequestInvoiceDto,
  ) {
    return this.invoicesService.requestInvoice(
      this.requireUserId(request),
      dto,
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        actorEmail: request.user?.email,
      },
    );
  }

  @Get('my')
  @UseGuards(PermissionsGuard)
  @RequirePermission('invoices:create')
  @ApiOperation({ summary: 'List my invoices' })
  findMine(
    @Req() request: AuthenticatedRequest,
    @Query() filters: FilterInvoicesDto,
  ) {
    return this.invoicesService.findMine(this.requireUserId(request), filters);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('invoices:create')
  @ApiOperation({ summary: 'Invoice detail (owner)' })
  findOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.invoicesService.findByIdForUser(
      this.requireUserId(request),
      id,
      false,
    );
  }

  @Get(':id/document')
  @UseGuards(PermissionsGuard)
  @RequirePermission('invoices:create')
  @ApiOperation({ summary: 'Download invoice HTML document' })
  @Header('Content-Type', 'text/html; charset=utf-8')
  async document(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<string> {
    await this.invoicesService.findByIdForUser(
      this.requireUserId(request),
      id,
      false,
    );

    const html = await this.invoicePdfService.readHtml(id);
    if (!html) {
      throw new NotFoundException('Invoice document not found');
    }

    return html;
  }
}
