# DOC 03 — Pricing, Invoices & Payments
**Uza Mobility · NestJS Backend**

---

## Overview

This is the commercial engine of the platform. It covers the dynamic pricing engine (admin-configurable, no dev involvement needed), invoice generation with PDF output, payment proof uploads, and the admin payment verification flow. Getting this right is critical for bank trust and seller confidence.

---

## Module Breakdown

```
src/modules/
├── pricing/
│   ├── pricing.module.ts
│   ├── pricing.service.ts
│   ├── pricing-rules.controller.ts   // admin only
│   └── dto/
│       ├── create-pricing-rule.dto.ts
│       └── calculate-price.dto.ts
│
├── invoices/
│   ├── invoices.module.ts
│   ├── invoices.controller.ts
│   ├── invoices.service.ts
│   ├── invoice-pdf.service.ts        // PDF generation
│   ├── invoice-number.service.ts     // reference generation
│   └── dto/
│       ├── request-invoice.dto.ts
│       └── update-invoice.dto.ts
│
└── payments/
    ├── payments.module.ts
    ├── payments.controller.ts
    ├── payments.service.ts
    └── dto/
        └── submit-payment.dto.ts
```

---

## Pricing Engine

### How It Works

The pricing engine calculates a `PriceBreakdown` for any listing based on its `sellerType`. The rules are stored in the `pricing_rules` table and are fully admin-editable — no code changes needed.

```typescript
// pricing/pricing.service.ts

export interface PriceBreakdown {
  basePriceUsd: number
  fobPriceUsd?: number
  sellerDesiredPayoutUsd?: number
  shippingCostUsd?: number
  localChargesUsd?: number
  taxesEstimateUsd?: number
  insuranceUsd?: number
  storageUsd?: number
  clearingFeeUsd?: number
  landingCostUsd?: number
  marginUsd?: number
  commissionUsd?: number
  discountUsd?: number
  finalPriceUsd: number
  finalPriceRwf?: number
  deliveryDaysMin: number
  deliveryDaysMax: number
}

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  async calculatePrice(
    sellerType: SellerType,
    input: PricingInput,
    originCountry?: string,
  ): Promise<PriceBreakdown> {
    const rule = await this.getActiveRule(sellerType, originCountry)

    switch (sellerType) {
      case 'UZA_RWANDA_STOCK':
        return this.calcRwandaStock(input, rule)
      case 'UZA_CHINA_SOURCING':
        return this.calcChinaSourcing(input, rule)
      case 'LOCAL_SELLER':
        return this.calcLocalSeller(input, rule)
      case 'INTERNATIONAL_SELLER':
        return this.calcInternational(input, rule)
    }
  }

  // Formula: admin sets the selling price directly
  private calcRwandaStock(input: PricingInput, rule: PricingRule): PriceBreakdown {
    const discount = input.discountUsd ?? 0
    const final    = input.basePriceUsd - discount
    return {
      basePriceUsd: input.basePriceUsd,
      discountUsd: discount,
      finalPriceUsd: final,
      finalPriceRwf: final * (rule.exchangeRateRwf ?? 1300),
      deliveryDaysMin: rule.deliveryDaysMin ?? 1,
      deliveryDaysMax: rule.deliveryDaysMax ?? 2,
    }
  }

  // Formula: FOB + Shipping + Local + Taxes + Insurance + Storage + Clearing + Margin
  private calcChinaSourcing(input: PricingInput, rule: PricingRule): PriceBreakdown {
    const fob      = input.fobPriceUsd ?? 0
    const ship     = rule.shippingCostUsd ?? 0
    const local    = rule.localChargesUsd ?? 0
    const taxes    = (fob + ship) * ((rule.taxRatePercent ?? 0) / 100)
    const insure   = (fob + ship) * ((rule.insuranceRatePercent ?? 0) / 100)
    const storage  = rule.storagePerDayUsd ?? 0
    const clearing = rule.clearingFeeUsd ?? 0
    const landing  = fob + ship + local + taxes + insure + storage + clearing
    const margin   = landing * ((rule.platformMarginPercent ?? 0) / 100)
    const discount = input.discountUsd ?? 0
    const final    = landing + margin - discount

    return {
      fobPriceUsd: fob,
      shippingCostUsd: ship,
      localChargesUsd: local,
      taxesEstimateUsd: taxes,
      insuranceUsd: insure,
      storageUsd: storage,
      clearingFeeUsd: clearing,
      landingCostUsd: landing,
      marginUsd: margin,
      discountUsd: discount,
      finalPriceUsd: final,
      finalPriceRwf: final * (rule.exchangeRateRwf ?? 1300),
      deliveryDaysMin: rule.deliveryDaysMin ?? 42,  // 6 weeks
      deliveryDaysMax: rule.deliveryDaysMax ?? 56,  // 8 weeks
    }
  }

  // Formula: Marketplace Price = Seller Payout / (1 - Commission Rate)
  private calcLocalSeller(input: PricingInput, rule: PricingRule): PriceBreakdown {
    const payout     = input.sellerDesiredPayoutUsd ?? 0
    const rate       = rule.commissionRate ?? 0.05
    const finalPrice = payout / (1 - rate)
    const commission = finalPrice - payout

    return {
      sellerDesiredPayoutUsd: payout,
      commissionUsd: commission,
      discountUsd: input.discountUsd ?? 0,
      finalPriceUsd: finalPrice - (input.discountUsd ?? 0),
      finalPriceRwf: finalPrice * (rule.exchangeRateRwf ?? 1300),
      deliveryDaysMin: rule.deliveryDaysMin ?? 2,
      deliveryDaysMax: rule.deliveryDaysMax ?? 5,
    }
  }

  // Formula: FOB + Route Costs + Country Costs + Platform Margin
  private calcInternational(input: PricingInput, rule: PricingRule): PriceBreakdown {
    const fob    = input.fobPriceUsd ?? 0
    const route  = rule.shippingCostUsd ?? 0
    const local  = rule.localChargesUsd ?? 0
    const taxes  = (fob + route) * ((rule.taxRatePercent ?? 0) / 100)
    const margin = (fob + route + local + taxes) * ((rule.platformMarginPercent ?? 0) / 100)
    const final  = fob + route + local + taxes + margin - (input.discountUsd ?? 0)

    return {
      fobPriceUsd: fob,
      shippingCostUsd: route,
      localChargesUsd: local,
      taxesEstimateUsd: taxes,
      marginUsd: margin,
      discountUsd: input.discountUsd ?? 0,
      finalPriceUsd: final,
      finalPriceRwf: final * (rule.exchangeRateRwf ?? 1300),
      deliveryDaysMin: rule.deliveryDaysMin ?? 42,
      deliveryDaysMax: rule.deliveryDaysMax ?? 70,
    }
  }

  private async getActiveRule(
    sellerType: SellerType,
    originCountry?: string,
  ): Promise<PricingRule> {
    // Try specific origin first, fall back to wildcard rule
    const rule = await this.prisma.pricingRule.findFirst({
      where: {
        sellerType,
        isActive: true,
        OR: [
          { originCountry: originCountry ?? null },
          { originCountry: null },
        ],
        validFrom: { lte: new Date() },
        OR: [
          { validUntil: null },
          { validUntil: { gte: new Date() } },
        ],
      },
      orderBy: { originCountry: 'desc' }, // specific origin wins over wildcard
    })

    if (!rule) throw new NotFoundException(`No active pricing rule for ${sellerType}`)
    return rule
  }
}
```

