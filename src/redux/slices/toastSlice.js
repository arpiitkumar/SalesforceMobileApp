import { createSlice } from '@reduxjs/toolkit';

const toastSlice = createSlice({
  name: 'toast',
  initialState: {
    visible: false,
    message: '',
    type: 'success', // 'success' | 'error' | 'warning'
    modalVisible: false,
    modalMessage: '',
    modalType: 'success',
    sessionExpiredVisible: false,
  },
  reducers: {
    showToast: (state, action) => {
      state.visible = true;
      state.message = action.payload.message;
      state.type = action.payload.type || 'success';
    },
    hideToast: (state) => {
      state.visible = false;
      state.message = '';
      state.type = 'success';
    },
    showModalToast: (state, action) => {
      state.modalVisible = true;
      state.modalMessage = action.payload.message;
      state.modalType = action.payload.type || 'success';
    },
    hideModalToast: (state) => {
      state.modalVisible = false;
      state.modalMessage = '';
      state.modalType = 'success';
    },
    showSessionExpired: (state) => {
      state.sessionExpiredVisible = true;
    },
    hideSessionExpired: (state) => {
      state.sessionExpiredVisible = false;
    },
  },
});

export const {
  showToast,
  hideToast,
  showModalToast,
  hideModalToast,
  showSessionExpired,
  hideSessionExpired,
} = toastSlice.actions;
export default toastSlice.reducer;
