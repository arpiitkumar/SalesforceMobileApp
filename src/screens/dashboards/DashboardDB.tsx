import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import ArrowDown from '../../assets/images/arrowDown.svg'; // Make sure your SVG loader is set
import Down from '../../assets/images/Down.svg';
import {getDashboardDBStyle} from '../../assets/css/DashboardDB.js';
 
const users = [
  { label: 'Anamika Patel (Distributor)', value: '1' },
  { label: 'Ravi Sharma (Distributor)', value: '2' },
  { label: 'Neha Verma (Distributor)', value: '3' },
];
 
const DashboardDB = () => {
  const [selectedUser, setSelectedUser] = useState('1');
  const styles = getDashboardDBStyle();
 
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Distributor Dropdown */}
     <Dropdown
  style={styles.dropdown}
  data={users}
  labelField="label"
  valueField="value"
  placeholder="Select Distributor"
  value={selectedUser}
  onChange={item => setSelectedUser(item.value)}
  selectedTextStyle={styles.selectedText}
  renderRightIcon={() => <Down width={16} height={16} />}
/>
      {/* Food Card */}
      <View style={styles.card}>
        <View>
          <Text style={styles.value}>13.2K / 21.6K</Text>
          <Text style={styles.subtitle}>Food (In Thousands)</Text>
        </View>
        <Image source={require('../../assets/images/food.png')} style={styles.icon} />
      </View>
 
      {/* Oil Card */}
      <View style={styles.card}>
        <View>
          <Text style={styles.value}>112L / 220L</Text>
          <Text style={styles.subtitle}>Oil (In Liters)</Text>
        </View>
        <Image source={require('../../assets/images/oil.png')} style={styles.icon} />
      </View>
 
      {/* Beat Performance */}
      <View style={styles.beat}>
        <View style={styles.beatCard}>
        <View style={styles.inlineRow}>
          <Text style={styles.beatTitle}>Beat 1</Text>
          <Down width={14} height={14} style={styles.iconSpacing} />
        </View>
        <View style={styles.inlineRow}>
          <Text style={styles.beatValue}>3.3K</Text>
          <ArrowDown width={12} height={12} style={[styles.iconSpacing, { tintColor: '#F50057' }]} />
        </View>
           
   
      </View>
        <Text style={styles.cardLabel}>Top Outlet Performance</Text>
      </View>
     
     
 
      {/* MBO and Top Outlet */}
      <View style={styles.row}>
        <View style={styles.smallCard}>
          <View style={styles.inlineRow}>
            <Text style={styles.cardValue}>30/78</Text>
            <ArrowDown width={14} height={14} style={styles.iconSpacing} />
          </View>
          <Text style={styles.cardLabel}>MBO</Text>
        </View>
        <View style={styles.smallCard}>
          <Text style={styles.cardValue}>22</Text>
          <Text style={styles.cardLabel}>Top Outlet Performance</Text>
        </View>
      </View>
 
      {/* Debtor Status and SD/BG Status */}
      <View style={styles.row}>
        <View style={styles.statusCard}>
          <Text style={[styles.statusText, { color: '#2E7D5B' }]}>Not Due</Text>
          <Text style={styles.cardLabel}>Debtor Status</Text>
        </View>
        <View style={styles.statusCard}>
          <Text style={[styles.statusText, { color: '#2E7D5B' }]}>Active</Text>
          <Text style={styles.cardLabel}>SD/BG Status</Text>
        </View>
      </View>
 
      {/* Credit Limit and Open Claim */}
      <View style={styles.row}>
        <View style={styles.smallCard}>
          <Text style={styles.cardValue}>11.3K</Text>
          <Text style={styles.cardLabel}>Current Credit Limit</Text>
        </View>
        <View style={styles.statusCard}>
          <Text style={[styles.statusText, { color: '#2E7D5B' }]}>Active</Text>
          <Text style={styles.cardLabel}>Open Claim Status</Text>
        </View>
      </View>
 
      {/* EAL Ledger and NDC */}
      <View style={styles.row}>
        <View style={styles.smallCard}>
          <Text style={styles.cardValue}>22</Text>
          <Text style={styles.cardLabel}>EAL Ledger</Text>
        </View>
        <View style={styles.smallCard}>
          <Text style={styles.cardValue}>11</Text>
          <Text style={styles.cardLabel}>NDC</Text>
        </View>
      </View>
    </ScrollView>
  );
};
 
export default DashboardDB;
 
 