### Pricing Rule Admin Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/admin/pricing-rules` | `SUPER_ADMIN` | List all pricing rules |
| `POST` | `/admin/pricing-rules` | `SUPER_ADMIN` | Create new rule |
| `PATCH` | `/admin/pricing-rules/:id` | `SUPER_ADMIN` | Update rule (shipping, taxes, margin, etc.) |
| `DELETE` | `/admin/pricing-rules/:id` | `SUPER_ADMIN` | Deactivate rule |

---

## Invoice System

### Reference Number Generation

Both invoice number and payment reference must be unique and generated at creation time.

```typescript
// invoices/invoice-number.service.ts

@Injectable()
export class InvoiceNumberService {
  constructor(private prisma: PrismaService) {}

  async generateInvoiceNumber(): Promise<string> {
    const year    = new Date().getFullYear()
    const count   = await this.prisma.invoice.count()
    const padded  = String(count + 1).padStart(6, '0')
    return `UZM-INV-${year}-${padded}`
    // e.g. UZM-INV-2026-000123
  }

  async generatePaymentReference(): Promise<string> {
    const year   = new Date().getFullYear()
    const count  = await this.prisma.payment.count()
    const padded = String(count + 1).padStart(6, '0')
    return `UZM-PAY-${year}-${padded}`
    // e.g. UZM-PAY-2026-000483
  }
}
```

### Invoice Request Flow

```
Buyer selects listing
→ POST /invoices/request
→ System snapshots listing data + pricing breakdown
→ Invoice created with status DRAFT
→ PDF generated (Puppeteer)
→ Invoice status → SENT
→ Buyer receives invoice (email + in-app)
→ Vehicle status → RESERVED
```

**Important:** The invoice snapshots all listing data at request time. If the listing price changes later, the invoice price does not change.

