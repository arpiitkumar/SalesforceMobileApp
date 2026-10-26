import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  routePlans: [],
};

const routePlanSlice = createSlice({
  name: 'routePlan',
  initialState,
  reducers: {
    setRoutePlans: (state, action) => {
      state.routePlans = action.payload;
    },
    clearRoutePlans: (state) => {
      state.routePlans = [];
    },
  },
});

export const { setRoutePlans, clearRoutePlans } = routePlanSlice.actions;
export default routePlanSlice.reducer;
