import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SkipAudit } from '../../common/audit/decorators/skip-audit.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

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
  @ApiOperation({ summary: 'Create category' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-access')
  @UseGuards(RolesGuard)
  @Roles('MARKETPLACE_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update category' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
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
  @ApiOperation({ summary: 'Add subcategory to category' })
  addSubcategory(@Param('id') id: string, @Body() dto: CreateSubcategoryDto) {
    return this.categoriesService.addSubcategory(id, dto);
  }
}
