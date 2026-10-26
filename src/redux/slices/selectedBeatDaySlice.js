import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// 1. Define the interface for the selected beat day object
interface SelectedBeatDay {
  Avg_Time_PC__c: string;
  Avg_Time_Spent_in_OL_for_Calls__c: string;
  BeatDate__c: string;
  Beat__Id: string;
  Beat__Name: string;
  Beat__c: string;
  Changed_Beat__c: string;
  EOD_Comment__c: string;
  End_Of_Day_Time__c: string;
  First_Call_Time__c: string;
  First_SCA_Time__c: string;
  Last_Last_Time__c: string;
  Last_SCA_Time__c: string;
  No_of_SCA_Done_in_Schedule_Beat__c: number;
  No_of_SCA_Done_through_Other_Beat__c: number;
  Non_PJP_Outlet_Visited__c: number;
  Non_PJP_Productive_Call__c: number;
  Non_PJP_TC__c: number;
  Non_Productive_Calls__c: number;
  Not_Visited_Outlets__c: number;
  PJP_Beat_Outlets__c: number;
  PJP_Outlet_Visited__c: number;
  Planned_Beat__c: string;
  Planned_Outlets_Coverage__c: string;
  PlannedOutlets__c: number;
  Productive_Calls_Duration__c: string;
  Productive_Calls__c: number;
  Productivity__c: string;
  Sec_Order_Qty_Pcs__c: number;
  Sec_Order_Value__c: string;
  Secondary_Order_Qty_in_KG: string;
  Secondary_Order_Qty_in_Value: string;
  Sf_Id: string;
  TC_After_6PM__c: number;
  TC_Till_12PM__c: number;
  TC_Till_3PM__c: number;
  TC_Till_6PM__c: number;
  Time_Spent_On_Field_c: string;
  Total_Distance_Travelled_KM__c: string;
  Total_Time_in_Outlet__c: string;
  Tour_Plan__c: string;
  _changed: string;
  _status: string;
  id: string;
  is_locally_changed: boolean;
  is_synced: boolean;
  last_modified: number;
  operation_type: string;
}

// 2. Define state type
interface SelectedBeatDayState {
  selectedBeatDay: SelectedBeatDay | null;
}

// 3. Initial state
const initialState: SelectedBeatDayState = {
  selectedBeatDay: null,
};

// 4. Slice creation
const selectedBeatDaySlice = createSlice({
  name: 'selectedBeatDay',
  initialState,
  reducers: {
    setSelectedBeatDay: (state, action: PayloadAction<SelectedBeatDay>) => {
      state.selectedBeatDay = action.payload;
    },
    clearSelectedBeatDay: (state) => {
      state.selectedBeatDay = null;
    },
  },
});

export const { setSelectedBeatDay, clearSelectedBeatDay } = selectedBeatDaySlice.actions;
export default selectedBeatDaySlice.reducer;
