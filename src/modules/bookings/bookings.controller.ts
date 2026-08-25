import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedRequest } from '../../users/users.types';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { StorageService } from '../../common/uploads/storage.service';
import { documentMulterOptions } from '../../common/uploads/multer.config';
import { parseMultipartPayload } from '../../common/uploads/parse-payload.util';
import { multipartPayloadSchema } from '../../common/uploads/swagger-multipart.util';
import { UploadFolder } from '../../common/uploads/upload.constants';
import { BookingsService } from './bookings.service';
import { FilterBookingsDto } from './dto/filter-bookings.dto';
import { RequestVehicleBookingDto } from './dto/request-vehicle-booking.dto';
import { SubmitBookingPaymentDto } from './dto/submit-booking-payment.dto';

@ApiTags('bookings')
@ApiBearerAuth('JWT-access')
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly storage: StorageService,
  ) {}

  private requireUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  }

  @Get('fee')
  @ApiOperation({
    summary: 'Public booking fee (Rwf) for China-sourced vehicles',
  })
  async getFee() {
    const bookingFeeRwf = await this.bookingsService.getBookingFeeRwf();
    return { bookingFeeRwf, currency: 'RWF' as const };
  }

  @Post('request')
  @UseGuards(PermissionsGuard)
  @RequirePermission('bookings:create')
  @ApiOperation({ summary: 'Book a China-sourced vehicle with a deposit fee' })
  request(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RequestVehicleBookingDto,
  ) {
    return this.bookingsService.requestBooking(
      this.requireUserId(request),
      dto,
      getRequestAuditContext(request),
    );
  }

  @Post(':id/payment')
  @UseGuards(PermissionsGuard)
  @RequirePermission('bookings:create')
  @UseInterceptors(FilesInterceptor('proofs', 10, documentMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      proofs: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
      },
    }),
  })
  @ApiOperation({ summary: 'Submit booking fee payment proof' })
  async submitPayment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('payload') payload: string,
    @UploadedFiles() proofs?: Express.Multer.File[],
  ) {
    const dto = await parseMultipartPayload(SubmitBookingPaymentDto, payload);
    const proofUrls = proofs?.length
      ? await Promise.all(
          proofs.map(async (file) => {
            const resourceType =
              file.mimetype === 'application/pdf' ? 'raw' : 'image';
            const asset = await this.storage.uploadImage(
              file,
              UploadFolder.PAYMENTS,
              resourceType,
            );
            return asset.url;
          }),
        )
      : [];

    return this.bookingsService.submitPayment(
      this.requireUserId(request),
      id,
      dto,
      proofUrls,
      getRequestAuditContext(request),
    );
  }

  @Patch(':id/cancel')
  @UseGuards(PermissionsGuard)
  @RequirePermission('bookings:create')
  @ApiOperation({
    summary: 'Cancel my booking before payment proof is submitted',
  })
  cancelMine(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.bookingsService.cancelBookingByBuyer(
      this.requireUserId(request),
      id,
      getRequestAuditContext(request),
    );
  }

  @Get('my')
  @UseGuards(PermissionsGuard)
  @RequirePermission('bookings:read')
  @ApiOperation({ summary: 'List my vehicle bookings' })
  findMine(
    @Req() request: AuthenticatedRequest,
    @Query() filters: FilterBookingsDto,
  ) {
    return this.bookingsService.findMine(this.requireUserId(request), filters);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('bookings:read')
  @ApiOperation({ summary: 'Booking detail (owner)' })
  findOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.bookingsService.findByIdForUser(
      this.requireUserId(request),
      id,
    );
  }
}