### Invoice Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `POST` | `/invoices/request` | `BUYER` | Request invoice for a listing |
| `GET` | `/invoices/my` | `BUYER` | Own invoices |
| `GET` | `/invoices/:id` | `BUYER` (owner) or Admin | Invoice detail |
| `GET` | `/invoices/:id/pdf` | `BUYER` (owner) or Admin | Download PDF |
| `GET` | `/admin/invoices` | `FINANCE_ADMIN` | All invoices with filters |
| `PATCH` | `/admin/invoices/:id/cancel` | `invoices:cancel` | Cancel invoice |
| `POST` | `/admin/invoices/fleet` | `FLEET_ADMIN` | Create fleet invoice manually |

### Request Invoice DTO

```typescript
// dto/request-invoice.dto.ts

export class RequestInvoiceDto {
  @IsString() listingId: string

  @IsOptional() @IsString() buyerAddress?: string

  @IsEnum(InvoiceType) @IsOptional()
  invoiceType?: InvoiceType  // defaults to PROFORMA

  @IsOptional() @IsString() notes?: string
}
```

### Invoice Service — Core Logic

```typescript
// invoices/invoices.service.ts

async requestInvoice(
  userId: string,
  dto: RequestInvoiceDto,
): Promise<Invoice> {

  const [user, listing] = await Promise.all([
    this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { buyerProfile: true },
    }),
    this.prisma.listing.findUniqueOrThrow({
      where: { id: dto.listingId, status: 'PUBLISHED' },
      include: { listingPricing: true, evSpecs: true, seller: true },
    }),
  ])

  const [invoiceNumber, paymentRef] = await Promise.all([
    this.invoiceNumberService.generateInvoiceNumber(),
    this.invoiceNumberService.generatePaymentReference(),
  ])

  const validUntil = addDays(new Date(), 7)

  const invoice = await this.prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        invoiceNumber,
        paymentReference: paymentRef,
        userId,
        listingId: listing.id,
        invoiceType: dto.invoiceType ?? 'PROFORMA',
        status: 'SENT',

        // Buyer snapshot
        buyerName: `${user.firstName} ${user.lastName}`,
        buyerEmail: user.email,
        buyerPhone: user.phone,
        buyerAddress: dto.buyerAddress,
        buyerType: user.buyerProfile?.buyerType,

        // Vehicle snapshot
        vehicleBrand: listing.brand,
        vehicleModel: listing.model,
        vehicleTrim: listing.trim,
        vehicleYear: listing.manufacturingYear,
        vehicleCondition: listing.condition,
        vehicleLocation: listing.vehicleLocation,
        sellerType: listing.sellerType,
        verificationLevel: listing.verificationLevel,

        // Price snapshot from listing pricing
        ...this.snapshotPricing(listing.listingPricing),
        totalAmountUsd: listing.listingPricing.finalPriceUsd,
        totalAmountRwf: listing.listingPricing.finalPriceRwf,
        currency: listing.listingPricing.currency,

        // Payment details
        beneficiaryName: 'UZA Solutions Ltd',
        bankName: process.env.COMPANY_BANK_NAME,
        accountNumber: process.env.COMPANY_ACCOUNT_NUMBER,
        paymentDeadline: validUntil,
        validUntil,
        notes: dto.notes,
        issuedAt: new Date(),
      },
    })

    // Reserve the listing
    await tx.listing.update({
      where: { id: listing.id },
      data: { status: 'RESERVED' },
    })

    return inv
  })

  // Generate PDF async (don't block response)
  this.invoicePdfService.generate(invoice.id).catch(console.error)

  // Notify buyer
  await this.notificationsService.send({
    userId,
    type: 'INVOICE_ISSUED',
    title: 'Your invoice is ready',
    body: `Invoice ${invoiceNumber} has been issued. Reference: ${paymentRef}`,
    metadata: { invoiceId: invoice.id },
  })

  return invoice
}
```

### Invoice PDF Service

Uses Puppeteer to render an HTML template to PDF. The template is branded with Uza Mobility logo and UZA Solutions Ltd details.

```typescript
// invoices/invoice-pdf.service.ts

@Injectable()
export class InvoicePdfService {
  async generate(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    })

    const html = this.renderTemplate(invoice) // Handlebars or simple template literal

    const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
    const page    = await browser.newPage()

    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    })

    await browser.close()

    // Upload PDF to S3/R2
    const url = await this.storageService.upload(
      `invoices/${invoiceId}.pdf`,
      pdfBuffer,
      'application/pdf',
    )

    // Save URL to invoice record
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfUrl: url },
    })
  }
}
```

### Invoice Expiry Cron Job

Runs daily. Expires invoices past their `validUntil` date and releases reserved listings.

