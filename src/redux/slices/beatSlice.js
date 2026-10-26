import { createSlice } from '@reduxjs/toolkit';
import moment from 'moment';

const initialState = {
  selectedDateBeat: moment().format('YYYY-MM-DD'), // current date in YYYY-MM-DD
};

const beatSlice = createSlice({
  name: 'beat',
  initialState,
  reducers: {
    beatReducer: (state, action) => {
      state.selectedDateBeat = action.payload.date;
    },
  },
});

export const { beatReducer } = beatSlice.actions;
export default beatSlice.reducer;
