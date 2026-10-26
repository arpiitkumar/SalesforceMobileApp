import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import moment from 'moment';
import { useDispatch } from 'react-redux';
import { beatReducer } from '../redux/slices/beatSlice';
import { getScrollableCalendarStyle } from '../assets/css/ScrollableCalendar.js';
 
const { width: screenWidth } = Dimensions.get('window');
 
const ScrollableCalendar = () => {
  const styles = getScrollableCalendarStyle();
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [dates, setDates] = useState([]);
  const scrollViewRef = useRef(null);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
 
  const dispatch = useDispatch();
 
  useEffect(() => {
    dispatch(
      beatReducer({
        date: selectedDate,
      })
    );
  }, [selectedDate]);
 
  useEffect(() => {
    generateDates();
  }, []);
 
  // Scroll when layout is ready and dates are set
  useEffect(() => {
    if (isLayoutReady && dates.length > 0) {
      scrollToSelectedDate();
    }
  }, [isLayoutReady, dates]);
 
  const generateDates = () => {
    const today = moment();
    const daysInMonth = today.daysInMonth();
    const datesArray = [];
 
    for (let i = 1; i <= daysInMonth; i++) {
      const date = moment().date(i);
      datesArray.push({
        fullDate: date.format('YYYY-MM-DD'),
        day: date.format('ddd'),
        dateNum: date.format('D'),
      });
    }
 
    setDates(datesArray);
  };
 
  const scrollToSelectedDate = () => {
    const index = dates.findIndex(item => item.fullDate === selectedDate);
    if (index !== -1 && scrollViewRef.current) {
      const itemWidth = 71;
      const offsetX = index * itemWidth - screenWidth / 2 + itemWidth / 2;
      scrollViewRef.current.scrollTo({
        x: Math.max(0, offsetX),
        animated: true,
      });
    }
  };
 
  const handleDatePress = (item, index) => {
    setSelectedDate(item.fullDate);
 
    // Center selected date when tapped
    const itemWidth = 70;
    const offsetX = index * itemWidth - screenWidth / 2 + itemWidth / 2;
    scrollViewRef.current?.scrollTo({ x: Math.max(0, offsetX), animated: true });
  };
 
  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 10,
          alignItems: 'center',
        }}
        onLayout={() => setIsLayoutReady(true)} // Wait until layout is complete
      >
        {dates.map((item, index) => {
          const isSelected = item.fullDate === selectedDate;
          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleDatePress(item, index)}
              style={[
                styles.dateContainer,
                isSelected && styles.selectedDateContainer,
              ]}
            >
              <Text
                style={[styles.dayText, isSelected && styles.selectedText]}
              >
                {item.day}
              </Text>
              <Text
                style={[styles.dateText, isSelected && styles.selectedText]}
              >
                {item.dateNum}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};
 
export default ScrollableCalendar;
 
 