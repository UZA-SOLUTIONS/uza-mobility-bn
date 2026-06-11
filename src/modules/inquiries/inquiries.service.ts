import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InquiryStatus,
  ListingStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { generateReferenceNumber } from '../../common/utils/reference-number.util';
import { MailService } from '../../common/mail/mail.service';
import { escapeHtml } from '../../common/mail/email-template.util';
import { buildBrandedEmailHtml } from '../../common/mail/email-template.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { FilterInquiriesDto } from './dto/filter-inquiries.dto';
import { UpdateInquiryStatusDto } from './dto/update-inquiry-status.dto';
import {
  toAdminInquiry,
  toBuyerInquiry,
  type InquiryListingContext,
} from './inquiry.mapper';
import { QuotePdfService } from './quote-pdf.service';

const listingInclude = {
  listingPricing: true,
  evSpecs: true,
  seller: { select: { businessName: true, city: true, country: true } },
} as const;

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotePdfService: QuotePdfService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly configService: ConfigService,
  ) {}

  async submit(dto: CreateInquiryDto) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: dto.listingId,
        status: ListingStatus.PUBLISHED,
        deletedAt: null,
      },
      include: listingInclude,
    });

    if (!listing) {
      throw new NotFoundException('Published listing not found');
    }

    const email = dto.email.trim().toLowerCase();
    const quoteNumber = await generateReferenceNumber(this.prisma, 'UZM-QUO');

    const defaultMessage =
      dto.message?.trim() ||
      `Inquiry for ${listing.listingTitle} (ref ${listing.id.slice(-8).toUpperCase()})`;

    const inquiry = await this.prisma.inquiry.create({
      data: {
        quoteNumber,
        listingId: listing.id,
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
      pdfBuffer,
    );

    await this.notificationsService.sendToRoleNames(
      ['SALES_AGENT', 'SUPER_ADMIN', 'MARKETPLACE_ADMIN'],
      {
        type: NotificationType.SYSTEM_ALERT,
        title: 'New vehicle inquiry',
        body: `${inquiry.name} inquired about ${listing.listingTitle}. Quote ${quoteNumber}.`,
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
      message:
        'Your inquiry has been received. Check your email for your quote.',
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
    quotePdf: Buffer,
  ) {
    const appName =
      this.configService.get<string>('APP_NAME') ?? 'UZA Mobility';
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const company =
      await this.platformSettingsService.getCompanyPaymentDetails();
    const whatsappUrl = this.platformSettingsService.buildWhatsAppUrl(
      company.whatsappNumber,
      `Hello UZA Mobility, my quote reference is ${quoteNumber}`,
    );

    const priceUsd = listing.listingPricing?.finalPriceUsd;
    const deliveryDays = listing.deliveryEstimateDays;

    const html = buildBrandedEmailHtml({
      appName,
      recipientName: name.split(' ')[0] ?? name,
      headline: 'Your vehicle quote',
      bodyHtml: `
        <p style="margin: 0 0 16px">Thank you for your interest in <strong>${escapeHtml(listing.listingTitle)}</strong>.</p>
        <p style="margin: 0 0 16px">We received your inquiry and attached a reference quote (<strong>${escapeHtml(quoteNumber)}</strong>).</p>
        <ul style="margin: 0 0 16px; padding-left: 20px; color: #356769;">
          <li>Vehicle: ${escapeHtml(listing.listingTitle)}</li>
          <li>Price: ${priceUsd != null ? `USD ${priceUsd.toLocaleString('en-US')}` : 'On request'}</li>
          <li>Delivery estimate: ${deliveryDays != null ? `${deliveryDays} days` : 'Confirmed at reservation'}</li>
          <li>Seller type: ${escapeHtml(listing.sellerType.replace(/_/g, ' '))}</li>
        </ul>
        <p style="margin: 0 0 16px">Include quote number <strong>${escapeHtml(quoteNumber)}</strong> when you contact us. This vehicle is <strong>not reserved</strong> until payment is confirmed.</p>
        <p style="margin: 0">Reply to this email or message us on WhatsApp to proceed.</p>`,
      actionUrl: whatsappUrl,
      actionLabel: 'Chat on WhatsApp',
      infoBoxHtml:
        'Your quote PDF is attached. Create a free account to track inquiries and save vehicles.',
      tagline: 'Electric vehicle marketplace for Rwanda.',
      logoUrl: `${frontendUrl}/images/FInal-logo.png`,
      websiteUrl: frontendUrl,
      supportUrl: `${frontendUrl}/inquiry/success?email=${encodeURIComponent(email)}`,
    });

    await this.mailService.sendMail({
      to: email,
      subject: `Your vehicle quote from Uza Mobility — ${listing.listingTitle}`,
      html,
      text: `Thank you ${name}. Your quote ${quoteNumber} for ${listing.listingTitle} is attached. This vehicle is not reserved until payment is confirmed.`,
      bufferAttachments: [
        {
          filename: `${quoteNumber}.pdf`,
          content: quotePdf,
        },
      ],
    });
  }
}
