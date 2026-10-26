import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Modal, TouchableWithoutFeedback, UIManager, findNodeHandle, Pressable
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import DownArrow from '../../assets/images/arrowDown.svg';
import UpArrow from '../../assets/images/arrowUp.svg';
import { getDashboardSOStyle } from '../../assets/css/DashboardSO.js';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import moment from 'moment'
import Ionicons from "../../components/Ionicons";
import { TouchableOpacity } from 'react-native-gesture-handler';
import getOrderedCategories from '../../UtilityMain/producthelpers/categoryPriorityService';
import { getUserAccessibleCategories } from '../../UtilityMain/producthelpers/userLineServiceForEndDay';

const DashboardSO = () => {
  const styles = getDashboardSOStyle();
  const [selectedUser, setSelectedUser] = useState('1');
  const [users, setUsers] = useState([]);
  const [uniqueCategories, setUniqueCategories] = useState([])
  const [selected, setSelected] = useState("Oils");
  const filterRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const DROPDOWN_WIDTH = 140;
  const openDropdown = () => {
    const handle = findNodeHandle(filterRef.current);

    if (handle) {
      UIManager.measure(handle, (x, y, width, height, pageX, pageY) => {
        setDropdownPos({
          top: pageY + height + 6, // button ke niche
          left: pageX + width - DROPDOWN_WIDTH, // RIGHT aligned
        });
        setVisible(true);
      });
    }
  };



  // ------- target states -------
  const [valueTarget, setValueTarget] = useState<number | null>(null);
  const [tlsTarget, setTlsTarget] = useState<number | null>(null);
  const [utlsTarget, setUtlsTarget] = useState<number | null>(null);
  const [mboTarget, setMboTarget] = useState<number | null>(null);
  const [subCatTarget, setSubCatTarget] = useState<number | null>(null);
  const [threeCatTarget, setThreeCatTarget] = useState<number | null>(null);

  // ------- achieved states -------
  const [valueAchieved, setValueAchieved] = useState(0);
  // const [tlsAchieved, setTlsAchieved] = useState(0);
  const [mboAchieved, setMboAchieved] = useState(0);
  const [subCatAchieved, setSubCatAchieved] = useState(0);
  const [threeCatAchieved, setThreeCatAchieved] = useState(0);


  const [currentMonthBillCuts, setCurrentMonthBillCuts] = useState(0)
  const [categorizedData, setCategorizedData] = useState({
    Upcoming: [],
    "Check Out": [],
    "Check In": [],
  });

  const [aStoresCompleted, setAStoresCompleted] = useState(0);
  const [aStoresTotal, setAStoresTotal] = useState(0);
  const [wholesaleCompleted, setWholesaleCompleted] = useState(0);
  const [wholesaleTotal, setWholesaleTotal] = useState(0);
  const [outletVisited, setOutletVisited] = useState(0);

  // helpers
  const safeParseNumber = (raw: any, preferAfterSlash = false) => {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === 'number') return raw;
    const s = String(raw).trim();
    if (!s) return 0;
    if (s.includes('/')) {
      const parts = s.split('/').map(p => p.trim());
      const pick = preferAfterSlash ? parts[1] ?? parts[0] : parts[0];
      const n = Number(String(pick).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(s.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const toMonthly = (value: number, frequency: string | undefined) => {
    if (!frequency) return value;
    const f = String(frequency).toLowerCase();
    if (f.includes('year')) return value / 12;
    if (f.includes('quarter')) return value / 3;
    return value;
  };

  const overlapsMonth = (start?: string | Date | null, end?: string | Date | null, monthDate?: string) => {
    const base = monthDate ? new Date(monthDate) : new Date();
    const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0);

    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;

    if (!s && !e) return true;

    const startOk = s ? s <= lastDay : true;
    const endOk = e ? e >= firstDay : true;
    return startOk && endOk;
  };


  const calculateBillCust = async () => {

    const InvoiceData = await UniversalUpdateInsert({
      ObjectName: "Invoice__c",
      Type: "get",

    });

    const currentMonth = moment().month();
    const currentYear = moment().year();

    // Filter InvoiceData
    const filteredInvoices = InvoiceData.filter(invoice => {
      const invoiceDate = moment(invoice.InvoiceDate__c, 'YYYY-MM-DD');
      return invoiceDate.month() === currentMonth && invoiceDate.year() === currentYear;
    });
    setCurrentMonthBillCuts(filteredInvoices?.length)
    //console.log("YHIDS IS FILTERED INVOICEESS>>>>>>>>>>>>>>>",filteredInvoices)
  }



  // Calculate A-stores metrics
  const calculateAStores = (accountData, categorizedData) => {
    // Get all accounts that are Active and Class A
    const aStoreAccounts = accountData.filter(account =>
      account.Active__c === true && account.Class__c === 'A'
    );

    // Count completed A-store visits
    const completedAStores = categorizedData["Check Out"].filter(visit => {
      const account = accountData.find(acc => acc.Sf_Id === visit.AccountId__c);
      return account && account.Active__c === true && account.Class__c === 'A';
    }).length;

    console.log(`A-Stores: ${completedAStores} completed out of ${aStoreAccounts.length} total`);

    setAStoresTotal(aStoreAccounts.length);
    setAStoresCompleted(completedAStores);
  };

  // Calculate Wholesale metrics
  const calculateWholesale = (accountData, categorizedData) => {
    // Get all accounts that are Active and SubChannel is Wholesale
    const wholesaleAccounts = accountData.filter(account =>
      account.Active__c === true // && account.SubChannel__c === 'Wholesale'
    );

    // Count completed wholesale visits
    const completedWholesale = categorizedData["Check Out"].filter(visit => {
      const account = accountData.find(acc => acc.Sf_Id === visit.AccountId__c);
      return account && account.Active__c === true; // && account.SubChannel__c === 'Wholesale';
    }).length;

    console.log(`Wholesale: ${completedWholesale} completed out of ${wholesaleAccounts.length} total`);

    setWholesaleTotal(wholesaleAccounts.length);
    setWholesaleCompleted(completedWholesale);
  };


  const fetchVisits = async () => {
    try {
      const accountData = await UniversalUpdateInsert({
        ObjectName: "Account",
        Type: "get",
      });


      const users = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get",
      });



      const RoutePlans = await UniversalUpdateInsert({
        ObjectName: "Route_Plans__c",
        Type: "get",
        filters: [
          { field: "Assigned_To__c", value: users[0].Sf_Id },
        ],
      });

      const todayForRoutePlans = new Date();
      const firstDayOfMonth = new Date(
        todayForRoutePlans.getFullYear(),
        todayForRoutePlans.getMonth(),
        1
      );
      const currentDate = new Date();

      // Filter route plans active in current month
      const currentMonthRoutePlans = RoutePlans.filter((plan) => {
        const startDate = new Date(plan.Start_Date__c);
        const endDate = new Date(plan.End_Date__c);
        return startDate <= currentDate && endDate >= firstDayOfMonth;
      });

      if (currentMonthRoutePlans.length === 0) {
        console.log("⚠️ No Route Plans found for this month.");
        return;
      }

      const activePlanId = currentMonthRoutePlans[0].Sf_Id;

      // Get BeatDays
      const BeatDays = await UniversalUpdateInsert({
        ObjectName: "BeatDay__c",
        Type: "get",
      });

      // Get Visits
      const Visit = await UniversalUpdateInsert({
        ObjectName: "Visit",
        Type: "get",
        filters: [{ field: "SoftDelete", value: false }],
      });

      // Categorized data for whole month
      const categorized = {
        Upcoming: [],
        "Check Out": [],
        "Check In": [],
      };

      // Loop from 1st of month to today
      for (
        let d = new Date(firstDayOfMonth);
        d <= currentDate;
        d.setDate(d.getDate() + 1)
      ) {
        const loopDate = moment(d).format("YYYY-MM-DD");

        // Find BeatDay for that date
        const beatDayForDate = BeatDays.find(
          (b) =>
            b.Tour_Plan__c === activePlanId &&
            b.BeatDate__c === loopDate
        );

        if (!beatDayForDate) continue;

        const filteredVisits = Visit.filter(
          (v) => v.BeatDay__c === beatDayForDate.Sf_Id
        );

        filteredVisits.forEach((v) => {
          if (!v.AccountId) return;

          const accountDetails = accountData.find(
            (a) => a.Sf_Id === v.AccountId
          );

          const base = {
            name: accountDetails?.Name || "",
            Class__c: accountDetails?.Class__c,
            target: accountDetails?.Channel__c,
            Active__c: accountDetails?.Active__c,
            // SubChannel__c: accountDetails?.SubChannel__c,
            lastOrder: "5 days",
            ProductiveCall__c: v.ProductiveCall__c,
            propensity: "70%",
            AccountId: v.AccountId,
            sfId: v.Sf_Id,
            CheckInTime__c: v.CheckInTime__c,
            CheckOutTime__c: v.CheckOutTime__c,
            Phone: accountDetails?.Phone,
            BillingAddress: accountDetails?.BillingAddress,
            OTPVerified__c: accountDetails?.OTPVerified__c,
            CreditLimit__c: accountDetails?.CreditLimit__c,
            VisitStatus__c: v.VisitStatus__c,
            CheckInLocation__Longitude: v.CheckInLocation__Longitude__s,
            CheckInLocation__Latitude: v.CheckInLocation__Latitude__s,
            CheckOutLocation__Longitude: v.CheckOutLocation__Longitude__s,
            CheckOutLocation__Latitude: v.CheckOutLocation__Latitude__s,
            BillingLatitude: accountDetails?.BillingLatitude,
            BillingLongitude: accountDetails?.BillingLongitude,
            BeatDay__c: v?.BeatDay__c,
            BeatDate__c: loopDate, // add date info for clarity
          };

          if (v.CheckInTime__c && v.CheckOutTime__c) {
            categorized["Check Out"].push(base);
          } else if (
            (v.CheckInTime__c && !v.CheckOutTime__c) ||
            v.VisitStatus__c === "Check In"
          ) {
            categorized["Check In"].push(base);

          } else {
            categorized.Upcoming.push(base);
          }
        });
      }

      setCategorizedData(categorized);
      //console.log("LENTH OF CATEGORY COMPLETE>>>>>>>>>>>>>>>>",categorized["Check Out"].length)
      setOutletVisited(categorized?.["Check Out"]?.length)

      setCategorizedData(categorized);
      setOutletVisited(categorized?.["Check Out"]?.length);

      // Calculate A-stores and Wholesale metrics
      calculateAStores(accountData, categorized);
      calculateWholesale(accountData, categorized);

    } catch (e) {
      console.error(" Error fetching Visit data:", e);
    }
  };


  useFocusEffect(
    useCallback(() => {
      const initialize = async () => {
        console.log('selected', selected)
        try {
          const result = await UniversalUpdateInsert({
            ObjectName: 'User',
            Type: 'get',
          });
          setUsers(result);

          if (!result?.[0]) {
            console.warn('⚠️ No valid user found');
            return;
          }

          const TargetData = await UniversalUpdateInsert({
            ObjectName: 'Target__c',
            Type: 'get',
            filters: [
              // { field: 'TargetSetFor__c', value: result[0].Sf_Id },
              { field: 'Category__c', value: selected },
            ]
          });

          await calculateBillCust()

          let valueSum = 0, tlsSum = 0, utlsSum = 0, mboSum = 0, subCatSum = 0, threeCatSum = 0;
          let valueAchSum = 0, tlsAchSum = 0, mboAchSum = 0, subCatAchSum = 0, threeCatAchSum = 0;

          for (const t of (TargetData || [])) {
            const startRaw = t.StartDate__c ?? t.EffectiveDate ?? t.Effective_Date__c ?? t.Start_Date__c ?? null;
            const endRaw = t.EndDate__c ?? t.End_Date__c ?? t.EndDate ?? null;
            const freq = t.Frequency__c ?? t.Frequency ?? 'Monthly';
            const dateStore = null;

            if (!overlapsMonth(startRaw, endRaw, dateStore)) {
              continue;
            }

            // ---------- Targets ----------
            const rawValue = selected === 'Oils' || selected === 'Flour' ? safeParseNumber(t.VolumeTarget__c) : safeParseNumber(t.ValueTarget__c);
            const rawTls = safeParseNumber(t.TLSTarget__c);
            const rawUtls = safeParseNumber(t.UTLSTarget__c);
            const rawMbo = (t.MBO_Type__c === null ||
              t.MBO_Type__c === undefined ||
              t.MBO_Type__c === '') &&
              (selected !== 'Oils' || t.SubCategory__c === '') ? safeParseNumber(t.MBO_Target__c, true) : 0;
            const rawSubCat = t.MBO_Type__c === '2 Oil MBO' ? safeParseNumber(t.MBO_Target__c, true) : 0;
            const rawThreeCat = t.MBO_Type__c === '3 Oil MBO' ? safeParseNumber(t.MBO_Target__c, true) : 0;

            // ---------- Achieved ----------
            const rawValueAch = selected === 'Oils' || selected === 'Flour' ? safeParseNumber(t.VolumeTargetAchieved__c) : safeParseNumber(t.ValueTargetAchieved__c);
            const rawTlsAch = safeParseNumber(t.ValueTarget__c); // if TLS achieved = same as ValueTargetAchieved
            const rawMboAch = (t.MBO_Type__c === null ||
              t.MBO_Type__c === undefined ||
              t.MBO_Type__c === '') &&
              (selected !== 'Oils' || t.SubCategory__c === '') ? safeParseNumber(t.MBO_Target_Achieved__c) : 0;
            const rawSubCatAch = t.MBO_Type__c === '2 Oil MBO' ? safeParseNumber(t.MBO_Target_Achieved__c) : 0;
            const rawThreeCatAch = t.MBO_Type__c === '3 Oil MBO' ? safeParseNumber(t.MBO_Target_Achieved__c) : 0;

            // ---------- Sum up ----------
            valueSum += toMonthly(rawValue, freq);
            tlsSum += toMonthly(rawTls, freq);
            utlsSum += toMonthly(rawUtls, freq);
            mboSum += toMonthly(rawMbo, freq);
            subCatSum += toMonthly(rawSubCat, freq);
            threeCatSum += toMonthly(rawThreeCat, freq);

            valueAchSum += toMonthly(rawValueAch, freq);
            tlsAchSum += toMonthly(rawTlsAch, freq);
            mboAchSum += toMonthly(rawMboAch, freq);
            subCatAchSum += toMonthly(rawSubCatAch, freq);
            threeCatAchSum += toMonthly(rawThreeCatAch, freq);
          }

          // ------- set states -------
          setValueTarget(Math.round(valueSum) || 0);
          setTlsTarget(Math.round(tlsSum) || 0);
          setUtlsTarget(Math.round(utlsSum) || 0);
          setMboTarget(Math.round(mboSum) || 0);
          setSubCatTarget(Math.round(subCatSum) || 0);
          setThreeCatTarget(Math.round(threeCatSum) || 0);

          setValueAchieved(Math.round(valueAchSum) || 0);
          // setTlsAchieved(Math.round(tlsAchSum) || 0);
          setMboAchieved(Math.round(mboAchSum) || 0);
          setSubCatAchieved(Math.round(subCatAchSum) || 0);
          setThreeCatAchieved(Math.round(threeCatAchSum) || 0);
          fetchVisits()


          const allProducts = await UniversalUpdateInsert({
            ObjectName: 'Product2',
            Type: 'get',
          });

          const loggedInUser = await UniversalUpdateInsert({
            ObjectName: 'User',
            Type: 'get',
          });

          const accessibleCategories = await getUserAccessibleCategories(loggedInUser);
          // console.log('accessibleCategories', accessibleCategories)

          const orderedUniqueCategories = await getOrderedCategories(accessibleCategories);
          // console.log('orderedUniqueCategories',orderedUniqueCategories)
          setUniqueCategories(orderedUniqueCategories)

        } catch (error) {
          console.error(' Error in initialize DashboardSO:', error);
        }
      };

      initialize();
    }, [selected])
  );


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={{ padding: 10, paddingTop: 0 }}>
        <View style={styles.filterWrapper}>
          <TouchableOpacity
            ref={filterRef}
            onPress={openDropdown}
            style={styles.filterButton}
          >
            <Ionicons name="filter-outline" size={20} color="#A67C2E" />
            <Text style={styles.filterText}>{selected?.toLowerCase() === 'flour' ? 'Staples' : selected}</Text>
            {/* <Text style={styles.filterText}>{selected}</Text> */}
            <Ionicons name="chevron-down" size={18} color="#A67C2E" />
          </TouchableOpacity>

          <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={() => setVisible(false)}
          >
            {/* Outside touch */}
            <Pressable style={styles.modalOverlay} onPress={() => setVisible(false)}>

              {/* Dropdown (inside touch should NOT close immediately) */}
              <Pressable
                style={[
                  styles.filterMenu,
                  { top: dropdownPos.top, left: dropdownPos.left },
                ]}
                onPress={(e) => e.stopPropagation()}
              >
                {uniqueCategories.map((item, i) => (
                  <Pressable
                    key={i}
                    onPress={() => {
                      setSelected(item);   // now works on Android
                      setVisible(false);
                    }}
                    style={[
                      styles.menuItem,
                      selected === item && styles.menuItemActive,
                    ]}
                  >
                    {/* <Text style={styles.menuText}>{item}</Text> */}
                    <Text style={styles.menuText}>{item?.toLowerCase() === 'flour' ? 'Staples' : item}</Text>
                  </Pressable>
                ))}
              </Pressable>

            </Pressable>
          </Modal>



        </View>

      </View>
      {/* Dropdown */}
      {/* <Dropdown
        style={styles.dropdown}
        data={users}
        labelField="label"
        valueField="value"
        placeholder="Select User"
        value={selectedUser}
        onChange={item => setSelectedUser(item.value)}
        placeholderStyle={styles.dropdownPlaceholder}
        selectedTextStyle={styles.dropdownText}
        itemTextStyle={styles.dropdownItemText}
      /> */}



      <View style={styles.card}>
        <View>
          <Text style={styles.value}>{valueAchieved}/ {valueTarget}</Text>
          <Text style={styles.subtitle}><Text style={{ fontSize: 15, fontWeight: '500', color: '#1F1D1A' }}>{selected === 'Oils' || selected === 'Flour'
            ? `${selected} (in MT)`
            : `${selected} (in Value)`}</Text>
            {/* (In Thousands) */}
          </Text>
        </View>
        <Image source={require('../../assets/images/food.png')} style={styles.icon} />
      </View>


      {
        // selected === 'Oil' && (
        //   <View style={styles.card}>
        //     <View>
        //       <Text style={styles.value}>{valueAchieved} / {valueTarget}</Text>
        //       <Text style={styles.subtitle}> <Text style={{ fontSize: 15, fontWeight: '500', color: '#1F1D1A' }}>
        //         Oil</Text>
        //         {/* (In Liters) */}
        //       </Text>
        //     </View>
        //     <Image source={require('../../assets/images/oil.png')} style={styles.icon} />
        //   </View>
        // )
      }



      {/* TLS and UTLS */}
      <View style={styles.row}>
        <View style={styles.smallCard}>
          <View style={styles.arrowRow}>
            <Text style={styles.cardValue}>{tlsTarget}</Text>
            <DownArrow width={14} height={14} style={styles.arrowIconRed} />
          </View>

          <Text style={styles.cardLabel}>TLS (Total Lines Sold)</Text>
        </View>
        <View style={styles.smallCard}>
          <View style={styles.arrowRow}>
            <Text style={styles.cardValue}>{utlsTarget}</Text>
            <UpArrow width={14} height={14} style={styles.arrowIconGreen} />
          </View>
          <Text style={styles.cardLabel}>UTLS (Unique Total Lines Sold)</Text>
        </View>
      </View>

      {/* MBOs */}

      {/* MBOs + Others in 2 rows with 3 cards each */}
      <View style={styles.rowWrap}>
        <View style={selected === 'Oils' ? styles.smallCard1 : styles.lengthCard}>
          <View style={styles.arrowRow}>
            <Text style={styles.cardValue}>{mboAchieved}/{mboTarget}</Text>
            <DownArrow width={14} height={14} style={styles.arrowIconRed} />
          </View>
          <Text style={styles.cardLabel}>MBO</Text>
        </View>
        {selected === 'Oils' && (
          <>
            <View style={styles.smallCard1}>
              <View style={styles.arrowRow}>
                <Text style={[styles.cardValue, { color: '#2E7D5B' }]}>{subCatAchieved}/{subCatTarget}</Text>
                <UpArrow width={14} height={14} style={styles.arrowIconGreen} />
              </View>
              <Text style={styles.cardLabel}>2 Cat MBO</Text>
            </View>

            <View style={styles.smallCard1}>
              <View style={styles.arrowRow}>
                <Text style={styles.cardValue}>{threeCatAchieved}/{threeCatTarget}</Text>
                <DownArrow width={14} height={14} style={styles.arrowIconRed} />
              </View>
              <Text style={styles.cardLabel}>3 Cat MBO</Text>
            </View></>

        )}


        {/* <View style={styles.smallCard1}>
          <View style={styles.arrowRow}>
            <Text style={styles.cardValue}>{currentMonthBillCuts}</Text>
            <DownArrow width={14} height={14} style={styles.arrowIconRed} />
          </View>

          <Text style={styles.cardLabel}>Bill Cuts</Text>
        </View> */}

        {/* A-Stores Card */}
        <View style={styles.smallCard}>
          <View style={styles.arrowRow}>
            <Text style={[styles.cardValue, { color: aStoresCompleted > 0 ? '#2E7D5B' : '#000' }]}>
              {aStoresCompleted}/{aStoresTotal}
            </Text>
            {aStoresCompleted > 0 ? (
              <UpArrow width={14} height={14} style={styles.arrowIconGreen} />
            ) : (
              <DownArrow width={14} height={14} style={styles.arrowIconRed} />
            )}
          </View>
          <Text style={styles.cardLabel}>A-Stores</Text>
        </View>

        {/* Wholesale Card */}
        <View style={styles.smallCard}>
          <View style={styles.arrowRow}>
            <Text style={[styles.cardValue, { color: wholesaleCompleted > 0 ? '#2E7D5B' : '#000' }]}>
              {wholesaleCompleted}/{wholesaleTotal}
            </Text>
            {wholesaleCompleted > 0 ? (
              <UpArrow width={14} height={14} style={styles.arrowIconGreen} />
            ) : (
              <DownArrow width={14} height={14} style={styles.arrowIconRed} />
            )}
          </View>
          <Text style={styles.cardLabel}>Wholesale</Text>
        </View>
      </View>


    </ScrollView>
  );
};

export default DashboardSO;