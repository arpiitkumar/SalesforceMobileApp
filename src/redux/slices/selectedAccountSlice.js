// store/slices/selectedAccountSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SelectedAccount {
  Sf_Id: string;
  Name: string;
  Phone?: string;
  BillingAddress?: string;
  OTPVerified__c?: string;
  BillingLatitude__c?: number;
  BillingLongitude__c?: number;
  Class__c?: string;
  Channel__c?: string;
  CreditLimit__c?: number;
  // Add more fields as needed
}

interface SelectedAccountState {
  selectedAccount: SelectedAccount | null;
}

const initialState: SelectedAccountState = {
  selectedAccount: null,
};

const selectedAccountSlice = createSlice({
  name: 'selectedAccount',
  initialState,
  reducers: {
    setSelectedAccount: (state, action: PayloadAction<SelectedAccount>) => {
      state.selectedAccount = action.payload;
    },
    clearSelectedAccount: (state) => {
      state.selectedAccount = null;
    },
  },
});

export const { setSelectedAccount, clearSelectedAccount } = selectedAccountSlice.actions;

export default selectedAccountSlice.reducer;
