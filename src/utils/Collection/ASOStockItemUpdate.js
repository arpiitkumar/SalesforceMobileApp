import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { isInternetAvailable } from '../../utils/networkUtils';
import { useSelector } from 'react-redux';
import { UNITS_PER_CASE } from "../helper/caseUnits";
 
const useASOStockItemUpdate = () => {
    const { apiComposite } = useApiFetch();  // Hook called at top level of custom hook
    const selectedBeatDay = useSelector((state: RootState) => state.selectedBeatDay.selectedBeatDay);
 
    const ASOStockItemUpdate = async (cartItems) => {
        const payloads = [];
        const compositeRequests = [];
        const connected = await isInternetAvailable();
 
        for (const cartItem of cartItems) {
            console.log("Processing cartItem:",compositeRequests.length, cartItem);
            const result = await UniversalUpdateInsert({
                ObjectName: 'Stock_Check__c',
                Type: 'get',
                filters: [{ field: "SKU__c", value: cartItem.Product2Id },{ field: "Beat_Day__c", value: selectedBeatDay.Sf_Id }],
            });
 
            const produtcwheigtdata = await UniversalUpdateInsert({
                ObjectName: 'cgcloud__Unit_of_Measure__c',
                Type: 'get',
                filters: [{ field: "cgcloud__Product__c", value: cartItem.Product2Id }],
            });
 
            if (result && result.length > 0) {
                const todayDate = new Date().toISOString().split('T')[0];
                const todaysRecords = result.filter(item =>
                    item.Stock_Check_Date__c.split('T')[0] === todayDate
                );
 
                const lastRecord = todaysRecords[todaysRecords.length - 1] || null;
                if (!lastRecord) continue;
console.log("lastRecord", lastRecord);
                const existingQty = lastRecord.Today_Secondary_Sales_Qty__c || 0;
                const closingexistingQty = lastRecord.Closing_Stock_Qty__c || 0;
                const calculatedQty = cartItem.UnitMode === 'Case'
                    ? UNITS_PER_CASE * cartItem.Quantity
                    : cartItem.Quantity;
  
                    const newQty = (existingQty || 0) + (calculatedQty || 0);
                    const newClosingQty = (closingexistingQty || 0) - (calculatedQty || 0);
                    
                    console.log('newQty = ', newQty, `existingQty = ${existingQty}`, `calculatedQty = ${calculatedQty}`);
                    console.log(`newClosingQty =  ${newClosingQty} closingexistingQty = ${closingexistingQty} calculatedQty = ${calculatedQty}`);
                    
 
                const Today_Secondary_Sales_MT__c = produtcwheigtdata.length > 0
                    ? (newQty * produtcwheigtdata[0].Weight_Per_Unit_in_KG__c) / 1000
                    : newQty;
 
                const Closing_MT__c = produtcwheigtdata.length > 0
                    ? (newClosingQty * produtcwheigtdata[0].Weight_Per_Unit_in_KG__c) / 1000
                    : newClosingQty;
 
                compositeRequests.push({
                    method: "PATCH",
                    url: `/services/data/v61.0/sobjects/Stock_Check__c/${lastRecord.Sf_Id}`,
                    referenceId: `updateStock_Check_${compositeRequests.length}`,
                    body: {
                        Today_Secondary_Sales_Qty__c: newQty,
                        Today_Secondary_Sales_MT__c,
                        Today_Secondary_Sales_Value__c: newQty * cartItem.PTR__c,
                        Closing_Stock_Qty__c: newClosingQty,
                        Closing_MT__c,
                        Closing_Value__c: newClosingQty * cartItem.PTR__c,
                    }
                });
 
                payloads.push({
                    Sf_Id: lastRecord.Sf_Id,
                    Today_Secondary_Sales_Qty__c: newQty,
                    Today_Secondary_Sales_MT__c,
                    Today_Secondary_Sales_Value__c: newQty * cartItem.PTR__c,
                    Closing_Stock_Qty__c: newClosingQty,
                    Closing_MT__c,
                    Closing_Value__c: newClosingQty * cartItem.PTR__c,
                    is_locally_changed: true,
                    is_synced: false,
                    sync_status: 'unsynced',
                });
            }
        }
 
        let is_synced = false;
        console.log("Connected:", JSON.stringify({ compositeRequest: compositeRequests, allOrNone: true }));
        if (connected && compositeRequests.length > 0) {
            const compositePayload = { compositeRequest: compositeRequests, allOrNone: true };
            const compositeResponse = await apiComposite("POST", "composite", compositePayload);
            console.log("Composite Response:", JSON.stringify(compositeResponse));
        
            if (compositeResponse?.data?.compositeResponse) {
                is_synced = compositeResponse.data.compositeResponse.every(
                    r => r.httpStatusCode >= 200 && r.httpStatusCode < 300
                );
            }
        }
        
 
        for (const pl of payloads) {
            await UniversalUpdateInsert({
                ObjectName: "Stock_Check__c",
                Type: "insert",
                data: { ...pl, is_locally_changed: !is_synced, is_synced }
            });
            console.log("Stock_Check__c payload", { ...pl, is_locally_changed: !is_synced, is_synced });
        }
 
        return { status: "success", message: "Cart processed successfully", is_synced };
    };
 
    return { ASOStockItemUpdate };
};
 
export default useASOStockItemUpdate;