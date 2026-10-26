// SRAttendanceScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TextInput,
  TouchableOpacity
} from 'react-native';
import FilterComponent from '../../components/FilterComponent'; // adjust path if needed
import HeaderMain from "../../components/HeaderMain";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import moment from 'moment';
import { showToast } from '../../redux/slices/toastSlice';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { Dropdown } from 'react-native-element-dropdown';
import LinearGradient from 'react-native-linear-gradient';
import { ScrollView } from 'react-native';
import getOrderedCategories from '../../UtilityMain/producthelpers/categoryPriorityService';
import { getUserAccessibleCategories } from '../../UtilityMain/producthelpers/userLineServiceForEndDay';


const LocationReport = () => {
  const dateStore = useSelector(
    (state: RootState) => state.beat.selectedDateBeat
  );
  // filter will be { from: 'YYYY-MM-DD' | null, to: 'YYYY-MM-DD' | null }
  const [filter, setFilter] = useState({ from: null, to: null }); // default All
  const [loading, setLoading] = useState(false);
  const [distributorOptions, setDistributorOptions] = useState([])
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [distributorDataState, setDistributorDataState] = useState([])
  const [beatOptions, setBeatOptions] = useState([]);
  const [selectedBeat, setSelectedBeat] = useState(null);

  const [searchText, setSearchText] = useState('');


  // show accounts & split into MBO / Non MBO
  const [accountsForBeats, setAccountsForBeats] = useState([]);
  const [mboAccounts, setMboAccounts] = useState([]);
  const [nonMboAccounts, setNonMboAccounts] = useState([]);
  const [selectedTab, setSelectedTab] = useState('mbo');
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [categoriesList, setCategoriesList] = useState(['All']); // bubble filters
  const [selectedCategory, setSelectedCategory] = useState('All');



  const dispatch = useDispatch();


  // helper: list of YYYY-MM-DD strings inclusive
  const getDatesBetween = (fromIso, toIso) => {
    const start = moment(fromIso, 'YYYY-MM-DD');
    const end = moment(toIso, 'YYYY-MM-DD');
    const arr = [];
    let m = start.clone();
    while (m.isSameOrBefore(end, 'day')) {
      arr.push(m.format('YYYY-MM-DD'));
      m = m.add(1, 'day');
    }
    return arr;
  };

  // helper: duration string H:M:S or if end is null, duration from start -> now
  const formatDuration = (startIso, endIso) => {
    const start = moment(startIso);
    const end = endIso ? moment(endIso) : moment(); // if no end, use now for in-progress
    if (!start.isValid() || !end.isValid()) return '—';
    const diff = moment.duration(end.diff(start));
    const hours = Math.floor(diff.asHours());
    const minutes = diff.minutes();
    const seconds = diff.seconds();
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const fetchMboNboData = async () => {
    const loggedInUser = await UniversalUpdateInsert({ ObjectName: 'User', Type: 'get' });
    if (!Array.isArray(loggedInUser) || loggedInUser.length === 0) {
      dispatch(showToast({ message: 'No logged in user found', type: 'error' }));

      setLoading(false);
      return;
    }
    const userSfId = loggedInUser[0].Sf_Id;

    const distributorData = await UniversalUpdateInsert({
      ObjectName: "SR_Beat_Assignment__c",
      Type: "get",
      filters: [
        { field: "Assigned_To__c", value: userSfId },
      ],
    });

    console.log('distributor data', distributorData)


    setDistributorDataState(distributorData)

    const uniqueDistributors = Array.from(
      new Map(
        distributorData
          .map(r => [
            r.Distributor__c,
            { label: r.Name, value: r.Distributor__c }
          ])
          .reverse()
      ).values()
    );
    setDistributorOptions(uniqueDistributors)

    console.log('new unique', uniqueDistributors)


  }

  // small helper to split an array into chunks
  const chunk = (arr, size = 200) => {
    const res = [];
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
    return res;
  };

  const getCategoriesForInvoices = async (invoices = []) => {
    try {
      if (!Array.isArray(invoices) || invoices.length === 0) return [];

      // invoice ids (some rows use Sf_Id)
      const invoiceIds = invoices.map((inv) => inv.Sf_Id || inv.id || inv.Id).filter(Boolean);
      if (invoiceIds.length === 0) return [];

      // 1) fetch Invoice_Item__c rows for all invoiceIds (batch 'in' requests)
      let invoiceItems = [];
      const invChunks = chunk(invoiceIds, 100); // keep chunk size reasonable
      for (const ch of invChunks) {
        const res = await UniversalUpdateInsert({
          ObjectName: 'Invoice_Item__c',
          Type: 'get',
          filters: [
            { field: 'Invoice__c', operator: 'in', value: ch },
          ],
        });
        if (Array.isArray(res)) invoiceItems = invoiceItems.concat(res);
      }

      // 2) gather unique product ids from invoice items
      const productIds = Array.from(new Set(
        invoiceItems.map((ii) => ii.Product__c).filter(Boolean)
      ));
      if (productIds.length === 0) return [];

      // 3) fetch Product2 rows for these product ids (batch)
      let products = [];
      const prodChunks = chunk(productIds, 100);
      for (const ch of prodChunks) {
        const res = await UniversalUpdateInsert({
          ObjectName: 'Product2',
          Type: 'get',
          filters: [
            { field: 'Sf_Id', operator: 'in', value: ch },
          ],
        });
        if (Array.isArray(res)) products = products.concat(res);
      }

      // 4) map to categories
      const categories = Array.from(new Set(
        products.map((p) => (p.Category__c || p.Category || '').toString()).filter(Boolean)
      ));

      return categories;
    } catch (err) {
      console.warn('getCategoriesForInvoices error', err);
      return [];
    }
  };

  useEffect(() => {
    fetchMboNboData()
  }, [filter, dateStore]);

  useEffect(() => {
    if (!selectedDistributor) {
      setBeatOptions([]);
      setSelectedBeat(null);
      setAccountsForBeats([]);
      setMboAccounts([]);
      setNonMboAccounts([]);
      return;
    }

    // find all records for selected distributor
    const matches = (distributorDataState || []).filter(
      (d) => d.Distributor__c === selectedDistributor
    );

    // build unique map by Beat__c
    const map = new Map();
    matches.forEach((m) => {
      const beatId = m.Beat__c || null;
      if (!beatId) return;
      const beatLabel = m.BeatName || `Beat ${beatId}`;
      if (!map.has(beatId)) map.set(beatId, { label: beatLabel, value: beatId });
    });

    const uniqueBeats = Array.from(map.values());
    setBeatOptions(uniqueBeats);
    setSelectedBeat(uniqueBeats.length ? uniqueBeats[0].value : null);

    // fetch accounts for these beat ids
    const uniqueBeatIds = uniqueBeats.map((b) => b.value);
    if (uniqueBeatIds.length === 0) {
      setAccountsForBeats([]);
      setMboAccounts([]);
      setNonMboAccounts([]);
      return;
    }

    const loadAccountsAndInvoices = async () => {
      setLoadingAccounts(true);
      try {
        // 1) fetch accounts that belong to these beats
        const accountsFromBeatIds = await UniversalUpdateInsert({
          ObjectName: 'Account',
          Type: 'get',
          filters: [
            {
              field: 'Beat__c',
              operator: 'in',
              value: uniqueBeatIds,
            },
          ],
        });

        setAccountsForBeats(accountsFromBeatIds || []);

        const accounts = Array.isArray(accountsFromBeatIds) ? accountsFromBeatIds : [];

        const getInvoiceCountForAccount = async (acct) => {
          // 1️⃣ Fetch ALL invoices for this account
          const invoices = await UniversalUpdateInsert({
            ObjectName: 'Invoice__c',
            Type: 'get',
            filters: [
              { field: 'SupplierName__c', value: selectedDistributor },
              { field: 'Customer__c', value: acct.Sf_Id },
            ],
          });

          if (!Array.isArray(invoices) || invoices.length === 0) {
            return { count: 0, categoriesOrdered: [] };
          }

          // 2️⃣ If filter.from/to not present -> count all invoices
          let filteredInvoices = invoices;
          if (filter?.from || filter?.to) {
            const from = filter?.from ? moment(filter.from, 'YYYY-MM-DD').startOf('day') : null;
            const to = filter?.to ? moment(filter.to, 'YYYY-MM-DD').endOf('day') : null;

            filteredInvoices = invoices.filter((inv) => {
              const dateStr = inv.InvoiceDate__c || inv.CreatedDate || inv.OrderSubmissionTime__c;
              if (!dateStr) return false;
              const invDate = moment(dateStr);
              if (!invDate.isValid()) return false;
              if (from && to) return invDate.isBetween(from, to, null, '[]');
              if (from) return invDate.isSameOrAfter(from);
              if (to) return invDate.isSameOrBefore(to);
              return true;
            });
          }

          // 3️⃣ derive categoriesOrdered for these invoices
          const categoriesOrdered = await getCategoriesForInvoices(filteredInvoices);

          return { count: filteredInvoices.length, categoriesOrdered };
        };



        const concurrency = 8;
        const results = [];
        for (let i = 0; i < accounts.length; i += concurrency) {
          const batch = accounts.slice(i, i + concurrency);
          const batchPromises = batch.map((acct) => getInvoiceCountForAccount(acct));
          // eslint-disable-next-line no-await-in-loop
          const batchCounts = await Promise.all(batchPromises);
          batch.forEach((acct, idx) => {
            const { count = 0, categoriesOrdered = [] } = batchCounts[idx] || {};
            results.push({ account: acct, count, categoriesOrdered });
          });
        }


        const mboAll = results
          .filter(r => r.count > 0)
          .map(r => ({
            ...r.account,
            invoiceCount: r.count,
            categoriesOrdered: r.categoriesOrdered || [],
          }));

        const nonAll = results
          .filter(r => r.count === 0)
          .map(r => ({
            ...r.account,
            invoiceCount: 0,
            categoriesOrdered: [],
          }));

        setMboAccounts(mboAll);
        setNonMboAccounts(nonAll);


        // Build global categories list from all accounts (union)
        const loggedInUser = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'get',
        });
        const accessibleCategories = await getUserAccessibleCategories(loggedInUser);

        const orderedUniqueCategories = await getOrderedCategories(accessibleCategories);

        // Keep "All" at start
        setCategoriesList(['All', ...orderedUniqueCategories]);



      } catch (err) {
        console.warn('loadAccountsAndInvoices err', err);
        setAccountsForBeats([]);
        setMboAccounts([]);
        setNonMboAccounts([]);
      } finally {
        setLoadingAccounts(false);
      }
    };

    loadAccountsAndInvoices();
  }, [selectedDistributor, distributorDataState, filter]);


  const handleApply = (payload) => {
    // payload = { from: 'YYYY-MM-DD' | null, to: 'YYYY-MM-DD' | null }
    console.log('Filter applied in screen ->', payload);
    setFilter(payload);
  };


  const filteredData = React.useMemo(() => {
    // 🔹 MBO logic (category based)
    if (selectedTab === 'mbo') {
      const base = mboAccounts || [];

      const categoryFiltered =
        selectedCategory !== 'All'
          ? base.filter(
            a =>
              Array.isArray(a.categoriesOrdered) &&
              a.categoriesOrdered.includes(selectedCategory)
          )
          : base;

      if (!searchText.trim()) return categoryFiltered;

      const q = searchText.toLowerCase();
      return categoryFiltered.filter(a =>
        (a.Name || '').toLowerCase().includes(q) ||
        (a.Class__c || '').toLowerCase().includes(q) ||
        (a.SubChannel1__c || '').toLowerCase().includes(q) ||
        String(a.invoiceCount || 0).includes(q)
      );
    }

    // 🔹 NON BUYING logic (TOTAL − CATEGORY MBO)
    const mboBase =
      selectedCategory === 'All'
        ? mboAccounts
        : mboAccounts.filter(
          a =>
            Array.isArray(a.categoriesOrdered) &&
            a.categoriesOrdered.includes(selectedCategory)
        );

    const mboIds = new Set(mboBase.map(a => a.Sf_Id));

    const nonBase = (accountsForBeats || []).filter(
      a => !mboIds.has(a.Sf_Id)
    );

    if (!searchText.trim()) return nonBase;

    const q = searchText.toLowerCase();
    return nonBase.filter(a =>
      (a.Name || '').toLowerCase().includes(q) ||
      (a.Class__c || '').toLowerCase().includes(q) ||
      (a.SubChannel1__c || '').toLowerCase().includes(q)
    );
  }, [
    mboAccounts,
    accountsForBeats,
    selectedTab,
    selectedCategory,
    searchText,
  ]);


  const filteredMboCount = React.useMemo(() => {
    if (selectedCategory === 'All') return mboAccounts.length;

    return mboAccounts.filter(
      a =>
        Array.isArray(a.categoriesOrdered) &&
        a.categoriesOrdered.includes(selectedCategory)
    ).length;
  }, [mboAccounts, selectedCategory]);

  const filteredNonCount = React.useMemo(() => {
    if (selectedCategory === 'All') return nonMboAccounts.length;

    const mboBase = mboAccounts.filter(
      a =>
        Array.isArray(a.categoriesOrdered) &&
        a.categoriesOrdered.includes(selectedCategory)
    );

    const mboIds = new Set(mboBase.map(a => a.Sf_Id));

    return (accountsForBeats || []).filter(
      a => !mboIds.has(a.Sf_Id)
    ).length;
  }, [mboAccounts, accountsForBeats, selectedCategory]);



  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      <View style={styles.headerContainer}>
        <HeaderMain screenName="Outlet Detail" />
      </View>
      {/* <Text style={styles.header}>SR Attendance</Text> */}


