export interface Board {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardList {
  id: string;
  boardId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  listId: string;
  title: string;
  description: string;
  dueDate: string | null;
  completed: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CardInput {
  title: string;
  description: string;
  dueDate: string | null;
  completed: boolean;
}

export interface ChecklistItem {
  id: string;
  cardId: string;
  title: string;
  completed: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  const reading = !options?.method || options.method.toUpperCase() === 'GET';
  // Render Free can take about a minute to wake up. Never retry writes automatically.
  try { response = await fetch(`/api${path}`, { ...options, signal: AbortSignal.timeout(reading ? 90000 : 30000) }); }
  catch {
    throw new Error(reading
      ? 'Не удалось связаться с сервером. Проверьте соединение и повторите загрузку.'
      : 'Не удалось получить ответ сервера. Изменение могло сохраниться: проверьте результат после обновления страницы перед повторной отправкой.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(typeof body?.message === 'string' ? body.message : 'Не удалось выполнить запрос', response.status);
  }
  try { return await response.json() as T; }
  catch { throw new Error('Сервер вернул некорректный ответ. Обновите страницу и проверьте результат.'); }
}
