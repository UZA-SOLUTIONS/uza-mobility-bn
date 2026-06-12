import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BuyerType,
  FleetRequestStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { MailService } from '../../common/mail/mail.service';
import {
  buildBrandedEmailHtml,
  escapeHtml,
} from '../../common/mail/email-template.util';
import { generateReferenceNumber } from '../../common/utils/reference-number.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AddAssociationMemberDto } from './dto/add-association-member.dto';
import { CreateAssociationDto } from './dto/create-association.dto';
import { CreateFleetRequestDto } from './dto/create-fleet-request.dto';
import { FilterFleetRequestsDto } from './dto/filter-fleet.dto';
import { UpdateFleetRequestStatusDto } from './dto/update-fleet-request.dto';
import { FleetRequestPdfService } from './fleet-request-pdf.service';
import { canFleetTransition } from './fleet-transitions';

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly fleetRequestPdfService: FleetRequestPdfService,
    private readonly mailService: MailService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly configService: ConfigService,
  ) {}

  async submitRequest(dto: CreateFleetRequestDto, userId?: string) {
    const email = dto.email.trim().toLowerCase();
    const buyerType = dto.buyerType ?? BuyerType.BUSINESS;
    const referenceNumber = await generateReferenceNumber(
      this.prisma,
      'UZM-FLT',
    );

    const [vehicleCategory, vehicleSubcategory] = await Promise.all([
      dto.vehicleCategoryId
        ? this.prisma.category.findUnique({
            where: { id: dto.vehicleCategoryId },
            select: { name: true },
          })
        : Promise.resolve(null),
      dto.vehicleSubcategoryId
        ? this.prisma.subcategory.findUnique({
            where: { id: dto.vehicleSubcategoryId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);

    const request = await this.prisma.fleetRequest.create({
      data: {
        referenceNumber,
        userId: userId ?? null,
        organizationName: dto.organizationName.trim(),
        contactPerson: dto.contactPerson.trim(),
        phone: dto.phone.trim(),
        email,
        buyerType,
        vehicleCategoryId: dto.vehicleCategoryId,
        vehicleSubcategoryId: dto.vehicleSubcategoryId,
        quantity: dto.quantity,
        useCase: dto.useCase,
        preferredDeliveryTimeline: dto.preferredDeliveryTimeline,
        budgetRangeMin: dto.budgetRangeMin,
        budgetRangeMax: dto.budgetRangeMax,
        financingRequested: dto.financingRequested ?? false,
        chargingSupportRequested: dto.chargingSupportRequested ?? false,
        associationId: dto.associationId,
        notes: dto.notes?.trim(),
        status: FleetRequestStatus.SUBMITTED,
      },
    });

    const { summaryPdfUrl, pdfBuffer } =
      await this.fleetRequestPdfService.generate({
        referenceNumber,
        organizationName: request.organizationName,
        contactPerson: request.contactPerson,
        email: request.email,
        phone: request.phone,
        buyerType: request.buyerType,
        quantity: request.quantity,
        vehicleCategoryName: vehicleCategory?.name,
        vehicleSubcategoryName: vehicleSubcategory?.name,
        useCase: request.useCase,
        notes: request.notes,
      });

    await this.prisma.fleetRequest.update({
      where: { id: request.id },
      data: { summaryPdfUrl },
    });

    await this.sendRequesterConfirmationEmail(
      request.contactPerson,
      email,
      request.organizationName,
      referenceNumber,
      request.quantity,
      vehicleCategory?.name,
      pdfBuffer,
    );

    await this.notificationsService.sendToRoleNames(
      ['FLEET_ADMIN', 'SUPER_ADMIN'],
      {
        type: NotificationType.FLEET_REQUEST_UPDATE,
        title: 'New fleet request',
        body: `${dto.organizationName} requested ${dto.quantity} vehicle(s).`,
        metadata: { fleetRequestId: request.id, referenceNumber },
      },
    );

    return {
      ...this.toPublicFleetRequest({ ...request, summaryPdfUrl }),
      referenceNumber,
      email,
    };
  }

  async findMine(userId: string, filters: FilterFleetRequestsDto) {
    return this.findPaginated({ userId }, filters, true);
  }

  async adminFindAll(filters: FilterFleetRequestsDto) {
    return this.findPaginated({}, filters, false);
  }

  async adminFindById(id: string) {
    const request = await this.prisma.fleetRequest.findUnique({
      where: { id },
      include: {
        association: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Fleet request not found');
    }

    const [vehicleCategory, vehicleSubcategory] = await Promise.all([
      request.vehicleCategoryId
        ? this.prisma.category.findUnique({
            where: { id: request.vehicleCategoryId },
            select: { id: true, name: true, slug: true },
          })
        : Promise.resolve(null),
      request.vehicleSubcategoryId
        ? this.prisma.category.findUnique({
            where: { id: request.vehicleSubcategoryId },
            select: { id: true, name: true, slug: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      ...request,
      vehicleCategory,
      vehicleSubcategory,
    };
  }

  async updateStatus(
    id: string,
    dto: UpdateFleetRequestStatusDto,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const request = await this.prisma.fleetRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Fleet request not found');
    }

    if (!canFleetTransition(request.status, dto.status)) {
      throw new BadRequestException(
        `Cannot transition fleet request from ${request.status} to ${dto.status}`,
      );
    }

    const updated = await this.prisma.fleetRequest.update({
      where: { id },
      data: {
        status: dto.status,
        adminNotes: dto.adminNotes,
        quotedAt:
          dto.status === FleetRequestStatus.QUOTED
            ? new Date()
            : request.quotedAt,
      },
    });

    if (request.userId) {
      await this.notificationsService.send({
        userId: request.userId,
        type: NotificationType.FLEET_REQUEST_UPDATE,
        title: 'Fleet request updated',
        body: `Your fleet request for ${request.organizationName} is now ${dto.status}.`,
        metadata: { fleetRequestId: id, status: dto.status },
      });
    }

    await this.auditService.record({
      userId: adminUserId,
      action: 'fleet:status-updated',
      entity: 'FleetRequest',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        fleetRequestId: id,
        from: request.status,
        to: dto.status,
      },
    });

    return this.toPublicFleetRequest(updated);
  }

  async createAssociation(dto: CreateAssociationDto) {
    return this.prisma.association.create({ data: dto });
  }

  async listAssociations() {
    return this.prisma.association.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true, fleetRequests: true } } },
    });
  }

  async addAssociationMember(
    associationId: string,
    dto: AddAssociationMemberDto,
  ) {
    await this.getAssociationOrThrow(associationId);

    return this.prisma.associationMember.create({
      data: {
        associationId,
        userId: dto.userId,
        memberName: dto.memberName,
        phone: dto.phone,
        email: dto.email,
        role: dto.role,
      },
    });
  }

  private async findPaginated(
    where: Prisma.FleetRequestWhereInput,
    filters: FilterFleetRequestsDto,
    hideAdminNotes: boolean,
  ) {
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.q) {
      where.OR = [
        { organizationName: { contains: filters.q, mode: 'insensitive' } },
        { contactPerson: { contains: filters.q, mode: 'insensitive' } },
        { phone: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
        { referenceNumber: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.fleetRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.fleetRequest.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toPublicFleetRequest(row, hideAdminNotes)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private toPublicFleetRequest<T extends { adminNotes?: string | null }>(
    request: T,
    stripAdminNotes = true,
  ) {
    if (!stripAdminNotes) {
      return request;
    }

    const { adminNotes: _adminNotes, ...rest } = request;
    return rest;
  }

  private async getAssociationOrThrow(id: string) {
    const association = await this.prisma.association.findUnique({
      where: { id },
    });

    if (!association) {
      throw new NotFoundException('Association not found');
    }

    return association;
  }

  private async sendRequesterConfirmationEmail(
    contactPerson: string,
    email: string,
    organizationName: string,
    referenceNumber: string,
    quantity: number,
    vehicleCategoryName: string | undefined,
    pdfBuffer: Buffer,
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
      `Hello UZA Mobility, my fleet request reference is ${referenceNumber}`,
    );
    const vehicleInterest = vehicleCategoryName ?? 'your selected category';
    const firstName = contactPerson.split(' ')[0] ?? contactPerson;

    const html = buildBrandedEmailHtml({
      appName,
      recipientName: firstName,
      headline: 'We received your fleet request',
      bodyHtml: `
        <p style="margin: 0 0 12px">Thank you for reaching out, ${escapeHtml(organizationName)}.</p>
        <p style="margin: 0 0 12px">We received your request for ${quantity} vehicle(s) and attached a summary document (${escapeHtml(referenceNumber)}).</p>
        <ul style="margin: 0 0 12px; padding-left: 18px; color: #424a53; font-size: 14px; line-height: 22px">
          <li>Primary interest: ${escapeHtml(vehicleInterest)}</li>
          <li>Reference: ${escapeHtml(referenceNumber)}</li>
        </ul>
        <p style="margin: 0 0 12px">Our commercial team will contact you within 24 hours to discuss sourcing, financing, and charging infrastructure for your fleet.</p>
        <p style="margin: 0">Pricing is not included in this email. A dedicated advisor will share commercial terms after reviewing your requirements.</p>`,
      actionUrl: whatsappUrl,
      actionLabel: 'Chat on WhatsApp',
      footerReason: `You are receiving this email because you submitted a fleet request on ${appName}.`,
      companyLegalName: company.legalName,
      companyLocation:
        this.configService.get<string>('MAIL_COMPANY_LOCATION') ??
        'Kigali, Rwanda',
      logoUrl: '',
      websiteUrl: frontendUrl,
      supportUrl: `${frontendUrl}/for-business`,
    });

    await this.mailService.sendMail({
      to: email,
      subject: `Fleet request received — ${referenceNumber}`,
      html,
      text: `Thank you ${contactPerson}. We received your fleet request ${referenceNumber} for ${quantity} vehicle(s). Our team will contact you within 24 hours. Pricing is not included — a dedicated advisor will follow up.`,
      bufferAttachments: [
        {
          filename: `${referenceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
  }
}
