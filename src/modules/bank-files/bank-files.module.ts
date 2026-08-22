import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BankFileGeneratorService } from './bank-file-generator.service';
import { BankFilesController } from './bank-files.controller';

/**
 * Bank file assembly for the Tunga Taxi programme.
 *
 * Seven of the eleven items a lender asks for are facts the platform already holds. This
 * module produces those and refuses to touch the other four, which is what makes the
 * "what is still missing" number trustworthy enough to act on.
 */
@Module({
  imports: [AuthModule],
  controllers: [BankFilesController],
  providers: [BankFileGeneratorService],
  exports: [BankFileGeneratorService],
})
export class BankFilesModule {}
