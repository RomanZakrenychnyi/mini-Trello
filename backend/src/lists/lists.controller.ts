import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ListsService } from './lists.service';

@Controller('boards/:boardId/lists')
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get()
  findAll(@Param('boardId') boardId: string) { return this.lists.findAll(boardId); }

  @Post()
  create(@Param('boardId') boardId: string, @Body() body: unknown) { return this.lists.create(boardId, body); }

  @Patch(':id')
  rename(@Param('boardId') boardId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.lists.rename(boardId, id, body);
  }

  @Delete(':id')
  remove(@Param('boardId') boardId: string, @Param('id') id: string) { return this.lists.remove(boardId, id); }
}
