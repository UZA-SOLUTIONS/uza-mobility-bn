import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InquiryIntent,
  InquiryStatus,
  ListingStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { generateReferenceNumber } from '../../common/utils/reference-number.util';
import { MailService } from '../../common/mail/mail.service';
import { buildCommerceConfirmationEmail } from '../../common/mail/commerce-confirmation-email.util';
import { NotificationsService } from '../notifications/notifications.service';
import { ExchangeRateService } from '../platform-settings/exchange-rate.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { FilterInquiriesDto } from './dto/filter-inquiries.dto';
import { UpdateInquiryStatusDto } from './dto/update-inquiry-status.dto';
import {
  toAdminInquiry,
  toBuyerInquiry,
  inquiryListingInclude,
  type InquiryListingContext,
} from './inquiry.mapper';
import { QuotePdfService } from './quote-pdf.service';

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotePdfService: QuotePdfService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly configService: ConfigService,
  ) {}

  async submit(dto: CreateInquiryDto) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: dto.listingId,
        status: ListingStatus.PUBLISHED,
        deletedAt: null,
      },
      include: inquiryListingInclude,
    });

    if (!listing) {
      throw new NotFoundException('Published listing not found');
    }

    const email = dto.email.trim().toLowerCase();
    const quoteNumber = await generateReferenceNumber(this.prisma, 'UZM-QUO');

    const intent = dto.intent ?? InquiryIntent.BOOK;
    const defaultMessage =
      dto.message?.trim() ||
      `${intent === InquiryIntent.BUY ? 'Purchase' : 'Booking'} inquiry for ${listing.listingTitle} (ref ${listing.id.slice(-8).toUpperCase()})`;

    const inquiry = await this.prisma.inquiry.create({
      data: {
        quoteNumber,
        listingId: listing.id,
        intent,
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        email,
        country: dto.country.toUpperCase(),
        buyerType: dto.buyerType,
        message: defaultMessage,
        status: InquiryStatus.RECEIVED,
      },
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            listingTitle: true,
            brand: true,
            model: true,
            manufacturingYear: true,
          },
        },
      },
    });

    const { pdfBuffer } = await this.quotePdfService.generate(
      inquiry.id,
      quoteNumber,
      intent,
      listing as InquiryListingContext,
      {
        name: inquiry.name,
        email: inquiry.email,
        phone: inquiry.phone,
        country: inquiry.country,
        buyerType: inquiry.buyerType,
      },
    );

    await this.sendBuyerConfirmationEmail(
      inquiry.name,
      inquiry.email,
      listing,
      quoteNumber,
      intent,
      pdfBuffer,
    );

    const intentLabel = intent === InquiryIntent.BUY ? 'purchase' : 'booking';
    await this.notificationsService.sendToRoleNames(
      ['SALES_AGENT', 'SUPER_ADMIN', 'MARKETPLACE_ADMIN'],
      {
        type: NotificationType.SYSTEM_ALERT,
        title: `New vehicle ${intentLabel} inquiry`,
        body: `${inquiry.name} submitted a ${intentLabel} inquiry for ${listing.listingTitle}. Quote ${quoteNumber}.`,
        metadata: {
          inquiryId: inquiry.id,
          listingId: listing.id,
          quoteNumber,
        },
      },
    );

    return {
      id: inquiry.id,
      quoteNumber: inquiry.quoteNumber,
      email: inquiry.email,
      listingSlug: listing.slug,
      intent,
      message:
        intent === InquiryIntent.BUY
          ? 'Your purchase request has been received. Check your email for price and payment details.'
          : 'Your booking request has been received. Check your email for your quote and booking fee.',
    };
  }

  async findMine(userId: string, filters: FilterInquiriesDto = {}) {
    return this.findPaginated({ userId }, filters, false);
  }

  async adminFindAll(filters: FilterInquiriesDto) {
    return this.findPaginated({}, filters, true);
  }

  async adminFindOne(id: string) {
    const row = await this.prisma.inquiry.findUnique({
      where: { id },
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            listingTitle: true,
            brand: true,
            model: true,
            manufacturingYear: true,
          },
        },
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!row) {
      throw new NotFoundException('Inquiry not found');
    }

    return toAdminInquiry(row);
  }

  async adminUpdateStatus(
    id: string,
    dto: UpdateInquiryStatusDto,
    adminId: string,
  ) {
    const existing = await this.prisma.inquiry.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Inquiry not found');
    }

    const updated = await this.prisma.inquiry.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.internalNotes !== undefined
          ? { internalNotes: dto.internalNotes }
          : {}),
      },
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            listingTitle: true,
            brand: true,
            model: true,
            manufacturingYear: true,
          },
        },
      },
    });

    if (existing.userId) {
      await this.notificationsService.send({
        userId: existing.userId,
        type: NotificationType.SYSTEM_ALERT,
        title: 'Inquiry update',
        body: `Your inquiry ${existing.quoteNumber} is now ${dto.status.toLowerCase().replace(/_/g, ' ')}.`,
        metadata: { inquiryId: id, status: dto.status },
      });
    }

    void adminId;
    return toAdminInquiry(updated);
  }

  async getQuoteDocument(inquiryId: string, userId?: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }

    if (userId && inquiry.userId !== userId) {
      throw new ForbiddenException('You do not have access to this quote');
    }

    const buffer = await this.quotePdfService.readPdfBuffer(
      inquiry.quotePdfUrl,
    );
    if (!buffer) {
      throw new NotFoundException('Quote document not found');
    }

    return { buffer, quoteNumber: inquiry.quoteNumber };
  }

  async linkInquiriesToUser(userId: string, email: string) {
    await this.prisma.inquiry.updateMany({
      where: { email: email.trim().toLowerCase(), userId: null },
      data: { userId },
    });
  }

  private async findPaginated(
    baseWhere: Prisma.InquiryWhereInput,
    filters: FilterInquiriesDto,
    includeInternalNotes: boolean,
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.InquiryWhereInput = { ...baseWhere };

    if (filters.status) where.status = filters.status;
    if (filters.country) where.country = filters.country.toUpperCase();
    if (filters.buyerType) where.buyerType = filters.buyerType;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const [rows, total] = await Promise.all([
      this.prisma.inquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          listing: {
            select: {
              id: true,
              slug: true,
              listingTitle: true,
              brand: true,
              model: true,
              manufacturingYear: true,
            },
          },
        },
      }),
      this.prisma.inquiry.count({ where }),
    ]);

    return {
      items: rows.map((row) =>
        includeInternalNotes ? toAdminInquiry(row) : toBuyerInquiry(row),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private async sendBuyerConfirmationEmail(
    name: string,
    email: string,
    listing: InquiryListingContext,
    quoteNumber: string,
    intent: InquiryIntent,
    quotePdf: Buffer,
  ) {
    const appName =
      this.configService.get<string>('APP_NAME') ?? 'UZA Mobility';
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const [company, bookingFeeUsd, exchangeRate] = await Promise.all([
      this.platformSettingsService.getCompanyPaymentDetails(),
      this.platformSettingsService.getBookingFeeUsd(),
      this.exchangeRateService.getSnapshot({ refreshIfStale: false }),
    ]);
    const whatsappUrl = this.platformSettingsService.buildWhatsAppUrl(
      company.whatsappNumber,
      `Hello UZA Mobility, my ${intent === InquiryIntent.BUY ? 'purchase' : 'booking'} reference is ${quoteNumber}`,
    );

    const registerParams = new URLSearchParams({ email });
    const nameParts = name.trim().split(/\s+/).filter(Boolean);
    if (nameParts[0]) registerParams.set('firstName', nameParts[0]);
    if (nameParts.length > 1) {
      registerParams.set('lastName', nameParts.slice(1).join(' '));
    }
    if (intent === InquiryIntent.BUY) {
      registerParams.set(
        'callbackUrl',
        `/my/invoices?listingId=${listing.id}&slug=${listing.slug}&request=1`,
      );
    } else {
      registerParams.set('callbackUrl', `/vehicles/${listing.slug}`);
    }

    const { subject, html, text } = buildCommerceConfirmationEmail({
      appName,
      frontendUrl,
      recipientName: name,
      listing,
      referenceNumber: quoteNumber,
      intent,
      company,
      bookingFeeUsd,
      usdToRwfEffective: exchangeRate.usdToRwfEffective,
      whatsappUrl,
      accountActionUrl: `${frontendUrl}/register?${registerParams.toString()}`,
      accountActionLabel: 'Create your account',
      footerReason: `You are receiving this email because you submitted a vehicle ${intent === InquiryIntent.BUY ? 'purchase' : 'booking'} inquiry on ${appName}.`,
    });

    await this.mailService.sendMail({
      to: email,
      subject,
      html,
      text,
      bufferAttachments: [
        {
          filename: `${quoteNumber}.pdf`,
          content: quotePdf,
        },
      ],
    });
  }
}
