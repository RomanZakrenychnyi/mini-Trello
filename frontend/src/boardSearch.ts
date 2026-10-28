import type { InjectionKey, Ref } from 'vue';

export interface BoardSearch {
  query: Ref<string>;
  report(listId: string, result: { count: number; failed: boolean } | null): void;
}
export const boardSearch: InjectionKey<BoardSearch> = Symbol('boardSearch');
