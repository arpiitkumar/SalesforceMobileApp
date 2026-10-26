import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { isInternetAvailable } from '../../utils/networkUtils';

const useVisitUpdateApi = () => {
  const { apiComposite } = useApiFetch();

  const VisitUpdateApi = async (dataInvoice, usersubmitAmount, invoiceTotalPaidAmount) => {
    console.log("VisitUpdateApi called with:", { dataInvoice, usersubmitAmount, invoiceTotalPaidAmount });
    try {
      const connected = await isInternetAvailable();
      let compositeResponse = null;

      let remainingPay = Number(usersubmitAmount);

      // New array for updated invoices
      const updatedInvoices = [...dataInvoice];

      for (let i = 0; i < updatedInvoices.length; i++) {
        let item = updatedInvoices[i];
        let newOutstanding = item.Outstanding_Amount__c || 0;
        let newStatus = item.Status__c || "Draft"; // keep original unless updated

        if (remainingPay >= newOutstanding) {
          // Full payment for this invoice
          remainingPay -= newOutstanding;
          newOutstanding = 0;
          newStatus = "Paid";
        } else if (remainingPay > 0) {
          // Partial payment for this invoice
          newOutstanding = newOutstanding - remainingPay;
          remainingPay = 0;
          newStatus = "Pending";
        } else {
          // No money left → don't touch further invoices
          break;
        }

        // Apply changes
        updatedInvoices[i] = {
          ...item,
          Outstanding_Amount__c: newOutstanding,
          Status__c: newStatus,
        };
      }

      // if (connected) {
      //   const compositeRequests = updatedInvoices.map((item, index) => ({
      //     method: "PATCH",
      //     url: `/services/data/v61.0/sobjects/Invoice__c/${item.Sf_Id}`,
      //     referenceId: `updateInvoice_${index}`,
      //     body: {
      //       Status__c: item.Status__c,
      //       Outstanding_Amount__c: item.Outstanding_Amount__c,
      //     },
      //   }));

      //   const visitCompositePayload = { compositeRequest: compositeRequests };
      //   console.log("visitCompositePayload", JSON.stringify(visitCompositePayload));

      //   compositeResponse = await apiComposite("POST", "composite", visitCompositePayload);
      //   console.log("Visit Update Response:", JSON.stringify(compositeResponse));
      // }

      // Update local DB
      for (let i = 0; i < updatedInvoices.length; i++) {
        const item = updatedInvoices[i];
        let is_synced = false;

        if (connected && compositeResponse?.compositeResponse) {
          const refId = `updateInvoice_${i}`;
          const resp = compositeResponse.compositeResponse.find(r => r.referenceId === refId);
          if (resp?.httpStatusCode >= 200 && resp?.httpStatusCode < 300) {
            is_synced = true;
          }
        }

        const visitLocalPayload = {
          Sf_Id: item.Sf_Id,
          // Status__c: item.Status__c,
          Outstanding_Amount__c: item.Outstanding_Amount__c,
          is_locally_changed: !is_synced,
          // is_synced: is_synced,
          is_synced: true,
        };


        await UniversalUpdateInsert({
          ObjectName: "Invoice__c",
          Type: "insert",
          data: visitLocalPayload,
        });
      }

      return { status: "success", message: "All invoices updated successfully" };
    } catch (error) {
      console.error("Error in VisitUpdateApi:", error);
      return { status: "error", message: error.message || "Something went wrong" };
    }
  };

  return { VisitUpdateApi };
};

export default useVisitUpdateApi;