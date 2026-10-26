import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    Image,
    SafeAreaView,
    StatusBar
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "../components/AntDesign";
import FIcon from "@react-native-vector-icons/feather";
import HeaderMain from "../components/HeaderMain";
import { useFocusEffect } from "@react-navigation/native";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { useSelector } from "react-redux";
import { RootState } from '../redux/store';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { isInternetAvailable } from '../utils/networkUtils'; import moment from 'moment';
import { useDispatch } from 'react-redux';
import { setSelectedBeatDay } from '../redux/slices/selectedBeatDaySlice';
import RippleBackground from '../components/RippleBackground';
import { useNavigation } from "@react-navigation/native";
import { SafeAreaProvider } from 'react-native-safe-area-context';


const CloseDay = () => {
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState([]);
    const dispatch = useDispatch();
    const navigation = useNavigation();
    const [selectedBeatId, setSelecteBeatId] = useState(null)
    const [beatDaysId, setBeatDaysId] = useState(null)
    const [users, setUsers] = useState([]);

    const [categories, setCategories] = useState(["All"]);
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [sortAscending, setSortAscending] = useState(true);
    const selectedBeatDay = useSelector((state: RootState) => state.selectedBeatDay.selectedBeatDay);
    const [RetailerAllData, setRetailerAllData] = useState([]);


    const formatDateYYYYMMDD = (d = new Date()) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    };


    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const initialize = async () => {
                setLoading(true);
                try {
                    const accountData = await UniversalUpdateInsert({
                        ObjectName: "Account",
                        Type: "get",
                    });
                    const usersData = await UniversalUpdateInsert({
                        ObjectName: 'User',
                        Type: 'get',
                    });

                    //set(users)
                    setUsers(usersData)

                    const RoutePlans = await UniversalUpdateInsert({
                        ObjectName: "Route_Plans__c",
                        Type: "get",
                        filters: [
                            { field: 'Assigned_To__c', value: usersData[0].Sf_Id },
                        ],

                    });
                    const todayForRoutePlans = new Date();
                    const firstDayOfMonth = new Date(
                        todayForRoutePlans.getFullYear(),
                        todayForRoutePlans.getMonth(),
                        1
                    );
                    const lastDayOfMonth = new Date(
                        todayForRoutePlans.getFullYear(),
                        todayForRoutePlans.getMonth() + 1,
                        0
                    );

                    // Filter the route plans that are active during the current month
                    const currentMonthRoutePlans = RoutePlans.filter((plan) => {
                        const startDate = new Date(plan.Start_Date__c);
                        const endDate = new Date(plan.End_Date__c);
                        return startDate <= lastDayOfMonth && endDate >= firstDayOfMonth;
                    });

                    const activePlanId = currentMonthRoutePlans[0].Sf_Id;
                    // Beat Day for that exact calendar day:

                    const BeatDays = await UniversalUpdateInsert({
                        ObjectName: "BeatDay__c",
                        Type: "get",
                    });


                    const beatDayForDate = BeatDays.find(
                        (b) =>
                            b.Tour_Plan__c === activePlanId && // belongs to the route plan
                            b.BeatDate__c === moment().format('YYYY-MM-DD') // is for the selected date
                    );


                    if (!beatDayForDate) {
                        console.log('No Beat Day found for date', dateStore);
                        dispatch(setSelectedBeatDay(null));

                        setSelecteBeatId(null);
                        setBeatDaysId(null);



                        return; // nothing more to do for this date
                    }
                    //console.log("BEAT DAYS FOR THE DATE |||||||||", beatDayForDate);
                    dispatch(setSelectedBeatDay(beatDayForDate));
                    // console.log("SELECTED BEAT DAY FROM REDUX STORE ::::::::::::::::::::", beatDayForDate?.Sf_Id)
                    setBeatDaysId(beatDayForDate?.Sf_Id);

                    //setSelectedBeatName(beatDayForDate?.Beat__Name);
                    setSelecteBeatId(beatDayForDate?.Beat__c); // Save selected Beat
                    setBeatDaysId(beatDayForDate?.Sf_Id);

                    const beatId = beatDayForDate?.Beat__c ?? null;
                    //const beatName = beatDayForDate?.Beat__Name ?? null;
                    console.log(beatId)
                    const BeatRecord = await UniversalUpdateInsert({
                        ObjectName: "Beat__c",
                        Type: "get",
                        filters: [
                            { field: 'Sf_Id', value: beatId }
                        ]
                    });
                    console.log('BeatRecord:::---------------------------------', BeatRecord)
                    const retailerdata = await UniversalUpdateInsert({
                        ObjectName: "Account",
                        Type: "get",
                        filters: [
                            { field: 'Sf_Id', value: BeatRecord[0]?.DirectDBSubDB__c }
                        ]
                    });

                    // console.log("SelectedBeatRecord------------------Hello", JSON.stringify(retailerdata));
                    setRetailerAllData(retailerdata)


                    const Product2 = await UniversalUpdateInsert({
                        ObjectName: "Product2",
                        Type: "get",
                    });
                    const StockCheckData = await UniversalUpdateInsert({
                        ObjectName: "Stock_Check__c",
                        Type: "get",
                    });
                    const productsArr = Array.isArray(Product2) ? Product2 : [];
                    const stockArr = Array.isArray(StockCheckData) ? StockCheckData : [];

                    const mapped = productsArr.map((p) => ({
                        ...p,
                        ...getStockFieldsForProduct(p, stockArr, beatDayForDate?.Sf_Id), // merge extra fields
                    }));
                    console.log("MAPPED::::-------------------------", JSON.stringify(mapped))

                    if (isActive) {
                        setProducts(mapped);
                    }

                    const subCategories = Product2
                        .map((item) => item.Category__c || "Unknown")
                        .filter((value, index, self) => self.indexOf(value) === index);

                    setCategories(["All", ...subCategories]);

                } catch (error) {
                    console.error(" Get Account Data Failed:", error);
                } finally {
                    if (isActive) setLoading(false);
                }
            };

            initialize();
            return () => {
                isActive = false;
            };
        }, [])
    );


    const getStockFieldsForProduct = (product, stockArr, Beat_day_Id) => {
        const today = new Date().toISOString().split('T')[0];
        const todayDate = new Date().toISOString().split('T')[0];
        // Get all matching records
        const stockRecords = stockArr.filter(
            (s) =>
                s.SKU__c === product.Sf_Id &&
                s.Beat_Day__c === Beat_day_Id &&
                // s.Stock_Check_Date__c.startsWith(today)
                s.Stock_Check_Date__c.split('T')[0] === todayDate
        );

        const stockRec = stockRecords[stockRecords.length - 1] || null;
        // const stockRec = stockRecords.length > 0 ? stockRecords[stockRecords.length - 1] : null;

        return {
            Closing_Stock_Qty__c: stockRec?.Closing_Stock_Qty__c || 0,
            Opening_Stock_Qty__c: stockRec?.Opening_Stock_Qty__c || 0,
            Primary_Stock_Qty__c: stockRec?.Primary_Stock_Qty__c || 0,
            Secondary_Stock_Qty__c: stockRec?.Secondary_Stock_Qty__c || 0,
            Current_Stock_Qty__c: stockRec?.Current_Stock_Qty__c || 0,
            Today_Secondary_Sales_Qty__c: stockRec?.Today_Secondary_Sales_Qty__c || 0,
            Stock_check__c: stockRec?.Sf_Id || 0,
        };
    };


    const filteredProducts = products
        .filter((p) => {
            const matchesSearch = p.Name?.toLowerCase().includes(search.toLowerCase());
            const matchesCategory =
                selectedCategory === "All" || p.Category__c === selectedCategory;
            //console.log('thisis in filtered products,-- ', p)
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            const nameA = a.Name?.toLowerCase() || "";
            const nameB = b.Name?.toLowerCase() || "";
            return sortAscending
                ? nameA.localeCompare(nameB)
                : nameB.localeCompare(nameA);
        });


    const renderItem = ({ item }) => (
        <View style={styles.rowContainer}>
            <Image
                source={
                    item?.ProductImageURL__c
                        ? { uri: item.ProductImageURL__c }
                        : require("../assets/images/food.png")
                }
                style={styles.image}
            />

            <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.Name}</Text>

                <View style={styles.infoRow}>
                    <View style={styles.infoBlock}>
                        <Text style={styles.label}>Opening Stock</Text>
                        <Text style={styles.value}>{item.Opening_Stock_Qty__c}</Text>
                    </View>
                    <View style={styles.infoBlock}>
                        <Text style={styles.label}>Primary Stock</Text>
                        <Text style={styles.value}>{item.Primary_Stock_Qty__c}</Text>
                    </View>
                    <View style={styles.infoBlock}>
                        <Text style={styles.label}>Current Stock</Text>
                        <Text style={styles.value}>{item.Current_Stock_Qty__c}</Text>
                    </View>

                </View>

                <View style={styles.infoRow}>
                    <View style={styles.infoBlock}>
                        <Text style={styles.label}>Sec. Sales</Text>
                        <Text style={styles.value}>{item.Secondary_Stock_Qty__c}</Text>
                    </View>
                    <View style={styles.infoBlock}>
                        <Text style={styles.label}>Today Sec. Sales</Text>
                        <Text style={styles.value}>
                            {item.Today_Secondary_Sales_Qty__c}
                        </Text>
                    </View>
                    <View style={styles.infoBlock}>
                        <Text style={styles.label}>Closing Stock</Text>
                        <Text style={styles.value}>
                            {item.Closing_Stock_Qty__c}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );


    return (
        <SafeAreaProvider style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
            <View style={styles.headerContainer}>
                <HeaderMain screenName="Closing Stock" />
            </View>

            <View style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>

                <View style={styles.mainContent}>
                    <View style={{
                        margin: 12,
                        borderRadius: 12,
                        backgroundColor: '#ffffff',
                        padding: 14,
                        // iOS shadow
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.12,
                        shadowRadius: 6,
                        // Android elevation
                        elevation: 3,
                        // spacing to avoid fasa hua look
                        alignSelf: 'stretch'
                    }}>
                        <Text style={{ fontSize: 13, color: '#666' }}>SUB DB :</Text>
                        <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 6, color: '#111' }}>
                            {RetailerAllData[0]?.Name ?? 'N/A'}
                        </Text>
                    </View>
                    <View style={styles.searchRow}>
                        <View style={styles.searchBox}>
                            <Icon name="search1" size={16} color="#888" />
                            <TextInput
                                placeholder="Search"
                                value={search}
                                onChangeText={setSearch}
                                style={styles.searchInput}
                                placeholderTextColor="#888"
                            />
                        </View>

                        <TouchableOpacity
                            onPress={() => setSortAscending(!sortAscending)}
                            style={styles.filterBtn}
                            accessibilityLabel="Toggle sort order"
                        >
                            {/* filter icon */}
                            <FIcon name="sliders" size={16} color="#444" />

                            {/* visual sort indicator */}
                            <FIcon
                                name={sortAscending ? "chevron-up" : "chevron-down"}
                                size={12}
                                color={sortAscending ? "#1E3A8A" : "#888"}
                                style={styles.sortIcon}
                            />
                        </TouchableOpacity>
                    </View>


                    <View style={styles.categoryRow}>
                        {categories.map((category) => (
                            <TouchableOpacity
                                key={category}
                                onPress={() => setSelectedCategory(category)}
                                style={[
                                    styles.categoryButton,
                                    selectedCategory === category &&
                                    styles.categoryButtonActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.categoryText,
                                        selectedCategory === category &&
                                        styles.categoryTextActive,
                                    ]}
                                >
                                    {category}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <FlatList
                        data={filteredProducts}
                        keyExtractor={(item) => item.Sf_Id}
                        renderItem={renderItem}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                        contentContainerStyle={{ paddingBottom: 80 }}
                    />

                </View>

            </View>
            <RippleBackground
                rippleColor="#1E3A8A"
                rippleCount={1}
                duration={3400}
                style={{ position: 'absolute', bottom: 40, right: 20 }}
            >
                <TouchableOpacity onPress={() => { navigation.navigate('ASOOrder') }} style={{ alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#C9A24D', borderRadius: 20 }}>
                    <Text style={{ color: 'white', fontWeight: '500' }}>Suggested Spot Sales</Text>
                </TouchableOpacity>
            </RippleBackground>




        </SafeAreaProvider>
    );
};

export default CloseDay;
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#A67C2E',
    },
    headerContainer: {
        backgroundColor: '#A67C2E',
    },
    container: {
        flex: 1,
        //backgroundColor: '#fff',
    },

    mainContent: { backgroundColor: "white", flex: 1, borderRadius: 26 },

    searchRow: { flexDirection: "row", alignItems: "center", margin: 15 },
    searchBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 25,
        borderWidth: 1,
        borderColor: "#ddd",
        paddingHorizontal: 10,
        height: 40,
    },
    searchInput: { flex: 1, fontSize: 14, marginLeft: 6, color: "#000" },

    // filterBtn: {
    //     width: 40,
    //     height: 40,
    //     borderRadius: 20,
    //     backgroundColor: "#fff",
    //     marginLeft: 10,
    //     justifyContent: "center",
    //     alignItems: "center",
    //     borderWidth: 1.6,
    //     borderColor: "#ddd",
    // },

    categoryRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 15,
        paddingBottom: 10,
        gap: 8,
    },
    categoryButton: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: "#fff",
        borderColor: "#1E3A8A",
        borderWidth: 1,
    },
    categoryButtonActive: {
        backgroundColor: "#1E3A8A",
    },
    categoryText: {
        fontSize: 13,
        color: "#1E3A8A",
        fontWeight: "500",
    },
    categoryTextActive: {
        color: "#fff",
    },

    rowContainer: {
        flexDirection: "row",
        padding: 12,
        backgroundColor: "#fff",
    },
    image: { width: 70, height: 70, borderRadius: 10, marginRight: 12, resizeMode: 'contain' },
    title: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#222" },
    headerContainer: { backgroundColor: '#A67C2E' },

    infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    infoBlock: { flex: 1 },
    label: { fontSize: 12, fontWeight: "500", color: "#888" },
    value: { fontSize: 12, fontWeight: "600", color: "#222", marginTop: 2 },

    quantityInput: {
        width: 60,
        fontSize: 11,
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 6,
        height: 28,
    },

    separator: { height: 1, backgroundColor: "#eee", marginTop: 8 },


    footer: {
        position: "absolute",
        bottom: 30,
        marginHorizontal: 15,
        left: 0,
        right: 0,
        height: 50,
    },
    footerInner: {
        flex: 1,
        borderRadius: 26,

        alignItems: "center",
        justifyContent: "center",
        // borderTopLeftRadius: 10,
        // borderTopRightRadius: 10,
    },
    footerText: { color: "#fff", fontSize: 16, fontWeight: "600" },

    filterBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: "#fff",
        marginLeft: 10,
        justifyContent: "center",
        borderWidth: 1.2,
        borderColor: "#e6e9ef",
        // subtle shadow for a bit of elevation
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
        elevation: 1,
    },
    sortIcon: {
        marginLeft: 8,
    },
});