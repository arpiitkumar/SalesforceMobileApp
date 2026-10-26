// redux/slices/selectedVisitSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = null;

const selectedVisitSlice = createSlice({
  name: 'selectedVisit',
  initialState,
  reducers: {
    setSelectedVisit: (state, action) => action.payload,
    clearSelectedVisit: () => null,
  },
});

export const { setSelectedVisit, clearSelectedVisit } = selectedVisitSlice.actions;
export default selectedVisitSlice.reducer;
