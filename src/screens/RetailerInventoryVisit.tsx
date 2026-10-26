/**
 * Retailer Inventory - details of one visit (DEMO).
 * Opened by tapping a visit row on RetailerInventory.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';
import Feather from '@react-native-vector-icons/feather';
import moment from 'moment';
import {InventoryVisit, LOW_STOCK_LIMIT, visitTotals} from './inventoryDemo';

const RetailerInventoryVisit = ({navigation, route}: any) => {
  const accountName: string = route?.params?.accountName || 'Retailer';
  const visit: InventoryVisit | undefined = route?.params?.visit;
  const t = visit ? visitTotals(visit) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#C9A24D" />
      <LinearGradient colors={['#C9A24D', '#A67C2E']} style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Feather name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Visit details</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {accountName}
            {visit ? ` · ${moment(visit.date).format('DD MMM YYYY')}` : ''}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {!visit || !t ? (
          <Text style={styles.empty}>Visit not found.</Text>
        ) : (
          <>
            <Text style={styles.dateLine}>
              {moment(visit.date).format('dddd, DD MMMM YYYY')}
            </Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{t.asked}</Text>
                <Text style={styles.summaryLabel}>Total asked</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{t.left}</Text>
                <Text style={styles.summaryLabel}>Total left</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text
                  style={[styles.summaryValue, t.low > 0 && {color: '#B3261E'}]}>
                  {t.low}
                </Text>
                <Text style={styles.summaryLabel}>Low stock</Text>
              </View>
            </View>
            <Text style={styles.topLine}>
              Sold most: <Text style={styles.topName}>{t.top}</Text>
            </Text>

            {visit.items.map(item => {
              const low = item.left <= LOW_STOCK_LIMIT;
              return (
                <View key={item.sku} style={styles.card}>
                  <Text style={styles.skuName} numberOfLines={1}>
                    {item.sku}
                  </Text>
                  <View style={styles.cardBottom}>
                    <View style={styles.metric}>
                      <Text style={styles.metricValue}>{item.asked}</Text>
                      <Text style={styles.metricLabel}>Asked</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text
                        style={[styles.metricValue, low && {color: '#B3261E'}]}>
                        {item.left}
                      </Text>
                      <Text style={styles.metricLabel}>Left</Text>
                    </View>
                    <View style={styles.flags}>
                      {item.fast && (
                        <View style={[styles.badge, {backgroundColor: '#F1EADB'}]}>
                          <Text style={[styles.badgeText, {color: '#A67C2E'}]}>
                            ★ Sold most
                          </Text>
                        </View>
                      )}
                      {low && (
                        <View style={[styles.badge, {backgroundColor: '#FDECEC'}]}>
                          <Text style={[styles.badgeText, {color: '#B3261E'}]}>
                            ! Low stock
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
            <Text style={styles.note}>
              Retailer-reported figures for demand insight. Demo data.
            </Text>
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
  empty: {textAlign: 'center', color: '#7A7266', marginTop: 40},
  dateLine: {fontSize: 15, fontWeight: '700', color: '#1F1D1A', marginBottom: 12},
  summaryRow: {flexDirection: 'row', gap: 10, marginBottom: 12},
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#D9D2C3',
  },
  summaryValue: {fontSize: 20, fontWeight: '700', color: '#13265C'},
  summaryLabel: {fontSize: 11, color: '#7A7266', marginTop: 4},
  topLine: {fontSize: 13, color: '#7A7266', marginBottom: 14},
  topName: {fontWeight: '700', color: '#A67C2E'},
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#D9D2C3',
  },
  skuName: {fontSize: 14, fontWeight: '600', color: '#1F1D1A'},
  cardBottom: {flexDirection: 'row', alignItems: 'center', marginTop: 10},
  metric: {marginRight: 26},
  metricValue: {fontSize: 18, fontWeight: '700', color: '#1F1D1A'},
  metricLabel: {fontSize: 11, color: '#7A7266', marginTop: 2},
  flags: {flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6},
  badge: {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10},
  badgeText: {fontSize: 11, fontWeight: '600'},
  note: {fontSize: 12, color: '#7A7266', marginTop: 8},
});

export default RetailerInventoryVisit;
