// store.js or store.ts
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistReducer, persistStore } from 'redux-persist';
import authReducer from './slices/authSlice';
import beatReducer from './slices/beatSlice';
import toastReducer from './slices/toastSlice';
import deviceReducer from './slices/deviceSlice';
import appReducer from './slices/appNavigationSlice';
import selectedAccountReducer from './slices/selectedAccountSlice';
import selectedVisitReducer from './slices/selectedVisitSlice';
import checkInReducer from './slices/checkInSlice';
import selectedBeatDayReducer from './slices/selectedBeatDaySlice';
import soVisitReducer from './slices/soVisitSlice'
import searchReducer from './slices/searchSlice';
import beatSelectionReducer from './slices/beatSelectionSlice';
import distributorReducer from './slices/distributorSlice';
import appReloadReducer from './slices/appReloadSlice';
import routePlanReducer from './slices/routePlanSlice';

// Config for auth persistence
const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
};

const combinedReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  beat: beatReducer,
  toast: toastReducer,
  device: deviceReducer,
  app: appReducer,
  selectedAccount: selectedAccountReducer,
  selectedVisit: selectedVisitReducer,
  checkIn: checkInReducer,
  selectedBeatDay: selectedBeatDayReducer,
  soVisit: soVisitReducer, 
  search: searchReducer,
  beatSelection: beatSelectionReducer,
   distributor: distributorReducer,
   appReload: appReloadReducer,
  routePlan: routePlanReducer,
});

// Root reducer with reset logic
const rootReducer = (state, action) => {
  if (action.type === 'auth/logout') {
    // Clear persisted storage manually
    AsyncStorage.clear(); // optional: only if you want to wipe everything
    state = undefined; // This resets all reducers
  }

  return combinedReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);

// Types for hooks
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
