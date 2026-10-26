import { StyleSheet } from 'react-native';

export const getDashboardSOStyle = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'white',
    },
    content: {
      padding: 16,
    },
    dropdown: {
      height: 50,
      borderColor: '#D9D2C3',
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: '#FFFFFF',
      marginBottom: 10,
    },
    dropdownText: {
      color: '#000',
      fontSize: 16,
    },
    dropdownPlaceholder: {
      color: '#000',
      fontSize: 16,
    },
    dropdownItemText: {
      color: '#000',
      fontSize: 16,
    },
    card: {
      backgroundColor: '#FFFFFF',
      padding: 12,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#D9D2C3',
    },
    value: {
      fontSize: 19,
      fontWeight: '700',
      color: '#000000',
    },
    subtitle: {
      fontSize: 14,
      color: '#757575',
    },
    icon: {
      width: 30,
      height: 30,
      resizeMode: 'contain',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    smallCard: {
      width: '49%',
      backgroundColor: '#FFFFFF',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#D9D2C3',
    },
    lengthCard: {
      width: '100%',
      backgroundColor: '#FFFFFF',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#D9D2C3',
      marginBottom: 10, // row spacing
    },
    cardValue: {
      fontSize: 19,
      fontWeight: '700',
      color: '#000',
    },
    cardLabel: {
      fontSize: 13,
      color: '#1F1D1A',
      marginTop: 4,
      fontWeight: '400'
    },
    arrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    arrowIcon: {
      marginLeft: 6,
    },
    arrowIconRed: {
      marginLeft: 6,
      tintColor: '#B3261E',
    },
    arrowIconGreen: {
      marginLeft: 6,
      tintColor: '#2E7D5B',
    },
    rowWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    smallCard1: {
      width: '32%',
      backgroundColor: '#FFFFFF',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#D9D2C3',
      marginBottom: 10, // row spacing
    },
    // add to your styles object
    filterWrapper: {
      // ensure parent allows children to overflow
      overflow: 'visible',
      zIndex: 9999,        // iOS stacking
      elevation: 9999,     // Android stacking
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#D9D2C3',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      elevation: 4,
      gap: 5,
      zIndex: 9999,
    },
    filterText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#A67C2E',
    },

    menuText: {
      fontSize: 14,
      color: '#333',
    },


    modalOverlay: {
      flex: 1,
      backgroundColor: 'transparent',
    },

    filterMenu: {
      position: 'absolute',
      width: 140,
      backgroundColor: '#fff',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#ddd',
      elevation: 12,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },

    menuItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
    },

    menuItemActive: {
      backgroundColor: '#eaf3ff',
    },

  });