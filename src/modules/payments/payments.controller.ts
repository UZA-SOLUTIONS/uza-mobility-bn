import {
  Body,
  Controller,
  Get,
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
import { CloudinaryService } from '../../common/uploads/cloudinary.service';
import { documentMulterOptions } from '../../common/uploads/multer.config';
import { parseMultipartPayload } from '../../common/uploads/parse-payload.util';
import { multipartPayloadSchema } from '../../common/uploads/swagger-multipart.util';
import { UploadFolder } from '../../common/uploads/upload.constants';
import { FilterPaymentsDto } from './dto/filter-payments.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth('JWT-access')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private requireUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  }

  @Post('submit')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payments:submit')
  @UseInterceptors(FilesInterceptor('proofs', 10, documentMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      proofs: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
        description: 'Payment proof images or PDFs',
      },
    }),
  })
  @ApiOperation({ summary: 'Submit payment proof for an invoice' })
  async submit(
    @Req() request: AuthenticatedRequest,
    @Body('payload') payload: string,
    @UploadedFiles() proofs?: Express.Multer.File[],
  ) {
    const dto = await parseMultipartPayload(SubmitPaymentDto, payload);
    const proofUrls = proofs?.length
      ? await Promise.all(
          proofs.map(async (file) => {
            const resourceType =
              file.mimetype === 'application/pdf' ? 'raw' : 'image';
            const asset = await this.cloudinary.uploadImage(
              file,
              UploadFolder.PAYMENTS,
              resourceType,
            );
            return asset.url;
          }),
        )
      : undefined;

    return this.paymentsService.submitPayment(
      this.requireUserId(request),
      { ...dto, proofUrls },
      getRequestAuditContext(request),
    );
  }

  @Get('my')
  @UseGuards(PermissionsGuard)
  @RequirePermission('payments:submit')
  @ApiOperation({ summary: 'My payment submissions' })
  findMine(
    @Req() request: AuthenticatedRequest,
    @Query() filters: FilterPaymentsDto,
  ) {
    return this.paymentsService.findMine(this.requireUserId(request), filters);
  }
}
