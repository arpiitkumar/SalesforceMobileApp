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
    Modal,
} from 'react-native';
import Feather from '@react-native-vector-icons/feather';
import CompetitorStockModal from '../components/modal/CompetitorStockCheck';
import AddCompetitorModal from '../components/modal/AddCompetitor';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HeaderMain from '../components/HeaderMain';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert.js'; // <-- add
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getSanitizedPhotoUrl } from '../utils/getSanitizedPhotoUrl';

const { width, height } = Dimensions.get('window');

type Competitor = {
    id: string;
    name: string;
    brand: string;
    sellingPrice: string;
    mrp: string;
    activity: string;
    subCat?: string;
    grm?: string;
    grmType?: string;
    image?: string;
    raw?: any;
};

export default function Competitors({ route }) {
    const [query, setQuery] = useState('');
    const [data, setData] = useState<Competitor[]>([]); // start empty, load dynamically
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [competitorMasterState, setCompetitorMasterState] = useState([]);
    const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
    const brandIdFromPricing = route?.params?.selectedBrandId;
    const skuNameFromPricing = route?.params?.selectedSkuName;
    // modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Competitor | null>(null);

    // Sorting and Filtering states
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedBrand, setSelectedBrand] = useState<string>('All');
    const [filterModalVisible, setFilterModalVisible] = useState(false);

    // Temp modal states
    const [tempSortOrder, setTempSortOrder] = useState<'asc' | 'desc'>('desc');
    const [tempSelectedBrand, setTempSelectedBrand] = useState<string>('All');

    // Sync temp states when modal opens
    useEffect(() => {
        if (filterModalVisible) {
            setTempSortOrder(sortOrder);
            setTempSelectedBrand(selectedBrand);
        }
    }, [filterModalVisible]);

    // console.log('brandIdFromPricing in competitor screen:::::::::::', brandIdFromPricing)
    // Utility to format Photo__c correctly
    const resolveImage = (photo?: string) => {
        // console.log('resolveImage called for:.............................', photo);
        if (!photo) return null;

        // If it's already a public URL
        if (photo.startsWith('http')) {
            // console.log('photo before sanitization::::::::::::::;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;', photo)
            let sanitizedPhoto = getSanitizedPhotoUrl(photo);
            // console.log('sanitizedPhoto::::::::::::::', sanitizedPhoto)
            return sanitizedPhoto;
        }

        // If it's likely base64 (no http, usually long string)
        if (/^[A-Za-z0-9+/=]+\s*$/.test(photo)) {
            return `data:image/jpeg;base64,${photo}`;
        }

        // Default: return as-is (in case already prefixed or unexpected case)
        return photo;
    };


    // Normalize DB item to UI Competitor


    // load from local DB
    const loadCompetitors = async () => {
        try {
            const competitorMaster = await UniversalUpdateInsert({ ObjectName: 'CompetitorMaster__c', Type: 'get' });

            const optionMappingCompetitorMaster = competitorMaster.map((item) => ({
                label: item.Name,
                value: item.Sf_Id
            }));

            setCompetitorMasterState(optionMappingCompetitorMaster);

            // Now fetch competitor items ONLY after setting state is done
            // So instead of relying on `competitorMasterState`, pass it directly

            const dbItems = await UniversalUpdateInsert({
                ObjectName: 'Competitor_LineItem__c', Type: 'get', filters: [
                    { field: 'Type__c', value: 'Competitor Initiative' },
                    { field: 'Customer__c', value: selectedVisit?.AccountId },
                ]
            });

            // console.log('COMPETITOR LINE ITEMS::::', dbItems)
            // console.log('DAB ITEMMMMSSSS::::', dbItems)
            const mapDbToCompetitor = (item: any, masterList: any[]): Competitor => {
                const getBrandName = () => {
                    const match = masterList?.find((c) => c.value === item.Competitor__c);
                    return match ? match.label : 'Unknown';
                };

                return {
                    id: item.Sf_Id || item.SfId || item.id || String(Math.random()),
                    name: item.Product_Name__c || item.Name || 'Unknown',
                    brand: getBrandName(),
                    sellingPrice: item.Selling_Price__c ? `₹ ${item.Selling_Price__c}` : '₹ 0',
                    mrp: item.MRP__c ? `₹ ${item.MRP}` : '₹ 0',
                    subCat: item.Sub_Category__c || item.Sub_Category__c || item.subCat || '',
                    activity: item.Activity__c || '',
                    grm: item.Grammage__c || item.GrammageBeforePromotion || item.grm || '--',
                    image: resolveImage(item.Photo__c) || (item.Images && item.Images[0]?.uri) || null,
                    raw: item,
                    grmType: item.Grammage_Type__c || '--',
                };
            };

            if (Array.isArray(dbItems)) {
                const mapped = dbItems.map((item) => mapDbToCompetitor(item, optionMappingCompetitorMaster));

                // console.log('mapped:::::::::::', mapped)
                setData(mapped);
            } else {
                setData(dbItems ? [mapDbToCompetitor(dbItems, optionMappingCompetitorMaster)] : []);
            }
        } catch (e) {
            console.warn('Failed to load competitors:', e);
            setData([]);
        }
    };


    useFocusEffect(
        useCallback(() => {
            loadCompetitors();
        }, [])
    );

    useEffect(() => {
        if ( skuNameFromPricing) {
            // Open modal with brand prefilled
            setAddModalVisible(true)
        }
    }, [])

    const filtered = useMemo(() => {
        if (!query) return data;
        const q = query.toLowerCase();
        return data.filter(
            (d) => (d.name ?? '').toLowerCase().includes(q) || (d.brand ?? '').toLowerCase().includes(q)
        );
    }, [query, data]);

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
                sellingPrice: payload.sellingPrice ? `₹ ${payload.sellingPrice}` : '₹ 0',
                mrp: payload.mrp ? `₹ ${payload.mrp}` : '₹ 0',
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


    const renderItem = ({ item }) => {
        // console.log('Rendering item:', item.id, item.name);
        return (
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
                            <View style={styles.metaItem}>
                                <Text style={styles.metaLabel}>Brand</Text>
                                <Text style={styles.metaValue}>{item.brand}</Text>
                            </View>

                            <View style={styles.metaItem}>
                                <Text style={styles.metaLabel}>Activity</Text>
                                <Text style={styles.metaValue}>{item.activity}</Text>
                            </View>
                             <View style={styles.metaItemRight}>
                                <Text style={styles.metaLabel}>Grammage Type</Text>
                                <Text style={styles.metaValue}>{item.grmType ?? '--'}</Text>
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
                                {/* <Text style={styles.metaLabel}>Grammage</Text>
                                <Text style={styles.metaValue}>{item.grm ?? '--'}</Text> */}
                            </View>
                            
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        )
    };

    // const renderItem = ({ item }: { item: Competitor }) => (

    // );

    const stripCurrency = (s?: string) => (s ? s.replace(/[^\d.]/g, '') : '');

    const uniqueBrands = useMemo(() => {
        const brands = new Set<string>();
        data.forEach(item => {
            if (item.brand && item.brand !== 'Unknown') brands.add(item.brand);
        });
        return ['All', ...Array.from(brands)];
    }, [data]);

    const sortedAndFilteredData = useMemo(() => {
        let result = [...filtered];

        // Apply brand filter
        if (selectedBrand && selectedBrand !== 'All') {
            result = result.filter(item => item.brand === selectedBrand);
        }

        // Apply sorting
        result.sort((a, b) => {
            const valA = (a.name || '').trim().toLowerCase();
            const valB = (b.name || '').trim().toLowerCase();
            if (sortOrder === 'asc') {
                return valA.localeCompare(valB);
            } else {
                return valB.localeCompare(valA);
            }
        });

        return result;
    }, [filtered, sortOrder, selectedBrand]);

    const handleApplyFilters = () => {
        setSortOrder(tempSortOrder);
        setSelectedBrand(tempSelectedBrand);
        setFilterModalVisible(false);
    };

    const handleClearFilters = () => {
        setTempSortOrder('desc');
        setTempSelectedBrand('All');
        setSortOrder('desc');
        setSelectedBrand('All');
        setFilterModalVisible(false);
    };

    return (
        <SafeAreaProvider style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
            <View style={styles.headerContainer}>
                <HeaderMain screenName="Competitors" />
            </View>
            <View style={{ flex: 1, backgroundColor: 'white', borderTopRightRadius: 20, borderTopLeftRadius: 20 }}>

                <View style={styles.searchContainer}>
                    <View style={styles.searchRow}>
                        <Feather name="search" size={18} color="#8a8a8a" style={{ marginLeft: 12 }} />
                        <TextInput
                            placeholder="Search competitor/brand..."
                            value={query}
                            onChangeText={setQuery}
                            style={styles.searchInput}
                            placeholderTextColor="#8a8a8a"
                        />
                    </View>
                    <TouchableOpacity 
                        style={styles.filterBtn}
                        onPress={() => setFilterModalVisible(true)}
                    >
                        <Feather name="sliders" size={18} color="#A67C2E" />
                    </TouchableOpacity>
                </View>

                {sortedAndFilteredData.length > 0 ? (
                    <FlatList
                        data={sortedAndFilteredData}
                        initialNumToRender={15}
                        keyExtractor={(i) => i.id}
                        maxToRenderPerBatch={10}
                        windowSize={4}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                    />
                ) : (
                    <View style={styles.noDataContainer}>
                        <Text style={styles.noDataText}>No competitors found</Text>
                    </View>
                )}

                {/* FAB to Add New Competitor */}
                <TouchableOpacity 
                    style={styles.fab}
                    activeOpacity={0.8}
                    onPress={() => setAddModalVisible(true)}
                >
                    <Feather name="plus" size={26} color="#fff" />
                </TouchableOpacity>

                {/* Filter Modal */}
                <Modal
                    visible={filterModalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setFilterModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity 
                            style={styles.modalBackground} 
                            activeOpacity={1} 
                            onPress={() => setFilterModalVisible(false)} 
                        />
                        <View style={styles.filterSheet}>
                            <View style={styles.sheetHeader}>
                                <Text style={styles.sheetTitle}>Filters & Sort</Text>
                                <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                                    <Feather name="x" size={22} color="#555" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.sectionLabel}>Sort Alphabetically</Text>
                            <View style={styles.optionsRow}>
                                <TouchableOpacity 
                                    style={[styles.optionBtn, tempSortOrder === 'asc' && styles.optionBtnActive]}
                                    onPress={() => setTempSortOrder('asc')}
                                >
                                    <Feather name={tempSortOrder === 'asc' ? "check-circle" : "circle"} size={16} color={tempSortOrder === 'asc' ? "#A67C2E" : "#888"} />
                                    <Text style={[styles.optionText, tempSortOrder === 'asc' && styles.optionTextActive]}>A to Z (Ascending)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.optionBtn, tempSortOrder === 'desc' && styles.optionBtnActive]}
                                    onPress={() => setTempSortOrder('desc')}
                                >
                                    <Feather name={tempSortOrder === 'desc' ? "check-circle" : "circle"} size={16} color={tempSortOrder === 'desc' ? "#A67C2E" : "#888"} />
                                    <Text style={[styles.optionText, tempSortOrder === 'desc' && styles.optionTextActive]}>Z to A (Descending)</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.sectionLabel}>Filter by Brand</Text>
                            <FlatList
                                data={uniqueBrands}
                                keyExtractor={(item) => item}
                                horizontal={true}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.brandBadgeList}
                                renderItem={({ item }) => (
                                    <TouchableOpacity 
                                        style={[styles.brandBadge, tempSelectedBrand === item && styles.brandBadgeActive]}
                                        onPress={() => setTempSelectedBrand(item)}
                                    >
                                        <Text style={[styles.brandBadgeText, tempSelectedBrand === item && styles.brandBadgeTextActive]}>{item}</Text>
                                    </TouchableOpacity>
                                )}
                            />

                            <View style={styles.sheetFooter}>
                                <TouchableOpacity style={styles.clearBtn} onPress={handleClearFilters}>
                                    <Text style={styles.clearBtnText}>Reset</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.applyBtn} onPress={handleApplyFilters}>
                                    <Text style={styles.applyBtnText}>Apply</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Stock Modal */}
                <CompetitorStockModal
                    visible={modalVisible}
                    onClose={() => {
                        closeModal()
                        loadCompetitors();
                    }}
                    initialRecordId={selectedItem?.id ?? null}
                    productTitle={selectedItem?.name ?? ''}
                    brand={selectedItem?.brand ?? ''}
                    subCat={selectedItem?.subCat ?? ''}
                    lastUpdated={new Date().toLocaleDateString()}
                    initialSellingPrice={stripCurrency(selectedItem?.sellingPrice)}
                    initialMrp={stripCurrency(selectedItem?.mrp)}
                    initialGrammage={selectedItem?.grm ?? ''}
                    initialImages={selectedItem?.image ? [{ uri: selectedItem.image }] : []}
                    onSubmit={handleModalSubmit}
                    initialActivity={selectedItem?.raw?.Activity__c ?? selectedItem?.activity ?? ''}
                />

                <AddCompetitorModal
                    visible={addModalVisible}
                    onClose={() => {
                        setAddModalVisible(false)
                        loadCompetitors();
                    }}
                    brandIdFromPricing={brandIdFromPricing}
                    skuNameFromPricing={skuNameFromPricing}
                />
            </View>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#A67C2E' },
    headerContainer: { backgroundColor: '#A67C2E' },
    container: { flex: 1, backgroundColor: '#fff' },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#fff',
        gap: 8,
    },
    searchRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 28,
        backgroundColor: '#fff',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        borderWidth: 0.5,
        borderColor: '#D9D2C3',
    },
    searchInput: { flex: 1, height: 44, paddingHorizontal: 10, fontSize: 14, color: '#000' },
    filterBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        borderWidth: 0.5,
        borderColor: '#D9D2C3',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
    },
    listContent: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 100 },
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
    noImage: { borderWidth: 1, borderColor: '#eee' },
    centerCol: { flex: 1, paddingHorizontal: 10 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
    metaItem: { flex: 1 },
    metaItemRight: { flex: 1, alignItems: 'flex-start' },
    metaLabel: { fontSize: 11, fontWeight: '400', color: '#7A7266' },
    metaValue: { fontWeight: '500', fontSize: 11, color: '#1F1D1A' },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#A67C2E',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalBackground: {
        flex: 1,
    },
    filterSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        elevation: 10,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderColor: '#F1EADB',
        paddingBottom: 12,
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
        marginTop: 10,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 16,
    },
    optionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#D9D2C3',
        gap: 8,
    },
    optionBtnActive: {
        borderColor: '#A67C2E',
        backgroundColor: '#FFF5F5',
    },
    optionText: {
        fontSize: 12,
        color: '#4A5568',
        fontWeight: '500',
    },
    optionTextActive: {
        color: '#A67C2E',
        fontWeight: '600',
    },
    brandBadgeList: {
        paddingVertical: 8,
        gap: 8,
        marginBottom: 24,
    },
    brandBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F7FAFC',
        borderWidth: 1,
        borderColor: '#D9D2C3',
    },
    brandBadgeActive: {
        backgroundColor: '#A67C2E',
        borderColor: '#A67C2E',
    },
    brandBadgeText: {
        fontSize: 12,
        color: '#4A5568',
        fontWeight: '500',
    },
    brandBadgeTextActive: {
        color: '#FFF',
        fontWeight: '600',
    },
    sheetFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 12,
    },
    clearBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#CBD5E0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearBtnText: {
        fontSize: 14,
        color: '#4A5568',
        fontWeight: '600',
    },
    applyBtn: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#A67C2E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    applyBtnText: {
        fontSize: 14,
        color: '#FFF',
        fontWeight: '600',
    },
    noDataContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    noDataText: {
        fontSize: 16,
        color: '#8a8a8a',
    },
});
