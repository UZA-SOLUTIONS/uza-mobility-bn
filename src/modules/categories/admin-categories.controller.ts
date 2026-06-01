import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UploadedFile,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StorageService } from '../../common/uploads/storage.service';
import { imageMulterOptions } from '../../common/uploads/multer.config';
import { parseMultipartPayload } from '../../common/uploads/parse-payload.util';
import { multipartPayloadSchema } from '../../common/uploads/swagger-multipart.util';
import { UploadFolder } from '../../common/uploads/upload.constants';
import { AdminFilterCategoriesDto } from './dto/admin-filter-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { CategoriesService } from './categories.service';

@ApiTags('admin')
@ApiBearerAuth('JWT-access')
@Controller('admin/categories')
@UseGuards(RolesGuard)
@Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
export class AdminCategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List categories for admin (includes inactive and subcategories)',
  })
  findAll(@Query() filters: AdminFilterCategoriesDto) {
    return this.categoriesService.adminFindAll(filters);
  }

  @Patch(':categoryId/subcategories/:subId')
  @UseInterceptors(FileInterceptor('icon', imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema(
      { icon: { type: 'string', format: 'binary' } },
      [],
    ),
  })
  @ApiOperation({ summary: 'Update subcategory' })
  async updateSubcategory(
    @Param('categoryId') categoryId: string,
    @Param('subId') subId: string,
    @Body('payload') payload: string | undefined,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    const dto = payload?.trim()
      ? await parseMultipartPayload(UpdateSubcategoryDto, payload)
      : {};
    const iconUrl = icon
      ? (await this.storage.uploadImage(icon, UploadFolder.CATEGORIES)).url
      : undefined;
    return this.categoriesService.updateSubcategory(categoryId, subId, {
      ...dto,
      ...(iconUrl ? { iconUrl } : {}),
    });
  }

  @Delete(':categoryId/subcategories/:subId')
  @ApiOperation({
    summary: 'Delete subcategory (no listings may reference it)',
  })
  deleteSubcategory(
    @Param('categoryId') categoryId: string,
    @Param('subId') subId: string,
  ) {
    return this.categoriesService.deleteSubcategory(categoryId, subId);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a deactivated category' })
  reactivate(@Param('id') id: string) {
    return this.categoriesService.reactivate(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('icon', imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema(
      { icon: { type: 'string', format: 'binary' } },
      [],
    ),
  })
  @ApiOperation({ summary: 'Update category' })
  async update(
    @Param('id') id: string,
    @Body('payload') payload: string | undefined,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    const dto = payload?.trim()
      ? await parseMultipartPayload(UpdateCategoryDto, payload)
      : {};
    const iconUrl = icon
      ? (await this.storage.uploadImage(icon, UploadFolder.CATEGORIES)).url
      : undefined;
    return this.categoriesService.update(id, {
      ...dto,
      ...(iconUrl ? { iconUrl } : {}),
    });
  }

  @Delete(':id/permanent')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Permanently delete category (no listings)' })
  hardDelete(@Param('id') id: string) {
    return this.categoriesService.hardDeleteCategory(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate category (soft)' })
  deactivate(@Param('id') id: string) {
    return this.categoriesService.deactivate(id);
  }
}
