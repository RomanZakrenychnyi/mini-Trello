import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { BoardsController } from './boards/boards.controller';
import { BoardsService } from './boards/boards.service';

@Module({ controllers: [HealthController, BoardsController], providers: [PrismaService, BoardsService] })
export class AppModule {}
