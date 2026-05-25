import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BuyerType, SellerStatus, SellerType } from '@prisma/client';

export class MeBuyerProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: BuyerType })
  buyerType!: BuyerType;

  @ApiPropertyOptional()
  organizationName?: string | null;

  @ApiPropertyOptional()
  city?: string | null;

  @ApiProperty()
  country!: string;

  @ApiProperty()
  isVerified!: boolean;
}

export class MeSellerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: SellerType })
  sellerType!: SellerType;

  @ApiProperty({ enum: SellerStatus })
  status!: SellerStatus;

  @ApiProperty()
  businessName!: string;

  @ApiPropertyOptional()
  city?: string | null;

  @ApiProperty()
  country!: string;

  @ApiProperty()
  isVerified!: boolean;

  @ApiPropertyOptional()
  verifiedAt?: Date | null;
}

export class MeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  isEmailVerified!: boolean;

  @ApiProperty()
  isPhoneVerified!: boolean;

  @ApiProperty()
  preferredLanguage!: string;

  @ApiPropertyOptional()
  profilePhoto?: string | null;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({
    type: [String],
    description:
      'Effective permissions from DB (same source as JWT/API guards). SUPER_ADMIN receives ["*"].',
  })
  permissions!: string[];

  @ApiPropertyOptional({ type: MeBuyerProfileDto, nullable: true })
  buyerProfile!: MeBuyerProfileDto | null;

  @ApiPropertyOptional({ type: MeSellerDto, nullable: true })
  seller!: MeSellerDto | null;

  @ApiProperty({ type: [MeSellerDto] })
  sellers!: MeSellerDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
