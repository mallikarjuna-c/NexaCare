export type ExpenseCategory = 'consultation' | 'medicine' | 'lab_test' | 'hospital' | 'insurance' | 'other';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'insurance' | 'other';

export type ReceiptType = 'pdf' | 'image';

export type Expense = {
  id: string;
  title: string;
  amountPaise: number;
  category: ExpenseCategory;
  date: string;
  providerName?: string;
  providerId?: string;
  paymentMethod: PaymentMethod;
  claimable: boolean;
  notes?: string;
  receiptUri?: string;
  receiptName?: string;
  receiptType?: ReceiptType;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>;

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  consultation: 'Consultation',
  medicine: 'Medicines',
  lab_test: 'Lab Tests',
  hospital: 'Hospital',
  insurance: 'Insurance',
  other: 'Other',
};

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  insurance: 'Insurance',
  other: 'Other',
};

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

function groupIndian(digits: string): string {
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
}

export function formatAmount(paise: number): string {
  const abs = Math.abs(Math.round(paise));
  const rupees = groupIndian(String(Math.floor(abs / 100)));
  const fraction = abs % 100;
  const sign = paise < 0 ? '-' : '';
  return `${sign}₹${rupees}${fraction ? `.${String(fraction).padStart(2, '0')}` : ''}`;
}

export function parseAmountToPaise(text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise <= 0 || paise > 99_99_99_999_00) return null;
  return paise;
}

export function paiseToInput(paise: number): string {
  const whole = Math.floor(paise / 100);
  const fraction = paise % 100;
  return fraction ? `${whole}.${String(fraction).padStart(2, '0')}` : String(whole);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseLocalISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export type MonthKey = string;

export function currentMonthKey(): MonthKey {
  return toLocalISODate(new Date()).slice(0, 7);
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(key: MonthKey, short = false): string {
  const [y, m] = key.split('-').map(Number);
  const name = MONTH_NAMES[m - 1];
  if (short) return name.slice(0, 3);
  return y === new Date().getFullYear() ? name : `${name} ${y}`;
}

export type MonthSummary = {
  total: number;
  count: number;
  claimableTotal: number;
  byCategory: { category: ExpenseCategory; total: number }[];
};

export function summarizeMonth(expenses: Expense[], month: MonthKey): MonthSummary {
  const inMonth = expenses.filter((e) => e.date.startsWith(month));
  const totals = new Map<ExpenseCategory, number>();
  let total = 0;
  let claimableTotal = 0;

  for (const e of inMonth) {
    total += e.amountPaise;
    if (e.claimable) claimableTotal += e.amountPaise;
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amountPaise);
  }

  const byCategory = [...totals.entries()]
    .map(([category, sum]) => ({ category, total: sum }))
    .sort((a, b) => b.total - a.total);

  return { total, count: inMonth.length, claimableTotal, byCategory };
}
