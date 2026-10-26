// styles.js
import { StyleSheet } from "react-native";
 
export const CustomTabBarStyle =()=> StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical:15,
    backgroundColor: 'white',
    position: 'absolute',
    width: '100%',
    bottom: 0,
    elevation: 10,
    borderTopColor: '#F4F6F9',
    borderTopWidth: 0.9,
    shadowColor: '#000',
  },
  tabItem: {
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C9A24D',
    marginTop: 4,
  },
   tabLabel: {
    fontSize: 10,
    color: '#6E7A8A',
    marginTop: 4,
    fontWeight: '400',
  },
  tabLabelFocused: {
    color: '#A67C2E',
    fontWeight: '600',
  },
  
});
 
 
 