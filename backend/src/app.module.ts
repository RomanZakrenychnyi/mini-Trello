import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { BoardsController } from './boards/boards.controller';
import { BoardsService } from './boards/boards.service';
import { ListsController } from './lists/lists.controller';
import { ListsService } from './lists/lists.service';
import { CardsController } from './cards/cards.controller';
import { CardsService } from './cards/cards.service';
import { ChecklistController } from './checklist/checklist.controller';
import { ChecklistService } from './checklist/checklist.service';

@Module({ controllers: [HealthController, BoardsController, ListsController, CardsController, ChecklistController], providers: [PrismaService, BoardsService, ListsService, CardsService, ChecklistService] })
export class AppModule {}
