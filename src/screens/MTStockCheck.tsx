// MTstockCheck.js
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Image,
    StyleSheet,
    Modal,
    StatusBar,
} from 'react-native';
import Feather from '@react-native-vector-icons/feather';
import MTStockCheckUpdate from '../components/modal/MTStockCheckUpdate';
import AddMTStockCheck from '../components/modal/AddMTStockCheck';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HeaderMain from '../components/HeaderMain';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert.js';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import moment from 'moment';
import LinearGradient from 'react-native-linear-gradient';


type Competitor = {
    id: string;
    name: string;
    category: string;
    subcategory: string;
    quantity: string;
    UOM: string;
    Expiration_Date?: string;
    Facing?: string;
    image?: string;
    raw?: any;
};

const MOST_CAPTURED_CATEGORY = 'Most Captured SKUs';


export default function MTStockCheck() {
    const [query, setQuery] = useState('');
    const [data, setData] = useState<Competitor[]>([]);
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState([]);
    const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
    const [selectedForAdd, setSelectedForAdd] = useState(null);
    const navigation = useNavigation()
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Competitor | null>(null);
    const [activeCategory, setActiveCategory] = useState<string | null>('All');
    const [productIdHolder, setProductIdHolder] = useState('');
    const [productIdConfirmVisible, setProductIdConfirmVisible] = useState(false)
    const [productName, setProductName] = useState('');
    const [mostCapturedData, setMostCapturedData] = useState<Competitor[]>([]);

    const getProductName = async () => {
        if (!productIdHolder) return

        console.log('product id idi di d', productIdHolder)
        const product2data = await UniversalUpdateInsert({
            ObjectName: "Product2",
            Type: "get",
            filters: [
                { field: 'Sf_Id', value: productIdHolder }
            ]
        })
        console.log(product2data)


        setProductName(product2data?.[0]?.Name || '');



    }

    useEffect(() => {
        if (productIdHolder) {
            getProductName();
            setProductIdConfirmVisible(true);
        }
    }, [productIdHolder]);

    const handleBrandConfirmYes = () => {

        setProductIdConfirmVisible(false)
        navigation.navigate('PricingMt', { selectedProductId: productIdHolder });


    };

    const handleBrandConfirmNo = () => {
        // simply clear the transient brandHolder and close modal
        setProductIdHolder('');
        setProductIdConfirmVisible(false);
    };


    const formatDate = (date) => {
        if (!date) return '--';

        const m = moment(
            date,
            ["YYYY-MM-DD", moment.ISO_8601], // allowed formats
            true                              // strict mode
        );

        return m.isValid()
            ? m.format("DD MMM YYYY")
            : '--';
    };

    const resolveImage = (photo?: string) => {
        if (!photo) return null;
        if (photo.startsWith('http')) return photo;
        if (/^[A-Za-z0-9+/=]+\s*$/.test(photo)) {
            return `data:image/jpeg;base64,${photo}`;
        }
        return photo;
    };

    const openAddModalWithItem = (item) => {
        setSelectedForAdd(item);
        setAddModalVisible(true);
    };

    const loadCompetitors = async () => {
        try {

            const newItem = await UniversalUpdateInsert({
                ObjectName: "Stock_Check__c",
                Type: "get",
                filters: [
                    { field: "Account__c", value: selectedVisit?.AccountId }, {
                        field: "SKU__c", value: '01tC1000006sirzIAA'
                    }],
            })
            console.log('newItem :::::::::::::::::::', newItem);

            // fetch product2 list and stock checks (filtered by account) in parallel
            const [productsResult, stockChecksResult] = await Promise.all([
                UniversalUpdateInsert({ ObjectName: "Product2", Type: "get" }), // adjust filters if you only want subset
                UniversalUpdateInsert({
                    ObjectName: "Stock_Check__c",
                    Type: "get",
                    filters: [{ field: "Account__c", value: selectedVisit?.AccountId }],
                }),
            ]);

            const products: any[] = Array.isArray(productsResult)
                ? productsResult
                : productsResult
                    ? [productsResult]
                    : [];

            // console.log('products ............', products);

            const stockChecks: any[] = Array.isArray(stockChecksResult)
                ? stockChecksResult
                : stockChecksResult
                    ? [stockChecksResult]
                    : [];

            // build a map of stock checks keyed by the Product2 SFID stored in Stock_Check__c.ProductName__c
            const stockByProductId = new Map<string, any>();
            for (const sc of stockChecks) {

                const prodId = sc.SKU__c || sc.ProductName || sc.sku;
                if (!prodId) continue;

                const existing = stockByProductId.get(prodId);

                // Use CreatedDate or LastModifiedDate or fallback to null
                const currentDate = new Date(
                    sc.CreatedDate || sc.Expiration_Date__c ||
                    sc.Check_Date__c ||
                    0
                );

                const existingDate = new Date(
                    existing?.CreatedDate || existing?.Expiration_Date__c ||
                    existing?.Check_Date__c ||
                    0
                );

                // Keep the newest one
                if (!existing || currentDate > existingDate) {
                    stockByProductId.set(prodId, sc);
                }
            }


            // map product records -> competitor entries
            const mappedFromProducts = products.map((p, index) => {
                const productSfId = p.Sf_Id || p.sfId || p.SfId || p.sfID || p.sfid;
                const stock = productSfId ? stockByProductId.get(productSfId) : undefined;

                const competitor = {
                    id: productSfId
                        ? `${productSfId}`
                        : `product-index-${index}`,

                    // NAME and IMAGE must come from Product (as requested)
                    name: p.Name || p.name || p.name__c || "-",
                    image: p.ProductImageURL__c || p.productImageUrl || (p.Images && p.Images[0]?.uri) || null,
                    // Other details come from stock check if present, otherwise null (explicit per your requirement)
                    category: p ? p.Category__c || null : null,
                    subcategory: p ? p.SubCategory__c || null : null,
                    quantity: stock ? stock.Quantity__c ?? null : null,
                    UOM: stock ? stock.UOM__c || null : null,
                    Expiration_Date: stock && stock.Expiration_Date__c
                        ? String(stock.Expiration_Date__c).split(" ").slice(0, 4).join(" ")
                        : null,
                    Facing: stock ? (stock.Facing__c ?? null) : null,
                    createdDate: stock?.CreatedDate || null,

                    raw: {
                        product: p,
                        stockCheck: stock || null,
                    },
                };

                return competitor;
            });
            // console.log('mappedFromProducts ............', JSON.stringify(mappedFromProducts));



            // final list = all mapped products + unmatched stock-checks
            const finalList = [...mappedFromProducts];

            const sortedFinalList = mappedFromProducts.sort((a, b) => {


                const ma = a.createdDate
                    ? moment(a.createdDate, "YYYY-MM-DDTHH:mm:ss.SSSZZ", true)
                    : null;

                const mb = b.createdDate
                    ? moment(b.createdDate, "YYYY-MM-DDTHH:mm:ss.SSSZZ", true)
                    : null;

                // Both have dates → latest first
                if (ma?.isValid() && mb?.isValid()) {
                    return mb.valueOf() - ma.valueOf();
                }

                // Only A has date → A first
                if (ma?.isValid()) return -1;

                // Only B has date → B first
                if (mb?.isValid()) return 1;

                // Neither has date → keep order
                return 0;
            });
            const mostCapturedSkus = sortedFinalList
                .filter(item => item.createdDate)     // only items with stock
                .slice(0, 10);



            setData(sortedFinalList);

            setMostCapturedData(mostCapturedSkus);
            // derive product categories (ignore falsy)
            const prodCategories = products
                .map(p => p.Category__c || p.Category || p.category || null)
                .filter(Boolean);

            // merge and sort unique
            // setCategoryFilter(prev => {
            //     const merged = Array.from(new Set([...(prev || []), ...prodCategories]));
            //     merged.sort((a, b) => String(a).localeCompare(String(b)));
            //     return merged;
            // });
            // merge and sort unique
            // setCategoryFilter(prev => {
            //     const merged = Array.from(new Set([...prodCategories]));
            //     merged.sort((a, b) => String(a).localeCompare(String(b)));
            //     return merged;
            // });
            setCategoryFilter(() => {
                const merged = Array.from(
                    new Set([MOST_CAPTURED_CATEGORY, ...prodCategories])
                );

                return merged;
            });

        } catch (e) {
            console.warn("Failed to load competitors:", e);
            setData([]);
        }
    };



    useFocusEffect(
        useCallback(() => {
            loadCompetitors();
        }, [])
    );

    useEffect(() => {
        const initialize = async () => {
            const AllPicklistData = await UniversalUpdateInsert({ ObjectName: "AllDataPicklist", Type: "get" });
            let optionsObj = null;
            if (Array.isArray(AllPicklistData) && AllPicklistData.length) {
                const raw = AllPicklistData[0]?.OptionsData;
                if (raw) {
                    try {
                        optionsObj = typeof raw === "string" ? JSON.parse(raw) : raw;
                    } catch {
                        optionsObj = null;
                    }
                }
            }
            if (optionsObj && Array.isArray(optionsObj.StockCheckCategory)) {
                const categoryLabels = optionsObj.StockCheckCategory.map((item) => item.value);
                console.log("Extracted category labels:", categoryLabels);
                setCategoryFilter(categoryLabels);
            }
        };



        // initialize();
    }, []);


    const filtered = useMemo(() => {
        let filteredData = data;
        if (query) {
            const q = query.toLowerCase();
            filteredData = filteredData.filter(
                (d) => (d.name ?? '').toLowerCase().includes(q) || (d.brand ?? '').toLowerCase().includes(q)
            );
        }
        // if (activeCategory && activeCategory !== 'All') {
        //     filteredData = filteredData.filter((d) => d.category === activeCategory);
        // }

        if (activeCategory === MOST_CAPTURED_CATEGORY) {
            filteredData = mostCapturedData;
        } else if (activeCategory && activeCategory !== 'All') {
            filteredData = filteredData.filter(d => d.category === activeCategory);
        }

        return filteredData;
    }, [query, data, activeCategory, mostCapturedData]);






    const openModal = (item: Competitor) => {
        setSelectedItem(item);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setSelectedItem(null);
    };



    const stripCurrency = (s?: string) => (s ? s.replace(/[^\d.]/g, '') : '');

    const renderItem = ({ item }: { item: Competitor }) => (
        // <TouchableOpacity onPress={() => openModal(item)} activeOpacity={0.8}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => openAddModalWithItem(item)}>
            <View style={styles.card}>
                <View style={styles.leftRow}>

                    <Image
                        // source={{ uri: item.image }}
                        source={item?.image ? { uri: item.image } : require("../assets/images/food.png")}
                        style={styles.thumb} />

                </View>
                <View style={styles.centerCol}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: '#1F1D1A', paddingVertical: 2 }}>
                        {item.name}
                    </Text>
                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Category</Text>
                            <Text style={styles.metaValue}>{item.category}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Sub-Category</Text>
                            <Text style={styles.metaValue}>{item.subcategory}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Quantity</Text>
                            <Text style={styles.metaValue}>{item.quantity || "--"}</Text>
                        </View>
                    </View>
                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>UOM</Text>
                            <Text style={styles.metaValue}>{item.UOM || "--"}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Facing</Text>
                            <Text style={styles.metaValue}>{item.Facing || "--"}</Text>
                        </View>
                        <View style={styles.metaItemRight}>
                            <Text style={styles.metaLabel}>Expiration Date</Text>
                            <Text style={styles.metaValue}>{formatDate(item?.Expiration_Date)}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    const CategoryTabs = ({ categories, allItems }: { categories: string[], allItems: Competitor[] }) => (
        <View style={{ marginVertical: 8 }}>
            <FlatList
                horizontal
                data={['All', ...categories]}
                keyExtractor={(i) => String(i)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 6 }}
                renderItem={({ item }) => {
                    const isActive = item === activeCategory;
                    // const count = item === 'All' ? allItems.length : allItems.filter(x => x.category === item).length;
                    const count =
                        item === 'All'
                            ? allItems.length
                            : item === MOST_CAPTURED_CATEGORY
                                ? mostCapturedData.length
                                : allItems.filter(x => x.category === item).length;
                    return (
                        <TouchableOpacity
                            onPress={() => setActiveCategory(isActive ? 'All' : item)}
                            // onPress={() => setActiveCategory(isActive ? 'All' : item)}
                            style={[styles.tabButton, isActive && styles.tabButtonActive]}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                                {item} ({count})
                            </Text>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );



    return (
        <SafeAreaProvider style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
            <View style={styles.headerContainer}>
                <HeaderMain screenName="Stock Check" />
            </View>
            <View style={{ flex: 1, padding: 10, backgroundColor: 'white', borderTopRightRadius: 20, borderTopLeftRadius: 20 }}>

                <View style={styles.header}>
                    <View style={styles.searchRow}>
                        <Feather name="search" size={18} style={{ marginLeft: 12 }} />
                        <TextInput
                            placeholder="Search"
                            value={query}
                            onChangeText={setQuery}
                            style={styles.searchInput}
                            placeholderTextColor="#8a8a8a"
                        />
                    </View>
                    {/* <TouchableOpacity style={styles.filterBtn}>
                        <Feather name="filter" size={18} color="#979797" />
                    </TouchableOpacity> */}
                </View>
                {categoryFilter.length > 0 && <CategoryTabs categories={categoryFilter} allItems={data} />}

                {/* <FlatList
                    key={activeCategory}   // ⭐ forces full remount
                    data={filtered}
                    extraData={filtered.length}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    style={{ flex: 1 }}
                /> */}

                {filtered.length > 0 &&
                    <FlatList
                        // horizontal
                        data={filtered}
                        // disableIntervalMomentum={true}

                        // onViewableItemsChanged={this.onViewableItemsChanged }
                        // viewabilityConfig={{
                        //     itemVisiblePercentThreshold: 50,
                        // }}
                        // onMomentumScrollEnd={this.onScrollEnd}
                        // onEndReached={this.loadMoreData}
                        //disableVirtualization = {true}
                        initialNumToRender={1}
                        // pagingEnabled
                        keyExtractor={(i) => i.Sf_Id}
                        // getItemLayout={getItemLayout}
                        maxToRenderPerBatch={10}
                        windowSize={4}
                        // snapToInterval={WINDOW_WIDTH}
                        renderItem={renderItem}
                    />
                }

                <MTStockCheckUpdate
                    visible={modalVisible}
                    onClose={() => {
                        setModalVisible(false);
                        loadCompetitors();
                    }}
                    data={selectedItem}
                />
                <AddMTStockCheck
                    visible={addModalVisible}
                    data={selectedForAdd}
                    setProductIdHolder={setProductIdHolder}
                    onClose={() => {
                        setAddModalVisible(false);
                        setSelectedForAdd(null);
                        loadCompetitors();
                    }}
                />

                <Modal
                    visible={productIdConfirmVisible}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                >
                    <View style={styles.confirmBackdrop}>
                        <View style={styles.confirmCard}>
                            <Text style={styles.confirmTitle}>Confirm</Text>
                            <Text style={styles.confirmMessage}>
                                Do you want to add pricing for the product
                            </Text>

                            {/* show the brand (friendly label) */}
                            <Text style={styles.confirmBrand}>{productName || '--'}</Text>
                            {/* <Text style={styles.confirmBrand}>sku name holder</Text> */}

                            <View style={styles.confirmButtonsRow}>
                                <TouchableOpacity onPress={handleBrandConfirmNo} style={styles.confirmBtnOutline}>
                                    <Text style={styles.confirmBtnOutlineText}>No</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleBrandConfirmYes} style={styles.confirmBtn}>
                                    <LinearGradient
                                        colors={['#1E3A8A', '#1E3A8A']}
                                        style={styles.confirmGradient}
                                    >
                                        <Text style={styles.confirmBtnText}>Yes</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>


            </View>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#A67C2E' },
    headerContainer: { backgroundColor: '#A67C2E' },
    header: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 8,
        flexDirection: 'row',
        alignItems: 'center'
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 28,
        backgroundColor: '#fff',
        elevation: 2,
        width: '100%',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 6,
    },
    searchInput: { flex: 1, height: 44, paddingHorizontal: 10, fontSize: 14 },
    addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eef6ff',
        paddingVertical: 15,
        paddingHorizontal: 14,
        borderRadius: 22,
        justifyContent: 'center',
        width: '100%'
    },
    addText: { marginLeft: 8, color: '#A67C2E', fontWeight: '600' },
    listContent: { paddingHorizontal: 12, paddingBottom: 120 },
    card: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 12,
        borderBottomWidth: 1,
        borderColor: '#D9D2C3'
    },
    leftRow: { width: 64, alignItems: 'center', justifyContent: 'center' },
    thumb: { width: 60, height: 60, borderRadius: 8 },
    thumbPlaceholder: { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
    centerCol: { flex: 1, paddingHorizontal: 10 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
    metaItem: { flex: 1 },
    metaItemRight: { flex: 1, alignItems: 'flex-start' },
    metaLabel: { fontSize: 11, fontWeight: '400', color: '#7A7266' },
    metaValue: { fontWeight: '500', fontSize: 11, color: '#1F1D1A' },
    filterBtn: {
        width: 35,
        backgroundColor: 'white',
        height: 35,
        borderWidth: 1,
        borderRadius: 30,
        borderColor: '#D9D2C3',
        marginLeft: 5,
        justifyContent: 'center',
        alignItems: 'center'
    },
    tabButton: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginHorizontal: 6,
        borderRadius: 20,
        backgroundColor: '#f3f6fb',
        borderWidth: 1,
        borderColor: '#eef2f9',
    },
    tabButtonActive: {
        backgroundColor: '#A67C2E',
        borderColor: '#A67C2E',
        elevation: 2,
    },
    tabText: {
        fontSize: 13,
        color: '#A67C2E',
        fontWeight: '600'
    },
    tabTextActive: {
        color: '#fff'
    },
    confirmBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmCard: {
        width: '86%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 18,
        alignItems: 'center',
        elevation: 6,
    },
    confirmTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F1D1A',
        marginBottom: 8,
    },
    confirmMessage: {
        fontSize: 14,
        color: '#333',
        textAlign: 'center',
        marginBottom: 10,
    },
    confirmBrand: {
        fontSize: 13,
        color: '#A67C2E',
        fontWeight: '600',
        marginBottom: 16,
    },
    confirmButtonsRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
    },
    confirmBtnOutline: {
        flex: 1,
        marginRight: 8,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D9D2C3',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    confirmBtnOutlineText: {
        color: '#5B5B5B',
        fontSize: 14,
        fontWeight: '600',
    },
    confirmBtn: {
        flex: 1,
        marginLeft: 8,
        borderRadius: 8,
        overflow: 'hidden',
    },
    confirmGradient: {
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    confirmBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
});