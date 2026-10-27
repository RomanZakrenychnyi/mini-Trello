import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { BoardsController } from './boards/boards.controller';
import { BoardsService } from './boards/boards.service';
import { ListsController } from './lists/lists.controller';
import { ListsService } from './lists/lists.service';
import { CardsController } from './cards/cards.controller';
import { CardsService } from './cards/cards.service';

@Module({ controllers: [HealthController, BoardsController, ListsController, CardsController], providers: [PrismaService, BoardsService, ListsService, CardsService] })
export class AppModule {}
