import { Controller, Get, Module } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get('live')
  live() {
    return { status: 'ok' };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
