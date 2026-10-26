import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  type: null,
};

const soVisitSlice = createSlice({
  name: 'soVisit',
  initialState,
  reducers: {
    setSoVisitStatus: (state, action) => {
      state.type = action.payload.type;
    },
    SoVisitStatus: (state) => {
      state.type = null;
    },
  },
});

export const { setSoVisitStatus, SoVisitStatus } = soVisitSlice.actions;
export default soVisitSlice.reducer;
