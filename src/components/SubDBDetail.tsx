import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';

// Theme colors
const THEME = {
  primary: '#1C4CB0',
  primaryLight: '#3f6eda',
  //   bg: '#F6F8FF',
  bg: 'white',
  card: '#FFFFFF',
  textDark: '#0B254D',
  textMuted: '#6B7A99',
};

// Map API keys to friendly labels and small transformations if needed
const FIELD_MAP = [
  { key: 'BillingAddress', label: 'Address' },
  { key: 'DBType__c', label: 'DB type' },
  { key: 'GSTIN_Number__c', label: 'GSTIN' },
  // { key: 'Name', label: 'Name' },
  { key: 'PAN_Number__c', label: 'PAN number' },
  { key: 'Party_Code__c', label: 'Party code' },
  { key: 'Phone', label: 'Phone' },
  { key: 'Type', label: 'Type' },
  { key: 'Email__c', label: 'Email' },
];

const SubDBDetail = () => {
  const [loading, setLoading] = useState(true);
  const [retailer, setRetailer] = useState(null);
  const [beatRecord, setBeatRecord] = useState(null);
  const [superData, setSuper] = useState(null);

  const distributorId = useSelector((state) => state.distributor.id);
  const { id: beatId, name: beatName } = useSelector(state => state.beatSelection || {});

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      try {
        setLoading(true);
        // get beat record (same logic you used previously)
        const SelectedBeatRecordArr = await UniversalUpdateInsert({
          ObjectName: 'Beat__c',
          Type: 'get',
          filters: [{ field: 'Sf_Id', value: beatId }],
        });

        const SelectedBeatRecord = Array.isArray(SelectedBeatRecordArr) && SelectedBeatRecordArr.length > 0
          ? SelectedBeatRecordArr[0]
          : null;

        if (!mounted) return;
        setBeatRecord(SelectedBeatRecord);

        // fetch retailer using DirectDBSubDB__c from beat
        const retailerArr = await UniversalUpdateInsert({
          ObjectName: 'Account',
          Type: 'get',
          filters: [
            // { field: 'Sf_Id', value: SelectedBeatRecord?.DirectDBSubDB__c },
            { field: 'Sf_Id', value: distributorId },
          ],
        });
        const retailerArrSuper = await UniversalUpdateInsert({
          ObjectName: 'Account',
          Type: 'get',
          filters: [
            { field: 'Sf_Id', value: retailerArr[0]?.ParentId },
          ],
        });
        setSuper(retailerArrSuper[0])

        const retailerObj = Array.isArray(retailerArr) && retailerArr.length > 0 ? retailerArr[0] : null;
        if (!mounted) return;
        setRetailer(retailerObj);
      } catch (err) {
        console.warn('SubDBDetail initialize error', err);
        Alert.alert('Error', 'Could not fetch details.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initialize();
    return () => { mounted = false };
  }, [beatId]);

  const handleCall = phone => {
    if (!phone) return;
    const tel = Platform.OS === 'android' ? `tel:${phone}` : `telprompt:${phone}`;
    Linking.openURL(tel).catch(() => Alert.alert('Error', 'Unable to make a call'));
  };

  const handleEmail = email => {
    if (!email) return;
    const mailto = `mailto:${email}`;
    Linking.openURL(mailto).catch(() => Alert.alert('Error', 'Unable to open email'));
  };

  const renderField = (label, value, key) => (
    <View style={styles.fieldRow} key={key}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {/* {key === 'Phone' ? (
        <TouchableOpacity onPress={() => handleCall(value)}>
          <Text style={[styles.fieldValue, styles.link]}>{value || '—'}</Text>
        </TouchableOpacity>
      ) : key === 'cgcloud__Account_Email__c' ? (
        <TouchableOpacity onPress={() => handleEmail(value)}>
          <Text style={[styles.fieldValue, styles.link]}>{value || '—'}</Text>
        </TouchableOpacity>
      ) : ( */}
      <Text style={styles.fieldValue}>{value || '—'}</Text>
      {/* )} */}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  if (!retailer) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No retailer details found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{(retailer.Name || ' ')[0]}</Text>
        </View>
        <View style={styles.headerTextWrap}>
          <Text numberOfLines={2} style={styles.title}>{retailer.Name || '—'}<Text style={{ fontSize: 12 }}></Text></Text>
          <Text style={styles.subtitle}>{retailer.Party_Code__c ? ' (#' + retailer.Party_Code__c + ')' : ''}</Text>
        </View>
      </View>
      <View style={styles.card}>
        {FIELD_MAP.map(({ key, label }) => {
          let value = retailer[key];


          if (key === 'BillingAddress' && value) {
            value = value.replace(/,\s*$/, '');
          }

          return renderField(label, value, key);
        })}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Super DB</Text>
          <Text style={styles.fieldValue}>{superData?.Name || '—'} (#{superData?.Party_Code__c || '—'})</Text>
        </View>
      </View>

      {/* <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleCall(retailer.Phone)}>
          <Text style={styles.actionBtnText}>Call</Text>
        </TouchableOpacity>
 
        <TouchableOpacity style={[styles.actionBtn, styles.outlineBtn]} onPress={() => handleEmail(retailer.Email__c)}>
          <Text style={[styles.actionBtnText, styles.outlineText]}>Email</Text>
        </TouchableOpacity>
      </View> */}

    </ScrollView>
  );
};

export default SubDBDetail;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 32,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    elevation: 3,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    color: THEME.textDark,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: THEME.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 22,
    // shadow for iOS
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    // elevation for android
    elevation: 2,
  },
  fieldRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1FA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  fieldLabel: {
    color: THEME.textMuted,
    fontSize: 12,
    width: '40%'
  },
  fieldValue: {
    color: THEME.textDark,
    fontWeight: 'bold',
    fontSize: 14,
    width: '60%',
    textAlign: 'right'
  },
  link: {
    textDecorationLine: 'underline',
    color: THEME.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  outlineBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: THEME.primary,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  outlineText: {
    color: THEME.primary,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: THEME.textMuted,
  }
});