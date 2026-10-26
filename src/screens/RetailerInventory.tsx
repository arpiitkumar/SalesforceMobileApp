/**
 * Retailer Inventory (DEMO).
 *
 * Filter (Last visit / Last week / This month / Last month) -> consolidated
 * summary -> per-SKU summary -> list of visits. Tapping a visit opens its
 * details (RetailerInventoryVisit). "Record this visit" adds a new entry.
 * Figures are retailer-reported market insight, NOT sales tracking.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import Feather from '@react-native-vector-icons/feather';
import moment from 'moment';
import {useDispatch} from 'react-redux';
import {showToast} from '../redux/slices/toastSlice';
import {
  DEMO_SKUS,
  InventoryItem,
  InventoryVisit,
  RANGE_LABELS,
  RangeKey,
  addVisit,
  consolidate,
  loadHistory,
  rangeCaption,
  shortName,
  visitTotals,
  visitsForRange,
} from './inventoryDemo';

const RetailerInventory = ({navigation, route}: any) => {
  const dispatch = useDispatch();
  const accountId: string = route?.params?.accountId || 'demo-retailer';
  const accountName: string = route?.params?.accountName || 'Retailer';

  const [history, setHistory] = useState<InventoryVisit[]>([]);
  const [range, setRange] = useState<RangeKey>('last');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<InventoryItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadHistory(accountId).then(h => active && setHistory(h));
      return () => {
        active = false;
      };
    }, [accountId]),
  );

  const visits = useMemo(() => visitsForRange(history, range), [history, range]);
  const summary = useMemo(() => consolidate(visits), [visits]);

  const startEditing = () => {
    setDraft(
      DEMO_SKUS.map(s => ({sku: s.sku, asked: 0, left: 0, fast: false})),
    );
    setEditing(true);
  };

  const updateDraft = (sku: string, patch: Partial<InventoryItem>) =>
    setDraft(d => d.map(i => (i.sku === sku ? {...i, ...patch} : i)));

  const toNumber = (text: string) => {
    const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(n) ? 0 : n;
  };

  const saveDraft = async () => {
    try {
      const next = await addVisit(accountId, history, draft);
      setHistory(next);
      setEditing(false);
      dispatch(showToast({message: 'Inventory saved.', type: 'success'}));
    } catch (e) {
      dispatch(showToast({message: 'Could not save inventory.', type: 'error'}));
    }
  };

  const renderTrend = (pct: number) => {
    if (Math.abs(pct) < 5) {
      return <Text style={[styles.trend, {color: '#7A7266'}]}>– Steady</Text>;
    }
    const up = pct > 0;
    return (
      <Text style={[styles.trend, {color: up ? '#2E7D5B' : '#B3261E'}]}>
        {up ? '▲ +' : '▼ '}
        {pct}%
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#C9A24D" />
      <LinearGradient colors={['#C9A24D', '#A67C2E']} style={styles.header}>
        <TouchableOpacity
          onPress={() => (editing ? setEditing(false) : navigation.goBack())}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Feather name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Inventory</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {accountName}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {!editing && (
          <>
            {/* Filters */}
            <View style={styles.chipRow}>
              {RANGE_LABELS.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.chip, range === r.key && styles.chipOn]}
                  onPress={() => setRange(r.key)}>
                  <Text
                    style={[styles.chipText, range === r.key && styles.chipTextOn]}
                    numberOfLines={1}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.caption}>
              {rangeCaption(range)} · {summary.visitCount}{' '}
              {summary.visitCount === 1 ? 'visit' : 'visits'}
            </Text>

            {summary.visitCount === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No visits in this period.</Text>
              </View>
            ) : (
              <>
                {/* Consolidated summary */}
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryValue}>{summary.visitCount}</Text>
                    <Text style={styles.summaryLabel}>Visits</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryValue}>{summary.totalAsked}</Text>
                    <Text style={styles.summaryLabel}>Total asked</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTop} numberOfLines={2}>
                      {summary.top}
                    </Text>
                    <Text style={styles.summaryLabel}>Top mover</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text
                      style={[
                        styles.summaryValue,
                        summary.lowStock > 0 && {color: '#B3261E'},
                      ]}>
                      {summary.lowStock}
                    </Text>
                    <Text style={styles.summaryLabel}>Low stock SKUs</Text>
                  </View>
                </View>

                {/* Consolidated per-SKU table */}
                <Text style={styles.sectionTitle}>SKU summary</Text>
                <View style={styles.card}>
                  <View style={styles.tableHead}>
                    <Text style={[styles.th, {flex: 2.2}]}>SKU</Text>
                    <Text style={[styles.th, styles.num]}>Asked</Text>
                    <Text style={[styles.th, styles.num]}>Avg left</Text>
                    <Text style={[styles.th, styles.num]}>★</Text>
                    <Text style={[styles.th, {flex: 1.5, textAlign: 'right'}]}>
                      Trend
                    </Text>
                  </View>
                  {summary.perSku.map(r => (
                    <View key={r.sku} style={styles.tableRow}>
                      <Text style={[styles.td, {flex: 2.2}]} numberOfLines={1}>
                        {shortName(r.sku)}
                      </Text>
                      <Text style={[styles.td, styles.num]}>{r.asked}</Text>
                      <Text
                        style={[
                          styles.td,
                          styles.num,
                          r.avgLeft <= 4 && {color: '#B3261E'},
                        ]}>
                        {r.avgLeft}
                      </Text>
                      <Text style={[styles.td, styles.num]}>{r.soldMost}</Text>
                      <View style={{flex: 1.5, alignItems: 'flex-end'}}>
                        {summary.visitCount > 1 ? (
                          renderTrend(r.trend)
                        ) : (
                          <Text style={[styles.trend, {color: '#7A7266'}]}>–</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
                <Text style={styles.legend}>
                  ★ = times marked "sold most". Trend = latest visit vs earlier
                  visits in this period.
                </Text>

                {/* Visit rows */}
                <Text style={styles.sectionTitle}>Visits</Text>
                {visits.map(v => {
                  const t = visitTotals(v);
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={styles.visitRow}
                      activeOpacity={0.8}
                      onPress={() =>
                        navigation.navigate('RetailerInventoryVisit', {
                          accountName,
                          visit: v,
                        })
                      }>
                      <View style={styles.dateBox}>
                        <Text style={styles.dateDay}>
                          {moment(v.date).format('DD')}
                        </Text>
                        <Text style={styles.dateMon}>
                          {moment(v.date).format('MMM')}
                        </Text>
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={styles.visitTitle}>
                          {moment(v.date).format('dddd, DD MMM YYYY')}
                        </Text>
                        <Text style={styles.visitMeta} numberOfLines={1}>
                          {t.asked} asked · Top: {t.top}
                        </Text>
                        {t.low > 0 && (
                          <Text style={styles.visitLow}>
                            ! {t.low} low stock
                          </Text>
                        )}
                      </View>
                      <Feather name="chevron-right" size={22} color="#A67C2E" />
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            <Text style={styles.note}>
              Figures are reported by the retailer to understand market trend
              and product demand. Sales are not tracked here. Demo data.
            </Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={startEditing}>
              <Text style={styles.primaryBtnText}>Record this visit</Text>
            </TouchableOpacity>
          </>
        )}

        {editing && (
          <>
            <Text style={styles.sectionTitle}>Record this visit</Text>
            <Text style={styles.note}>
              Enter what the retailer asked for, what is left on the shelf, and
              tick the SKU that sold the most.
            </Text>
            {draft.map(item => (
              <View key={item.sku} style={styles.card}>
                <Text style={styles.skuName}>{item.sku}</Text>
                <View style={styles.editRow}>
                  <View style={styles.inputWrap}>
                    <Text style={styles.metricLabel}>Asked</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      value={item.asked ? String(item.asked) : ''}
                      placeholder="0"
                      onChangeText={t =>
                        updateDraft(item.sku, {asked: toNumber(t)})
                      }
                    />
                  </View>
                  <View style={styles.inputWrap}>
                    <Text style={styles.metricLabel}>Left</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      value={item.left ? String(item.left) : ''}
                      placeholder="0"
                      onChangeText={t =>
                        updateDraft(item.sku, {left: toNumber(t)})
                      }
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.fastToggle, item.fast && styles.fastToggleOn]}
                    onPress={() => updateDraft(item.sku, {fast: !item.fast})}>
                    <Text
                      style={[
                        styles.fastToggleText,
                        item.fast && {color: '#fff'},
                      ]}>
                      ★ Sold most
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setEditing(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, {flex: 1, marginTop: 0}]}
                onPress={saveDraft}>
                <Text style={styles.primaryBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#C9A24D'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTextWrap: {marginLeft: 8, flex: 1},
  headerTitle: {color: '#fff', fontSize: 21, fontFamily: 'PlayfairDisplay_700Bold', fontWeight: 'normal'},
  headerSub: {color: '#F1EADB', fontSize: 13, marginTop: 2},
  content: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#FBF8F1',
    minHeight: '100%',
  },
  chipRow: {flexDirection: 'row', gap: 8},
  chip: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C9A24D',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  chipOn: {backgroundColor: '#A67C2E', borderColor: '#A67C2E'},
  chipText: {fontSize: 12, fontWeight: '600', color: '#A67C2E'},
  chipTextOn: {color: '#fff'},
  caption: {fontSize: 12, color: '#7A7266', marginTop: 10, marginBottom: 12},
  empty: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#D9D2C3',
  },
  emptyText: {color: '#7A7266', fontSize: 14},
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#D9D2C3',
    minHeight: 76,
  },
  summaryValue: {fontSize: 20, fontWeight: '700', color: '#13265C'},
  summaryTop: {
    fontSize: 15,
    fontWeight: '700',
    color: '#13265C',
    textAlign: 'center',
  },
  summaryLabel: {fontSize: 11, color: '#7A7266', marginTop: 4},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1D1A',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#D9D2C3',
  },
  tableHead: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1EADB',
  },
  th: {fontSize: 11, fontWeight: '700', color: '#7A7266'},
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F1F4',
  },
  td: {fontSize: 13, color: '#1F1D1A'},
  num: {flex: 1, textAlign: 'center'},
  trend: {fontSize: 11, fontWeight: '700'},
  legend: {fontSize: 11, color: '#7A7266', marginBottom: 18, lineHeight: 15},
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#D9D2C3',
    gap: 12,
  },
  dateBox: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#F1EADB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {fontSize: 18, fontWeight: '800', color: '#A67C2E'},
  dateMon: {fontSize: 11, fontWeight: '600', color: '#A67C2E'},
  visitTitle: {fontSize: 14, fontWeight: '700', color: '#1F1D1A'},
  visitMeta: {fontSize: 12, color: '#7A7266', marginTop: 3},
  visitLow: {fontSize: 11, fontWeight: '700', color: '#B3261E', marginTop: 3},
  skuName: {fontSize: 14, fontWeight: '600', color: '#1F1D1A'},
  metricLabel: {fontSize: 11, color: '#7A7266', marginTop: 2},
  note: {fontSize: 12, color: '#7A7266', marginVertical: 12, lineHeight: 17},
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#A67C2E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {color: '#fff', fontSize: 15, fontWeight: '700'},
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A67C2E',
    marginRight: 10,
  },
  secondaryBtnText: {color: '#A67C2E', fontSize: 15, fontWeight: '700'},
  btnRow: {flexDirection: 'row', marginTop: 8},
  editRow: {flexDirection: 'row', alignItems: 'flex-end', marginTop: 10, gap: 10},
  inputWrap: {width: 70},
  input: {
    borderWidth: 1,
    borderColor: '#D9D2C3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    marginTop: 4,
    color: '#1F1D1A',
  },
  fastToggle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A67C2E',
    borderRadius: 8,
    paddingVertical: 9,
  },
  fastToggleOn: {backgroundColor: '#A67C2E'},
  fastToggleText: {fontSize: 12, fontWeight: '600', color: '#A67C2E'},
});

export default RetailerInventory;
