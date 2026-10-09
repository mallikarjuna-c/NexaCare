import { View, Text, StyleSheet } from 'react-native';
import { parseMessage, type InlinePart } from '../types/messageFormat';
import { colors, spacing } from '../theme/theme';

// Renders an assistant reply with real bold text, bullets, numbered lists and headings.

function Inline({ parts }: { parts: InlinePart[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <Text key={i} style={[p.bold && styles.bold, p.italic && styles.italic, p.code && styles.code]}>
          {p.text}
        </Text>
      ))}
    </>
  );
}

export default function FormattedMessage({ text }: { text: string }) {
  const blocks = parseMessage(text);

  return (
    <View>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'gap':
            return <View key={i} style={styles.gap} />;
          case 'heading':
            return (
              <Text key={i} style={styles.heading} selectable>
                <Inline parts={b.parts} />
              </Text>
            );
          case 'bullet':
          case 'number':
            return (
              <View key={i} style={[styles.listRow, b.level > 0 && styles.nested]}>
                {b.kind === 'bullet' ? (
                  <View style={[styles.dot, b.level > 0 && styles.dotNested]} />
                ) : (
                  <Text style={styles.number}>{b.n}.</Text>
                )}
                <Text style={[styles.body, styles.listText]} selectable>
                  <Inline parts={b.parts} />
                </Text>
              </View>
            );
          default:
            return (
              <Text key={i} style={styles.body} selectable>
                <Inline parts={b.parts} />
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22, color: colors.textPrimary },
  bold: { fontWeight: '700', color: colors.textPrimary },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: 'monospace', fontSize: 14, backgroundColor: colors.background },
  heading: { fontSize: 15, lineHeight: 22, fontWeight: '800', color: colors.primaryDark, marginTop: 2, marginBottom: 2 },
  gap: { height: spacing.sm },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: 3 },
  nested: { paddingLeft: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green, marginTop: 8 },
  dotNested: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.green },
  number: { minWidth: 18, fontSize: 15, lineHeight: 22, fontWeight: '700', color: colors.green },
  listText: { flex: 1 },
});
