/**
 * Report 2 - Spot Sales Summary (DEMO).
 * Spot sales are sold on the spot, so there is no Submitted/Approved/Rejected
 * funnel here: every recorded spot sale counts as booked value.
 */
import React, {useMemo, useState} from 'react';
import {Text} from 'react-native';
import moment from 'moment';
import {Alert, Bar, C, Card, Empty, Kpis, ReportShell, Section, TableHead, TableRow, Trend, useCurrentUser} from './ReportKit';
import {ChartCard, BarChart, HBar, LineChart, StackedBar, VIZ} from './Charts';
import {Period, ViewMode, dailySeries, dayData, getTeam, inr, inrShort, pct, periodStats, prevPeriodStats, statsFor, sumStats, targetFor, todayStr, trendPct} from './reportData';

const SpotSalesReport = ({navigation}: any) => {
  const user = useCurrentUser();
  const [view, setView] = useState<ViewMode>('salesman');
  const [period, setPeriod] = useState<Period>('mtd');
  const team = useMemo(() => getTeam(user), [user.id, user.name]);
  const me = team[0];
  const [read, setRead] = useState('');

  const my = useMemo(() => periodStats(me, period), [me, period]);
  const myPrev = useMemo(() => prevPeriodStats(me, period), [me, period]);
  const myToday = useMemo(() => periodStats(me, 'today'), [me]);
  const myMtd = useMemo(() => periodStats(me, 'mtd'), [me]);
  const myMtdPrev = useMemo(() => prevPeriodStats(me, 'mtd'), [me]);
  const todaySales = dayData(me, todayStr()).visits.filter(v => v.sale);
  const week = useMemo(() => periodStats(me, 'wtd'), [me]);
  const topOutlets = Object.values(week.outlet).sort((a, b) => b.value - a.value).slice(0, 3);

  const rows = useMemo(
    () =>
      team.map(rep => {
        const cur = periodStats(rep, period);
        const today = periodStats(rep, 'today');
        const mtd = periodStats(rep, 'mtd');
        const t = targetFor(rep);
        const trail = [1, 2, 3, 4, 5].map(i => moment().subtract(i, 'days')).filter(d => d.date() !== 2);
        const avg = trail.reduce((a, d) => a + statsFor(rep, d, d).value, 0) / Math.max(1, trail.length);
        return {rep, cur, today, mtd, ach: t ? pct(mtd.value, t.value) : null, drop: avg > 0 && today.value < avg * 0.5, avg};
      }),
    [team, period],
  );
  const tTotal = sumStats(rows.map(r => r.cur));
  const tToday = sumStats(rows.map(r => r.today));
  const tYest = sumStats(team.map(r => prevPeriodStats(r, 'today')));
  const tWtd = sumStats(team.map(r => periodStats(r, 'wtd')));
  const tWtdPrev = sumStats(team.map(r => prevPeriodStats(r, 'wtd')));
  const tMtd = sumStats(team.map(r => periodStats(r, 'mtd')));
  const tMtdPrev = sumStats(team.map(r => prevPeriodStats(r, 'mtd')));
  const clsTotals = rows.reduce((a, r) => ({A: a.A + r.cur.cls.A, B: a.B + r.cur.cls.B, C: a.C + r.cur.cls.C}), {A: 0, B: 0, C: 0});
  const clsSum = clsTotals.A + clsTotals.B + clsTotals.C;
  const mySeries = useMemo(() => dailySeries([me], 14, x => x.value), [me]);
  const teamSeries = useMemo(() => dailySeries(team, 14, x => x.value), [team]);
  const myAvg = mySeries.length ? mySeries.reduce((a, v) => a + v.value, 0) / mySeries.length : 0;

  return (
    <ReportShell title="Spot Sales Summary" user={user} navigation={navigation} view={view} setView={setView} period={period} setPeriod={setPeriod}>
      {view === 'salesman' ? (
        <>
          <Kpis
            items={[
              {label: "Today's spot sales", value: inrShort(myToday.value), sub: `${myToday.cases} cases · ${myToday.orders} sales`},
              {label: period === 'today' ? 'Selected period' : period === 'wtd' ? 'Week to date' : 'Month to date', value: inrShort(my.value), sub: `vs previous: ${trendPct(my.value, myPrev.value)}%`},
              {label: 'Spot sales count', value: String(my.orders), sub: `${my.cases} cases`},
              {label: 'Avg value / sale', value: inrShort(my.aov)},
            ]}
          />
          <Card style={{marginTop: 10}}>
            <Text style={{fontSize: 12, color: C.muted}}>MTD vs same point last month</Text>
            <Text style={{fontSize: 16, fontWeight: '700', color: C.navy, marginTop: 4}}>
              {inr(myMtd.value)} <Trend pct={trendPct(myMtd.value, myMtdPrev.value)} />
            </Text>
          </Card>
          <ChartCard title="Daily spot sales" sub="Last 14 working days · tap a bar" readout={read}>
            <BarChart data={mySeries.map(v => ({label: v.label, value: v.value}))} format={inrShort} refLine={{value: myAvg, label: 'avg'}} onSelect={setRead} />
          </ChartCard>
          <Section title="Today's spot sales" right={`${todaySales.length} sales`}>
            <Card>
              <TableHead cols={[{t: 'Time', f: 0.8, a: 'left'}, {t: 'Outlet', f: 2.2, a: 'left'}, {t: 'Cases', f: 0.7}, {t: 'Value', f: 1.1, a: 'right'}]} />
              {todaySales.length === 0 && <Empty text="No spot sales recorded yet today." />}
              {todaySales.map((v, i) => (
                <TableRow key={i} cells={[{t: v.time, f: 0.8, a: 'left', color: C.muted}, {t: v.outlet, f: 2.2, a: 'left'}, {t: v.sale!.cases, f: 0.7}, {t: inrShort(v.sale!.value), f: 1.1, a: 'right', bold: true}]} />
              ))}
            </Card>
          </Section>
          <Section title="Top outlets this week" right="for your next visit">
            <Card>
              {topOutlets.length === 0 && <Empty text="No spot sales this week yet." />}
              {topOutlets.map((o, i) => (
                <TableRow key={i} cells={[{t: `${i + 1}`, f: 0.4, color: C.muted}, {t: o.name, f: 2.6, a: 'left'}, {t: `Class ${o.cls}`, f: 0.9, color: C.muted}, {t: inrShort(o.value), f: 1, a: 'right', bold: true}]} />
              ))}
            </Card>
          </Section>
        </>
      ) : (
        <>
          <Kpis
            items={[
              {label: 'Team today (vs yesterday)', value: inrShort(tToday.value), sub: `${trendPct(tToday.value, tYest.value)}%`},
              {label: 'Team WTD (vs last week)', value: inrShort(tWtd.value), sub: `${trendPct(tWtd.value, tWtdPrev.value)}%`},
              {label: 'Team MTD (vs last MTD)', value: inrShort(tMtd.value), sub: `${trendPct(tMtd.value, tMtdPrev.value)}%`},
              {label: 'Avg value / sale', value: inrShort(tTotal.aov), sub: `${tTotal.orders} sales`},
            ]}
          />
          <ChartCard title="Team spot sales" sub="Daily value, last 14 working days · tap to inspect" readout={read}>
            <LineChart series={[{name: 'Team', color: VIZ.s1, data: teamSeries.map(v => v.value)}]} labels={teamSeries.map(v => v.label)} format={inrShort} onSelect={setRead} />
          </ChartCard>
          <ChartCard title="MTD spot sales by rep">
            <HBar rows={[...rows].sort((a, b) => b.mtd.value - a.mtd.value).map(r => ({label: r.rep.isMe ? 'Me' : r.rep.name.split(' ')[0], value: r.mtd.value, text: inrShort(r.mtd.value), color: r.rep.isMe ? VIZ.s1 : VIZ.gray, bold: r.rep.isMe}))} />
          </ChartCard>
          <Section title="Needs attention">
            {rows.filter(r => r.today.value === 0).map(r => (
              <Alert key={'z' + r.rep.id} text={`${r.rep.name}: no spot sales today`} />
            ))}
            {rows.filter(r => r.drop && r.today.value > 0).map(r => (
              <Alert key={'d' + r.rep.id} tone="amber" text={`${r.rep.name}: today ${inrShort(r.today.value)} is >50% below the 5-day average (${inrShort(r.avg)})`} />
            ))}
            {!rows.some(r => r.today.value === 0 || r.drop) && <Alert tone="green" text="No exceptions right now." />}
          </Section>
          <Section title="Rep-wise spot sales">
            <Card>
              <TableHead cols={[{t: 'Rep', f: 2, a: 'left'}, {t: 'Today', f: 1}, {t: 'MTD', f: 1.1}, {t: 'vs Tgt', f: 0.9, a: 'right'}]} />
              {[...rows].sort((a, b) => b.mtd.value - a.mtd.value).map(r => (
                <TableRow
                  key={r.rep.id}
                  cells={[
                    {t: r.rep.isMe ? `${r.rep.name} (me)` : r.rep.name, f: 2, a: 'left', bold: r.rep.isMe},
                    {t: inrShort(r.today.value), f: 1},
                    {t: inrShort(r.mtd.value), f: 1.1, bold: true},
                    {t: r.ach === null ? 'No target' : `${r.ach}%`, f: 0.9, a: 'right', color: r.ach === null ? C.muted : r.ach >= 100 ? C.green : r.ach >= 80 ? C.amber : C.red},
                  ]}
                />
              ))}
            </Card>
          </Section>
          <Section title="Value by outlet class" right="where revenue sits">
            <ChartCard title="Share of value" sub="Class A / B / C outlets">
              <StackedBar format={inrShort} segments={[{label: 'Class A', value: clsTotals.A, color: VIZ.s1}, {label: 'Class B', value: clsTotals.B, color: VIZ.s2}, {label: 'Class C', value: clsTotals.C, color: VIZ.s3}]} />
            </ChartCard>
          </Section>
        </>
      )}
    </ReportShell>
  );
};

export default SpotSalesReport;
