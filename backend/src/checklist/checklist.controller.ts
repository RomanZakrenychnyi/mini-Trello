import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ChecklistService } from './checklist.service';

@Controller('boards/:boardId/lists/:listId/cards/:cardId/checklist')
export class ChecklistController {
  constructor(private readonly checklist: ChecklistService) {}
  @Get()
  findAll(@Param('boardId') boardId: string, @Param('listId') listId: string, @Param('cardId') cardId: string) {
    return this.checklist.findAll(boardId, listId, cardId);
  }
  @Post()
  create(@Param('boardId') boardId: string, @Param('listId') listId: string, @Param('cardId') cardId: string, @Body() body: unknown) {
    return this.checklist.create(boardId, listId, cardId, body);
  }
  @Patch(':id')
  update(@Param('boardId') boardId: string, @Param('listId') listId: string, @Param('cardId') cardId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.checklist.update(boardId, listId, cardId, id, body);
  }
  @Delete(':id')
  remove(@Param('boardId') boardId: string, @Param('listId') listId: string, @Param('cardId') cardId: string, @Param('id') id: string) {
    return this.checklist.remove(boardId, listId, cardId, id);
  }
}
