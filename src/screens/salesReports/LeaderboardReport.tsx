/**
 * Report 5 - Leaderboard / Incentive Tracker (DEMO).
 * Each metric is capped at 100 before weighting (the spec leaves the points
 * scale undefined), so total points always sit on a 0-100 scale.
 */
import React, {useMemo, useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import moment from 'moment';
import {Alert, Bar, C, Card, Kpis, Pill, ReportShell, Section, TableHead, TableRow, s, useCurrentUser} from './ReportKit';
import {ChartCard, HBar, Meter, StackedBar, VIZ} from './Charts';
import {POOL, RepScore, SLABS, ViewMode, WEIGHTS, getTeam, inr, leaderboard, slabFor} from './reportData';

const METRICS: {key: 'achievement' | 'coverage' | 'collections' | 'focus'; label: string}[] = [
  {key: 'achievement', label: 'Target achievement'},
  {key: 'coverage', label: 'Coverage'},
  {key: 'collections', label: 'Collections'},
  {key: 'focus', label: 'Focus SKU'},
];
const cap = (n: number) => Math.max(0, Math.min(100, n));
const arrow = (m: number) => (m > 0 ? `▲ ${m}` : m < 0 ? `▼ ${Math.abs(m)}` : '–');
const arrowColor = (m: number) => (m > 0 ? C.green : m < 0 ? C.red : C.muted);

const Breakdown = ({r}: {r: RepScore}) => (
  <Card>
    {METRICS.map(m => {
      const w = WEIGHTS[m.key];
      const val = cap(r[m.key]);
      return (
        <View key={m.key} style={{marginBottom: 10}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
            <Text style={{fontSize: 12.5, color: C.text}}>{m.label} <Text style={{color: C.muted}}>({Math.round(w * 100)}%)</Text></Text>
            <Text style={{fontSize: 12.5, fontWeight: '700', color: C.navy}}>{val}% → {(val * w).toFixed(1)} pts</Text>
          </View>
          <Bar value={val} color={C.gold} />
        </View>
      );
    })}
    <Text style={{fontSize: 13, fontWeight: '800', color: C.navy}}>Total {r.points} pts</Text>
  </Card>
);

const LeaderboardReport = ({navigation}: any) => {
  const user = useCurrentUser();
  const [view, setView] = useState<ViewMode>('salesman');
  const [locked, setLocked] = useState(false);
  const [openRep, setOpenRep] = useState<string | null>(null);
  const team = useMemo(() => getTeam(user), [user.id, user.name]);
  const board = useMemo(() => leaderboard(team, locked), [team, locked]);
  const mineIdx = board.findIndex(r => r.rep.isMe);
  const mine = board[mineIdx];
  const slab = slabFor(mine.points);
  const nextSlab = [...SLABS].reverse().find(sl => sl.min > mine.points);
  const company = 9 + mineIdx * 14;
  const opened = board.find(r => r.rep.id === openRep);
  const liability = board.reduce((a, r) => a + r.payout, 0);

  const badges: string[] = [];
  if (mineIdx === 0) badges.push('🏆 Team #1');
  if (mine.coverage >= 90) badges.push('📍 90%+ coverage');
  if (mine.focus >= 90) badges.push('🥃 Focus SKU champion');
  if (mine.collections >= 90) badges.push('💰 Collections star');

  const LockToggle = (
    <View style={{marginTop: 10}}>
      <View style={s.segment}>
        <TouchableOpacity style={[s.segBtn, !locked && s.segOn]} onPress={() => setLocked(false)}>
          <Text style={[s.segText, !locked && s.segTextOn]}>● Live</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.segBtn, locked && s.segOn]} onPress={() => setLocked(true)}>
          <Text style={[s.segText, locked && s.segTextOn]}>🔒 Official</Text>
        </TouchableOpacity>
      </View>
      <View style={{marginTop: 8}}>
        {locked ? (
          <Alert tone="amber" text={`🔒 Official leaderboard for ${moment().subtract(1, 'month').format('MMMM YYYY')}. Locked at period close and used for payout.`} />
        ) : (
          <Alert tone="green" text={`● Live leaderboard for ${moment().format('MMMM YYYY')}. Updates through the month and is not used for payout.`} />
        )}
      </View>
    </View>
  );

  return (
    <ReportShell title="Leaderboard & Incentive" user={user} navigation={navigation} view={view} setView={setView} extra={LockToggle}>
      {view === 'salesman' ? (
        <>
          <Kpis
            items={[
              {label: `Team rank (of ${board.length})`, value: `#${mineIdx + 1}`, sub: `${arrow(mine.moved)} vs last period`, color: arrowColor(mine.moved)},
              {label: 'Company rank', value: `#${company}`, sub: 'of 126 reps'},
              {label: 'Total points', value: String(mine.points)},
              {label: 'Incentive earned', value: inr(mine.payout), sub: `${slab.pay}% of ${inr(POOL)} pool`},
            ]}
          />
          {nextSlab ? (
            <Alert tone="amber" text={`Next slab: ${nextSlab.pay}% payout at ${nextSlab.min} pts. You need ${(nextSlab.min - mine.points).toFixed(1)} more points (worth ${inr((POOL * nextSlab.pay) / 100 - mine.payout)} more).`} />
          ) : (
            <Alert tone="green" text="You are in the top payout slab (100%)." />
          )}
          <ChartCard title="Points vs payout slabs" sub="Slabs pay out at 60 / 75 / 90 points">
            <Meter value={mine.points} max={100} color={VIZ.s1} height={14} ticks={[{at: 60, label: '60'}, {at: 75, label: '75'}, {at: 90, label: '90'}]} text={`${mine.points} points · ${slab.pay}% slab`} />
          </ChartCard>
          <ChartCard title="Where my points come from" sub="Weighted contribution by metric">
            <StackedBar format={n => `${n.toFixed(1)}`} segments={METRICS.map((m, i) => ({label: m.label, value: cap(mine[m.key]) * WEIGHTS[m.key], color: [VIZ.s1, VIZ.s2, VIZ.s3, VIZ.s4][i]}))} />
          </ChartCard>
          <Section title="How your points were earned">
            <Breakdown r={mine} />
          </Section>
          {badges.length > 0 && (
            <Section title="Badges">
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                {badges.map(b => (
                  <Pill key={b} text={b} color={C.gold} bg="#F1EADB" />
                ))}
              </View>
            </Section>
          )}
        </>
      ) : (
        <>
          <Kpis
            items={[
              {label: 'Incentive liability', value: inr(liability), sub: `of ${inr(POOL * board.length)} pool`},
              {label: 'Reps in top slab', value: String(board.filter(r => r.points >= 90).length)},
            ]}
          />
          <Section title="Needs attention">
            {board.filter(r => r.outlier.length).map(r => (
              <Alert key={r.rep.id} text={`${r.rep.name}: ${r.outlier.join(' · ')}. Review before period close.`} />
            ))}
            {board.filter(r => r.noTarget).map(r => (
              <Alert key={'t' + r.rep.id} tone="amber" text={`${r.rep.name}: no target set, so achievement points are 0`} />
            ))}
            {!board.some(r => r.outlier.length || r.noTarget) && <Alert tone="green" text="No exceptions right now." />}
          </Section>
          <ChartCard title="Points by rep" sub="Reference lines mark the payout slabs">
            <HBar max={100} refs={[{value: 60, label: '60'}, {value: 75, label: '75'}, {value: 90, label: '90 pts'}]} rows={board.map(r => ({label: r.rep.isMe ? 'Me' : r.rep.name.split(' ')[0], value: r.points, text: `${r.points}`, color: r.rep.isMe ? VIZ.s1 : VIZ.gray, bold: r.rep.isMe}))} />
          </ChartCard>
          <Section title="Team leaderboard" right="tap a rep for the formula">
            <Card>
              <TableHead cols={[{t: '#', f: 0.4}, {t: 'Rep', f: 1.8, a: 'left'}, {t: 'Ach', f: 0.7}, {t: 'Cov', f: 0.7}, {t: 'Col', f: 0.7}, {t: 'Foc', f: 0.7}, {t: 'Pts', f: 0.9, a: 'right'}]} />
              {board.map((r, i) => (
                <TableRow
                  key={r.rep.id}
                  onPress={() => setOpenRep(openRep === r.rep.id ? null : r.rep.id)}
                  cells={[
                    {t: i + 1, f: 0.4, color: i === 0 ? C.green : i === board.length - 1 ? C.red : C.muted, bold: true},
                    {t: r.rep.isMe ? `${r.rep.name} (me)` : r.rep.name, f: 1.8, a: 'left', bold: r.rep.isMe},
                    {t: r.achievement, f: 0.7},
                    {t: r.coverage, f: 0.7},
                    {t: r.collections, f: 0.7, color: r.collections < 50 ? C.red : C.text},
                    {t: r.focus, f: 0.7},
                    {t: r.points, f: 0.9, a: 'right', bold: true},
                  ]}
                />
              ))}
            </Card>
          </Section>
          {opened && (
            <Section title={`${opened.rep.name} · points formula`}>
              <Breakdown r={opened} />
            </Section>
          )}
          <Section title="Payout summary" right="by slab">
            <Card>
              <TableHead cols={[{t: 'Slab', f: 1.2, a: 'left'}, {t: 'Reps', f: 0.8}, {t: 'Payout', f: 1.2, a: 'right'}]} />
              {SLABS.map((sl, i) => {
                const inSlab = board.filter(r => slabFor(r.points).min === sl.min);
                return (
                  <TableRow key={sl.min} cells={[{t: i === SLABS.length - 1 ? `< ${SLABS[i - 1].min} pts (${sl.pay}%)` : `≥ ${sl.min} pts (${sl.pay}%)`, f: 1.2, a: 'left'}, {t: inSlab.length, f: 0.8}, {t: inr(inSlab.reduce((a, r) => a + r.payout, 0)), f: 1.2, a: 'right', bold: true}]} />
                );
              })}
            </Card>
          </Section>
        </>
      )}
    </ReportShell>
  );
};

export default LeaderboardReport;
