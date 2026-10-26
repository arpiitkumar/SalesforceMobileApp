// components/SubEndDay.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { Gradients } from '../assets/css/MasterCss.js'
import { getUserAccessibleCategories } from '../UtilityMain/producthelpers/userLineServiceForEndDay';
import {
  getQuantityInKg,
  getValueInRupees,
} from '../UtilityMain/producthelpers/DashboardSRCategoryData';
import getOrderedCategories from '../UtilityMain/producthelpers/categoryPriorityService';

export default function DashboardSRCategory({
  data: propData = null,
  themeColor = '#C9A24D',
  onPressCategory,
}) {
  const [categoryData, setCategoryData] = useState([]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const loggedInUser = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'get',
        });

        const accessibleCategories = await getUserAccessibleCategories(loggedInUser);
        // console.log('accessibleCategories',accessibleCategories)
 const orderedUniqueCategories = await getOrderedCategories(accessibleCategories);
                // console.log('after priority', orderedUniqueCategories )
        const items = await Promise.all(
          orderedUniqueCategories.map(async (catName) => {
            const [qtyInKg, valueInRupees] = await Promise.all([
              getQuantityInKg(catName),
              getValueInRupees(catName),
            ]);

            return {
              id: catName,
              name: catName,
              qtyInKg,
              valueInRupees,
            };
          })
        );

        console.log('items',items)
        setCategoryData(items);
      } catch (err) {
        console.error('Dashboard highlight error', err);
      }
    };

    if (!propData) initialize();
    else setCategoryData(propData);
  }, [propData]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.cardWrap}
      onPress={() => onPressCategory?.(item)}
    >
      {/* CATEGORY HIGHLIGHT STRIP */}
      {/* <LinearGradient
         colors={Gradients.primary}
        style={styles.categoryStrip}
        start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
      > */}
      <View style={styles.categoryStrip}>
        <Text style={styles.categoryText}>
          {
          item.name?.toLowerCase() === 'flour' ? 'Staples' : item.name
          }
          {/* {item.name} */}
        </Text>
        </View>
      {/* </LinearGradient> */}

      {/* CARD BODY */}
      <View style={styles.cardBody}>
        {/* LEFT : QTY */}
        <View style={styles.left}>
          <Text style={[styles.qtyValue, { color: themeColor }]}>
            {item.qtyInKg || 0} KG
          </Text>
          <Text style={styles.subLabel}>Weight</Text>
        </View>

        {/* DIVIDER */}
        <View style={styles.verticalDivider} />

        {/* RIGHT : AMOUNT */}
        <View style={styles.right}>
          <Text style={styles.amountValue}>
            ₹ 
            {/* {Number(item.valueInRupees || 0).toLocaleString('en-IN')} */}
            {Number(item.valueInRupees || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.subLabel}>
            {item.name} (Net Amount)
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={categoryData}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '97%',
    alignSelf: 'center',
    marginVertical: 12,
    // marginTop:0,
  },

  cardWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    backgroundColor: '#fff',
    margin:1,
  },
 
  categoryStrip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor:'#EEF4FF'
  },

  categoryText: {
    color: '#A67C2E',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },

  left: {
    width: '35%',
    alignItems: 'center',
  },

  right: {
    width: '65%',
    paddingLeft: 12,
  },

  qtyValue: {
    fontSize: 20,
    fontWeight: '900',
  },

  amountValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1F1D1A',
  },

  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A7266',
    marginTop: 2,
  },

  verticalDivider: {
    width: 1,
    height: 42,
    backgroundColor: '#D9D2C3',
    marginHorizontal: 8,
  },
});