<View style={styles.topRow}>
  {/* Distributor Dropdown */}
  <View style={styles.dropdownInline}>
    <Dropdown
      style={styles.dropdown}
      containerStyle={styles.dropdownContainer}
      placeholderStyle={styles.dropdownPlaceholder}
      selectedTextStyle={styles.dropdownSelectedText}
      itemTextStyle={styles.dropdownItemText}
      data={distributorOptions}
      labelField="label"
      valueField="value"
      placeholder="Distributor"
      value={selectedDistributor}
      onChange={(item) => {
        setSelectedDistributor(item.value);
      }}
    />
  </View>

  {/* Search Box */}
  <View style={styles.searchInline}>
    <Text style={styles.searchIcon}>🔍</Text>
    <TextInput
      value={searchText}
      onChangeText={setSearchText}
      placeholder="Search"
      placeholderTextColor="#9AA6B2"
      style={styles.searchInput}
    />
  </View>
</View>


      <FilterComponent onApply={handleApply} initial={{ from: null, to: null }} visiblePresets={['today', 'last7', 'thisMonth', 'yesterday']} initialPreset='thisMonth' />

      {selectedDistributor && categoriesList && categoriesList.length > 0 && (
        <View style={{ paddingHorizontal: 18, marginTop: -5, marginBottom: 5 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
            {categoriesList.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setSelectedTab('mbo');
                  }}

                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 20,
                    marginRight: 8,
                    backgroundColor: active ? '#17a508ff' : '#F2F4F7',
                  }}
                >
                  <Text style={{ color: active ? '#fff' : '#1F1D1A', fontWeight: '700', fontSize: 12 }}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}


      <View style={styles.currentFilter}>
        <Text style={styles.currentFilterText}>
          Current Filter:
          {!filter.from && !filter.to ? ' All' : ` From: ${filter.from} • To: ${filter.to}`}
        </Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" style={{ marginTop: 24 }} />
        ) : (<>
          {/* Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, selectedTab === 'mbo' && styles.tabActive]}
              onPress={() => setSelectedTab('mbo')}
            >
              <Text style={[styles.tabLabel, selectedTab === 'mbo' && styles.tabLabelActive]}>
                MBO ({filteredMboCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, selectedTab === 'non' && styles.tabActive]}
              onPress={() => setSelectedTab('non')}
            >
              <Text style={[styles.tabLabel, selectedTab === 'non' && styles.tabLabelActive]}>
                Non Buying ({filteredNonCount})
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.id || item.Sf_Id || item.Name}
            contentContainerStyle={{ paddingBottom: 30, paddingHorizontal: 12 }}
            extraData={filteredData.length}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                activeOpacity={0.92}
                style={[styles.card, index % 2 !== 0 && styles.cardAlt]}
                onPress={() => {
                  // optional: navigate to details or open modal
                  console.log('card pressed', item);
                }}
              >
                <LinearGradient
                  colors={['#EAF3FF', '#EAF3FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardHeaderGradient}
                >
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.Name || item.name || item.outletName}
                  </Text>

               
                </LinearGradient>

                <View style={styles.cardBody}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Class</Text>
                    <Text style={styles.metaValue}>{item.Class__c || item.Class || '-'}</Text>
                  </View>

                  {/* <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Sub Channel</Text>
                    <Text style={styles.metaValue}>{item.SubChannel1__c || item.SubChannel__c || '-'}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Sub Channel 2</Text>
                    <Text style={styles.metaValue}>{item.SubChannel2__c || item.SubChannel__c || '-'}</Text>
                  </View> */}

                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Party Code</Text>
                    <Text style={styles.metaValue}>{item.Party_Code__c || '-'}</Text>
                  </View>

               
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingTop: 80,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#7B8A99',
                    textAlign: 'center',
                  }}
                >
                  No outlet on this category
                </Text>
              </View>
            }
          />

        </>

        )}
      </View>
    </SafeAreaProvider >
  );
};

