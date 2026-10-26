/** Report 3 - Target vs Achievement, MTD / weekly (DEMO). */
import React, {useMemo, useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {Alert, Bar, C, Card, Kpis, Pill, ReportShell, Section, TableHead, TableRow, s, useCurrentUser} from './ReportKit';
import {ChartCard, HBar, LineChart, Meter, VIZ} from './Charts';
import {ViewMode, cumulativeSeries, getTeam, inrShort, monthWorkingInfo, paceFor, pct, periodStats, targetFor, targetHistory, weekTarget} from './reportData';

type Kind = 'value' | 'volume';
const paceColor = (st: string) => (st === 'On Track' ? C.green : st === 'At Risk' ? C.amber : C.red);
const paceBg = (st: string) => (st === 'On Track' ? '#E6F6EC' : st === 'At Risk' ? '#F1EADB' : '#FDECEC');
const heat = (p: number) => (p >= 100 ? {bg: '#E6F6EC', fg: C.green} : p >= 80 ? {bg: '#F1EADB', fg: C.amber} : {bg: '#FDECEC', fg: C.red});

const TargetReport = ({navigation}: any) => {
  const user = useCurrentUser();
  const [view, setView] = useState<ViewMode>('salesman');
  const [kind, setKind] = useState<Kind>('value');
  const team = useMemo(() => getTeam(user), [user.id, user.name]);
  const info = monthWorkingInfo();
  const fmt = (n: number) => (kind === 'value' ? inrShort(n) : `${Math.round(n)} cs`);

  const rows = useMemo(
    () =>
      team.map(rep => {
        const t = targetFor(rep);
        const m = periodStats(rep, 'mtd');
        const w = periodStats(rep, 'wtd');
        const target = t ? (kind === 'value' ? t.value : t.volume) : 0;
        const achieved = kind === 'value' ? m.value : m.cases;
        const weekAch = kind === 'value' ? w.value : w.cases;
        const ach = target ? pct(achieved, target) : 0;
        const pace = target ? paceFor(achieved, target) : null;
        return {rep, target, achieved, weekAch, ach, pace, hasTarget: !!t};
      }),
    [team, kind],
  );
  const mine = rows[0];
  const tTarget = rows.reduce((a, r) => a + r.target, 0);
  const tAch = rows.reduce((a, r) => a + r.achieved, 0);
  const [read, setRead] = useState('');
  const cum = useMemo(() => (mine.hasTarget ? cumulativeSeries(team[0], kind === 'value' ? 'value' : 'cases', mine.target) : null), [team, kind, mine.hasTarget, mine.target]);

  const KindToggle = (
    <View style={[s.segment, {marginTop: 10}]}>
      {(['value', 'volume'] as Kind[]).map(k => (
        <TouchableOpacity key={k} style={[s.segBtn, kind === k && s.segOn]} onPress={() => setKind(k)}>
          <Text style={[s.segText, kind === k && s.segTextOn]}>{k === 'value' ? 'Value (₹)' : 'Volume (cases)'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ReportShell title="Target vs Achievement" user={user} navigation={navigation} view={view} setView={setView} extra={KindToggle}>
      {view === 'salesman' ? (
        !mine.hasTarget ? (
          <Alert text="No target is set for you this month. Please ask your admin to set one." />
        ) : (
          <>
            <Card style={{marginTop: 14}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                <Text style={{fontSize: 13, color: C.muted}}>Month to date</Text>
                {mine.pace && <Pill text={mine.pace.status} color={paceColor(mine.pace.status)} bg={paceBg(mine.pace.status)} />}
              </View>
              <Text style={{fontSize: 24, fontWeight: '800', color: C.navy, marginTop: 6}}>{mine.ach}%</Text>
              <Text style={{fontSize: 12.5, color: C.muted, marginVertical: 6}}>
                {fmt(mine.achieved)} of {fmt(mine.target)}
              </Text>
              <Meter value={mine.ach} max={120} color={paceColor(mine.pace!.status)} height={12} ticks={[{at: 80, label: '80%'}, {at: 100, label: '100%'}]} />
            </Card>
            <Kpis
              items={[
                {label: 'Working days elapsed', value: `${info.elapsed}/${info.total}`},
                {label: 'Working days remaining', value: String(info.remaining)},
                {label: 'Required daily run-rate', value: fmt(mine.pace!.runRate)},
                {label: 'Projected month-end', value: fmt(mine.pace!.projected), sub: `${mine.pace!.ratio}% of target`},
              ]}
            />
            {cum && (
              <ChartCard title="Cumulative vs pace" sub="Achieved so far against an even pace to target · tap to inspect" readout={read} legend={[{label: 'Achieved', color: VIZ.s1}, {label: 'Even pace to target', color: VIZ.grayDark, dashed: true}]}>
                <LineChart area={false} series={[{name: 'Achieved', color: VIZ.s1, data: cum.actual}, {name: 'Pace', color: VIZ.grayDark, data: cum.ideal, dashed: true}]} labels={cum.labels} format={fmt} onSelect={setRead} />
              </ChartCard>
            )}
            <Section title="This week">
              <Card>
                <Text style={{fontSize: 12.5, color: C.muted, marginBottom: 6}}>
                  {fmt(mine.weekAch)} of {fmt(weekTarget(mine.target))} weekly sub-target
                </Text>
                <Bar value={pct(mine.weekAch, weekTarget(mine.target))} color={C.gold} />
              </Card>
            </Section>
          </>
        )
      ) : (
        <>
          <Kpis
            items={[
              {label: 'Team target', value: fmt(tTarget)},
              {label: 'Team achieved', value: fmt(tAch), sub: `${pct(tAch, tTarget)}% of target`},
            ]}
          />
          <Section title="Needs attention">
            {rows.filter(r => !r.hasTarget).map(r => (
              <Alert key={'g' + r.rep.id} tone="amber" text={`${r.rep.name}: no target set this month (data gap, needs admin)`} />
            ))}
            {rows.filter(r => r.pace && r.pace.status !== 'On Track').map(r => (
              <Alert key={'a' + r.rep.id} tone={r.pace!.status === 'Behind' ? 'red' : 'amber'} text={`${r.rep.name}: ${r.pace!.status} · projected ${r.pace!.ratio}% of target`} />
            ))}
            {rows.filter(r => r.ach >= 120).map(r => (
              <Alert key={'o' + r.rep.id} tone="green" text={`${r.rep.name}: ${r.ach}% achieved. Recognise, and check the target was not set too low`} />
            ))}
          </Section>
          <Section title="Team heatmap" right="achievement %">
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
              {rows.map(r => {
                const h = r.hasTarget ? heat(r.ach) : {bg: '#F1EADB', fg: C.muted};
                return (
                  <View key={r.rep.id} style={{width: '31%', flexGrow: 1, backgroundColor: h.bg, borderRadius: 10, padding: 10, alignItems: 'center'}}>
                    <Text style={{fontSize: 18, fontWeight: '800', color: h.fg}}>{r.hasTarget ? `${r.ach}%` : '–'}</Text>
                    <Text style={{fontSize: 11, color: C.text, marginTop: 3, textAlign: 'center'}} numberOfLines={1}>{r.rep.isMe ? 'Me' : r.rep.name.split(' ')[0]}</Text>
                  </View>
                );
              })}
            </View>
          </Section>
          <ChartCard title="Projected month-end by rep" sub="% of target, at the current run-rate">
            <HBar max={160} refs={[{value: 80, label: '80%'}, {value: 100, label: '100% target'}]} rows={rows.filter(r => r.pace).sort((a, b) => b.pace!.ratio - a.pace!.ratio).map(r => ({label: r.rep.isMe ? 'Me' : r.rep.name.split(' ')[0], value: r.pace!.ratio, text: `${r.pace!.ratio}%`, color: r.rep.isMe ? VIZ.s1 : VIZ.gray, bold: r.rep.isMe}))} />
          </ChartCard>
          <Section title="Rep detail">
            <Card>
              <TableHead cols={[{t: 'Rep', f: 1.8, a: 'left'}, {t: 'Target', f: 1.1}, {t: 'Achieved', f: 1.1}, {t: 'Projected', f: 1.2, a: 'right'}]} />
              {rows.map(r => (
                <TableRow
                  key={r.rep.id}
                  cells={[
                    {t: r.rep.isMe ? `${r.rep.name} (me)` : r.rep.name, f: 1.8, a: 'left', bold: r.rep.isMe},
                    {t: r.hasTarget ? fmt(r.target) : '–', f: 1.1},
                    {t: fmt(r.achieved), f: 1.1},
                    {t: r.pace ? `${r.pace.ratio}%` : '–', f: 1.2, a: 'right', color: r.pace ? paceColor(r.pace.status) : C.muted, bold: true},
                  ]}
                />
              ))}
            </Card>
          </Section>
          <Section title="Last 3 months" right="achievement %">
            <Card>
              {rows.map(r => (
                <TableRow
                  key={r.rep.id}
                  cells={[
                    {t: r.rep.isMe ? 'Me' : r.rep.name.split(' ')[0], f: 1.2, a: 'left', bold: r.rep.isMe},
                    ...targetHistory(r.rep).map(h => ({t: `${h.month} ${h.ach}%`, f: 1.1, color: heat(h.ach).fg})),
                  ]}
                />
              ))}
            </Card>
          </Section>
          <Text style={{fontSize: 11, color: C.muted, marginTop: 4}}>Run-rate and pace use working days. The 2nd of each month is a demo dry day.</Text>
        </>
      )}
    </ReportShell>
  );
};

export default TargetReport;
