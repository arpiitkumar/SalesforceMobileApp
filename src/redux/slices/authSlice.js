import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  userId: null,
  accessToken: null,
  communityId: null,
  communityUrl: null,
  instanceUrl: null,
  refreshToken: null,
  orgId: null,
  sessionTime: null,
  isOtpVerified: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      state.userId = action.payload.userId;
      state.accessToken = action.payload.accessToken;
      state.communityId = action.payload.communityId;
      state.communityUrl = action.payload.communityUrl;
      state.instanceUrl = action.payload.instanceUrl;
      state.refreshToken = action.payload.refreshToken;
      state.orgId = action.payload.orgId;
      state.sessionTime = action.payload.sessionTime;
    },
    logout: (state) => {
      state.userId = null;
      state.accessToken = null;
      state.communityId = null;
      state.communityUrl = null;
      state.instanceUrl = null;
      state.refreshToken = null;
      state.orgId = null;
      state.sessionTime = null;
      state.isOtpVerified = false;
    },
    setOtpVerified: (state, action) => {
      state.isOtpVerified = action.payload;
    },
  },
});

export const { loginSuccess, logout, setOtpVerified } = authSlice.actions;
export default authSlice.reducer;