export default LocationReport;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#A67C2E',
  },
  container: { flex: 1, backgroundColor: '#F6F8FB', padding: 16 },
  container: { flex: 1 },
  content: {
    flex: 1,
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#ffffff",
  },
  headerContainer: {
    backgroundColor: "transparent",
  },
  header: { fontSize: 22, fontWeight: '700', color: '#1F1D1A', marginBottom: 12 },
  currentFilter: { marginHorizontal: 16, marginTop: 0, marginBottom: 10, backgroundColor: 'rgba(255,255,255,1)', padding: 6, paddingHorizontal: 10, borderRadius: 10 },
  currentFilterText: { fontSize: 12, color: '#1F1D1A', fontWeight: '600' },

  row: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
  },
  name: { fontSize: 16, fontWeight: '700', color: '#1F1D1A' },
  meta: { fontSize: 12, color: '#7B8A99', marginTop: 4 },
  status: { fontWeight: '700' },
  present: { color: '#1C8E3A' },
  absent: { color: '#B3261E' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E3A8A',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
    borderRadius: 10,
    marginBottom: 6,
  },

  th: {
    // borderWidth:1,
    color: '#fff',
    // borderWidth:1,
    fontSize: 12,
    textAlign: 'left',
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    gap: 6,
    marginBottom: 8,
    elevation: 1,
  },

  tableRowAlt: {
    backgroundColor: '#F5F8FF',
  },

  td: {
    // color: '#1F1D1A',
    color: '#333',
    fontWeight: '600',
    fontSize: 11,

  },

  tdMono: {
    // color: '#1F1D1A',
    // backgroundColor:'red',
    // borderWidth:1,
    // fontSize: 12,
    color: '#333',
    fontWeight: '600',
    fontSize: 11,
    // fontFamily: 'monospace',
  },
  searchBox: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 0,
    elevation: 2,
  },

  searchIcon: {
    fontSize: 12,
    marginRight: 6,
  },

  searchInput: {
    flex: 1,
    //  borderWidth:1,
    fontSize: 12,
    color: '#1F1D1A',
    fontWeight: '600',
  },
  dropdownWrapper: {
    marginHorizontal: 16,
    marginBottom: 10,
  },

  dropdown: {
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    elevation: 2,
  },

  dropdownContainer: {
    borderRadius: 10,
  },

  dropdownPlaceholder: {
    fontSize: 12,
    color: '#9AA6B2',
    fontWeight: '600',
  },

  dropdownSelectedText: {
    fontSize: 12,
    color: '#1F1D1A',
    fontWeight: '700',
  },

  dropdownItemText: {
    fontSize: 13,
    color: '#1F1D1A',
  },
  tabsRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 8, marginBottom: 10 },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 10,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#1E3A8A' },
  tabLabel: { fontWeight: '700', color: '#1F1D1A' },
  tabLabelActive: { color: '#fff' },
  /* Card list styles */
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 8,
    overflow: 'hidden',
    // shadow (iOS)
    shadowColor: '#0f1724',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    // elevation (Android)
    elevation: 3,
  },

  cardAlt: {
    transform: [{ translateY: 0 }],
  },

  cardHeaderGradient: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardTitle: {
    // color: '#fff',
    color: '#333',
    fontSize: 16,
    fontWeight: '800',
    maxWidth: '72%',
  },

  badgeWrap: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },

  badgeMbo: {
    // keep white text on gradient, but bold background for MBO using semi-transparent white
    backgroundColor: 'transparent',
  },

  badgeNon: {
    // if you want a special style for non-buying, change text color by wrapping view or change background
    color: '#fff',
  },

  cardBody: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },

  metaRow: {
    flexDirection: 'column',
    // justifyContent: 'space-between',
    // marginBottom: 8,
  },

  metaLabel: {
    fontSize: 12,
    color: '#7A7266',
    fontWeight: '700',
  },

  metaValue: {
    fontSize: 13,
    color: '#0f1724',
    // backgroundColor:'red',
    fontWeight: '800',
    maxWidth: '95%',
    textAlign: 'left',
  },
  cardFooter: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  leftFooter: {
    flex: 1,
  },

  rightFooter: {
    alignItems: 'flex-end',
  },

  smallLabel: {
    fontSize: 11,
    color: '#7A7266',
    fontWeight: '700',
  },

  smallValue: {
    fontSize: 12,
    color: '#1F1D1A',
    fontWeight: '800',
    marginTop: 4,
  },

topRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginHorizontal: 16,
  marginBottom: 0,
  gap: 8,
},

dropdownInline: {
  flex: 1.2,
},

searchInline: {
  flex: 1,
  height: 40,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FFFFFF',
  borderRadius: 14,
  paddingHorizontal: 12,
  elevation: 2,
},


});

