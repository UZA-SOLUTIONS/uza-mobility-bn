import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Welcome to UZA MOBILITY API';
  }

  getSystemInfo(): object {
    return {
      system: 'UZA MOBILITY API',
      version: '1.0.0',
      description: 'UZA MOBILITY API INFORMATION',
      features: [],
      roles: [],
      documentation: '/api/docs',
      support: 'Contact UZA MOBILITY support for more information',
    };
  }
}
