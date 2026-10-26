import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { isInternetAvailable } from '../../utils/networkUtils';
import { InsertNSyncLog } from '../InsertNSyncLog';

const useOrderWithInvoicApi = () => {
  const { apiComposite } = useApiFetch();

  // Merge items
  const mergeItemsByInvoiceId = (items) => {
    const map = {};

    items.forEach(item => {
      const key = item.invoiceItemId;

      if (!map[key]) {
        map[key] = {
          ...item,
          quantity: Number(item.quantity || 0),
          returnqty: Number(item.returnqty || 0)
        };
      } else {
        map[key].quantity += Number(item.quantity || 0);
        map[key].returnqty += Number(item.returnqty || 0);
      }
    });

    return Object.values(map);
  };

  const OrderWithInvoicApi = async (invoice, items) => {
    console.log("OrderWithInvoicApi called with invoice:", invoice);

    // STEP 1: Merge duplicate invoice items
    const mergedItems = mergeItemsByInvoiceId(items);
    console.log("Merged Items:", mergedItems);

    try {
      const connected = await isInternetAvailable();
      let compositeResponse = null;
      let compositeRequests = [];

      if (connected) {
        // STEP 2: API Items update first
        mergedItems.forEach((item, index) => {
          compositeRequests.push({
            method: "PATCH",
            url: `/services/data/v61.0/sobjects/Invoice_Item__c/${item.invoiceItemId}`,
            referenceId: `updateItem_${index}`,
            body: {
              Return_Quantity_in_Pcs__c: item.returnqty + item.quantity,
            }
          });
        });

        const payload = { compositeRequest: compositeRequests };
        console.log("Composite Payload:", JSON.stringify(payload));

        // API hit
        compositeResponse = await apiComposite("POST", "composite", payload);
        console.log("Composite Response:", JSON.stringify(compositeResponse));
      }

      // STEP 3: Local update → Items
      for (let item of mergedItems) {
        const success = (connected && compositeResponse != null);

        const itemLocalPayload = {
          Sf_Id: item.invoiceItemId,
          Return_Quantity_in_Pcs__c: item.returnqty + item.quantity,
          is_locally_changed: success ? false : true,
          is_synced: success ? true : false,
        };
        // console.log("Item Local Payload:", itemLocalPayload);
        await UniversalUpdateInsert({
          ObjectName: "Invoice_Item__c",
          Type: "insert",
          data: itemLocalPayload,
        });
      }

      // STEP 4: Fetch updated invoice items from Local DB
      const afterUpdateItems = await UniversalUpdateInsert({
        ObjectName: "Invoice_Item__c",
        Type: "get",
        filters: [
          { field: "Invoice__c", value: invoice.id }
        ]
      });
      console.log("afterUpdategetinvoiceitem", afterUpdateItems);

      // STEP 5: Check if all items return fully
      const allReturned = afterUpdateItems.every(item =>
        Number(item.InvoiceQuantityPcs__c) === Number(item.Return_Quantity_in_Pcs__c)
      );

      console.log("allReturned?", allReturned);

      // STEP 6: Only update Invoice if all items are fully returned
      if (allReturned) {
        console.log("All items fully returned → Invoice update allowed");

        // Prepare invoice update
        let isInvoiceSynced = false;

        if (connected) {
          const invoiceReq = {
            method: "PATCH",
            url: `/services/data/v61.0/sobjects/Invoice__c/${invoice.id}`,
            referenceId: "updateInvoiceFinal",
            body: {
              Return_Submitted__c: true,
            }
          };

          console.log("Invoice update payload:", invoiceReq);

          // Optional API Hit
          const invoiceComposite = await apiComposite("POST", "composite", { compositeRequest: [invoiceReq] });

          if (invoiceComposite.data?.compositeResponse?.[0]?.httpStatusCode === 204) {
            isInvoiceSynced = true;
          }
        }

        // Local DB update for Invoice
        await UniversalUpdateInsert({
          ObjectName: "Invoice__c",
          Type: "insert",
          data: {
            Sf_Id: invoice.id,
            Return_Submitted__c: true,
            is_locally_changed: connected ? false : true,
            is_synced: connected ? true : false
          }
        });

      } else {
        console.log(" Not all items fully returned → Invoice update skipped");
      }

      return { status: "success", message: "Invoice / Items processed successfully" };

    } catch (error) {
      console.error("Error in OrderWithInvoicApi:", error);
      InsertNSyncLog({ endpoint: '/services/data/v61.0/composite', requestBody: {}, responseBody: { message: error.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
      return { status: "error", message: error.message };
    }
  };

  return { OrderWithInvoicApi };
};

export default useOrderWithInvoicApi;
