import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { Formik } from 'formik';
import LinearGradient from 'react-native-linear-gradient';
import Entypo from '@react-native-vector-icons/entypo';
import { Gradients } from '../../assets/css/MasterCss';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import ObjectList from '../../screens/ObjectList';
import { useNavigation } from '@react-navigation/native';

const { height } = Dimensions.get('window');

const StockHistoryModal = ({
  visible,
  onClose,
  // optional callback when save is done
}) => {
  const navigation = useNavigation();
  // console.log("THIS IS ACCCUT DATATAT",accountData)
  const handleSubmit = async (values) => {

  };
  
  const handleAddPress = () => {
    onClose();
    navigation.navigate('SelectionScreen');
  }



  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Stock History</Text>
            <TouchableOpacity onPress={onClose}>
              <Entypo name="cross" size={22} color="#333" />
            </TouchableOpacity>
          </View>
          {/* <View style={styles.addButtonRow}>
            <TouchableOpacity style={styles.addButton} activeOpacity={0.8} onPress={() => handleAddPress()}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View> */}

          <ScrollView contentContainerStyle={styles.content}>
            <ObjectList title={"Stock History"} objectName={"Stock_Check__c"} plus={false} onClose={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default StockHistoryModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '70%',
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 16
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    fontWeight: '500',
  },
  required: {
    color: 'red',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D9D2C3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  error: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
  },
  buttonContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
  },
  buttonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addButtonRow: {
  paddingHorizontal: 20,
  paddingTop: 10,
  alignItems: 'flex-end',
},

addButton: {
  width: 100,
  // height: 48,
  paddingVertical: 10,
  borderRadius: 24,
  backgroundColor: '#A67C2E', // theme color
  justifyContent: 'center',
  alignItems: 'center',
  elevation: 1, // Android shadow
  shadowColor: '#000', // iOS shadow
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
},

addButtonText: {
  color: 'white',
  fontSize: 14,
  fontWeight: '600',
  marginTop: -2, // optical alignment
},

});
