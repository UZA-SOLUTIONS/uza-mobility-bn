import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../users/users.types';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { FilterInquiriesDto } from './dto/filter-inquiries.dto';
import { InquiriesService } from './inquiries.service';

@ApiTags('inquiries')
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Submit a vehicle inquiry (no account required)' })
  submit(@Body() dto: CreateInquiryDto) {
    return this.inquiriesService.submit(dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-access')
  @ApiOperation({ summary: 'List inquiries linked to the signed-in buyer' })
  findMine(
    @Req() request: AuthenticatedRequest,
    @Query() filters: FilterInquiriesDto,
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.inquiriesService.findMine(userId, filters);
  }

  @Get(':id/quote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-access')
  @ApiOperation({ summary: 'Download quote PDF for an owned inquiry' })
  async quoteDocument(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    const { buffer, quoteNumber } =
      await this.inquiriesService.getQuoteDocument(id, userId);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${quoteNumber}.pdf"`,
    });
  }
}
