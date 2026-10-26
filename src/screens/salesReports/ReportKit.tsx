/**
 * Sales Reports (DEMO) - shared UI pieces.
 * Icons are plain text/emoji on purpose (the vector-icon glyph maps are
 * unreliable in this build); only the back chevron uses Feather.
 */
import React, {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';
import Feather from '@react-native-vector-icons/feather';
import {useSelector} from 'react-redux';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import {Period, ViewMode, PERIOD_LABEL} from './reportData';

export const C = {
  gold: '#A67C2E',
  goldLight: '#C9A24D',
  navy: '#13265C',
  bg: '#FBF8F1',
  green: '#2E7D5B',
  red: '#B3261E',
  amber: '#D08C1F',
  text: '#1F1D1A',
  muted: '#7A7266',
  line: '#D9D2C3',
};

export type CurrentUser = {id: string; name: string; role: string};

/** Current logged-in user (same User table the Home header reads). */
export const useCurrentUser = (): CurrentUser => {
  const authUserId = useSelector((s: any) => s?.auth?.userId);
  const [user, setUser] = useState<CurrentUser>({id: authUserId || 'demo-user', name: '', role: ''});
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res: any = await UniversalUpdateInsert({ObjectName: 'User', Type: 'get'});
        const u = Array.isArray(res) ? res[0] : null;
        if (active && u) {
          setUser({id: u.Sf_Id || authUserId || 'demo-user', name: u.Name || '', role: u.Role || u.DeveloperName || ''});
        }
      } catch (e) {}
    })();
    return () => {
      active = false;
    };
  }, [authUserId]);
  return {...user, name: user.name || 'Sales Rep'};
};

