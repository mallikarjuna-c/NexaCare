import { deleteFamilyMemberEntry } from './familyService';
import { removeAllRecords } from './healthRecordsService';
import { removeAllFollowUps } from './followUpService';
import { removeAllExpenses } from './expenseService';
import { removeMedicalInfo } from './emergencyService';

export async function removeFamilyMember(userId: string, memberId: string): Promise<void> {
  await Promise.all([
    removeAllRecords(memberId),
    removeAllFollowUps(memberId),
    removeAllExpenses(memberId),
    removeMedicalInfo(memberId),
  ]);
  await deleteFamilyMemberEntry(userId, memberId);
}
