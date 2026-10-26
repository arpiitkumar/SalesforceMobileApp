import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  VisitId: null,
  status: null,
  date:null,
};

const checkInSlice = createSlice({
  name: 'checkIn',
  initialState,
  reducers: {
    setCheckInStatus: (state, action) => {
      state.VisitId = action.payload.VisitId;
      state.status = action.payload.status;
      state.date = action.payload.date;
    },
    clearCheckInStatus: (state) => {
      state.VisitId = null;
      state.status = null;
      state.date = null;
    },
  },
});

export const { setCheckInStatus, clearCheckInStatus } = checkInSlice.actions;
export default checkInSlice.reducer;
