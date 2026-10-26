import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.board.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
  }

  async findOne(id: string) {
    const board = await this.prisma.board.findUnique({ where: { id } });
    if (!board) throw new NotFoundException('Доска не найдена');
    return board;
  }

  create(body: unknown) {
    if (typeof body !== 'object' || body === null || !('name' in body) || typeof body.name !== 'string') {
      throw new BadRequestException('Укажите название доски');
    }
    const name = body.name.trim();
    if (!name || name.length > 100) throw new BadRequestException('Название должно содержать от 1 до 100 символов');
    return this.prisma.board.create({ data: { name } });
  }
}
