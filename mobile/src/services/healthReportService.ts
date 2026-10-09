import { Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildReportHtml, buildReportText, type ReportData } from './healthReportFormat';

export { hasReportContent, type ReportData } from './healthReportFormat';

export async function sharePdfReport(data: ReportData): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  const { uri } = await Print.printToFileAsync({ html: buildReportHtml(data) });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share health summary',
    UTI: 'com.adobe.pdf',
  });
}

export async function shareTextReport(data: ReportData): Promise<void> {
  await Share.share({ message: buildReportText(data), title: 'NexaCare health summary' });
}
