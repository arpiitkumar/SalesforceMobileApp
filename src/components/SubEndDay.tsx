import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Icon from "./Ionicons";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import moment from 'moment';
import { useFocusEffect } from '@react-navigation/native';
const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 80) / 3;

const SubEndDay = ({ onUnvisitedOutletsLoaded }) => {
  const [pjp, setPjp] = useState(0);
  const [callsMade, setCallsMade] = useState(0);
  const [nonPjp, setNonPjp] = useState(0);
  const [totalOutlet, setTotalOutlet] = useState(0);
  const [totalProductive, setTotalProductive] = useState(0);
  const [productivity, setProductivity] = useState(0);
  const [unvisitedOutlets, setUnvisitedOutlets] = useState([]);
  const [isOpen, setIsOpen] = useState(true);

  const fetchData = async () => {
    try {
      const dateNow = moment().format("YYYY-MM-DD");
      console.log("FETCHING DYNAMIC END DAY OUTLET SUMMARY DATA FOR:", dateNow);

      const userFromDb = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get",
      });

      const RoutePlans = await UniversalUpdateInsert({
        ObjectName: "Route_Plans__c",
        Type: "get",
        filters: [
          { field: 'Assigned_To__c', value: userFromDb?.[0]?.Sf_Id },
        ],
      }) || [];

      const todayForRoutePlans = new Date();
      const firstDayOfMonth = new Date(todayForRoutePlans.getFullYear(), todayForRoutePlans.getMonth(), 1);
      const lastDayOfMonth = new Date(todayForRoutePlans.getFullYear(), todayForRoutePlans.getMonth() + 1, 0);
      const currentMonthRoutePlans = RoutePlans.filter(plan => {
        const startDate = new Date(plan.Start_Date__c);
        const endDate = new Date(plan.End_Date__c);
        return startDate <= lastDayOfMonth && endDate >= firstDayOfMonth;
      });
      const activePlanId = currentMonthRoutePlans[0]?.Sf_Id;

      // Fetch BeatDays
      const BeatDays = await UniversalUpdateInsert({
        ObjectName: "BeatDay__c",
        Type: "get",
      }) || [];

      const beatDayDate = (beatDay) => String(beatDay?.Beat_Date__c || beatDay?.BeatDate__c || "").slice(0, 10);
      const beatDayForDate = BeatDays.find(b =>
        (activePlanId ? b.Tour_Plan__c === activePlanId : true) && beatDayDate(b) === dateNow
      ) || BeatDays.find(b => beatDayDate(b) === dateNow);

      // Fetch Visits for the day
      let Visitsall = [];
      if (beatDayForDate?.Sf_Id) {
        Visitsall = await UniversalUpdateInsert({
          ObjectName: "Visit",
          Type: "get",
          filters: [
            { field: "SoftDelete", value: false },
            { field: "BeatDay__c", value: beatDayForDate.Sf_Id },
          ],
        }) || [];
      }

      if (!Visitsall || Visitsall.length === 0) {
        const allVisits = await UniversalUpdateInsert({
          ObjectName: "Visit",
          Type: "get",
          filters: [
            { field: "SoftDelete", value: false },
          ],
        }) || [];
        Visitsall = allVisits.filter(v =>
          (beatDayForDate?.Sf_Id && v.BeatDay__c === beatDayForDate.Sf_Id) ||
          (v.VisitDate__c === dateNow)
        );
      }

      // Fetch Accounts
      const accountData = await UniversalUpdateInsert({
        ObjectName: "Account",
        Type: "get",
      }) || [];

      const accountMap = new Map();
      (accountData || []).forEach((acc) => {
        if (acc.Sf_Id) accountMap.set(String(acc.Sf_Id).trim(), acc);
        if (acc.id) accountMap.set(String(acc.id).trim(), acc);
      });

      // Fetch Orders to determine if order is taken for an outlet/visit
      const orders = await UniversalUpdateInsert({
        ObjectName: "Order",
        Type: "get",
        filters: [{ field: "SoftDelete", value: false }],
      }) || [];

      // Visit is the source of truth for the outlet totals. Do not discard a
      // visit because its Account is not present in the local cache or has a
      // stale active flag; that caused valid scheduled visits to display as 0.
      const Visits = Visitsall || [];

      const isNonPjpVisit = (visit) =>
        visit?.NonPjpOutlet__c === true || visit?.NonPjpOutlet__c === "true";

      const isCallMadeVisit = (visit) =>
        Boolean(
          (visit?.CheckInTime__c && visit?.CheckOutTime__c) ||
          visit?.VisitStatus__c === "In Progress" ||
          visit?.VisitStatus__c === "Completed" ||
          visit?.VisitStatus__c === "Check Out" ||
          visit?.VisitStatus__c === "Check In" ||
          visit?.CheckInTime__c
        );

      const isProductiveVisit = (visit) => {
        if (visit?.ProductiveCall__c === true || visit?.ProductiveCall__c === "true") {
          return true;
        }
        // Check if any order was created for this visit or account today
        const hasOrder = orders.some(order => {
          const matchesVisit =
            (order.Visit__c && (order.Visit__c === visit.Sf_Id || order.Visit__c === visit.id)) ||
            (order.Visit && (order.Visit === visit.Sf_Id || order.Visit === visit.id));
          const matchesAccount =
            (order.AccountId && (order.AccountId === visit.AccountId__c || order.AccountId__c === visit.AccountId__c)) ||
            (order.AccountId__c && (order.AccountId__c === visit.AccountId__c));
          const orderDate = order.EffectiveDate || order.OrderSubmissionTime__c || order.CreatedDate;
          const isToday = orderDate ? String(orderDate).startsWith(dateNow) : true;
          return matchesVisit || (matchesAccount && isToday);
        });
        return hasOrder;
      };

      const PjpCount = Visits.filter(v => !isNonPjpVisit(v)).length;
      const PjpCallMadeCount = Visits.filter(v => !isNonPjpVisit(v) && isCallMadeVisit(v)).length;
      const nonPjpCount = Visits.filter(v => isNonPjpVisit(v)).length;
      const totalVisits = Visits.length;
      const totalProductiveCount = Visits.filter(v => isProductiveVisit(v)).length;
      const productivityPercent = totalVisits > 0 ? Math.round((totalProductiveCount / totalVisits) * 100) : 0;

      // Extract unvisited outlets list
      const missedList = Visits.filter(v => !isCallMadeVisit(v)).map(v => {
        const accId = String(v.AccountId__c || v.AccountId || "").trim();
        const account = accountMap.get(accId);
        return {
          id: v.id || v.Sf_Id,
          sfId: v.Sf_Id,
          visitId: v.Sf_Id || v.id,
          accountId: accId,
          accountName: account?.Name || v.AccountName || v.AccountId__r?.Name || "Scheduled Outlet",
          accountCode: account?.Account_Code__c || account?.Outlet_Id__c || "",
          class: account?.Class__c || "",
          address: account?.BillingStreet || account?.ShippingStreet || account?.City__c || account?.Address__c || "",
          beatName: account?.Beat_Name__c || v.Beat_Name__c || "",
          isNonPjp: isNonPjpVisit(v),
        };
      });

      setTotalOutlet(totalVisits);
      setPjp(PjpCount);
      setCallsMade(PjpCallMadeCount);
      setNonPjp(nonPjpCount);
      setTotalProductive(totalProductiveCount);
      setProductivity(productivityPercent);
      setUnvisitedOutlets(missedList);

      if (onUnvisitedOutletsLoaded && typeof onUnvisitedOutletsLoaded === 'function') {
        onUnvisitedOutletsLoaded(missedList);
      }
    } catch (error) {
      console.error('Failed to get dynamic outlet summary data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  return (
    <View style={styles.wrapper}>
      {/* 🔹 OUTLET DETAILS CARD */}
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.headerRow}
          activeOpacity={0.7}
          onPress={() => setIsOpen(!isOpen)}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: '#A67C2E' }]}>
              Outlet Details
            </Text>
            <Text style={styles.headerSub}>
              All Outlet — quick overview
            </Text>
          </View>

          <Icon
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={22}
            color="#C9A24D"
          />
        </TouchableOpacity>

        {isOpen && (
          <>
            {/* 🔹 ONE ROW CARDS */}
            <View style={styles.row}>
              <Tile value={pjp} label="PJP Outlets" />
              <Tile value={callsMade} label="PJP Calls Made" />
              <Tile value={nonPjp} label="Non PJP Outlets" />
            </View>
            <View style={styles.row}>
              <Tile value={totalOutlet} label="Total Outlets" />
              <Tile value={totalProductive} label="Productive Outlet" />
              <Tile value={productivity} label="Productivity" />
            </View>
          </>
        )}
      </View>

      {/* 🔹 NOT VISITED OUTLETS CARD (BELOW OUTLET DETAILS) */}
      <View style={styles.notVisitedContainer}>
        <View style={styles.notVisitedHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.headerTitle, { color: '#A67C2E' }]}>
                Not Visited Outlets
              </Text>
              <View style={[styles.badgePill, { backgroundColor: unvisitedOutlets.length > 0 ? '#F1EADB' : '#E3F1EA' }]}>
                <Text style={[styles.badgePillText, { color: unvisitedOutlets.length > 0 ? '#C9A24D' : '#2E7D5B' }]}>
                  {unvisitedOutlets.length}
                </Text>
              </View>
            </View>
            <Text style={styles.headerSub}>
              {unvisitedOutlets.length > 0
                ? `${unvisitedOutlets.length} ${unvisitedOutlets.length === 1 ? 'outlet was' : 'outlets were'} not visited today`
                : 'All scheduled outlets have been visited'}
            </Text>
          </View>
        </View>

        {unvisitedOutlets.length > 0 ? (
          <View style={styles.unvisitedList}>
            {unvisitedOutlets.map((item, idx) => (
              <View
                key={item.id || item.sfId || idx}
                style={styles.unvisitedCard}
              >
                <View style={styles.unvisitedCardContent}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.unvisitedName} numberOfLines={1}>
                      {item.accountName}
                    </Text>
                    <View style={styles.missedBadge}>
                      <Text style={styles.missedBadgeText}>Missed</Text>
                    </View>
                  </View>

                  <View style={styles.unvisitedMetaRow}>
                    {item.accountCode ? (
                      <View style={styles.codePill}>
                        <Text style={styles.codePillText}>#{item.accountCode}</Text>
                      </View>
                    ) : null}
                    {item.class ? (
                      <View style={styles.classTag}>
                        <Text style={styles.classTagText}>Class {item.class}</Text>
                      </View>
                    ) : null}
                    {item.beatName ? (
                      <Text style={styles.unvisitedBeat} numberOfLines={1}>
                        Beat: {item.beatName}
                      </Text>
                    ) : null}
                  </View>

                  {item.address ? (
                    <Text style={styles.unvisitedAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="checkmark-circle-outline" size={20} color="#166534" />
            <Text style={styles.emptyStateText}>
              Great job! All scheduled outlets for today were visited.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const Tile = ({ value, label }) => (
  <View style={styles.tile}>
    <Text style={styles.tileValue}>{value}{label === 'Productivity' ? '%' : ''}</Text>
    <View style={styles.divider} />
    <Text style={styles.tileLabel}>{label}</Text>
  </View>
);

export default SubEndDay;
const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    paddingVertical: 20,
    paddingHorizontal: 10,
    borderRadius: 12,
    elevation: 2,
    width: '92%',
    alignSelf: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
  },
  headerRow: {
    marginBottom: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
    color: '#7A7266',
    marginTop: 4,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  tile: {
    width: CARD_WIDTH,
    backgroundColor: '#F1EADB',
    borderRadius: 16,
    paddingVertical: 6,
    alignItems: 'center',
    margin: 5,

    // ✨ Neumorphism shadow
    shadowColor: '#7A7266',
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 6,
  },

  tileValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#A67C2E',
  },

  divider: {
    width: 20,
    height: 3,
    backgroundColor: '#D9D2C3',
    borderRadius: 3,
    marginVertical: 6,
  },

  tileLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7A7266',
    letterSpacing: 0.5,
    textAlign: 'center'
  },

  wrapper: {
    width: '100%',
    alignItems: 'center',
  },

  notVisitedContainer: {
    backgroundColor: "white",
    marginTop: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    elevation: 2,
    width: '92%',
    alignSelf: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },

  notVisitedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },

  badgePillText: {
    fontSize: 12,
    fontWeight: '700',
  },

  unvisitedList: {
    marginTop: 4,
  },

  unvisitedCard: {
    backgroundColor: '#FBF8F1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3.5,
    borderLeftColor: '#C9A24D',
    borderWidth: 1,
    borderColor: '#D9D2C3',
  },

  unvisitedCardContent: {
    flex: 1,
  },

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  unvisitedName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1D1A',
    flex: 1,
    marginRight: 8,
  },

  missedBadge: {
    backgroundColor: '#F1EADB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: '#FECDD3',
  },

  missedBadgeText: {
    color: '#A67C2E',
    fontSize: 11,
    fontWeight: '700',
  },

  unvisitedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
  },

  codePill: {
    backgroundColor: '#D9D2C3',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginRight: 6,
  },

  codePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F1D1A',
  },

  classTag: {
    backgroundColor: '#F1EADB',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 0.5,
    borderColor: '#D9D2C3',
  },

  classTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7A7266',
  },

  unvisitedBeat: {
    fontSize: 11,
    color: '#7A7266',
    fontWeight: '500',
  },

  unvisitedAddress: {
    fontSize: 11,
    color: '#7A7266',
    marginTop: 4,
  },

  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    marginTop: 6,
  },

  emptyStateText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
});
