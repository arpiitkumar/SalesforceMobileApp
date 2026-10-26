import React, { useEffect } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import Ionicons from "../Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { Gradients } from "../../assets/css/MasterCss";
import { useState } from "react";
import { useNavigation } from "@react-navigation/native";

const ProspectingModal = ({
  visible,
  onClose,
  onSave

}) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [loading, setLoading] = useState()
  const navigation = useNavigation();


  const options = ['DB Onboarding', 'SR Onboarding'];
  // const options = ['DB Onboarding', 'Sub DB Onboarding'];



  const handleSelect = (option) => {
    setSelectedOption(option);
  };

  const resetSelection = () => {
    setSelectedOption(null);
    setLoading(false);
  };

  // reset when parent hides the modal (parent-driven close)
  useEffect(() => {
    if (!visible) {
      resetSelection();
    }
  }, [visible]);
  // const dispatch = useDispatch();
  // const { apiFetch } = useApiFetch()
  const handleSelectSave = async (option) => {
    console.log("Selected option:", option);
    resetSelection();

    onClose();
    // navigation.navigate('SROnboardingForm',
    //   {
    //     formType: option === 'DB Onboarding' ? 'Db Onboarding' : 'Sub Db Onboarding',
    //     title: option === 'DB Onboarding' ? 'DB Onboarding Form' : 'Sub DB Onboarding Form '
    //   });
    navigation.navigate('SROnboardingForm',
      {
        formType: option === 'DB Onboarding' ? 'Db Onboarding' : 'Sr Onboarding',
        title: option === 'DB Onboarding' ? 'DB Scouting Form' : 'SR Scouting Form'
      });

  }


  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Prospecting/Vacant SR DB-Visit</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.container}>
              <Text style={styles.title}>Choose an option:</Text>

              {options.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.radioContainer}
                  onPress={() => handleSelect(option)}
                >
                  <View style={styles.radioOuter}>
                    {selectedOption === option && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.label}>{option === 'DB Onboarding' ? 'DB Scouting' : option === 'SR Onboarding' ? 'SR Scouting' : ''}</Text>
                </TouchableOpacity>
              ))}

              {/* {selectedOption && (
              <Text style={styles.selectedText}>Selected: {selectedOption}</Text>
            )} */}
            </View>
          </ScrollView>






          <View style={styles.footerRow}>
            <TouchableOpacity onPress={() => {
              resetSelection();
              onClose();
            }} style={styles.buttonWrap} activeOpacity={0.8}>
              <LinearGradient colors={Gradients.primary} style={styles.button}>
                <Text style={styles.buttonText}>Cancel</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSelectSave(selectedOption)}
              disabled={!selectedOption || loading}   //  disable jab tak option select na ho ya loading true ho
              style={[
                styles.buttonWrap,
                (!selectedOption || loading) && { opacity: 0.5 } // grey look jab disable ho
              ]}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={Gradients.primary}
                style={styles.button}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Saving...' : 'Save'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Saving Visits...</Text>
        </View>
      )}
    </Modal>
  );
};

export default ProspectingModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(33, 91, 204, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "92%",
    height: "60%",
    backgroundColor: "#fff",
    borderRadius: 13,
    padding: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 17,
    color: '#0B0B0B',
  },
  distributorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f7fc",
    padding: 11,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Gradients.primary[1] + "24",
  },
  distributorName: {
    fontSize: 15,
    fontWeight: "600",
    color: '#0B0B0B',
  },
  srTable: {
    marginTop: 5,
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Gradients.primary[1] + "15",
    paddingBottom: 2,
    marginHorizontal: 2,
  },
  srRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Gradients.primary[0] + "13",
  },
  selectedRow: {
    backgroundColor: Gradients.primary[0] + "12",
    borderRadius: 4,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    paddingHorizontal: 8,
  },
  buttonWrap: {
    flex: 1,
    marginHorizontal: 5,
  },
  button: {
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 13,            // match your modal’s corners
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },



  container: {
    padding: 20,
    justifyContent: 'flex-start',
  },
  title: {
    color: 'black',
    fontSize: 16,
    marginBottom: 16,
    fontWeight: '600',
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  radioOuter: {
    height: 16,
    width: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B5BB5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioInner: {
    height: 8,
    width: 8,
    borderRadius: 6,
    backgroundColor: '#3B5BB5',
  },
  label: {
    fontSize: 16,
    color: '#333'
  },
  selectedText: {
    marginTop: 20,
    fontSize: 16,
    fontStyle: 'italic',
    color: '#333',
  },
});