import type { CreateCategoryDto } from './create-category.dto';
import type { CreateSubcategoryDto } from './create-subcategory.dto';
import type { UpdateCategoryDto } from './update-category.dto';
import type { UpdateSubcategoryDto } from './update-subcategory.dto';

export type CreateCategoryPayload = CreateCategoryDto & {
  iconUrl?: string | null;
};

export type UpdateCategoryPayload = UpdateCategoryDto & {
  iconUrl?: string | null;
};

export type CreateSubcategoryPayload = CreateSubcategoryDto & {
  iconUrl?: string | null;
};

export type UpdateSubcategoryPayload = UpdateSubcategoryDto & {
  iconUrl?: string | null;
};
