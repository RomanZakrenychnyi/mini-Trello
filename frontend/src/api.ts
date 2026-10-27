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
  position: number;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api${path}`, { ...options, signal: AbortSignal.timeout(10000) }); }
  catch { throw new Error('Не удалось связаться с сервером. Проверьте соединение и повторите попытку.'); }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(typeof body?.message === 'string' ? body.message : 'Не удалось выполнить запрос', response.status);
  }
  return response.json() as Promise<T>;
}
