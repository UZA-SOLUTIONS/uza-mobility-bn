import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class AssignUserRolesDto {
  @ApiProperty({
    type: [String],
    example: ['BUYER', 'SELLER'],
    description: 'Role names to assign (replaces current roles)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roles!: string[];
}
