import { StyleSheet, Dimensions } from 'react-native';
const { width: screenWidth } = Dimensions.get('window');
 
export const getScrollableCalendarStyle = () => StyleSheet.create({
   wrapper: {
    marginTop: 12,
  },
  dateContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 56,
    height: 58,
    borderRadius: 12,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDateContainer: {
    backgroundColor: '#fff',
     width: 60,
    height: 61,
 
  },
  dayText: {
    color: '#E8D5A3',
    fontSize: 14,
    fontWeight: '500',
  },
  dateText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectedText: {
    color: '#A67C2E',
  },
});