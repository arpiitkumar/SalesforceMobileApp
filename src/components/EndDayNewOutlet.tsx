import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Icon from "./Ionicons";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import moment from 'moment';
const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 70) / 2;

const EndDayNewOutlet = () => {
  const [pjp, setPjp] = useState(0);
  const [callsMade, setCallsMade] = useState(0);
  const dateNow = moment().format("YYYY-MM-DD");
  const [isOpen, setIsOpen] = useState(true);


  useEffect(() => {
    console.log("END DAY SUMMARY SCREEN MOUNTED");

    const fetchData = async () => {
      try {
        const userFromDb = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });
        const RoutePlans = await UniversalUpdateInsert({
          ObjectName: "Route_Plans__c",
          Type: "get",
          filters: [
            { field: 'Assigned_To__c', value: userFromDb[0]?.Sf_Id },
          ],
        });
        const todayForRoutePlans = new Date();
        const firstDayOfMonth = new Date(todayForRoutePlans.getFullYear(), todayForRoutePlans.getMonth(), 1);
        const lastDayOfMonth = new Date(todayForRoutePlans.getFullYear(), todayForRoutePlans.getMonth() + 1, 0);
        const currentMonthRoutePlans = RoutePlans.filter(plan => {
          const startDate = new Date(plan.Start_Date__c);
          const endDate = new Date(plan.End_Date__c);
          return startDate <= lastDayOfMonth && endDate >= firstDayOfMonth;
        });
        const activePlanId = currentMonthRoutePlans[0]?.Sf_Id;
        // 5️⃣ Fetch BeatDays
        const BeatDays = await UniversalUpdateInsert({
          ObjectName: "BeatDay__c",
          Type: "get",
        });
        const beatDayForDate = BeatDays.find(b =>
          b.Tour_Plan__c === activePlanId && b.BeatDate__c === dateNow
        );
        const Visits = await UniversalUpdateInsert({
          ObjectName: "Visit",
          Type: "get",
          filters: [
            { field: "SoftDelete", value: false },
            { field: "BeatDay__c", value: beatDayForDate?.Sf_Id },
          ],
        });

        const PjpCount = Visits?.filter(
          visit => visit.Add_New_Retailer_Visit__c === true
        ).length;
        const totalProductiveCount = Visits?.filter(
          visit => visit.ProductiveCall__c === true && visit.Add_New_Retailer_Visit__c === true
        ).length;

        setPjp(PjpCount || 0)
        setCallsMade(totalProductiveCount || 0)
      } catch (error) {
        console.error('Failed to get data safely:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.headerRow}
        activeOpacity={0.7}
        onPress={() => setIsOpen(!isOpen)}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: '#A67C2E' }]}>
            New Outlet Details
          </Text>
          <Text style={styles.headerSub}>
            All New Outlet — quick overview
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
            <Tile value={pjp} label="New Outlets Added" />
            <Tile value={callsMade} label="New Outlet Productive Visits" />
          </View>
        </>
      )}

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

export default EndDayNewOutlet;
const styles = StyleSheet.create({
  container: {
    marginTop: 20,
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
 
});