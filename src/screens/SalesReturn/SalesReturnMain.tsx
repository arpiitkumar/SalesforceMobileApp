import React, { useEffect, useState } from 'react';
 
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, } from 'react-native';
 
import Receipt from '../../assets/images/receipt.svg';
 
import File from '../../assets/images/file-cancel-outline.svg';
 
import ReturnWithInvoice from './ReturnWithInvoice';
 
import ReturnWithoutInvoice from './ReturnWithoutInvoice';
import Ionicons from "../../components/Ionicons";
 
const TakeOrder = ({ visible, onClose,fromset=null }) => {
 
  const [selectedTab, setSelectedTab] = useState('withoutInvoice');
  const [searchText, setSearchText] = useState("");
 
  useEffect(() => {
    setSelectedTab('withoutInvoice');

  }, [visible]);
  return (
    <Modal transparent={true} statusBarTranslucent={false} visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.bgcontainer}>
        <View style={styles.container}>
 
          {/* Top Header */}
          <View style={{ justifyContent: 'space-between', height: 34, flexDirection: 'row', padding: 4 }}>
            <Text style={{ color: '#1F1D1A', fontSize: 16, fontWeight: '500' }}>Sales Return</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={{ fontSize: 16, color: '#5A5454' }}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchContainer}>
            <TextInput
              placeholder="Search"
              value={searchText}
              onChangeText={setSearchText}
              style={styles.searchInput}
            />
            <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          </View>
 
 
          {/* Tab Switcher (Styled like Original) */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
 
              style={[styles.tabButton, selectedTab === 'withInvoice' && styles.activeTab]}
 
              onPress={() => setSelectedTab('withInvoice')}
            >
              <Receipt width={24} height={24} />
              <Text style={selectedTab === 'withInvoice' ? styles.activeText : styles.inactiveText}>
                <Text style={styles.tabLabel}>With Invoice</Text>
              </Text>
            </TouchableOpacity>
 
            <TouchableOpacity
 
              style={[styles.tabButton, selectedTab === 'withoutInvoice' && styles.activeTab]}
 
              onPress={() => setSelectedTab('withoutInvoice')}
            >
              <File width={24} height={24} />
              <Text style={selectedTab === 'withoutInvoice' ? styles.activeText : styles.inactiveText}>
                <Text style={styles.tabLabel}>Without Invoice</Text>
              </Text>
            </TouchableOpacity>
          </View>
 
          {/* Conditional Content */}
 
          {selectedTab === 'withInvoice' ? (
            <ReturnWithInvoice onClose={onClose} searchText={searchText} fromset={fromset}/>
 
          ) : (
            <ReturnWithoutInvoice onClose={onClose} searchText={searchText} fromset={fromset}/>
 
          )}
        </View>
      </View>
 
    </Modal>
 
  );
 
};
 
const styles = StyleSheet.create({
 
  container: {
 
    height: '90%',
    marginTop: 'auto',
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
 
  },
 
  closeBtn: {},
 
  tabContainer: {
 
    flexDirection: 'row',
 
    marginBottom: 10,
 
    gap: 10,
 
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 10,
    marginBottom: 10,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 12 },
  searchIcon: { marginLeft: 8 },
  tabButton: {
 
    flex: 1,
 
    padding: 15,
 
    borderWidth: 1,
 
    borderColor: '#ccc',
 
    borderRadius: 15,
 
    flexDirection: 'row',
 
    justifyContent: 'center',
 
    alignItems: 'center',
 
    gap: 6,
 
  },
  bgcontainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  activeTab: {
 
    backgroundColor: '#F1EADB',
 
    borderColor: '#C9A24D',
 
  },
 
  activeText: {
 
    color: '#A67C2E',
 
    fontWeight: '500',
 
  },
 
  inactiveText: {
 
    color: '#888',
 
    fontWeight: '400',
 
  },
 
  tabLabel: {
 
    fontSize: 12,
    fontWeight: '400',
 
    color: '#000',
 
  },
 
});
 
export default TakeOrder;