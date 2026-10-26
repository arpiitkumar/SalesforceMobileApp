// components/SubEndDay.js
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AntDesign from "./AntDesign";
import { getUserAccessibleCategories } from '../UtilityMain/producthelpers/userLineServiceForEndDay';
import {
    getTlsdForCategory,
    getLpscForCategory,
    getDropSizeForCategory,
    getProductivityForCategory,
    getTlsdSubCategoryCount,
    getCategorySubCategoryNesting,
    getQuantityInKg,
    getValueInRupees
} from '../UtilityMain/producthelpers/categoryDataServiceEndDay';
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import Icon from "./Ionicons";
import { getUserAccessibleSubCategories } from '../UtilityMain/producthelpers/userLineService.js';
import { LayoutAnimation, UIManager, Platform } from 'react-native';
import Feather from '@react-native-vector-icons/feather'
import getOrderedCategories from '../UtilityMain/producthelpers/categoryPriorityService';


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 140) / 3;
// const { width } = Dimensions.get('window');
const CARD_MARGIN = 10;
const NUM_COLUMNS = 3;
// const CARD_WIDTH = (width - CARD_MARGIN * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

// const DEFAULT_THEME = '#C9A24D';
const DEFAULT_THEME = '#C9A24D';

export default function EndDayProductivity({ data: propData = null, themeColor = DEFAULT_THEME, onPressCategory }) {
    const [categoryData, setCategoryData] = useState(propData || []); // dynamic data
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(true);
    const [subCategoryCounts, setSubCategoryCounts] = useState({});
    const [accessibleSubCategories, setAccessibleSubCategories] = useState([]);

    const Tile = ({ value, label }) => (
        <View style={styles.tile}>
            <Text style={styles.tileValue}>{value}{label === 'Productivity' ? '%' : ''}</Text>
            <View style={styles.divider} />
            <Text style={styles.tileLabel}>{label}</Text>
        </View>
    );

    useEffect(() => {
        const initialize = async () => {
            setLoading(false);
            try {
                const loggedInUser = await UniversalUpdateInsert({
                    ObjectName: "User",
                    Type: "get"
                });

                const accessibleSubCategoriesByUser = await getUserAccessibleSubCategories(loggedInUser, null) || [];

                const accessibleCategories = await getUserAccessibleCategories(loggedInUser);
                console.log('accessible categories ... ', accessibleCategories)
                const orderedUniqueCategories = await getOrderedCategories(accessibleCategories);
                console.log('after priority', orderedUniqueCategories)

                // 2) for each category, fetch the tlsd/lpsc/dropSize/productivity in parallel
                const items = await Promise.all(
                    orderedUniqueCategories.map(async (catName) => {

                        const subCategoriesFromCategory = await getCategorySubCategoryNesting(catName)

                        //filtered for user specific categories
                        const filteredSubCategories = subCategoriesFromCategory.filter(item =>
                            accessibleSubCategories.includes(item)
                        )

                        setAccessibleSubCategories(filteredSubCategories)
                        // fetch subcategory counts
                        const subCountsRaw = (await getTlsdSubCategoryCount(catName)) || {};

                        const mergedSubCounts = {};

                        // 1️⃣ Always show ALL accessible subcategories
                        (subCategoriesFromCategory || []).forEach((subName) => {
                            mergedSubCounts[subName] = Number(subCountsRaw[subName] || 0);
                        });

                        // 2️⃣ (Optional safety) Include unexpected subcategories if backend sends extra
                        Object.keys(subCountsRaw).forEach((key) => {
                            if (!mergedSubCounts.hasOwnProperty(key)) {
                                mergedSubCounts[key] = Number(subCountsRaw[key] || 0);
                            }
                        });


                        // fetch metrics in parallel per category
                        const [
                            { totalProducts, uniqueProducts },
                            lpsc,
                            dropSize,
                            { categorySpecificOrderVisitsNumber, categorySpecificOrderVisits, totalVisits },
                            qtyInKg,
                            valueInRupees,
                        ] = await Promise.all([
                            getTlsdForCategory(catName),
                            getLpscForCategory(catName),
                            getDropSizeForCategory(catName),
                            getProductivityForCategory(catName),
                            getQuantityInKg(catName),
                            getValueInRupees(catName),
                        ]);

                        return {
                            id: catName,
                            name: catName,
                            note: totalProducts, // TLSD shown under TLSD label
                            lpsc:
                                categorySpecificOrderVisitsNumber > 0
                                    ? Number((totalProducts / categorySpecificOrderVisitsNumber).toFixed(2))
                                    : 0,
                            dropSize: categorySpecificOrderVisitsNumber > 0 ? Number(dropSize / categorySpecificOrderVisitsNumber).toFixed(2) : 0,
                            uniqueTls: uniqueProducts,
                            productivity: `${categorySpecificOrderVisits}% (${categorySpecificOrderVisitsNumber})`,
                            subCounts: mergedSubCounts,
                            qtyInKg: qtyInKg,
                            valueInRupees: valueInRupees,
                        };

                    })
                );

                setCategoryData(items);
            } catch (err) {
                console.error('EndDayProductivity initialize err', err);
            } finally {
                setLoading(false);
            }
        };

        // If parent passes propData, skip fetching
        if (!propData) initialize();
        else setCategoryData(propData);
    }, [propData]);


    const SubTable = ({ data = {}, accessible = [] }) => {
        const [isOpenSub, setIsOpenSub] = useState(true); // LOCAL STATE

        const rows = (accessible && accessible.length > 0)
            ? accessible.map((name) => ({ name, count: Number(data[name] || 0) }))
            : Object.entries(data).map(([name, count]) => ({ name, count }));

        if (!rows.length) return null;

        return (
            <View style={styles.subTableContainer}>
                <View style={styles.subTable}>

                    {/* HEADER */}
                    <View style={styles.subHeaderRow}>
                        <Text style={[styles.subHeaderCell, { flex: 1 }]}>
                            Subcategory
                        </Text>

                        {/* COUNT + COLLAPSE */}
                        <TouchableOpacity
                            style={styles.countHeader}
                            onPress={() => {
                                LayoutAnimation.configureNext(
                                    LayoutAnimation.Presets.easeInEaseOut
                                );
                                setIsOpenSub(prev => !prev);
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.subHeaderCell}>KG  <Feather
                                name={isOpenSub ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color="#C9A24D"
                                style={{ marginLeft: 4 }}
                            /></Text>

                        </TouchableOpacity>
                    </View>

                    {/* ROWS */}
                    {isOpenSub && rows.map(({ name, count }) => (
                        <View key={name} style={styles.subRow}>
                            <Text style={[styles.subCell, { flex: 0.7 }]} numberOfLines={1}>
                                {name}
                            </Text>
                            <Text style={[styles.subCellCount, { flex: 0.3, textAlign: 'right' }]}>
                                {count.toFixed(2)}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    };





    const renderItem = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.92}
            style={styles.cardWrap}
            onPress={() => (onPressCategory ? onPressCategory(item) : null)}
        >
            <LinearGradient
                colors={['#f5f6f7ff', '#eff7faff']}
                style={styles.cardInner}
            >
                <View style={styles.cardHeader}>
                    <Text style={[styles.catName, { color: themeColor }]} numberOfLines={1}>
                        {/* {item.name} */}
                        {item.name?.toLowerCase() === 'flour' ? 'Staples' : item.name}
                    </Text>
                    <View style={[styles.pill, { borderColor: themeColor }]}>
                        <Text style={[styles.pillText, { color: themeColor }]}>Productivity: {item.productivity}</Text>
                    </View>
                </View>

                <View style={styles.row}>
                    <Tile label="TLSD" value={item.note} />
                    <Tile label="LPSC" value={item.lpsc} />
                    <Tile label="Drop Size" value={item.dropSize} />
                </View>
                <View style={styles.row}>

                    <Tile label="Unique TLS" value={item.uniqueTls} />
                    <Tile label="Qty In KG" value={item.qtyInKg} />
                    <Tile label="Value in (₹)" value={item.valueInRupees} />
                </View>


                <SubTable data={item.subCounts} accessible={accessibleSubCategories} />

            </LinearGradient>
        </TouchableOpacity>
    );

    // if (!propData) {
    //     return (
    //         <View style={styles.loaderWrap}>
    //             <ActivityIndicator size="small" color={themeColor} />
    //         </View>
    //     );
    // }

    return (
        <View style={styles.container}>

            <TouchableOpacity
                style={styles.headerRow}
                activeOpacity={0.7}
                onPress={() => setIsOpen(!isOpen)}
            >
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: themeColor }]}>Productivity</Text>
                    <Text style={styles.headerSub}>All categories — quick overview</Text>
                </View>

                <Icon
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color="#C9A24D"
                />
            </TouchableOpacity>
            {isOpen && (
                <>
                    <FlatList
                        data={categoryData}
                        keyExtractor={(i) => i.id?.toString()}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        // style={{ maxHeight: 300 }}   // 🔥 THIS ENABLES SCROLL
                        contentContainerStyle={{ paddingBottom: 12, margin: 0 }}
                        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}

                    // showverticalScrollIndicator={false}
                    />
                </>
            )}
        </View>

    );
}
const styles = StyleSheet.create({
    container: {
        backgroundColor: "white",
        padding: 20,
        paddingHorizontal: 22,
        borderRadius: 12,
        elevation: 2,
        width: '92%',
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 12,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 1,
    },
    headerRow: {
        marginBottom: 10,
        // paddingHorizontal: 10,
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
    listContent: {
        paddingBottom: 12,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        marginBottom: CARD_MARGIN,
    },
    cardWrap: {
        // width: CARD_WIDTH,
        width: '100%',
        elevation: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    cardInner: {
        padding: 12,
        backgroundColor: '#eff7faff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eef3ff',
        minHeight: 140,
        justifyContent: 'space-between',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    catName: {
        fontSize: 16,
        fontWeight: '900',
        maxWidth: '70%',
    },
    pill: {
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '700',
    },
    cardBody: {
        marginTop: 10,
        flexDirection: 'row',
    },

    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },

    //
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
        fontSize: 14,
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
        letterSpacing: 0.6,
        textAlign: 'center'
    },
    //
    rowLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
        // color: '#7A7266',
        width: '45%',
    },
    rowValue: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'right',
        width: '55%',
        color: '#0f1724',
    },
    cardFooter: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    moreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    moreText: {
        fontSize: 12,
        fontWeight: '700',
    },
    loaderWrap: {
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    /* Sub-table styles */

    // container to allow overlay positioning and margin
    subTableContainer: {
        position: 'relative',
    },

    // existing subTable mostly reused
    subTable: {
        marginTop: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#EEF3FF',
        paddingVertical: 8,
        paddingHorizontal: 16,
        shadowColor: '#7A7266',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 2,
        overflow: 'visible',
    },

    // the faded overlay that sits at bottom of the subTable when collapsed
    subOverlayTouchable: {
        position: 'absolute',
        // backgroundColor:'red',
        left: 0,
        right: 0,
        bottom: 0,
        height: 100, // adjust how strong the fade looks
        alignItems: 'center',
        justifyContent: 'center',
    },
    subOverlayFade: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 100,
        backgroundColor: 'rgba(255,255,255,0.92)',
    },


    subOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 100,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
    },

    showMoreRow: {
        position: 'absolute',
        bottom: 8,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },

    showMoreText: {
        color: '#1E3A8A',
        fontWeight: '700',
        marginRight: 8,
    },

    collapseBtn: {
        marginTop: 8,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F3F6FF',
        borderWidth: 1,
        borderColor: '#EEF3FF',
    },

    collapseText: {
        color: '#1E3A8A',
        fontWeight: '700',
        fontSize: 12,
    },



    // subTable: {
    //     marginTop: 12,
    //     backgroundColor: '#FFFFFF',
    //     borderRadius: 8,
    //     borderWidth: 1,
    //     borderColor: '#EEF3FF',
    //     paddingVertical: 8,
    //     paddingHorizontal: 16,
    //     // subtle shadow
    //     shadowColor: '#7A7266',
    //     shadowOffset: { width: 0, height: 1 },
    //     shadowOpacity: 0.06,
    //     shadowRadius: 2,
    //     elevation: 2,
    // },

    subHeaderRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#EEF3FF',
        marginBottom: 6,
    },

    subHeaderCell: {
        fontSize: 12,
        fontWeight: '700',
        color: '#A67C2E',
    },

    subRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        alignItems: 'center',
    },

    subCell: {
        fontSize: 13,
        color: '#0f1724',
        fontWeight: '600',
    },

    subCellCount: {
        fontSize: 13,
        color: '#0f1724',
        fontWeight: '900',
    },

});