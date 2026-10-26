import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { isInternetAvailable } from '../../utils/networkUtils';
 
const useOrderWithInvoicApi = () => {
  const { apiComposite } = useApiFetch();
 
  const OrderWithInvoicApi = async (invoice, sumSalesReturnValues) => {
    // console.log("OrderWithInvoicApi called with invoice:", invoice);
    // console.log("sumSalesReturnValues:", sumSalesReturnValues);
  
    try {
      const connected = await isInternetAvailable();
      let compositeResponse = null;
 
      // let adjustedReturn = 0;
      // if (sumSalesReturnValues <= invoice.Outstanding_Amount__c) {
      //   adjustedReturn = sumSalesReturnValues;
      // } else {
      //   adjustedReturn = invoice.Outstanding_Amount__c;
      // }
 
      // let outstanding = (invoice.Outstanding_Amount__c - adjustedReturn) ;
 
      // let statusVal = outstanding === 0 ? "Paid" : "Pending";
 
      if (connected) {
        const compositeRequests = [{
          method: "PATCH",
          url: `/services/data/v61.0/sobjects/Invoice__c/${invoice.id}`,
          referenceId: "updateInvoice_0",
          body: {
            Return_Submitted__c: true,
            // Return_Adjusted_Against_Outstanding__c: adjustedReturn,
            // Total_Sales_Return_Value__c: sumSalesReturnValues,
            // Status__c: statusVal,
          },
        }];
 
        const visitCompositePayload = { compositeRequest: compositeRequests };
        console.log("visitCompositePayload", JSON.stringify(visitCompositePayload));
 
        compositeResponse = await apiComposite("POST", "composite", visitCompositePayload);
        console.log("Invoice Update Response:", JSON.stringify(compositeResponse));
      }
 
      // 🔹 Default false
      let is_synced = false;
 
      if (connected && compositeResponse?.data?.compositeResponse) {
        const resp = compositeResponse.data.compositeResponse.find(r => r.referenceId === "updateInvoice_0");
        if (resp?.httpStatusCode >= 200 && resp?.httpStatusCode < 300) {
          is_synced = true;
        }
      }
      
 
      // 🔹 Save in local DB also
      const visitLocalPayload = {
        Sf_Id: invoice.id,
        Return_Submitted__c: true,
        // Return_Adjusted_Against_Outstanding__c: adjustedReturn,
        // Outstanding_Amount__c: outstanding,
        // Total_Sales_Return_Value__c: sumSalesReturnValues,
        // Status__c: statusVal,
        is_locally_changed: !is_synced,
        is_synced: is_synced,
      };
 
      // console.log("visitLocalPayload", visitLocalPayload);
 
      await UniversalUpdateInsert({
        ObjectName: "Invoice__c",
        Type: "insert",
        data: visitLocalPayload,
      });
 
      return { status: "success", message: "Invoice updated successfully" };
    } catch (error) {
      console.error("Error in OrderWithInvoicApi:", error);
      return { status: "error", message: error.message || "Something went wrong" };
    }
  };
 
  return { OrderWithInvoicApi };
};
 
export default useOrderWithInvoicApi;