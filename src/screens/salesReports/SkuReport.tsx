/** Report 4 - SKU / Brand-wise Performance (DEMO). */
import React, {useMemo, useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {Alert, Bar, C, Card, Kpis, Pill, ReportShell, Section, TableHead, TableRow, Trend, s, useCurrentUser} from './ReportKit';
import {ChartCard, HBar, LineChart, SERIES, StackedBar, VIZ} from './Charts';
import {BRANDS, Period, SKUS, ViewMode, focusPenetration, focusSkuTarget, getTeam, inrShort, launchCurve, pct, periodStats, prevPeriodStats, rangeFor, skuById, trendPct, whitespace, workingDays} from './reportData';

const FOCUS = SKUS.filter(k => k.focus);

const SkuReport = ({navigation}: any) => {
  const user = useCurrentUser();
  const [view, setView] = useState<ViewMode>('salesman');
  const [period, setPeriod] = useState<Period>('mtd');
  const [focusId, setFocusId] = useState('PW750');
  const team = useMemo(() => getTeam(user), [user.id, user.name]);
  const me = team[0];
  const focus = skuById(focusId);
  const {from, to} = rangeFor(period);
  const sellDays = Math.max(1, workingDays(from, to));

  const my = useMemo(() => periodStats(me, period), [me, period]);
  const myMtd = useMemo(() => periodStats(me, 'mtd'), [me]);
  const myTotalValue = Object.values(my.sku).reduce((a, k) => a + k.value, 0);
  const myPremium = SKUS.filter(k => k.premium).reduce((a, k) => a + (my.sku[k.id]?.value || 0), 0);
  const ws = whitespace(me, focusId);

  const cur = useMemo(() => team.map(r => periodStats(r, period)), [team, period]);
  const prev = useMemo(() => team.map(r => prevPeriodStats(r, period)), [team, period]);
  const sumSku = (list: typeof cur, id: string) => list.reduce((a, st) => ({cases: a.cases + (st.sku[id]?.cases || 0), value: a.value + (st.sku[id]?.value || 0)}), {cases: 0, value: 0});
  const brandRows = BRANDS.map(b => {
    const ids = SKUS.filter(k => k.brand === b).map(k => k.id);
    const c = ids.reduce((a, id) => ({cases: a.cases + sumSku(cur, id).cases, value: a.value + sumSku(cur, id).value}), {cases: 0, value: 0});
    const p = ids.reduce((a, id) => a + sumSku(prev, id).value, 0);
    return {b, ...c, trend: trendPct(c.value, p)};
  });
  const velocity = SKUS.map(k => ({k, v: sumSku(cur, k.id).cases / sellDays})).sort((a, b) => b.v - a.v);
  const teamValue = brandRows.reduce((a, r) => a + r.value, 0);
  const teamPremium = SKUS.filter(k => k.premium).reduce((a, k) => a + sumSku(cur, k.id).value, 0);
  const curve = launchCurve();
  const lastPt = curve[curve.length - 1];
  const [read, setRead] = useState('');
  const launch = skuById('RTD250');

  const FocusChips = (
    <View style={[s.segment, {marginTop: 10}]}>
      {FOCUS.map(k => (
        <TouchableOpacity key={k.id} style={[s.segBtn, focusId === k.id && s.segOn]} onPress={() => setFocusId(k.id)}>
          <Text style={[s.segText, focusId === k.id && s.segTextOn]} numberOfLines={1}>{k.short}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ReportShell title="SKU / Brand Performance" user={user} navigation={navigation} view={view} setView={setView} period={period} setPeriod={setPeriod} extra={FocusChips}>
      {view === 'salesman' ? (
        <>
          <Kpis
            items={[
              {label: 'Cases sold', value: String(my.cases)},
              {label: 'Value sold', value: inrShort(my.value)},
              {label: 'Premium mix', value: `${pct(myPremium, myTotalValue)}%`, color: C.gold},
              {label: `${focus.short} · MTD`, value: `${myMtd.sku[focusId]?.cases || 0}/${focusSkuTarget(me, focusId)} cs`, sub: 'focus SKU target'},
            ]}
          />
          <Section title="Focus SKU tracker" right={focus.short}>
            <Card>
              {(() => {
                const sold = myMtd.sku[focusId]?.cases || 0;
                const tgt = focusSkuTarget(me, focusId);
                return (
                  <>
                    <Text style={{fontSize: 12.5, color: C.muted, marginBottom: 6}}>{sold} of {tgt} cases (MTD) · penetration {focusPenetration(me, focusId)}% of your outlets</Text>
                    <Bar value={pct(sold, tgt)} color={pct(sold, tgt) >= 80 ? C.green : C.amber} height={10} />
                  </>
                );
              })()}
            </Card>
          </Section>
          {focusId === 'RTD250' && (
            <Section title="New launch tracker" right={`launched ${launch.launchDaysAgo} days ago`}>
              <Card>
                <Text style={{fontSize: 13, color: C.text}}>
                  {my.sku.RTD250?.cases || 0} cases · {inrShort(my.sku.RTD250?.value || 0)} in this period
                </Text>
              </Card>
            </Section>
          )}
          <Section title="Whitespace outlets" right={`not yet bought ${focus.short}`}>
            <Card>
              {ws.slice(0, 8).map(o => (
                <TableRow key={o.id} cells={[{t: o.name, f: 2.6, a: 'left'}, {t: `Class ${o.cls}`, f: 1, a: 'right', color: C.muted}]} />
              ))}
              {ws.length > 8 && <Text style={{fontSize: 11.5, color: C.muted, marginTop: 8}}>+ {ws.length - 8} more outlets</Text>}
            </Card>
          </Section>
          <ChartCard title="Sales by SKU" sub="Value in this period · focus SKUs highlighted">
            <HBar rows={SKUS.map(k => ({label: k.short, value: my.sku[k.id]?.value || 0, text: inrShort(my.sku[k.id]?.value || 0), color: k.focus ? VIZ.s1 : VIZ.gray, bold: k.focus})).sort((a, b) => b.value - a.value)} />
          </ChartCard>
          <Section title="SKU sales">
            <Card>
              <TableHead cols={[{t: 'SKU', f: 2.2, a: 'left'}, {t: 'Cases', f: 0.8}, {t: 'Value', f: 1.1, a: 'right'}]} />
              {SKUS.map(k => (
                <TableRow
                  key={k.id}
                  cells={[
                    {t: k.focus ? `★ ${k.short}` : k.short, f: 2.2, a: 'left', bold: k.focus},
                    {t: my.sku[k.id]?.cases || 0, f: 0.8},
                    {t: inrShort(my.sku[k.id]?.value || 0), f: 1.1, a: 'right'},
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
              {label: 'Team value', value: inrShort(teamValue)},
              {label: 'Premium mix', value: `${pct(teamPremium, teamValue)}%`, color: C.gold},
              {label: `${focus.short} penetration`, value: `${Math.round(team.reduce((a, r) => a + focusPenetration(r, focusId), 0) / team.length)}%`, sub: 'avg across reps'},
            ]}
          />
          <Section title="Needs attention">
            {lastPt.actual < lastPt.goal && <Alert tone="amber" text={`RTD Cocktail launch is at ${lastPt.actual}% penetration vs ${lastPt.goal}% adoption target (week ${lastPt.week})`} />}
            {team.map((r, i) => (cur[i].sku[focusId]?.cases || 0) === 0 ? <Alert key={r.id} text={`${r.name}: no ${focus.short} sold in this period`} /> : null)}
          </Section>
          <ChartCard title="Brand share of value" sub="Part of team total in this period">
            <StackedBar format={inrShort} segments={brandRows.filter(r => r.value > 0).map(r => ({label: r.b, value: r.value, color: SERIES[BRANDS.indexOf(r.b)]}))} />
          </ChartCard>
          <Section title="Brand rollup" right="vs previous period">
            <Card>
              <TableHead cols={[{t: 'Brand', f: 1.3, a: 'left'}, {t: 'Cases', f: 0.8}, {t: 'Value', f: 1.1}, {t: 'Trend', f: 1.1, a: 'right'}]} />
              {brandRows.map(r => (
                <TableRow key={r.b} cells={[{t: r.b, f: 1.3, a: 'left', bold: true}, {t: r.cases, f: 0.8}, {t: inrShort(r.value), f: 1.1}, {t: <Trend pct={r.trend} />, f: 1.1, a: 'right'}]} />
              ))}
            </Card>
          </Section>
          <Section title="SKU velocity" right="cases per selling day">
            <Card>
              {[...velocity.slice(0, 3), ...velocity.slice(-3)].map(({k, v}, i) => (
                <TableRow key={k.id} cells={[{t: i < 3 ? 'Top' : 'Slow', f: 0.7, a: 'left', color: i < 3 ? C.green : C.red, bold: true}, {t: k.short, f: 2, a: 'left'}, {t: v.toFixed(1), f: 0.8, a: 'right', bold: true}]} />
              ))}
            </Card>
          </Section>
          <Section title="Focus SKU by rep" right={focus.short}>
            <Card>
              <TableHead cols={[{t: 'Rep', f: 1.8, a: 'left'}, {t: 'Pen.%', f: 0.8}, {t: 'MTD cs', f: 0.9}, {t: 'vs Tgt', f: 0.9, a: 'right'}]} />
              {team
                .map((r, i) => {
                  const sold = periodStats(r, 'mtd').sku[focusId]?.cases || 0;
                  const comp = pct(sold, focusSkuTarget(r, focusId));
                  return {r, pen: focusPenetration(r, focusId), sold, comp};
                })
                .sort((a, b) => b.comp - a.comp)
                .map(x => (
                  <TableRow key={x.r.id} cells={[{t: x.r.isMe ? `${x.r.name} (me)` : x.r.name, f: 1.8, a: 'left', bold: x.r.isMe}, {t: x.pen, f: 0.8}, {t: x.sold, f: 0.9}, {t: `${x.comp}%`, f: 0.9, a: 'right', color: x.comp >= 80 ? C.green : C.amber}]} />
                ))}
            </Card>
          </Section>
          <Section title="New launch adoption" right="RTD Cocktail">
            <ChartCard title="Penetration since launch" sub="% of active outlets · tap to inspect" readout={read} legend={[{label: 'Actual', color: VIZ.s1}, {label: 'Target curve', color: VIZ.grayDark, dashed: true}]}>
              <LineChart area={false} yMax={70} format={n => `${Math.round(n)}%`} labels={curve.map(p => `Wk ${p.week}`)} series={[{name: 'Actual', color: VIZ.s1, data: curve.map(p => p.actual)}, {name: 'Target', color: VIZ.grayDark, data: curve.map(p => p.goal), dashed: true}]} onSelect={setRead} />
            </ChartCard>
          </Section>
        </>
      )}
    </ReportShell>
  );
};

export default SkuReport;
