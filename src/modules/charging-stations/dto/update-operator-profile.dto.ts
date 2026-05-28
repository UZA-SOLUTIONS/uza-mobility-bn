import { PartialType } from '@nestjs/swagger';
import { CreateOperatorProfileDto } from './create-operator-profile.dto';

export class UpdateOperatorProfileDto extends PartialType(
  CreateOperatorProfileDto,
) {}
