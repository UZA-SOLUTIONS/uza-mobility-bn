import { PartialType } from '@nestjs/swagger';
import { AdminCreatePartDto } from './admin-create-part.dto';

export class AdminUpdatePartDto extends PartialType(AdminCreatePartDto) {}
