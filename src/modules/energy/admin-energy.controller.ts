import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StorageService } from '../../common/uploads/storage.service';
import { imageMulterOptions } from '../../common/uploads/multer.config';
import { parseMultipartPayload } from '../../common/uploads/parse-payload.util';
import { multipartPayloadSchema } from '../../common/uploads/swagger-multipart.util';
import { UploadFolder } from '../../common/uploads/upload.constants';
import { CreateChargingProductDto } from './dto/create-charging-product.dto';
import { UpdateChargingProductDto } from './dto/update-charging-product.dto';
import { UpdateEnergyRequestStatusDto } from './dto/update-energy-request-status.dto';
import { EnergyService } from './energy.service';

class FilterEnergyRequestsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/energy')
export class AdminEnergyController {
  constructor(
    private readonly energyService: EnergyService,
    private readonly storage: StorageService,
  ) {}

  @Post('products')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('parts:manage')
  @UseInterceptors(FilesInterceptor('photos', 10, imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      photos: { type: 'array', items: { type: 'string', format: 'binary' } },
    }),
  })
  @ApiOperation({ summary: 'Create charging product' })
  async createProduct(
    @Body('payload') payload: string,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    const dto = await parseMultipartPayload(CreateChargingProductDto, payload);
    const photoUrls = photos?.length
      ? this.storage.urlsFromAssets(
          await this.storage.uploadImages(photos, UploadFolder.ENERGY),
        )
      : undefined;
    return this.energyService.createProduct({ ...dto, photoUrls });
  }

  @Patch('products/:id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('parts:manage')
  @UseInterceptors(FilesInterceptor('photos', 10, imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema(
      {
        photos: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
      [],
    ),
  })
  @ApiOperation({ summary: 'Update charging product' })
  async updateProduct(
    @Param('id') id: string,
    @Body('payload') payload: string | undefined,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    const dto = payload?.trim()
      ? await parseMultipartPayload(UpdateChargingProductDto, payload)
      : {};
    const photoUrls = photos?.length
      ? this.storage.urlsFromAssets(
          await this.storage.uploadImages(photos, UploadFolder.ENERGY),
        )
      : undefined;
    return this.energyService.updateProduct(id, { ...dto, photoUrls });
  }

  @Get('requests')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('FLEET_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('fleet:read')
  @ApiOperation({ summary: 'List energy quote requests' })
  listRequests(@Query() filters: FilterEnergyRequestsDto) {
    return this.energyService.adminListRequests(filters);
  }

  @Patch('requests/:id/status')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('FLEET_ADMIN', 'SUPER_ADMIN')
  @RequirePermission('fleet:update-status')
  @ApiOperation({ summary: 'Update energy request status' })
  updateRequestStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEnergyRequestStatusDto,
  ) {
    return this.energyService.updateRequestStatus(id, dto);
  }
}
