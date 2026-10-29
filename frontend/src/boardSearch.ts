import type { InjectionKey, Ref } from 'vue';

export type CardFilter = 'all' | 'pending' | 'completed' | 'overdue';

export function localDay() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export interface BoardSearch {
  query: Ref<string>;
  filter: Ref<CardFilter>;
  today: Ref<string>;
  report(listId: string, result: { count: number; failed: boolean } | null): void;
}
export const boardSearch: InjectionKey<BoardSearch> = Symbol('boardSearch');
