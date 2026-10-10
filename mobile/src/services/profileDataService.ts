import { deleteFamilyMemberEntry } from './familyService';
import { removeAllRecords } from './healthRecordsService';
import { removeAllFollowUps } from './followUpService';
import { removeAllExpenses } from './expenseService';
import { removeMedicalInfo } from './emergencyService';
import { removeAllReminders } from './reminderService';
import { rescheduleReminders } from './reminderScheduler';

export async function removeFamilyMember(userId: string, memberId: string): Promise<void> {
  await Promise.all([
    removeAllRecords(memberId),
    removeAllFollowUps(memberId),
    removeAllExpenses(memberId),
    removeMedicalInfo(memberId),
    removeAllReminders(memberId),
  ]);
  await deleteFamilyMemberEntry(userId, memberId);
  await rescheduleReminders(userId).catch(() => {});
}
