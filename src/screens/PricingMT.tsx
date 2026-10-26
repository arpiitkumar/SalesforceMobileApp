// Competitors.js
import React, { useMemo, useState, useEffect } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Image,
    StyleSheet,
    Dimensions,
    StatusBar,
    Modal
} from 'react-native';
import Feather from '@react-native-vector-icons/feather';
import CompetitorStockModal from '../components/modal/PricingStockCheck';
import AddCompetitorModal from '../components/modal/AddPricing';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HeaderMain from '../components/HeaderMain';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert.js';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
const { width, height } = Dimensions.get('window');
import { getSanitizedPhotoUrl } from '../utils/getSanitizedPhotoUrl';

type Competitor = {
    id: string;
    name: string;
    brand: string;
    sellingPrice: string;
    mrp: string;
    activity: string;
    category: string;
    subCategory: string;
    subCat?: string;
    grm?: string;
    grmType?: string;
    image?: string;
    raw?: any;
    promotion: string;
};

export default function PricingMT({route}) {
    const [query, setQuery] = useState('');
    const [data, setData] = useState<Competitor[]>([]); // start empty, load dynamically
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [competitorMasterState, setCompetitorMasterState] = useState([]);
    const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
    const navigation = useNavigation();
    const [brandHolder, setBrandHolder] = useState('');
    const [SKUNameHolder, setSKUNameHolder] = useState('');
    const productIdFromStockCheck = route?.params?.selectedProductId;
    console.log('brand holder in pricing screen:::::::::::', brandHolder)
    {productIdFromStockCheck && console.log("THIS IS BRAND ID FROM PRICING .............",productIdFromStockCheck)}
    // add near other useState declarations
    const [activeCategory, setActiveCategory] = useState('All');
    const [sortAZ, setSortAZ] = useState(true); // true = A→Z, false = Z→A


    // modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Competitor | null>(null);


    const [brandConfirmVisible, setBrandConfirmVisible] = useState(false);
    // Helper: get user-friendly label for the brandHolder (brandHolder is usually the value/Sf_Id)
    const getBrandLabel = () => {
        if (!brandHolder) return '';
        const match = competitorMasterState?.find(c => c.value === brandHolder);
        return match ? match.label : brandHolder;
    };

    // Utility to format Photo__c correctly
    // const resolveImage = (photo?: string) => {
    //     if (!photo) return null;

    //     // If it's already a public URL
    //     if (photo.startsWith('http')) return photo;

    //     // If it's likely base64 (no http, usually long string)
    //     if (/^[A-Za-z0-9+/=]+\s*$/.test(photo)) {
    //         return `data:image/jpeg;base64,${photo}`;
    //     }

    //     // Default: return as-is (in case already prefixed or unexpected case)
    //     return photo;
    // };


    const normalizeUrl = (url: string) => {
        return getSanitizedPhotoUrl(url);
    };

    const resolveImage = (photo?: string) => {
        if (!photo) return null;

        // Normalize HTML-encoded URLs


        // If it's already a public URL
        if (photo.startsWith('http')) {
            photo = normalizeUrl(photo);
            return photo;
        }

        // If it's likely base64 (no http, usually long string)
        if (/^[A-Za-z0-9+/=]+\s*$/.test(photo)) {
            return `data:image/jpeg;base64,${photo}`;
        }

        // Default: return as-is (in case already prefixed or unexpected case)
        return photo;
    };

    const handleBrandConfirmYes = () => {

        const brandLabel = getBrandLabel();
        setBrandConfirmVisible(false)
        navigation.navigate('CompetitorMt', { selectedBrandId: brandHolder, selectedSkuName: SKUNameHolder });

        //setSelectedItem(null);
        //setModalVisible(true);


        //setBrandHolder('');
        //setBrandConfirmVisible(false);
    };

    const handleBrandConfirmNo = () => {
        // simply clear the transient brandHolder and close modal
        setBrandHolder('');
        setSKUNameHolder('');
        setBrandConfirmVisible(false);
    };


    // // Normalize DB item to UI Competitor
    // const mapDbToCompetitor = (item: any): Competitor => {




    //     const getBrandName = () => {


    //         const match = competitorMasterState?.find(
    //             (c) => c.value === item.Competitor__c
    //         );
    //         return match ? match.label : 'Unknown';
    //     };


    //     return {
    //         id: item.Sf_Id || item.SfId || item.id || String(Math.random()),
    //         name: item.Product_Name__c || item.Name || 'Unknown',
    //         brand: competitorMasterState.length > 0 ? getBrandName() : 'NA',
    //         sellingPrice: item.Selling_Price__c ? `₹ ${item.SellingPrice}` : '₹ 0',
    //         mrp: item.MRP__c ? `₹ ${item.MRP}` : '₹ 0',
    //         subCat: item.Sub_Category__c || item.Sub_Category__c || item.subCat || '',
    //         activity: item.Activity__c || '',
    //         category: item.Category__c || '',
    //         subCategory: item.Sub_Category__c || '',
    //         grm: item.Grammage_Before_Promotion__c || item.GrammageBeforePromotion || item.grm || '--',
    //         image: resolveImage(item.Photo__c) || (item.Images && item.Images[0]?.uri) || null,
    //         raw: item,
    //     };
    // };

    // load from local DB
    // const loadCompetitors = async () => {
    //     try {
    //         const competitorMaster = await UniversalUpdateInsert({ ObjectName: 'CompetitorMaster__c', Type: 'get' });

    //         const optionMappingCompetitorMaster = competitorMaster.map((item) => ({
    //             label: item.Name,
    //             value: item.Sf_Id
    //         }));

    //         setCompetitorMasterState(optionMappingCompetitorMaster);

    //         // Now fetch competitor items ONLY after setting state is done
    //         // So instead of relying on `competitorMasterState`, pass it directly

    //         const dbItems = await UniversalUpdateInsert({
    //             ObjectName: 'Competitor_LineItem__c', Type: 'get', filters: [
    //                 { field: 'Type__c', value: 'Competitor Price' },
    //                 { field: 'Customer__c', value: selectedVisit?.AccountId },
    //             ]
    //         });


    //         console.log('DAB ITEMMMMSSSS::::', dbItems)
    //         const mapDbToCompetitor = (item: any, masterList: any[]): Competitor => {
    //             const getBrandName = () => {
    //                 const match = masterList?.find((c) => c.value === item.Competitor__c);
    //                 return match ? match.label : 'Unknown';
    //             };

    //             return {
    //                 id: item.Sf_Id || item.SfId || item.id || String(Math.random()),
    //                 name: item.Product_Name__c || item.Name || 'Unknown',
    //                 brand: getBrandName(),
    //                 sellingPrice: item.Selling_Price__c ? `${item.Selling_Price__c}` : '0',
    //                 mrp: item.MRP__c ? `${item.MRP__c}` : 0,
    //                 subCat: item.Sub_Category__c || item.Sub_Category__c || item.subCat || '',
    //                 activity: item.Activity__c || '',
    //                 grm: item.Grammage_Before_Promotion__c || item.GrammageBeforePromotion || item.grm || '--',
    //                 // image: item.Photo__c || (item.Images && item.Images[0]?.uri) || null,
    //                 image: resolveImage(item.Photo__c) || (
    //                     item.Images && (
    //                         item.Images[0]?.uri
    //                             ? item.Images[0].uri
    //                             : resolveImage(item.Images[0]?.base64 || item.Images[0]?.Photo__c)
    //                     )
    //                 ) || null,
    //                 raw: item,
    //                 category: item.Category__c || '',
    //                 subCategory: item.Sub_Category__c || '',
    //                 promotion: item.Promotion__c
    //             };
    //         };

    //         if (Array.isArray(dbItems)) {
    //             const mapped = dbItems.map((item) => mapDbToCompetitor(item, optionMappingCompetitorMaster));

    //             console.log('mapped:::::::::::', mapped)
    //             setData(mapped);
    //         } else {
    //             setData(dbItems ? [mapDbToCompetitor(dbItems, optionMappingCompetitorMaster)] : []);
    //         }
    //     } catch (e) {
    //         console.warn('Failed to load competitors:', e);
    //         setData([]);
    //     }
    // };


    const loadCompetitors = async () => {
        try {
            // 1️⃣ Get competitor master list
            const competitorMaster = await UniversalUpdateInsert({
                ObjectName: 'CompetitorMaster__c',
                Type: 'get'
            });

            const optionMappingCompetitorMaster = competitorMaster.map((item) => ({
                label: item.Name,
                value: item.Sf_Id
            }));

            setCompetitorMasterState(optionMappingCompetitorMaster);

            // 2️⃣ Get competitor line items
            const dbItems = await UniversalUpdateInsert({
                ObjectName: 'Competitor_LineItem__c',
                Type: 'get',
                filters: [
                    { field: 'Type__c', value: 'Competitor Price' },
                    { field: 'Customer__c', value: selectedVisit?.AccountId },
                ]
            });

            if (!Array.isArray(dbItems) || dbItems.length === 0) {
                setData([]);
                return;
            }

            // 3️⃣ Fetch all product names in parallel
            const productNames = await Promise.all(
                dbItems.map(async (item) => {
                    try {
                        const productRecord = await UniversalUpdateInsert({
                            ObjectName: 'Product2',
                            Type: 'get',
                            filters: [
                                { field: 'Sf_Id', value: item.Product__c }
                            ]
                        });

                        return productRecord?.[0]?.Name || item.Product_Name__c;
                    } catch {
                        return 'Unknown';
                    }
                })
            );

            // 4️⃣ Map DB items → UI Competitor objects
            const mapped = dbItems.map((item, index) => ({
                id: item.Sf_Id || item.SfId || String(Math.random()),

                // ⭐ FINAL PRODUCT NAME HERE
                name: productNames[index],

                brand:
                    optionMappingCompetitorMaster.find(
                        (c) => c.value === item.Competitor__c
                    )?.label || 'Unknown',

                sellingPrice: item.Selling_Price__c ? `${item.Selling_Price__c}` : '0',
                mrp: item.MRP__c ? `${item.MRP__c}` : '0',
                subCat: item.Sub_Category__c || '',
                activity: item.Activity__c || '',
                grm: item.Grammage_Before_Promotion__c || '--',
                grmType: item.Grammage_Type__c || '--',

                image:
                    resolveImage(item.Photo__c) ||
                    (item.Images &&
                        (item.Images[0]?.uri
                            ? item.Images[0].uri
                            : resolveImage(
                                item.Images[0]?.base64 || item.Images[0]?.Photo__c
                            ))) ||
                    null,

                raw: item,
                category: item.Category__c || '',
                subCategory: item.Sub_Category__c || '',
                promotion: item.Promotion__c
            }));

            // console.log("Mapped:", mapped);
            setData(mapped);
        } catch (e) {
            console.warn("Failed to load competitors:", e);
            setData([]);
        }
    };

     useEffect(() => {
            if (productIdFromStockCheck) {
                // Open modal with brand prefilled
                setAddModalVisible(true)
            }
        }, [])

    useFocusEffect(
        useCallback(() => {
            loadCompetitors();

            //console.log('brand holder ...........', brandHolder)
        }, [])
    );

    useEffect(() => {
        if (SKUNameHolder) {
            setBrandConfirmVisible(true);
        }
    }, [SKUNameHolder]);

    // const filtered = useMemo(() => {
    //     if (!query) return data;
    //     const q = query.toLowerCase();
    //     return data.filter(
    //         (d) => (d.name ?? '').toLowerCase().includes(q) || (d.brand ?? '').toLowerCase().includes(q)
    //     );
    // }, [query, data]);
    const filtered = useMemo(() => {
        let list = data;

        // category filter
        if (activeCategory && activeCategory !== 'All') {
            list = list.filter(d => {
                const cat = d.category?.trim() || 'Uncategorized';
                return cat === activeCategory;
            });
        }

        // search filter
        if (query) {
            const q = query.toLowerCase();
            list = list.filter(
                d =>
                    (d.name ?? '').toLowerCase().includes(q) ||
                    (d.brand ?? '').toLowerCase().includes(q)
            );
        }

        // 🔥 ONLY reverse order (no alphabetical sorting)
        return [...list].reverse();
    }, [query, data, activeCategory]);


    const categories = useMemo(() => {
        const set = new Set();
        data.forEach(d => {
            const cat = (d.category && d.category.trim()) ? d.category.trim() : 'Uncategorized';
            set.add(cat);
        });
        return ['All', ...Array.from(set)];
    }, [data]);


    const openModal = (item: Competitor) => {

        // console.log("item;;;;;;;;;;;;;;;;;;;;;;;;", item)
        setSelectedItem(item);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setSelectedItem(null);
    };

    const handleModalSubmit = (payload) => {
        // payload expected: { sellingPrice, mrp, grammage, images, ... } or the full saved item
        // If payload contains a raw DB object or Sf_Id, map it first
        let newItem = null;
        if (payload && payload.raw) {
            newItem = mapDbToCompetitor(payload.raw);
        } else {
            // fallback, construct minimal item
            newItem = {
                id: payload.id || String(Date.now()),
                name: payload.name || payload.productName || 'New Competitor',
                brand: payload.brand || '',
                sellingPrice: payload.sellingPrice ? `${payload.sellingPrice}` : '0',
                mrp: payload.mrp ? `${payload.mrp}` : '0',
                subCat: payload.subCat || '',
                grm: payload.grammage ?? '--',
                image: payload.images?.[0]?.resizedUri || payload.images?.[0]?.uri || null,
                raw: payload,
            };
        }

        if (!newItem) return;

        // update local state (prepend so user sees it immediately)
        setData(prev => [newItem, ...prev]);

        // optionally close modal (this is the stock modal submit)
        setModalVisible(false);
        setSelectedItem(null);
    };

    const renderItem = ({ item }: { item: Competitor }) => (
        <TouchableOpacity onPress={() => openModal(item)} activeOpacity={0.8}>
            <View style={styles.card}>
                <View style={styles.leftRow}>
                    {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.thumb} />
                    ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder, styles.noImage]}>
                            {/* <Feather name="image" size={20} color="#bbb" /> */}
                            <Text style={{ alignItems: 'center', textAlign: 'center', fontSize: 10 }}>No Image</Text>
                        </View>
                    )}
                </View>

                <View style={styles.centerCol}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: '#1F1D1A', paddingVertical: 2 }}>{item.name}</Text>

                    <View style={styles.metaRow}>
                        {/* <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Brand</Text>
                            <Text style={styles.metaValue}>{item.brand}</Text>
                        </View> */}

                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Promotion</Text>
                            <Text style={styles.metaValue}>{item.promotion}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Category</Text>
                            <Text style={styles.metaValue}>{item.category}</Text>
                        </View>
                         <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Sub-Category</Text>
                            <Text style={styles.metaValue}>{item.subCategory}</Text>
                        </View>
                    </View>

                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Selling Price</Text>
                            <Text style={styles.metaValue}>{item.sellingPrice}</Text>
                        </View>

                        {/* <View style={styles.metaItemRight}>
                            <Text style={styles.metaLabel}>MRP</Text>
                            <Text style={styles.metaValue}>{item.mrp}</Text>
                        </View> */}

                        <View style={styles.metaItemRight}>
                            <Text style={styles.metaLabel}>Grammage</Text>
                            <Text style={styles.metaValue}>{item.grm ?? '--'}</Text>
                        </View>
                        <View style={styles.metaItemRight}>
                            <Text style={styles.metaLabel}>Gram. Type</Text>
                            <Text style={styles.metaValue}>{item.grmType ?? '--'}</Text>
                        </View>
                       
                    </View>


                    <View style={styles.metaRow}>



                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    const stripCurrency = (s?: string) => (s ? s.replace(/[^\d.]/g, '') : '');

    const CategoryTabs = () => (
        <View style={styles.tabWrap}>
            <FlatList
                horizontal
                data={categories}
                keyExtractor={(i) => i}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 6 }}
                renderItem={({ item }) => {
                    const isActive = item === activeCategory;
                    return (
                        <TouchableOpacity
                            onPress={() => setActiveCategory(item)}
                            style={[styles.tabButton, isActive && styles.tabButtonActive]}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                                {item}
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
                <HeaderMain screenName="Pricing" />
            </View>
            <View style={{ flex: 1, padding: 10, backgroundColor: 'white', borderTopRightRadius: 20, borderTopLeftRadius: 20 }}>

                <View style={styles.addRow}>
                    <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => setAddModalVisible(true)}>
                        <Feather name="plus" size={18} color="#2b6cb0" />
                        <Text style={styles.addText}>Add Pricing</Text>
                    </TouchableOpacity>
                </View>

                {/* existing header/search row */}
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

                

                </View>

                {/* NEW: category tabs */}
                <CategoryTabs />
                
                {/* then the list */}
                <FlatList
                    data={filtered.reverse()}
                    keyExtractor={(i) => i.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />



                {/* Modal */}
                <CompetitorStockModal
                    visible={modalVisible}
                    onClose={() => {
                        closeModal()
                        loadCompetitors();
                    }}
                    initialRecordId={selectedItem?.id ?? null}
                    initialMrp={selectedItem?.mrp ?? null}
                    productTitle={selectedItem?.name ?? ''}
                    initialSubCategory={selectedItem?.subCategory}
                    initialCategory={selectedItem?.category}
                    brand={selectedItem?.brand ?? ''}
                    subCat={selectedItem?.subCat ?? ''}
                    lastUpdated={new Date().toLocaleDateString()}
                    initialSellingPrice={stripCurrency(selectedItem?.sellingPrice)}

                    initialGrammage={selectedItem?.grm ?? ''}
                    initialImages={selectedItem?.image ? [{ uri: selectedItem.image }] : []}
                    onSubmit={handleModalSubmit}
                    initialActivity={selectedItem?.raw?.Activity__c ?? selectedItem?.activity ?? ''}
                    initialPromotion={selectedItem?.raw?.Promotion__c}
                />

                <AddCompetitorModal
                    visible={addModalVisible}
                    onClose={() => {
                        setAddModalVisible(false)
                        loadCompetitors();
                    }}
                    productIdFromStockCheck={productIdFromStockCheck}
                    setBrandHolder={setBrandHolder}
                    setSKUNameHolder={setSKUNameHolder}
                />

                {/* --- Brand confirm modal */}
                <Modal
                    visible={brandConfirmVisible}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                >
                    <View style={styles.confirmBackdrop}>
                        <View style={styles.confirmCard}>
                            <Text style={styles.confirmTitle}>Confirm</Text>
                            <Text style={styles.confirmMessage}>
                                Any initiative activity (Competitor) to be captured?
                            </Text>

                            {/* show the brand (friendly label) */}
                            {/* <Text style={styles.confirmBrand}>{getBrandLabel()}</Text> */}
                            <Text style={styles.confirmBrand}>{SKUNameHolder}</Text>

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
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#fff',
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
    thumb: { width: 60, height: 60, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    thumbPlaceholder: { backgroundColor: '#eee' },
    centerCol: { flex: 1, paddingHorizontal: 10 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
    metaItem: { flex: 1 },
    metaItemRight: { flex: 1, alignItems: 'flex-start' },
    metaLabel: { fontSize: 11, fontWeight: '400', color: '#7A7266' },
    metaValue: { fontWeight: '500', fontSize: 11, color: '#1F1D1A' },
    saveBtn: {
        position: 'absolute',
        width: '100%',
        bottom: 18,
        backgroundColor: '#2b6cb0',
        paddingVertical: 13,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
    },
    saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    tabWrap: {
        paddingVertical: 8,
        borderBottomWidth: 0,
        backgroundColor: '#fff',
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
        fontSize: 16,
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
