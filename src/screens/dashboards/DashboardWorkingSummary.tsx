import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {DashboardWorkingSummaryStyle} from '../../assets/css/DashboardWorkingSummary.js'
 
import DownArrow from '../../assets/images/arrowDown.svg';
import UpArrow   from '../../assets/images/arrowUp.svg';
 
const topStores = [
  { rank: 1, name: 'Store 1 Name', change: 2 },
  { rank: 2, name: 'Store 2 Name', change: 1 },
  { rank: 3, name: 'Store 3 Name', change: 3 },
  { rank: 4, name: 'Store 4 Name', change: 2 },
  { rank: 5, name: 'Store 5 Name', change: -1 },
  { rank: 6, name: 'Store 6 Name', change: 1 },
  { rank: 7, name: 'Store 7 Name', change: -3 },
  { rank: 8, name: 'Store 8 Name', change: 5 },
  { rank: 9, name: 'Store 9 Name', change: 3 },
];
 
const DashboardWorkingSummary = () => {
  const [selectedTab, setSelectedTab] = useState('Top Outlet');
  const styles = DashboardWorkingSummaryStyle();
 
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        {[
          { label: 'Days Worked',  value: '11' },
          { label: 'Outlet Visited', value: '44' },
          { label: 'Total Outlets',  value: '92' },
        ].map((item, index) => (
          <View key={index} style={styles.smallCard}>
            <Text style={styles.cardValue}>{item.value}</Text>
            <Text style={styles.cardLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
 
      <View style={styles.row}>
        <View style={styles.statusCard}>
          <View style={styles.statusTextRow}>
            <Text style={styles.statusNumber}>22</Text>
            <DownArrow width={12} height={12} />
          </View>
          <Text style={styles.cardLabel}>Not Visited Outlets</Text>
        </View>
 
        <View style={styles.statusCard}>
          <View style={styles.statusTextRow}>
            <Text style={styles.statusNumber}>22</Text>
            <UpArrow width={12} height={12} />
          </View>
          <Text style={styles.cardLabel}>Productive v/s Total Visits</Text>
        </View>
      </View>
 
      <View style={styles.listContainer}>
        {/* Tabs */}
        <View style={styles.tabRow}>
          {['Top Outlet', 'Top Retail', 'Top Wholesale'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabButton,
                selectedTab === tab && styles.activeTabButton,
              ]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTab === tab && styles.activeTabText,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
 
        {/* Ranked store list */}
        {topStores.map((store) => (
          <View key={store.rank} style={styles.storeRow}>
            <Text style={styles.storeRank}>{store.rank}</Text>
            <Text style={styles.storeName}>{store.name}</Text>
 
            <View style={styles.changePill}>
              {store.change >= 0 ? (
                <UpArrow width={10} height={10} />
              ) : (
                <DownArrow width={10} height={10} />
              )}
              <Text style={styles.changeText}>{Math.abs(store.change)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};
 
export default DashboardWorkingSummary;
 
 
 
 