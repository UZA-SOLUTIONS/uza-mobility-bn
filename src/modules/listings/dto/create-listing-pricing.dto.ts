import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Seller/admin provides cost inputs in Rwf. finalPriceRwf is computed
 * server-side via PricingService from active pricing rules.
 */
export class CreateListingPricingDto {
  @ApiPropertyOptional({
    description:
      'Required for UZA_RWANDA_STOCK — vehicle base selling price (Rwf)',
    example: 28000000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePriceRwf?: number;

  @ApiPropertyOptional({
    description:
      'Required for UZA_CHINA_SOURCING and INTERNATIONAL_SELLER — FOB price (Rwf)',
    example: 22000000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fobPriceRwf?: number;

  @ApiPropertyOptional({
    description: 'Required for LOCAL_SELLER — desired payout after sale (Rwf)',
    example: 25000000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellerDesiredPayoutRwf?: number;

  @ApiPropertyOptional({
    description:
      'Optional discount subtracted after platform margin/fees (Rwf)',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountRwf?: number;

  @ApiPropertyOptional({
    description:
      'Active pricing rule to apply. When omitted, the platform picks the default active rule for the seller type.',
  })
  @IsOptional()
  @IsString()
  pricingRuleId?: string;
}