const Segmented = ({options, value, onChange}: {options: {key: string; label: string}[]; value: string; onChange: (k: any) => void}) => (
  <View style={s.segment}>
    {options.map(o => (
      <TouchableOpacity key={o.key} style={[s.segBtn, value === o.key && s.segOn]} onPress={() => onChange(o.key)}>
        <Text style={[s.segText, value === o.key && s.segTextOn]}>{o.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

type ShellProps = {
  title: string;
  user: CurrentUser;
  navigation: any;
  view?: ViewMode;
  setView?: (v: ViewMode) => void;
  period?: Period;
  setPeriod?: (p: Period) => void;
  extra?: React.ReactNode;
  children: React.ReactNode;
};

export const ReportShell = ({title, user, navigation, view, setView, period, setPeriod, extra, children}: ShellProps) => (
  <SafeAreaView style={s.safe} edges={['top']}>
    <StatusBar barStyle="light-content" backgroundColor={C.goldLight} />
    <LinearGradient colors={[C.goldLight, C.gold]} style={s.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
        <Feather name="chevron-left" size={28} color="#fff" />
      </TouchableOpacity>
      <View style={{marginLeft: 8, flex: 1}}>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        <Text style={s.headerSub} numberOfLines={1}>
          {user.name}
          {view ? (view === 'manager' ? ' · Manager view' : ' · Salesman view') : ''}
        </Text>
      </View>
    </LinearGradient>
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.userCard}>
        <View style={s.avatar}><Text style={s.avatarText}>{user.name.trim().charAt(0).toUpperCase()}</Text></View>
        <View style={{flex: 1}}>
          <Text style={s.userName}>{user.name}</Text>
          <Text style={s.userRole} numberOfLines={1}>{user.role || 'Sales Representative'} · Demo data</Text>
        </View>
      </View>
      {view && setView && (
        <Segmented
          options={[{key: 'salesman', label: 'Salesman'}, {key: 'manager', label: 'Manager'}]}
          value={view}
          onChange={setView}
        />
      )}
      {period && setPeriod && (
        <View style={{marginTop: 10}}>
          <Segmented
            options={(['today', 'wtd', 'mtd'] as Period[]).map(p => ({key: p, label: p === 'today' ? 'Today' : p === 'wtd' ? 'WTD' : 'MTD'}))}
            value={period}
            onChange={setPeriod}
          />
          <Text style={s.periodCaption}>{PERIOD_LABEL[period]}</Text>
        </View>
      )}
      {extra}
      {children}
      <Text style={s.footer}>Dummy data for demo purposes only.</Text>
    </ScrollView>
  </SafeAreaView>
);

export const Section = ({title, right, children}: {title: string; right?: string; children?: React.ReactNode}) => (
  <View style={{marginTop: 18}}>
    <View style={s.secRow}>
      <Text style={s.secTitle}>{title}</Text>
      {!!right && <Text style={s.secRight}>{right}</Text>}
    </View>
    {children}
  </View>
);

export const Card = ({children, style}: {children: React.ReactNode; style?: any}) => <View style={[s.card, style]}>{children}</View>;

export const Kpis = ({items}: {items: {label: string; value: string; color?: string; sub?: string}[]}) => (
  <View style={s.kpiGrid}>
    {items.map(k => (
      <View key={k.label} style={s.kpi}>
        <Text style={[s.kpiValue, !!k.color && {color: k.color}]} numberOfLines={2}>{k.value}</Text>
        <Text style={s.kpiLabel}>{k.label}</Text>
        {!!k.sub && <Text style={s.kpiSub}>{k.sub}</Text>}
      </View>
    ))}
  </View>
);

export const Bar = ({value, color = C.gold, height = 8}: {value: number; color?: string; height?: number}) => (
  <View style={[s.barBg, {height}]}>
    <View style={[s.barFill, {width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color, height}]} />
  </View>
);

export const Pill = ({text, color, bg}: {text: string; color: string; bg: string}) => (
  <View style={[s.pill, {backgroundColor: bg}]}>
    <Text style={[s.pillText, {color}]}>{text}</Text>
  </View>
);

export const Trend = ({pct}: {pct: number}) => {
  if (Math.abs(pct) < 3) return <Text style={[s.trend, {color: C.muted}]}>– Steady</Text>;
  const up = pct > 0;
  return <Text style={[s.trend, {color: up ? C.green : C.red}]}>{up ? '▲ +' : '▼ '}{pct}%</Text>;
};

export const TableHead = ({cols}: {cols: {t: string; f?: number; a?: 'left' | 'center' | 'right'}[]}) => (
  <View style={s.tHead}>
    {cols.map((c, i) => (
      <Text key={i} style={[s.th, {flex: c.f ?? 1, textAlign: c.a ?? 'center'}]}>{c.t}</Text>
    ))}
  </View>
);
export const TableRow = ({cells, onPress}: {cells: {t: React.ReactNode; f?: number; a?: 'left' | 'center' | 'right'; color?: string; bold?: boolean}[]; onPress?: () => void}) => {
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={s.tRow} onPress={onPress} activeOpacity={0.7}>
      {cells.map((c, i) =>
        typeof c.t === 'string' || typeof c.t === 'number' ? (
          <Text key={i} style={[s.td, {flex: c.f ?? 1, textAlign: c.a ?? 'center'}, !!c.color && {color: c.color}, c.bold && {fontWeight: '700'}]} numberOfLines={1}>{c.t}</Text>
        ) : (
          <View key={i} style={{flex: c.f ?? 1, alignItems: c.a === 'right' ? 'flex-end' : c.a === 'left' ? 'flex-start' : 'center'}}>{c.t}</View>
        ),
      )}
    </Wrap>
  );
};

export const Alert = ({text, tone = 'red'}: {text: string; tone?: 'red' | 'amber' | 'green'}) => {
  const col = tone === 'red' ? C.red : tone === 'amber' ? C.amber : C.green;
  const bg = tone === 'red' ? '#FDECEC' : tone === 'amber' ? '#F1EADB' : '#E6F6EC';
  return (
    <View style={[s.alert, {backgroundColor: bg, borderLeftColor: col}]}>
      <Text style={[s.alertText, {color: col}]}>{text}</Text>
    </View>
  );
};

export const Empty = ({text}: {text: string}) => <Text style={s.empty}>{text}</Text>;

export const s = StyleSheet.create({
  safe: {flex: 1, backgroundColor: C.goldLight},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14},
  headerTitle: {color: '#fff', fontSize: 20, fontFamily: 'PlayfairDisplay_700Bold', fontWeight: 'normal'},
  headerSub: {color: '#F1EADB', fontSize: 12.5, marginTop: 2},
  content: {padding: 16, paddingBottom: 50, backgroundColor: C.bg, minHeight: '100%'},
  userCard: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 0.5, borderColor: C.line, gap: 12},
  avatar: {width: 40, height: 40, borderRadius: 20, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center'},
  avatarText: {color: '#fff', fontWeight: '800', fontSize: 17},
  userName: {fontSize: 15, fontWeight: '700', color: C.text},
  userRole: {fontSize: 11.5, color: C.muted, marginTop: 2},
  segment: {flexDirection: 'row', backgroundColor: '#F1EADB', borderRadius: 10, padding: 3},
  segBtn: {flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center'},
  segOn: {backgroundColor: C.gold},
  segText: {fontSize: 13, fontWeight: '600', color: C.muted},
  segTextOn: {color: '#fff'},
  periodCaption: {fontSize: 11.5, color: C.muted, marginTop: 6, textAlign: 'center'},
  secRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  secTitle: {fontSize: 16.5, fontFamily: 'PlayfairDisplay_700Bold', fontWeight: 'normal', color: C.text},
  secRight: {fontSize: 11.5, color: C.muted},
  card: {backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: C.line},
  kpiGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14},
  kpi: {width: '48%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: C.line, minHeight: 78},
  kpiValue: {fontSize: 19, fontWeight: '700', color: C.navy, textAlign: 'center'},
  kpiLabel: {fontSize: 11, color: C.muted, marginTop: 4, textAlign: 'center'},
  kpiSub: {fontSize: 10.5, color: C.muted, marginTop: 2},
  barBg: {backgroundColor: '#F1EADB', borderRadius: 6, overflow: 'hidden', width: '100%'},
  barFill: {borderRadius: 6},
  pill: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10},
  pillText: {fontSize: 11, fontWeight: '700'},
  trend: {fontSize: 11, fontWeight: '700'},
  tHead: {flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1EADB'},
  th: {fontSize: 11, fontWeight: '700', color: C.muted},
  tRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: '#F0F1F4'},
  td: {fontSize: 12.5, color: C.text},
  alert: {borderLeftWidth: 4, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 8},
  alertText: {fontSize: 12.5, fontWeight: '600', lineHeight: 17},
  empty: {textAlign: 'center', color: C.muted, fontSize: 13, paddingVertical: 14},
  footer: {textAlign: 'center', color: '#7A7266', fontSize: 11, marginTop: 24},
});
