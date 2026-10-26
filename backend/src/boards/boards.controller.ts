import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
}
