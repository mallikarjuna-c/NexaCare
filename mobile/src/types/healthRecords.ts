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
  value: string;        // acts as "Title" for medical_report / prescription
  date: string;
  notes?: string;
  providerName?: string;       // doctor/lab/pharmacy name — only meaningful for document types
  attachmentUri?: string;      // local file URI
  attachmentName?: string;     // original file name, for display
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