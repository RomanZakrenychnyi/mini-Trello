import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BoardsService } from '../boards/boards.service';

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService, private readonly boards: BoardsService) {}

  private name(body: unknown): string {
    if (typeof body !== 'object' || body === null || !('name' in body) || typeof body.name !== 'string') {
      throw new BadRequestException('Укажите название списка');
    }
    const name = body.name.trim();
    if (!name || name.length > 100) throw new BadRequestException('Название должно содержать от 1 до 100 символов');
    return name;
  }

  async findAll(boardId: string) {
    await this.boards.findOne(boardId);
    return this.prisma.boardList.findMany({ where: { boardId }, orderBy: { position: 'asc' } });
  }

  async create(boardId: string, body: unknown) {
    const name = this.name(body);
    await this.boards.findOne(boardId);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const last = await tx.boardList.aggregate({ where: { boardId }, _max: { position: true } });
          return tx.boardList.create({ data: { boardId, name, position: (last._max.position ?? -1) + 1 } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2002', 'P2034'].includes(error.code)) throw error;
      }
    }
    throw new ConflictException('Список изменился параллельно. Повторите создание.');
  }

  async rename(boardId: string, id: string, body: unknown) {
    const name = this.name(body);
    try {
      return await this.prisma.boardList.update({ where: { id, boardId }, data: { name } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Список не найден на этой доске');
      }
      throw error;
    }
  }

  async remove(boardId: string, id: string) {
    // Cards are not implemented yet, so all existing lists are empty.
    const deleted = await this.prisma.boardList.deleteMany({ where: { id, boardId } });
    if (!deleted.count) throw new NotFoundException('Список не найден на этой доске');
    return { id };
  }
}
