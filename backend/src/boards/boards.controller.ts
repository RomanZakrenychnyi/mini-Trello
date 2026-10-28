import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { BoardsService } from './boards.service';

@Controller('boards')
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}
  @Get()
  findAll() { return this.boards.findAll(); }
  @Get(':id')
  findOne(@Param('id') id: string) { return this.boards.findOne(id); }
  @Post()
  create(@Body() body: unknown) { return this.boards.create(body); }
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) { return this.boards.update(id, body); }
  @Get(':id/deletion-preview')
  deletionPreview(@Param('id') id: string) { return this.boards.deletionPreview(id); }
  @Delete(':id')
  remove(@Param('id') id: string) { return this.boards.remove(id); }
}
