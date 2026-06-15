import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Seller/admin provides cost inputs only. finalPriceUsd is computed
 * server-side via PricingService from active pricing rules.
 */
export class CreateListingPricingDto {
  @ApiPropertyOptional({
    description:
      'Required for UZA_RWANDA_STOCK — vehicle base selling price (USD)',
    example: 28000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePriceUsd?: number;

  @ApiPropertyOptional({
    description:
      'Required for UZA_CHINA_SOURCING and INTERNATIONAL_SELLER — FOB price (USD)',
    example: 22000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fobPriceUsd?: number;

  @ApiPropertyOptional({
    description: 'Required for LOCAL_SELLER — desired payout after sale (USD)',
    example: 25000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellerDesiredPayoutUsd?: number;

  @ApiPropertyOptional({
    description:
      'Optional discount subtracted after platform margin/fees (USD)',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountUsd?: number;

  @ApiPropertyOptional({
    description:
      'Active pricing rule to apply. When omitted, the platform picks the default active rule for the seller type.',
  })
  @IsOptional()
  @IsString()
  pricingRuleId?: string;
}
