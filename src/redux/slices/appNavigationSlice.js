// redux/slices/appSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  dataReady: boolean;
}

const initialState: AppState = { dataReady: false };

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setDataReady: (state, action: PayloadAction<boolean>) => {
      state.dataReady = action.payload;
    },
  },
});

export const { setDataReady } = appSlice.actions;
export default appSlice.reducer;
