import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CardsService } from './cards.service';

@Controller('boards/:boardId/lists/:listId/cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}
  @Get()
  findAll(@Param('boardId') boardId: string, @Param('listId') listId: string) { return this.cards.findAll(boardId, listId); }
  @Post()
  create(@Param('boardId') boardId: string, @Param('listId') listId: string, @Body() body: unknown) { return this.cards.create(boardId, listId, body); }
  @Patch(':id')
  update(@Param('boardId') boardId: string, @Param('listId') listId: string, @Param('id') id: string, @Body() body: unknown) { return this.cards.update(boardId, listId, id, body); }
  @Patch(':id/move')
  move(@Param('boardId') boardId: string, @Param('listId') listId: string, @Param('id') id: string, @Body() body: unknown) { return this.cards.move(boardId, listId, id, body); }
  @Delete(':id')
  remove(@Param('boardId') boardId: string, @Param('listId') listId: string, @Param('id') id: string) { return this.cards.remove(boardId, listId, id); }
}
