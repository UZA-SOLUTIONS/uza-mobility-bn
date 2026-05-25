import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SkipAudit } from '../../common/audit/decorators/skip-audit.decorator';
import { CloudinaryService } from '../../common/uploads/cloudinary.service';
import { imageMulterOptions } from '../../common/uploads/multer.config';
import { parseMultipartPayload } from '../../common/uploads/parse-payload.util';
import { multipartPayloadSchema } from '../../common/uploads/swagger-multipart.util';
import { UploadFolder } from '../../common/uploads/upload.constants';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get()
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'List active categories with subcategories' })
  findAll() {
    return this.categoriesService.findAllActive();
  }

  @Get(':slug')
  @Public()
  @SkipAudit()
  @ApiOperation({ summary: 'Get category by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Post()
  @ApiBearerAuth('JWT-access')
  @UseGuards(RolesGuard)
  @Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('icon', imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      icon: { type: 'string', format: 'binary' },
    }),
  })
  @ApiOperation({ summary: 'Create category' })
  async create(
    @Body('payload') payload: string,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    const dto = await parseMultipartPayload(CreateCategoryDto, payload);
    const iconUrl = icon
      ? (await this.cloudinary.uploadImage(icon, UploadFolder.CATEGORIES)).url
      : undefined;
    return this.categoriesService.create({
      ...dto,
      ...(iconUrl ? { iconUrl } : {}),
    });
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-access')
  @UseGuards(RolesGuard)
  @Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
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
      ? (await this.cloudinary.uploadImage(icon, UploadFolder.CATEGORIES)).url
      : undefined;
    return this.categoriesService.update(id, {
      ...dto,
      ...(iconUrl ? { iconUrl } : {}),
    });
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-access')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Deactivate category' })
  @ApiOkResponse({ description: 'Category deactivated' })
  deactivate(@Param('id') id: string) {
    return this.categoriesService.deactivate(id);
  }

  @Post(':id/subcategories')
  @ApiBearerAuth('JWT-access')
  @UseGuards(RolesGuard)
  @Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('icon', imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema({
      icon: { type: 'string', format: 'binary' },
    }),
  })
  @ApiOperation({ summary: 'Add subcategory to category' })
  async addSubcategory(
    @Param('id') id: string,
    @Body('payload') payload: string,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    const dto = await parseMultipartPayload(CreateSubcategoryDto, payload);
    const iconUrl = icon
      ? (await this.cloudinary.uploadImage(icon, UploadFolder.CATEGORIES)).url
      : undefined;
    return this.categoriesService.addSubcategory(id, {
      ...dto,
      ...(iconUrl ? { iconUrl } : {}),
    });
  }
}
