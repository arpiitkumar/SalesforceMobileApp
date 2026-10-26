/**
 * Sales Reports (DEMO) - chart components (react-native-svg + plain Views).
 *
 * Colour follows the dataviz method: categorical slots are used in fixed order
 * (validated palette: blue, orange, aqua, yellow, magenta, green), one axis only,
 * thin marks, 2px surface gaps/rings, recessive grid, selective direct labels,
 * and a legend whenever there are two or more series. Tapping a chart shows a
 * readout above it (the touch equivalent of a hover tooltip).
 */
import React, {useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Svg, {Circle, G, Line, Path, Text as SvgText} from 'react-native-svg';
import {C} from './ReportKit';

export const VIZ = {
  s1: '#3B5BB5', // blue
  s2: '#eb6834', // orange
  s3: '#1baf7a', // aqua
  s4: '#eda100', // yellow
  s5: '#e87ba4', // magenta
  s6: '#008300', // green
  gray: '#D9D2C3',
  grayDark: '#7A7266',
  grid: '#F1EADB',
  surface: '#FFFFFF',
  ink: '#1F1D1A',
  muted: '#7A7266',
};
export const SERIES = [VIZ.s1, VIZ.s2, VIZ.s3, VIZ.s4, VIZ.s5, VIZ.s6];

const useWidth = (initial = 300) => {
  const [w, setW] = useState(initial);
  return [w, (e: any) => setW(Math.max(120, Math.round(e.nativeEvent.layout.width)))] as const;
};

// ---------- card wrapper + legend ----------
export const Legend = ({items}: {items: {label: string; color: string; value?: string; dashed?: boolean}[]}) => (
  <View style={st.legend}>
    {items.map(i => (
      <View key={i.label} style={st.legendItem}>
        <View style={[st.swatch, {backgroundColor: i.dashed ? 'transparent' : i.color}, i.dashed && {borderWidth: 1.5, borderColor: i.color, borderStyle: 'dashed'}]} />
        <Text style={st.legendText}>
          {i.label}
          {i.value ? <Text style={{fontWeight: '700'}}>  {i.value}</Text> : null}
        </Text>
      </View>
    ))}
  </View>
);

export const ChartCard = ({title, sub, readout, legend, children}: {title: string; sub?: string; readout?: string; legend?: React.ComponentProps<typeof Legend>['items']; children: React.ReactNode}) => (
  <View style={st.card}>
    <Text style={st.title}>{title}</Text>
    {!!sub && <Text style={st.sub}>{sub}</Text>}
    <Text style={st.readout} numberOfLines={1}>{readout || ' '}</Text>
    {children}
    {legend && legend.length > 1 && <Legend items={legend} />}
  </View>
);

// ---------- line chart ----------
export type LineSeries = {name: string; color: string; data: (number | null)[]; dashed?: boolean};

export const LineChart = ({series, labels, height = 170, format = (n: number) => String(Math.round(n)), yMax, refLine, onSelect, area = true}: {
  series: LineSeries[];
  labels: string[];
  height?: number;
  format?: (n: number) => string;
  yMax?: number;
  refLine?: {value: number; label: string};
  onSelect?: (text: string) => void;
  area?: boolean;
}) => {
  const [w, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const padL = 42, padR = 12, padT = 10, padB = 22;
  const pw = w - padL - padR;
  const ph = height - padT - padB;
  const n = labels.length;
  const all = series.flatMap(s => s.data).filter((v): v is number => v !== null);
  const max = yMax ?? Math.max(1, Math.max(...all, refLine?.value ?? 0) * 1.12);
  const x = (i: number) => padL + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw);
  const y = (v: number) => padT + ph - (Math.min(v, max) / max) * ph;
  const ticks = [0, 1, 2, 3].map(i => (max / 3) * i);

  const pathFor = (data: (number | null)[]) => {
    let d = '';
    let pen = false;
    data.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  const touch = (e: any) => {
    const lx = e.nativeEvent.locationX;
    const i = Math.max(0, Math.min(n - 1, Math.round(((lx - padL) / pw) * (n - 1))));
    setSel(i);
    onSelect?.(`${labels[i]}  ·  ` + series.map(s => `${s.name} ${s.data[i] === null ? '–' : format(s.data[i] as number)}`).join('  ·  '));
  };
  const labelIdx = n <= 6 ? labels.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <View onLayout={onLayout} onTouchStart={touch} onTouchMove={touch}>
      <Svg width={w} height={height}>
        {ticks.map((t, i) => (
          <G key={i}>
            <Line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={VIZ.grid} strokeWidth={1} />
            <SvgText x={padL - 6} y={y(t) + 3} fontSize={10} fill={VIZ.muted} textAnchor="end">{format(t)}</SvgText>
          </G>
        ))}
        {refLine && (
          <G>
            <Line x1={padL} x2={w - padR} y1={y(refLine.value)} y2={y(refLine.value)} stroke={VIZ.grayDark} strokeWidth={1} strokeDasharray="4,4" />
            <SvgText x={w - padR} y={y(refLine.value) - 4} fontSize={10} fill={VIZ.muted} textAnchor="end">{refLine.label}</SvgText>
          </G>
        )}
        {labelIdx.map(i => (
          <SvgText key={i} x={x(i)} y={height - 6} fontSize={10} fill={VIZ.muted} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{labels[i]}</SvgText>
        ))}
        {area && series.length === 1 && series[0].data.every(v => v !== null) && (
          <Path d={`${pathFor(series[0].data)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={series[0].color} opacity={0.1} />
        )}
        {series.map(s => (
          <Path key={s.name} d={pathFor(s.data)} stroke={s.color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5,4' : undefined} />
        ))}
        {sel !== null && <Line x1={x(sel)} x2={x(sel)} y1={padT} y2={padT + ph} stroke={VIZ.grayDark} strokeWidth={1} />}
        {series.map(s => {
          const idx = sel !== null && s.data[sel] !== null ? sel : [...s.data].map((v, i) => (v !== null ? i : -1)).filter(i => i >= 0).pop();
          if (idx === undefined || s.data[idx] === null) return null;
          return <Circle key={s.name} cx={x(idx)} cy={y(s.data[idx] as number)} r={4.5} fill={s.color} stroke={VIZ.surface} strokeWidth={2} />;
        })}
      </Svg>
    </View>
  );
};

// ---------- column chart (emphasis: highlighted bar in accent, rest gray) ----------
export const BarChart = ({data, height = 170, color = VIZ.s1, format = (n: number) => String(Math.round(n)), refLine, onSelect}: {
  data: {label: string; value: number}[];
  height?: number;
  color?: string;
  format?: (n: number) => string;
  refLine?: {value: number; label: string};
  onSelect?: (text: string) => void;
}) => {
  const [w, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const padL = 42, padR = 8, padT = 18, padB = 22;
  const pw = w - padL - padR;
  const ph = height - padT - padB;
  const n = data.length;
  const max = Math.max(1, Math.max(...data.map(d => d.value), refLine?.value ?? 0) * 1.12);
  const slot = pw / n;
  const bw = Math.max(4, Math.min(26, slot * 0.62));
  const y = (v: number) => padT + ph - (v / max) * ph;
  const hi = sel !== null ? sel : n - 1; // default emphasis: the latest bar
  const ticks = [0, 1, 2, 3].map(i => (max / 3) * i);
  const touch = (e: any) => {
    const i = Math.max(0, Math.min(n - 1, Math.floor((e.nativeEvent.locationX - padL) / slot)));
    setSel(i);
    onSelect?.(`${data[i].label}  ·  ${format(data[i].value)}`);
  };
  const bar = (i: number) => {
    const v = data[i].value;
    const top = y(v);
    const bx = padL + slot * i + (slot - bw) / 2;
    const h = Math.max(0, padT + ph - top);
    const r = Math.min(4, bw / 2, h);
    return `M${bx},${top + h} L${bx},${top + r} Q${bx},${top} ${bx + r},${top} L${bx + bw - r},${top} Q${bx + bw},${top} ${bx + bw},${top + r} L${bx + bw},${top + h} Z`;
  };
  const labelIdx = n <= 7 ? data.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <View onLayout={onLayout} onTouchStart={touch} onTouchMove={touch}>
      <Svg width={w} height={height}>
        {ticks.map((t, i) => (
          <G key={i}>
            <Line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={VIZ.grid} strokeWidth={1} />
            <SvgText x={padL - 6} y={y(t) + 3} fontSize={10} fill={VIZ.muted} textAnchor="end">{format(t)}</SvgText>
          </G>
        ))}
        {data.map((d, i) => (
          <Path key={i} d={bar(i)} fill={i === hi ? color : VIZ.gray} />
        ))}
        {refLine && (
          <G>
            <Line x1={padL} x2={w - padR} y1={y(refLine.value)} y2={y(refLine.value)} stroke={VIZ.ink} strokeWidth={1} strokeDasharray="4,4" opacity={0.55} />
            <SvgText x={w - padR} y={y(refLine.value) - 4} fontSize={10} fill={VIZ.muted} textAnchor="end">{refLine.label}</SvgText>
          </G>
        )}
        <SvgText x={padL + slot * hi + slot / 2} y={y(data[hi].value) - 5} fontSize={10.5} fontWeight="700" fill={VIZ.ink} textAnchor="middle">{format(data[hi].value)}</SvgText>
        {labelIdx.map(i => (
          <SvgText key={i} x={padL + slot * i + slot / 2} y={height - 6} fontSize={10} fill={VIZ.muted} textAnchor="middle">{data[i].label}</SvgText>
        ))}
      </Svg>
    </View>
  );
};

// ---------- horizontal bars (ranking / comparison) ----------
export type HRow = {label: string; value: number; text?: string; color?: string; bold?: boolean};
export const HBar = ({rows, max, refs = [], format = (n: number) => String(Math.round(n))}: {
  rows: HRow[];
  max?: number;
  refs?: {value: number; label: string}[];
  format?: (n: number) => string;
}) => {
  const m = max ?? Math.max(1, ...rows.map(r => r.value), ...refs.map(r => r.value)) * 1.05;
  return (
    <View>
      {rows.map(r => (
        <View key={r.label} style={st.hRow}>
          <Text style={[st.hLabel, r.bold && {fontWeight: '800'}]} numberOfLines={1}>{r.label}</Text>
          <View style={st.hTrack}>
            <View style={[st.hFill, {width: `${Math.max(0, Math.min(100, (r.value / m) * 100))}%`, backgroundColor: r.color || VIZ.gray}]} />
            {refs.map(rf => (
              <View key={rf.label} style={[st.hRef, {left: `${(rf.value / m) * 100}%`}]} />
            ))}
          </View>
          <Text style={[st.hValue, r.bold && {fontWeight: '800'}]}>{r.text ?? format(r.value)}</Text>
        </View>
      ))}
      {refs.length > 0 && (
        <Text style={st.refNote}>┆ {refs.map(r => r.label).join('  ·  ')}</Text>
      )}
    </View>
  );
};

// ---------- stacked bar (part-to-whole) ----------
export const StackedBar = ({segments, format = (n: number) => String(Math.round(n)), height = 26}: {
  segments: {label: string; value: number; color: string}[];
  format?: (n: number) => string;
  height?: number;
}) => {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <View>
      <View style={{flexDirection: 'row', height}}>
        {segments.filter(s => s.value > 0).map((s, i, arr) => {
          const share = s.value / total;
          return (
            <View key={s.label} style={{flex: s.value, backgroundColor: s.color, marginRight: i < arr.length - 1 ? 2 : 0, borderTopLeftRadius: i === 0 ? 5 : 0, borderBottomLeftRadius: i === 0 ? 5 : 0, borderTopRightRadius: i === arr.length - 1 ? 5 : 0, borderBottomRightRadius: i === arr.length - 1 ? 5 : 0, justifyContent: 'center', alignItems: 'center'}}>
              {share >= 0.12 && <Text style={[st.segText, [VIZ.s3, VIZ.s4, VIZ.s5, VIZ.gray].includes(s.color) && {color: VIZ.ink}]}>{Math.round(share * 100)}%</Text>}
            </View>
          );
        })}
      </View>
      <Legend items={segments.map(s => ({label: s.label, color: s.color, value: `${format(s.value)}`}))} />
    </View>
  );
};

// ---------- meter (progress against a target, optional slab ticks) ----------
export const Meter = ({value, max = 100, color = VIZ.s1, ticks = [], height = 14, text}: {
  value: number;
  max?: number;
  color?: string;
  ticks?: {at: number; label: string}[];
  height?: number;
  text?: string;
}) => (
  <View>
    <View style={{height, backgroundColor: '#E8F0FB', borderRadius: height / 2, overflow: 'hidden'}}>
      <View style={{width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, height, backgroundColor: color, borderRadius: height / 2}} />
    </View>
    {ticks.length > 0 && (
      <View style={{height: 26}}>
        {ticks.map(t => (
          <View key={t.label} style={{position: 'absolute', left: `${(t.at / max) * 100}%`, top: 0, alignItems: 'center', width: 44, marginLeft: -22}}>
            <View style={{width: 1.5, height: 8, backgroundColor: VIZ.grayDark}} />
            <Text style={{fontSize: 10, color: VIZ.muted}}>{t.label}</Text>
          </View>
        ))}
      </View>
    )}
    {!!text && <Text style={{fontSize: 12, color: VIZ.muted, marginTop: 6}}>{text}</Text>}
  </View>
);

// ---------- sparkline ----------
export const Sparkline = ({data, color = VIZ.s1, width = 76, height = 30}: {data: number[]; color?: string; width?: number; height?: number}) => {
  if (data.length < 2) return <View style={{width, height}} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pad = 4;
  const pts = data.map((v, i) => [pad + (i / (data.length - 1)) * (width - pad * 2), pad + (1 - (v - min) / span) * (height - pad * 2)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={last[0]} cy={last[1]} r={3.5} fill={color} stroke={VIZ.surface} strokeWidth={2} />
    </Svg>
  );
};

const st = StyleSheet.create({
  card: {backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: C.line},
  title: {fontSize: 14, fontWeight: '700', color: VIZ.ink},
  sub: {fontSize: 11.5, color: VIZ.muted, marginTop: 2},
  readout: {fontSize: 12, fontWeight: '600', color: VIZ.ink, marginTop: 8, marginBottom: 4, minHeight: 16},
  legend: {flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10},
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
  swatch: {width: 12, height: 12, borderRadius: 3},
  legendText: {fontSize: 11.5, color: VIZ.ink},
  segText: {fontSize: 10.5, fontWeight: '700', color: '#fff'},
  hRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8},
  hLabel: {width: 92, fontSize: 12, color: VIZ.ink},
  hTrack: {flex: 1, height: 12, backgroundColor: '#F1F2F5', borderRadius: 6, justifyContent: 'center'},
  hFill: {height: 12, borderRadius: 6, position: 'absolute', left: 0, top: 0},
  hRef: {position: 'absolute', top: -2, bottom: -2, width: 1.5, backgroundColor: VIZ.ink, opacity: 0.55},
  hValue: {width: 58, fontSize: 12, color: VIZ.ink, textAlign: 'right'},
  refNote: {fontSize: 10.5, color: VIZ.muted, marginTop: 2},
});
