import { Global, Module } from '@nestjs/common';
import { HtmlToPdfService } from './html-to-pdf.service';

@Global()
@Module({
  providers: [HtmlToPdfService],
  exports: [HtmlToPdfService],
})
export class PdfModule {}
