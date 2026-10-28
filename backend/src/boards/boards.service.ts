import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  private name(body: unknown) {
    if (typeof body !== 'object' || body === null || !('name' in body) || typeof body.name !== 'string') {
      throw new BadRequestException('Укажите название доски');
    }
    const name = body.name.trim();
    if (!name || name.length > 100) throw new BadRequestException('Название должно содержать от 1 до 100 символов');
    return name;
  }

  create(body: unknown) {
    return this.prisma.board.create({ data: { name: this.name(body) } });
  }

  async update(id: string, body: unknown) {
    const name = this.name(body);
    try { return await this.prisma.board.update({ where: { id }, data: { name } }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Доска не найдена');
      throw error;
    }
  }

  async deletionPreview(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const board = await tx.board.findUnique({ where: { id } });
      if (!board) throw new NotFoundException('Доска не найдена');
      const lists = await tx.boardList.count({ where: { boardId: id } });
      const cards = await tx.card.count({ where: { list: { boardId: id } } });
      return { lists, cards };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async remove(id: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          if (!await tx.board.findUnique({ where: { id } })) throw new NotFoundException('Доска не найдена');
          // Cards restrict list deletion; remove descendants explicitly in the same transaction.
          await tx.card.deleteMany({ where: { list: { boardId: id } } });
          await tx.boardList.deleteMany({ where: { boardId: id } });
          await tx.board.delete({ where: { id } });
          return { id };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (['P2034', 'P2003'].includes(error.code)) continue;
          if (error.code === 'P2025') throw new NotFoundException('Доска не найдена');
        }
        throw error;
      }
    }
    throw new ConflictException('Доска изменилась параллельно. Повторите удаление.');
  }
}
