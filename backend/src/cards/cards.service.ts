import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  private data(body: unknown, creating = false): { title?: string; description?: string } {
    if (typeof body !== 'object' || body === null) throw new BadRequestException('Укажите данные карточки');
    const data: { title?: string; description?: string } = {};
    if ('title' in body) {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) {
        throw new BadRequestException('Название должно содержать от 1 до 200 символов');
      }
      data.title = body.title.trim();
    } else if (creating) throw new BadRequestException('Укажите название карточки');
    if ('description' in body) {
      if (typeof body.description !== 'string' || body.description.length > 5000) {
        throw new BadRequestException('Описание должно быть строкой не длиннее 5000 символов');
      }
      data.description = body.description;
    }
    if (!Object.keys(data).length) throw new BadRequestException('Укажите название или описание');
    return data;
  }

  private async requireList(boardId: string, listId: string) {
    if (!await this.prisma.boardList.findFirst({ where: { id: listId, boardId } })) {
      throw new NotFoundException('Список не найден на этой доске');
    }
  }

  async findAll(boardId: string, listId: string) {
    await this.requireList(boardId, listId);
    return this.prisma.card.findMany({ where: { listId }, orderBy: { position: 'asc' } });
  }

  async create(boardId: string, listId: string, body: unknown) {
    const data = this.data(body, true);
    await this.requireList(boardId, listId);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const last = await tx.card.aggregate({ where: { listId }, _max: { position: true } });
          return tx.card.create({ data: { listId, title: data.title!, description: data.description ?? '', position: (last._max.position ?? -1) + 1 } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2003') throw new NotFoundException('Список не найден');
          if (['P2002', 'P2034'].includes(error.code)) continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Список изменился параллельно. Повторите создание карточки.');
  }

  async update(boardId: string, listId: string, id: string, body: unknown) {
    const data = this.data(body);
    try {
      return await this.prisma.card.update({ where: { id, listId, list: { boardId } }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Карточка не найдена в этом списке');
      throw error;
    }
  }

  async move(boardId: string, listId: string, id: string, body: unknown) {
    if (!body || typeof body !== 'object' || !('targetListId' in body) || typeof body.targetListId !== 'string' ||
        !('position' in body) || typeof body.position !== 'number' || !Number.isSafeInteger(body.position) || body.position < 0) {
      throw new BadRequestException('Укажите целевой список и целую позицию от 0');
    }
    const { targetListId, position } = body;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const card = await tx.card.findFirst({ where: { id, listId, list: { boardId } } });
          if (!card) throw new NotFoundException('Карточка не найдена в этом списке');
          if (!await tx.boardList.findFirst({ where: { id: targetListId, boardId } })) {
            throw new NotFoundException('Целевой список не найден на этой доске');
          }
          const affected = await tx.card.findMany({ where: { listId: { in: [listId, targetListId] } }, orderBy: { position: 'asc' } });
          const target = affected.filter((item) => item.listId === targetListId && item.id !== id);
          if (position > target.length) throw new BadRequestException('Позиция выходит за границы списка');
          target.splice(position, 0, card);
          const source = listId === targetListId ? [] : affected.filter((item) => item.listId === listId && item.id !== id);
          // Vacate all occupied positions before assigning the final order (unique listId + position).
          const offset = Math.max(0, ...affected.map((item) => item.position)) + 1;
          for (let index = 0; index < affected.length; index++) {
            await tx.card.update({ where: { id: affected[index]!.id }, data: { position: offset + index } });
          }
          for (const [destination, items] of [[listId, source], [targetListId, target]] as const) {
            for (let index = 0; index < items.length; index++) {
              await tx.card.update({ where: { id: items[index]!.id }, data: { listId: destination, position: index } });
            }
          }
          return tx.card.findUniqueOrThrow({ where: { id } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) continue;
        throw error;
      }
    }
    throw new ConflictException('Доска изменилась параллельно. Обновите её и повторите перемещение.');
  }

  async remove(boardId: string, listId: string, id: string) {
    const deleted = await this.prisma.card.deleteMany({ where: { id, listId, list: { boardId } } });
    if (!deleted.count) throw new NotFoundException('Карточка не найдена в этом списке');
    return { id };
  }
}
