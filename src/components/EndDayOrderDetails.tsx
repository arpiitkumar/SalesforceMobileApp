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
      getQuantityInKg,
    getValueInRupees
} from '../UtilityMain/producthelpers/categoryDataServiceEndDay';
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import Icon from "./Ionicons";
 
 
const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 140) / 2;
 
const CARD_MARGIN = 10;
const NUM_COLUMNS = 2;
 
const DEFAULT_THEME = '#C9A24D';
 
export default function EndDayOrderDetails({ data: propData = null, themeColor = DEFAULT_THEME, onPressCategory }) {
    const [categoryData, setCategoryData] = useState(propData || []); // dynamic data
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(true);
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
 
                // 1) get accessible categories (array of strings)
                const accessibleCategories = await getUserAccessibleCategories(loggedInUser);
                
                const items = await Promise.all(
                    accessibleCategories.map(async (catName) => {
                        // fetch metrics in parallel per category
                        const [
                            qtyInKg,
                            valueInRupees,
                        ] = await Promise.all([
                            getQuantityInKg(catName),
                            getValueInRupees(catName),
                            
                        ]);
 
                        return {
                            id: catName,
                            name: catName,
                          
                            qtyInKg:qtyInKg,
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
    // onPressCategory optional callback: (item) => {}
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
                        {item.name}
                    </Text>
                   
                </View>
 
                <View style={styles.row}>
                    <Tile label="Qty In KG" value={item.qtyInKg} />
                    <Tile label="Value in (₹)" value={item.valueInRupees} />
                    
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
 
    return (
        <View style={styles.container}>
 
            <TouchableOpacity
                style={styles.headerRow}
                activeOpacity={0.7}
                onPress={() => setIsOpen(!isOpen)}
            >
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: themeColor }]}>Spot Sales Details</Text>
                    <Text style={styles.headerSub}>All Spot Sales Details — quick overview</Text>
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
 
function Row({ label, value }) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
                {value}
            </Text>
        </View>
    );
}
 
// small helper to create subtle rgba from hex
function hexToRgba(hex, alpha = 1) {
    try {
        const h = hex.replace('#', '');
        const bigint = parseInt(h, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r},${g},${b},${alpha})`;
    } catch (e) {
        return `rgba(21,84,178,${alpha})`;
    }
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
        fontSize: 11,
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
 
});