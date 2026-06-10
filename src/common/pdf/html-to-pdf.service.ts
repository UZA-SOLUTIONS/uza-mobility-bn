import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Browser } from 'puppeteer';
import puppeteer from 'puppeteer';

@Injectable()
export class HtmlToPdfService implements OnModuleDestroy {
  private readonly logger = new Logger(HtmlToPdfService.name);
  private browserPromise: Promise<Browser> | null = null;

  async onModuleDestroy() {
    if (this.browserPromise) {
      const browser = await this.browserPromise.catch(() => null);
      await browser?.close().catch(() => undefined);
      this.browserPromise = null;
    }
  }

  async render(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer
        .launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        .catch((error) => {
          this.browserPromise = null;
          this.logger.error('Failed to launch Puppeteer', error);
          throw error;
        });
    }

    return this.browserPromise;
  }
}
