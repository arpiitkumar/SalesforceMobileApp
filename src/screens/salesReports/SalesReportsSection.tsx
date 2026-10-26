/**
 * Sales Reports (DEMO) - Home page section.
 * Five tappable cards, each with a live headline number for the current user.
 */
import React, {useMemo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {C, useCurrentUser} from './ReportKit';
import {Sparkline, VIZ} from './Charts';
import {SKUS, cumulativeSeries, dailySeries, getTeam, inrShort, leaderboard, monthWorkingInfo, paceFor, pct, periodStats, targetFor} from './reportData';

const SalesReportsSection = () => {
  const navigation = useNavigation<any>();
  const user = useCurrentUser();

  const cards = useMemo(() => {
    const team = getTeam(user);
    const me = team[0];
    const today = periodStats(me, 'today');
    const mtd = periodStats(me, 'mtd');
    const t = targetFor(me);
    const pace = t ? paceFor(mtd.value, t.value) : null;
    const total = Object.values(mtd.sku).reduce((a, k) => a + k.value, 0);
    const premium = SKUS.filter(k => k.premium).reduce((a, k) => a + (mtd.sku[k.id]?.value || 0), 0);
    const top = Object.entries(mtd.sku).sort((a, b) => b[1].value - a[1].value)[0];
    const board = leaderboard(team, false);
    const idx = board.findIndex(r => r.rep.isMe);
    monthWorkingInfo();
    const spark = {
      cov: dailySeries([me], 10, x => x.coverage).map(v => v.value),
      val: dailySeries([me], 10, x => x.value).map(v => v.value),
      tgt: t ? (cumulativeSeries(me, 'value', t.value).actual.filter(v => v !== null) as number[]) : [],
      cs: dailySeries([me], 10, x => x.cases).map(v => v.value),
      pts: [] as number[],
    };
    return [
      {route: 'ReportCoverage', spark: spark.cov, icon: '📍', title: 'Outlet Coverage & Visit Rate', line: `${today.visited}/${today.assigned} outlets today · ${mtd.strike}% strike rate (MTD)`},
      {route: 'ReportSpotSales', spark: spark.val, icon: '🧾', title: 'Spot Sales Summary', line: `${inrShort(today.value)} today · ${inrShort(mtd.value)} MTD`},
      {route: 'ReportTarget', spark: spark.tgt, icon: '🎯', title: 'Target vs Achievement', line: t && pace ? `${pct(mtd.value, t.value)}% of target · ${pace.status}` : 'No target set'},
      {route: 'ReportSku', spark: spark.cs, icon: '🥃', title: 'SKU / Brand Performance', line: `Premium mix ${pct(premium, total)}%${top ? ' · Top: ' + SKUS.find(k => k.id === top[0])!.short : ''}`},
      {route: 'ReportLeaderboard', spark: spark.pts, icon: '🏆', title: 'Leaderboard & Incentive', line: `Rank #${idx + 1} of ${board.length} · ${board[idx].points} pts`},
    ];
  }, [user.id, user.name]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <View style={styles.bar} />
        <View style={{flex: 1}}>
          <Text style={styles.title}>MY SALES REPORTS</Text>
          <Text style={styles.sub} numberOfLines={1}>{user.name} · demo data</Text>
        </View>
      </View>
      {cards.map(c => (
        <TouchableOpacity key={c.route} style={styles.card} activeOpacity={0.8} onPress={() => navigation.navigate(c.route)}>
          <View style={styles.iconWrap}><Text style={styles.icon}>{c.icon}</Text></View>
          <View style={{flex: 1}}>
            <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
            <Text style={styles.cardLine} numberOfLines={2}>{c.line}</Text>
          </View>
          {c.spark.length > 1 && <Sparkline data={c.spark} color={VIZ.s1} />}
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {marginTop: 14, marginBottom: 6},
  headRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10},
  bar: {width: 5, height: 34, borderRadius: 3, backgroundColor: C.gold},
  title: {fontSize: 17, fontFamily: 'PlayfairDisplay_700Bold', fontWeight: 'normal', color: C.text, letterSpacing: 0.4},
  sub: {fontSize: 12, color: C.muted, marginTop: 2},
  card: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: C.line, gap: 12},
  iconWrap: {width: 42, height: 42, borderRadius: 12, backgroundColor: '#F1EADB', alignItems: 'center', justifyContent: 'center'},
  icon: {fontSize: 20},
  cardTitle: {fontSize: 14, fontWeight: '700', color: C.text},
  cardLine: {fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 16},
  chev: {fontSize: 26, color: C.gold, marginRight: 2},
});

export default SalesReportsSection;
