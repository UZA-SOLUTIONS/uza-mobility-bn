import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({
    example:
      'Account created. Check your email to verify your account before signing in.',
  })
  message!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;
}
