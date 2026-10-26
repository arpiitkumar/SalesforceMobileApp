// redux/slices/searchSlice.ts

import { createSlice } from '@reduxjs/toolkit';

const searchSlice = createSlice({
  name: 'search',
  initialState: {
    searchParam: '',
  },
  reducers: {
    setSearchParam: (state, action) => {
      state.searchParam = action.payload;
    },
    clearSearchParam: (state) => {
      state.searchParam = '';
    },
  },
});

export const { setSearchParam, clearSearchParam } = searchSlice.actions;
export default searchSlice.reducer;
