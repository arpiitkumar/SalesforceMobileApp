import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  reloadKey: Date.now(),     // forces remount
  lastSyncedAt: null,        // optional: for screens that want to listen
};

const appReloadSlice = createSlice({
  name: 'appReload',
  initialState,
  reducers: {
    triggerAppReload(state) {
      const now = Date.now();
      state.reloadKey = now;
      state.lastSyncedAt = now;
    },
  },
});

export const { triggerAppReload } = appReloadSlice.actions;
export default appReloadSlice.reducer;
