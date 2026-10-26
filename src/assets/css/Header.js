import { StyleSheet, Platform, StatusBar } from 'react-native';
 
export const getHeaderStyle = () => StyleSheet.create({
  // safeArea: { backgroundColor: '#0047AB' },
  container: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 20,
    paddingBottom: 20,
    Height: 400,
    borderBottomRightRadius: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 0,
  },
   badge: {
    position: 'absolute',
    top: -8,
    right: -7,
    minWidth: 22,
    height: 22,
    borderRadius: 16,
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    // paddingHorizontal: 3,
  },
 
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
   
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 10,
    height: 40,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    fontWeight:'400',
    // backgroundColor:'red',
   paddingVertical:0
  },
  searchIcon: {
    marginLeft: 12,
  },
  iconButton: {
    marginLeft: 16,
    backgroundColor: 'white',
    borderRadius: 50,
    padding: 6,
   
  },
  dropdown: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
  },
  modalLabel: {
    marginBottom: 6,
    color: '#555',
    fontSize: 14,
  },
  dropdownTrigger: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 4,
},
arrowIcon: {
  marginLeft: 8,
  marginTop: 2,
},    
   
    name: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: 'normal' },
    greeting: { color: '#fff', fontSize: 13 },
    title: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 4 },
    subtitle: { color: '#fff', fontSize: 13, marginTop: 2 },
 
});
 