import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import Entypo from '@react-native-vector-icons/entypo';
import LinearGradient from 'react-native-linear-gradient';
import { Gradients } from '../../assets/css/MasterCss.js';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert.js';

const { height } = Dimensions.get('window');

const SurveyModal = ({ visible, onClose, outlet }) => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [remarks, setRemarks] = useState('');
  const options = ['Yes', 'No'];

  const handleSubmit = () => {
    console.log('Survey Answers:', answers);
    console.log('Additional Remarks:', remarks);
    onClose();
  };

  useFocusEffect(
    useCallback(() => {
      const getData = async () => {
        try {
          const getSurveyData = await UniversalUpdateInsert({
            ObjectName: 'Survey',
            Type: 'get',
          });
          console.log('Fetched Survey:', getSurveyData);
          setQuestions(getSurveyData);
        } catch (error) {
          console.error('Error fetching survey data:', error);
        }
      };

      getData();
    }, [])
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Survey</Text>
            <TouchableOpacity onPress={onClose}>
              <Entypo name="cross" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {/* Dynamic Questions */}
            {questions.map((q, index) => (
              <View key={q.Sf_Id} style={{ marginBottom: 20 }}>
                <Text style={styles.question}>
                  {index + 1}. {q.Name} <Text style={{ color: 'red' }}>*</Text>
                </Text>

                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={styles.radioRow}
                    onPress={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.Sf_Id]: opt,
                      }))
                    }
                  >
                    <View style={styles.radioOuter}>
                      {answers[q.Sf_Id] === opt && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text style={styles.radioLabel}>{opt}</Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.separator} />
              </View>
            ))}

            {/* <Text style={styles.label}>Additional Remarks</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Type here"
              placeholderTextColor="#7A7266"
              multiline
              value={remarks}
              onChangeText={setRemarks}
            /> */}
          </ScrollView>
        </View>

        {/* Gradient Submit Button */}
        <TouchableOpacity onPress={handleSubmit} style={styles.submitWrapper}>
          <LinearGradient
            colors={Gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitButton}
          >
            <Text style={styles.submitText}>Submit</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

export default SurveyModal;

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
    maxHeight: height * 0.92,
    overflow: 'hidden',
    padding: 12,
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 0.6,
    borderColor: 'black',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '400',
    color: '#000',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  question: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 10,
    color: '#000',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#A67C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#A67C2E',
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  separator: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 14,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    color: '#555',
  },
  textInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    fontSize: 19,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  submitWrapper: {
    width: '100%',
    height: 60,
  },
  submitButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 16,
  },
});
