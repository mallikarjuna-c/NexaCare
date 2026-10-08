import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import type { TrendPoint } from '../types/trends';
import { colors } from '../theme/theme';

// Single-metric daily chart: line (with optional second line, e.g. diastolic BP) or bars.
// One slot per calendar day; tap anywhere to select the nearest day with data.

type Props = {
  points: TrendPoint[]; // oldest first, days with data only
  days: number; // number of calendar days shown, ending today
  kind: 'line' | 'bar';
  band?: { lo: number; hi: number };
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
  formatAxis: (v: number) => string;
};

const HEIGHT = 190;
const PAD = { top: 12, bottom: 22, left: 38, right: 8 };
export const SERIES_COLORS = { primary: colors.green, secondary: colors.blue };

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Round axis bounds to tidy numbers.
function niceBounds(min: number, max: number): [number, number] {
  if (min === max) return [min * 0.9, max * 1.1 || 1];
  const range = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(range))) / 2;
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}

export default function TrendChart({ points, days, kind, band, selectedDay, onSelectDay, formatAxis }: Props) {
  const [width, setWidth] = useState(0);

  const calendar = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return isoDay(d);
  });
  const indexOf = new Map(calendar.map((day, i) => [day, i]));
  const plotted = points.filter((p) => indexOf.has(p.day));

  const values = plotted.flatMap((p) => (p.value2 != null ? [p.value, p.value2] : [p.value]));
  const withBand = band ? [...values, band.lo, band.hi] : values;
  let [yMin, yMax] = niceBounds(Math.min(...withBand), Math.max(...withBand));
  if (kind === 'bar') yMin = 0;

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / days;
  const x = (i: number) => PAD.left + slot * i + slot / 2;
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const linePath = (key: 'value' | 'value2') =>
    plotted
      .filter((p) => p[key] != null)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(indexOf.get(p.day)!).toFixed(1)} ${y(p[key] as number).toFixed(1)}`)
      .join(' ');

  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  // Label the first, middle and last day (7 days: every other day).
  const labelEvery = days <= 7 ? 1 : Math.ceil(days / 5);

  const handlePress = (locationX: number) => {
    if (!plotted.length) return;
    const i = Math.round((locationX - PAD.left - slot / 2) / slot);
    const nearest = plotted.reduce((best, p) =>
      Math.abs(indexOf.get(p.day)! - i) < Math.abs(indexOf.get(best.day)! - i) ? p : best
    );
    onSelectDay(nearest.day);
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Pressable onPress={(e) => handlePress(e.nativeEvent.locationX)} accessibilityRole="adjustable" accessibilityLabel="Trend chart — tap to see a day">
          <Svg width={width} height={HEIGHT}>
            {/* Healthy band */}
            {band && (
              <Rect
                x={PAD.left}
                width={plotW}
                y={y(Math.min(band.hi, yMax))}
                height={Math.max(0, y(Math.max(band.lo, yMin)) - y(Math.min(band.hi, yMax)))}
                fill={colors.badge.greenBg}
                opacity={0.6}
              />
            )}
            {/* Recessive grid */}
            {ticks.map((t) => (
              <Line key={t} x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
            ))}

            {kind === 'bar'
              ? plotted.map((p) => {
                  const i = indexOf.get(p.day)!;
                  const barW = Math.max(3, Math.min(18, slot * 0.6));
                  const top = y(p.value);
                  const selected = p.day === selectedDay;
                  return (
                    <Rect
                      key={p.day}
                      x={x(i) - barW / 2}
                      y={top}
                      width={barW}
                      height={Math.max(2, PAD.top + plotH - top)}
                      rx={Math.min(4, barW / 2)}
                      fill={SERIES_COLORS.primary}
                      opacity={selected || !selectedDay ? 1 : 0.45}
                    />
                  );
                })
              : (
                <>
                  {plotted.some((p) => p.value2 != null) && (
                    <Path d={linePath('value2')} stroke={SERIES_COLORS.secondary} strokeWidth={2} fill="none" strokeLinejoin="round" />
                  )}
                  <Path d={linePath('value')} stroke={SERIES_COLORS.primary} strokeWidth={2} fill="none" strokeLinejoin="round" />
                  {plotted.map((p) => {
                    const i = indexOf.get(p.day)!;
                    const selected = p.day === selectedDay;
                    return (
                      <G key={p.day}>
                        {selected && (
                          <Line x1={x(i)} x2={x(i)} y1={PAD.top} y2={PAD.top + plotH} stroke={colors.textSecondary} strokeWidth={1} strokeDasharray="3 3" />
                        )}
                        {p.value2 != null && (
                          <Circle cx={x(i)} cy={y(p.value2)} r={selected ? 6 : 4} fill={SERIES_COLORS.secondary} stroke={colors.surface} strokeWidth={2} />
                        )}
                        <Circle cx={x(i)} cy={y(p.value)} r={selected ? 6 : 4} fill={SERIES_COLORS.primary} stroke={colors.surface} strokeWidth={2} />
                      </G>
                    );
                  })}
                </>
              )}
          </Svg>

          {/* Axis labels (plain Text keeps them crisp and theme-coloured) */}
          {ticks.map((t) => (
            <Text key={`t${t}`} style={[styles.yLabel, { top: y(t) - 7 }]}>{formatAxis(t)}</Text>
          ))}
          <View style={[styles.xRow, { left: PAD.left, width: plotW }]}>
            {calendar.map((day, i) =>
              i % labelEvery === 0 || i === days - 1 ? (
                <Text key={day} style={[styles.xLabel, { left: slot * i, width: slot }, day === selectedDay && styles.xLabelSelected]}>
                  {i === days - 1 ? 'Today' : `${Number(day.slice(8))}`}
                </Text>
              ) : null
            )}
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  yLabel: { position: 'absolute', left: 0, width: PAD.left - 6, textAlign: 'right', fontSize: 10, color: colors.textSecondary },
  xRow: { position: 'absolute', top: HEIGHT - PAD.bottom + 6, height: 14 },
  xLabel: { position: 'absolute', textAlign: 'center', fontSize: 10, color: colors.textSecondary, overflow: 'visible' },
  xLabelSelected: { color: colors.green, fontWeight: '800' },
});
