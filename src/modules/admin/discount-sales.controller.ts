import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { SkipAudit } from '../../common/audit/decorators/skip-audit.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DiscountSalesPdfService } from './discount-sales-pdf.service';
import { DiscountSalesService } from './discount-sales.service';
import { FilterDiscountSalesDto } from './dto/filter-discount-sales.dto';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/reports/discount-sales')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles('FINANCE_ADMIN', 'MARKETPLACE_ADMIN', 'SUPER_ADMIN')
@RequirePermission('invoices:read')
export class DiscountSalesController {
  constructor(
    private readonly discountSalesService: DiscountSalesService,
    private readonly discountSalesPdfService: DiscountSalesPdfService,
  ) {}

  @Get()
  @SkipAudit()
  @ApiOperation({
    summary: 'List confirmed vehicle sales that included a discount',
  })
  findAll(@Query() filters: FilterDiscountSalesDto) {
    return this.discountSalesService.findAll(filters);
  }

  @Get('export')
  @SkipAudit()
  @ApiOperation({ summary: 'Export discount sales report as PDF' })
  @ApiProduces('application/pdf')
  async exportPdf(
    @Query() filters: FilterDiscountSalesDto,
    @Res() res: Response,
  ) {
    const { items, summary } =
      await this.discountSalesService.findAllForExport(filters);
    const pdf = await this.discountSalesPdfService.render(items, summary, {
      from: filters.from,
      to: filters.to,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="uza-discount-sales-${stamp}.pdf"`,
    );
    res.send(pdf);
  }
}
