import type { InjectionKey, Ref } from 'vue';
import type { BoardList, Card } from './api';

export interface CardMovement {
  lists: Ref<BoardList[]>;
  dragged: Ref<Card | null>;
  target: Ref<{ listId: string; index: number } | null>;
  preview: Ref<{ x: number; y: number; width: number; height: number; settling: boolean } | null>;
  moving: Ref<boolean>;
  searchActive: Ref<boolean>;
  revision: Ref<number>;
  move(card: Card, targetListId: string, position: number): Promise<void>;
}
export const cardMovement: InjectionKey<CardMovement> = Symbol('cardMovement');
