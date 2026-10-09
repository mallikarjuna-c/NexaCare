import { formatCalendarDate } from './followUps';
import { parseLocalISODate } from './expenses';

export type HealthRecordType =
  | 'blood_pressure'
  | 'heart_rate'
  | 'weight'
  | 'blood_glucose'
  | 'medical_report'
  | 'prescription';

export type AttachmentType = 'pdf' | 'image';

export type HealthRecord = {
  id: string;
  type: HealthRecordType;
  value: string;
  date: string;
  notes?: string;
  providerName?: string;
  attachmentUri?: string;
  attachmentName?: string;
  attachmentType?: AttachmentType;
  createdAt: string;
};

export type NewHealthRecordInput = {
  type: HealthRecordType;
  value: string;
  date: string;
  notes?: string;
  providerName?: string;
  attachmentUri?: string;
  attachmentName?: string;
  attachmentType?: AttachmentType;
};

export const RECORD_TYPE_LABELS: Record<HealthRecordType, string> = {
  blood_pressure: 'Blood Pressure',
  heart_rate: 'Heart Rate',
  weight: 'Weight',
  blood_glucose: 'Blood Glucose',
  medical_report: 'Medical Report',
  prescription: 'Prescription',
};

export const DOCUMENT_TYPES: HealthRecordType[] = ['medical_report', 'prescription'];

export const WATCH_TRACKED_TYPES: HealthRecordType[] = ['heart_rate', 'blood_pressure'];

export function formatRecordDate(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatCalendarDate(parseLocalISODate(date)) : date;
}