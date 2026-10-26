// redux/slices/beatSelectionSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  id: null,
  name: null,
};

const beatSelectionSlice = createSlice({
  name: 'beatSelection',
  initialState,
  reducers: {
    setBeatSelection(state, action) {
      state.id = action.payload.id ?? null;
      state.name = action.payload.name ?? null;
    },
    clearBeatSelection(state) {
      state.id = null;
      state.name = null;
    },
  },
});

export const { setBeatSelection, clearBeatSelection } = beatSelectionSlice.actions;
export default beatSelectionSlice.reducer;
