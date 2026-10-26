import { createSlice } from '@reduxjs/toolkit';

const initialState = {
 loginStatus: false
};

const deviceSlice = createSlice({
  name: 'device',
  initialState,
  reducers: {
    setLoginStatus: (state, action) => {
      state.loginStatus = action.payload.loginStatus;
      
    },
 
  },
});

export const { setLoginStatus} = deviceSlice.actions;
export default deviceSlice.reducer;
