/** Report 1 - Outlet Coverage & Productive Visit Rate (DEMO). */
import React, {useMemo, useState} from 'react';
import {View, Text} from 'react-native';
import moment from 'moment';
import {Alert, Bar, C, Card, Empty, Kpis, Pill, ReportShell, Section, TableHead, TableRow, Trend, s, useCurrentUser} from './ReportKit';
import {ChartCard, HBar, LineChart, StackedBar, VIZ} from './Charts';
import {PERIOD_LABEL, Period, ViewMode, belowFloorDays, dailySeries, dateList, dayData, getTeam, lapsedOutlets, periodStats, prevPeriodStats, rangeFor, sumStats, todayStr} from './reportData';

const statusPill = (st: string) =>
  st === 'visited' ? <Pill text="Visited" color={C.green} bg="#E6F6EC" /> : st === 'skipped' ? <Pill text="Skipped" color={C.red} bg="#FDECEC" /> : <Pill text="Pending" color={C.amber} bg="#F1EADB" />;

const CoverageReport = ({navigation}: any) => {
  const user = useCurrentUser();
  const [view, setView] = useState<ViewMode>('salesman');
  const [period, setPeriod] = useState<Period>('mtd');
  const [openRep, setOpenRep] = useState<string | null>(null);
  const [read, setRead] = useState('');
  const team = useMemo(() => getTeam(user), [user.id, user.name]);
  const me = team[0];

  const my = useMemo(() => periodStats(me, period), [me, period]);
  const todayDay = useMemo(() => dayData(me, todayStr()), [me]);
  const nextDue = todayDay.visits.find(v => v.status === 'pending');
  const unproductive = useMemo(() => {
    const {from, to} = rangeFor(period);
    const out: {date: string; outlet: string; time: string; reason: string}[] = [];
    dateList(from, to).forEach(d =>
      dayData(me, d).visits.forEach(v => {
        if (v.status === 'visited' && !v.sale) out.push({date: d, outlet: v.outlet, time: v.time, reason: v.reason || 'Other'});
      }),
    );
    return out.reverse().slice(0, 8);
  }, [me, period]);

  const rows = useMemo(
    () =>
      team.map(rep => {
        const cur = periodStats(rep, period);
        const prev = prevPeriodStats(rep, period);
        const today = periodStats(rep, 'today');
        return {rep, cur, prev, today, low: belowFloorDays(rep)};
      }),
    [team, period],
  );
  const teamTotal = sumStats(rows.map(r => r.cur));
  const zeroCall = rows.filter(r => r.today.visited === 0);
  const belowFloor = rows.filter(r => r.low >= 2);
  const geoFlags = rows.reduce((a, r) => a + r.cur.geoFlags, 0);
  const lapsed = team.flatMap(rep => lapsedOutlets(rep).map(o => ({rep, o}))).sort((a, b) => b.o.dormantDays - a.o.dormantDays);
  const detail = rows.find(r => r.rep.id === openRep);
  const covSeries = useMemo(() => dailySeries([me], 14, x => x.coverage), [me]);
  const teamCov = useMemo(() => dailySeries(team, 14, x => x.coverage), [team]);

  return (
    <ReportShell title="Outlet Coverage & Visit Rate" user={user} navigation={navigation} view={view} setView={setView} period={period} setPeriod={setPeriod}>
      {view === 'salesman' ? (
        <>
          <Kpis
            items={[
              {label: 'Outlets assigned', value: String(my.assigned)},
              {label: 'Outlets visited', value: String(my.visited)},
              {label: 'Coverage %', value: `${my.coverage}%`, color: my.coverage >= 80 ? C.green : C.red},
              {label: 'Productive visits', value: `${my.productive}/${my.totalCalls}`},
              {label: 'Strike rate', value: `${my.strike}%`, color: my.strike >= 40 ? C.green : C.red},
              {label: 'Geofence flags', value: String(my.geoFlags), color: my.geoFlags ? C.amber : C.green},
            ]}
          />
          <ChartCard title="Coverage trend" sub="Daily coverage %, last 14 days · tap to inspect" readout={read}>
            <LineChart series={[{name: 'Coverage', color: VIZ.s1, data: covSeries.map(v => v.value)}]} labels={covSeries.map(v => v.label)} yMax={100} format={n => `${Math.round(n)}%`} refLine={{value: 80, label: '80% floor'}} onSelect={setRead} />
          </ChartCard>
          <ChartCard title="Where my visits went" sub={PERIOD_LABEL[period]}>
            <StackedBar segments={[{label: 'Productive', value: my.productive, color: VIZ.s1}, {label: 'Visited, no sale', value: my.visited - my.productive, color: VIZ.s2}, {label: 'Not visited', value: my.assigned - my.visited, color: VIZ.gray}]} />
          </ChartCard>
          <Section title="Today's beat list" right={moment().format('ddd, DD MMM')}>
            {nextDue && (
              <Alert tone="amber" text={`Next outlet due: ${nextDue.outlet} at ${nextDue.time}`} />
            )}
            <Card>
              {todayDay.visits.length === 0 && <Empty text="No beat planned today." />}
              {todayDay.visits.map((v, i) => (
                <TableRow
                  key={i}
                  cells={[
                    {t: v.time, f: 0.9, a: 'left', color: C.muted},
                    {t: v.outlet, f: 2.6, a: 'left', bold: true},
                    {t: statusPill(v.status), f: 1.5, a: 'right'},
                  ]}
                />
              ))}
            </Card>
          </Section>
          <Section title="Unproductive visits" right={`${unproductive.length} shown`}>
            <Card>
              {unproductive.length === 0 && <Empty text="No unproductive visits in this period." />}
              {unproductive.map((u, i) => (
                <TableRow
                  key={i}
                  cells={[
                    {t: moment(u.date).format('DD MMM'), f: 0.9, a: 'left', color: C.muted},
                    {t: u.outlet, f: 2.4, a: 'left'},
                    {t: u.reason, f: 1.4, a: 'right', color: C.red},
                  ]}
                />
              ))}
            </Card>
          </Section>
        </>
      ) : (
        <>
          <Kpis
            items={[
              {label: 'Team coverage %', value: `${teamTotal.coverage}%`, color: teamTotal.coverage >= 80 ? C.green : C.red},
              {label: 'Team strike rate', value: `${teamTotal.strike}%`, color: teamTotal.strike >= 40 ? C.green : C.red},
              {label: 'Visits / assigned', value: `${teamTotal.visited}/${teamTotal.assigned}`},
              {label: 'Lapsed outlets (14d+)', value: String(lapsed.length), color: C.amber},
            ]}
          />
          <ChartCard title="Team coverage trend" sub="Daily coverage %, last 14 days · tap to inspect" readout={read}>
            <LineChart series={[{name: 'Team coverage', color: VIZ.s1, data: teamCov.map(v => v.value)}]} labels={teamCov.map(v => v.label)} yMax={100} format={n => `${Math.round(n)}%`} refLine={{value: 80, label: '80% floor'}} onSelect={setRead} />
          </ChartCard>
          <ChartCard title="Coverage by rep" sub={PERIOD_LABEL[period]}>
            <HBar max={100} refs={[{value: 80, label: '80% floor'}]} rows={[...rows].sort((a, b) => b.cur.coverage - a.cur.coverage).map(r => ({label: r.rep.isMe ? 'Me' : r.rep.name.split(' ')[0], value: r.cur.coverage, text: `${r.cur.coverage}%`, color: r.rep.isMe ? VIZ.s1 : VIZ.gray, bold: r.rep.isMe}))} />
          </ChartCard>
          <Section title="Needs attention">
            {zeroCall.map(r => (
              <Alert key={'z' + r.rep.id} text={`${r.rep.name}: no visits logged today`} />
            ))}
            {belowFloor.map(r => (
              <Alert key={'b' + r.rep.id} tone="amber" text={`${r.rep.name}: below coverage/strike floor for ${r.low} days`} />
            ))}
            {geoFlags > 0 && <Alert tone="amber" text={`${geoFlags} check-ins outside the outlet geofence in this period`} />}
            {!zeroCall.length && !belowFloor.length && !geoFlags && <Alert tone="green" text="No exceptions right now." />}
          </Section>
          <Section title="Rep-wise coverage" right="tap a rep">
            <Card>
              <TableHead cols={[{t: 'Rep', f: 2, a: 'left'}, {t: 'Asg', f: 0.6}, {t: 'Vis', f: 0.6}, {t: 'Cov%', f: 0.9}, {t: 'Prod%', f: 0.9}, {t: 'Trend', f: 1.2, a: 'right'}]} />
              {rows.map(r => (
                <TableRow
                  key={r.rep.id}
                  onPress={() => setOpenRep(openRep === r.rep.id ? null : r.rep.id)}
                  cells={[
                    {t: r.rep.isMe ? `${r.rep.name} (me)` : r.rep.name, f: 2, a: 'left', bold: r.rep.isMe},
                    {t: r.cur.assigned, f: 0.6},
                    {t: r.cur.visited, f: 0.6},
                    {t: `${r.cur.coverage}`, f: 0.9, color: r.cur.coverage >= 80 ? C.green : C.red, bold: true},
                    {t: `${r.cur.strike}`, f: 0.9, color: r.cur.strike >= 40 ? C.green : C.red},
                    {t: <Trend pct={r.cur.coverage - r.prev.coverage} />, f: 1.2, a: 'right'},
                  ]}
                />
              ))}
            </Card>
          </Section>
          {detail && (
            <Section title={`${detail.rep.name} · today`}>
              <Card>
                <Text style={{fontSize: 12, color: C.muted, marginBottom: 6}}>Coverage {detail.cur.coverage}%</Text>
                <Bar value={detail.cur.coverage} color={detail.cur.coverage >= 80 ? C.green : C.red} />
                {dayData(detail.rep, todayStr()).visits.map((v, i) => (
                  <TableRow key={i} cells={[{t: v.time, f: 0.9, a: 'left', color: C.muted}, {t: v.outlet, f: 2.4, a: 'left'}, {t: statusPill(v.status), f: 1.4, a: 'right'}]} />
                ))}
              </Card>
            </Section>
          )}
          <Section title="Lapsed outlets" right="not visited in 14+ days">
            <Card>
              {lapsed.slice(0, 8).map(({rep, o}) => (
                <TableRow key={o.id} cells={[{t: o.name, f: 2.2, a: 'left'}, {t: rep.name.split(' ')[0], f: 1}, {t: `${o.dormantDays}d`, f: 0.7, a: 'right', color: C.red, bold: true}]} />
              ))}
            </Card>
          </Section>
        </>
      )}
    </ReportShell>
  );
};

export default CoverageReport;
