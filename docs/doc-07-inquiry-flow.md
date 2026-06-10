# Inquiry Flow — Feature Specification

## Inquiry Flow Feature

### New Prisma model — Inquiry

```prisma
enum InquiryStatus {
  RECEIVED
  CONTACTED
  QUOTED
  CONVERTED
  CLOSED
}

enum BuyerTypeSimple {
  INDIVIDUAL
  BUSINESS
}

model Inquiry {
  id            String          @id @default(cuid())
  userId        String?
  listingId     String?
  name          String
  phone         String
  email         String
  country       String
  buyerType     BuyerTypeSimple
  message       String?
  status        InquiryStatus   @default(RECEIVED)
  quotePdfUrl   String?
  internalNotes String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  user          User?           @relation(fields: [userId], references: [id])
  listing       Listing?        @relation(fields: [listingId], references: [id])

  @@index([email])
  @@index([status])
  @@map("inquiries")
}
```

### New module

```
src/modules/
└── inquiries/
    ├── inquiries.module.ts
    ├── inquiries.controller.ts
    ├── inquiries.service.ts
    ├── quote-pdf.service.ts
    └── dto/
        ├── create-inquiry.dto.ts
        └── update-inquiry-status.dto.ts
```

### Account linking — add to auth service

Inside the registration transaction (both email and Google), after the user record is created:

```typescript
await tx.inquiry.updateMany({
  where: { email: dto.email, userId: null },
  data: { userId: newUser.id },
})
```