```typescript
// invoices/invoices.cron.ts

@Cron('0 0 * * *')  // midnight daily
async expireInvoices(): Promise<void> {
  const expired = await this.prisma.invoice.findMany({
    where: {
      status: { in: ['SENT', 'AWAITING_PAYMENT'] },
      validUntil: { lt: new Date() },
    },
    include: { listing: true },
  })

  for (const invoice of expired) {
    await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'EXPIRED' },
      }),
      // Release the listing back to marketplace
      this.prisma.listing.update({
        where: { id: invoice.listingId },
        data: { status: 'PUBLISHED' },
      }),
    ])
  }
}
```

---

## Payment System

### Submit Payment Flow

```
Buyer clicks "I Have Paid"
→ POST /payments/submit
→ Payment record created (status: SUBMITTED)
→ Proof files uploaded
→ Invoice status → PAYMENT_SUBMITTED
→ Finance admin receives notification
→ Admin reviews proof
→ Admin confirms or rejects
```

### Payment Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `POST` | `/payments/submit` | `BUYER` | Submit payment with proof upload |
| `GET` | `/payments/my` | `BUYER` | Own payment history |
| `GET` | `/admin/payments` | `FINANCE_ADMIN` | All payments pending verification |
| `PATCH` | `/admin/payments/:id/confirm` | `payments:verify` | Confirm payment |
| `PATCH` | `/admin/payments/:id/reject` | `payments:reject` | Reject with reason |
| `PATCH` | `/admin/payments/:id/partial` | `payments:verify` | Mark as partial payment |

### Submit Payment DTO

```typescript
// dto/submit-payment.dto.ts

export class SubmitPaymentDto {
  @IsString() invoiceId: string
  @IsNumber() amountPaid: number
  @IsString() @IsOptional() currency?: string
  @IsString() @IsOptional() bankName?: string
  @IsString() @IsOptional() transferReference?: string
  @IsDateString() @IsOptional() paymentDate?: string
  @IsString() @IsOptional() senderName?: string
  @IsString() @IsOptional() notes?: string
  // Files handled by Multer interceptor, not this DTO
}
```

### Payment Confirmation — Full Flow

```typescript
// payments/payments.service.ts

async confirmPayment(paymentId: string, adminId: string): Promise<void> {
  const payment = await this.prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { invoice: { include: { listing: true } } },
  })

  await this.prisma.$transaction([
    // Update payment status
    this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'CONFIRMED',
        verifiedBy: adminId,
        verifiedAt: new Date(),
      },
    }),

    // Update invoice status
    this.prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: 'PAYMENT_CONFIRMED' },
    }),

    // Mark listing as SOLD
    this.prisma.listing.update({
      where: { id: payment.invoice.listingId },
      data: { status: 'SOLD' },
    }),

    // Log the action
    this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'payments:confirmed',
        entity: 'Payment',
        entityId: paymentId,
        metadata: {
          invoiceId: payment.invoiceId,
          amount: payment.amountPaid,
        },
      },
    }),
  ])

  // Trigger order creation
  await this.ordersService.createFromInvoice(payment.invoiceId)

  // Notify buyer
  await this.notificationsService.send({
    userId: payment.invoice.userId,
    type: 'PAYMENT_CONFIRMED',
    title: 'Payment confirmed',
    body: `Your payment for invoice ${payment.invoice.invoiceNumber} has been confirmed.`,
    metadata: { invoiceId: payment.invoiceId },
  })
}
```

### Payment Status Machine

Only these transitions are valid:

```typescript
const PAYMENT_TRANSITIONS = {
  SUBMITTED:         ['UNDER_VERIFICATION'],
  UNDER_VERIFICATION: ['CONFIRMED', 'REJECTED'],
  CONFIRMED:         ['REFUNDED'],
  REJECTED:          [],
  REFUNDED:          [],
}
```

---

## Key Business Rules

- Every invoice has a **7-day validity** by default. Configurable per invoice type in the future.
- The `paymentReference` (`UZM-PAY-2026-000483`) must be included in the buyer's bank transfer narration. This is prominently displayed on the invoice PDF.
- An invoice that expires releases the `RESERVED` listing back to `PUBLISHED` automatically.
- If a payment is **rejected**, the invoice goes back to `AWAITING_PAYMENT` and the buyer is notified with the rejection reason so they can resubmit.
- `commissionUsd` and `sellerDesiredPayoutUsd` are stored in the database but **never returned** in public buyer-facing API responses. Strip these in response DTOs.
- For **partial payments**, the invoice moves to `PARTIALLY_PAID`. A second payment submission is expected. The order is not created until the invoice reaches `PAYMENT_CONFIRMED`.
- All financial amounts are stored in **USD** as the base currency. RWF values are computed from the exchange rate at invoice time and stored alongside.
