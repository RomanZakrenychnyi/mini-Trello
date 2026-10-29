import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  private data(body: unknown, creating = false) {
    if (!body || typeof body !== 'object') throw new BadRequestException('Укажите данные пункта');
    const data: { title?: string; completed?: boolean } = {};
    if ('title' in body) {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) {
        throw new BadRequestException('Название пункта должно содержать от 1 до 200 символов');
      }
      data.title = body.title.trim();
    } else if (creating) throw new BadRequestException('Укажите название пункта');
    if ('completed' in body) {
      if (typeof body.completed !== 'boolean') throw new BadRequestException('Отметка выполнения должна быть true или false');
      data.completed = body.completed;
    }
    if (!Object.keys(data).length) throw new BadRequestException('Укажите название или выполнение пункта');
    return data;
  }

  private cardWhere(boardId: string, listId: string, cardId: string) {
    return { id: cardId, listId, list: { boardId } };
  }

  async findAll(boardId: string, listId: string, cardId: string) {
    if (!await this.prisma.card.findFirst({ where: this.cardWhere(boardId, listId, cardId) })) {
      throw new NotFoundException('Карточка не найдена в этом списке');
    }
    return this.prisma.checklistItem.findMany({ where: { cardId }, orderBy: { position: 'asc' } });
  }

  async create(boardId: string, listId: string, cardId: string, body: unknown) {
    const data = this.data(body, true);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          if (!await tx.card.findFirst({ where: this.cardWhere(boardId, listId, cardId) })) {
            throw new NotFoundException('Карточка не найдена в этом списке');
          }
          const last = await tx.checklistItem.aggregate({ where: { cardId }, _max: { position: true } });
          return tx.checklistItem.create({ data: { cardId, ...data, title: data.title!, position: (last._max.position ?? -1) + 1 } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (['P2002', 'P2034'].includes(error.code)) continue;
          if (error.code === 'P2003') throw new NotFoundException('Карточка не найдена');
        }
        throw error;
      }
    }
    throw new ConflictException('Чек-лист изменился параллельно. Повторите создание пункта.');
  }

  async update(boardId: string, listId: string, cardId: string, id: string, body: unknown) {
    const data = this.data(body);
    try {
      return await this.prisma.checklistItem.update({
        where: { id, cardId, card: this.cardWhere(boardId, listId, cardId) }, data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Пункт не найден в этой карточке');
      throw error;
    }
  }

  async remove(boardId: string, listId: string, cardId: string, id: string) {
    const result = await this.prisma.checklistItem.deleteMany({ where: { id, cardId, card: this.cardWhere(boardId, listId, cardId) } });
    if (!result.count) throw new NotFoundException('Пункт не найден в этой карточке');
    return { id };
  }
}
