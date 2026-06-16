import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({
    example:
      'Account created. Check your email to verify your account before signing in.',
  })
  message!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({
    required: false,
    description:
      'True when the email already had a Google sign-in account; a password-setup link was sent instead of creating a duplicate user.',
  })
  linkedExistingAccount?: boolean;
}
