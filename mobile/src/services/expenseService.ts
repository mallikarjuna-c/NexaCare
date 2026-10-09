import { loadData, removeLocalData, saveData } from './profileStore';
import type { Expense, ExpenseInput } from '../types/expenses';

async function readAll(userId: string): Promise<Expense[]> {
  const list = await loadData<Expense[]>('expenses', userId, []);
  return Array.isArray(list) ? list : [];
}

async function writeAll(userId: string, list: Expense[]): Promise<void> {
  await saveData('expenses', userId, list);
}

export async function removeAllExpenses(userId: string): Promise<void> {
  await removeLocalData('expenses', userId);
}

export async function getExpenses(userId: string): Promise<Expense[]> {
  const list = await readAll(userId);
  return list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function getExpenseById(userId: string, id: string): Promise<Expense | null> {
  const list = await readAll(userId);
  return list.find((e) => e.id === id) ?? null;
}

export async function addExpense(userId: string, input: ExpenseInput): Promise<Expense> {
  const now = new Date().toISOString();
  const expense: Expense = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  const list = await readAll(userId);
  await writeAll(userId, [expense, ...list]);
  return expense;
}

export async function updateExpense(userId: string, id: string, input: ExpenseInput): Promise<Expense> {
  const list = await readAll(userId);
  const existing = list.find((e) => e.id === id);
  if (!existing) throw new Error('Expense not found.');

  const expense: Expense = { ...existing, ...input, updatedAt: new Date().toISOString() };
  await writeAll(userId, list.map((e) => (e.id === id ? expense : e)));
  return expense;
}

export async function deleteExpense(userId: string, id: string): Promise<void> {
  const list = await readAll(userId);
  await writeAll(userId, list.filter((e) => e.id !== id));
}
