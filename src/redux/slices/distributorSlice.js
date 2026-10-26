// src/store/distributorSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  id: null,
};
const distributorSlice = createSlice({
  name: 'distributor',
  initialState,
  reducers: {
    setDistributorId(state, action) {
      // Accepts payload = id (string | number | null)
      state.id = action.payload;
    },
    clearDistributorId(state) {
      state.id = null;
    },
  },
});

export const { setDistributorId, clearDistributorId } = distributorSlice.actions;

// Selector(s)
export const selectDistributorId = (state) => state.distributor.id;

// Default export reducer for store registration
export default distributorSlice.reducer;
