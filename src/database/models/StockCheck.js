import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class StockCheck extends Model {
  static table = "Stock_Check__c";

  @field("Sf_Id") sfId;

  @field("Name") name;
  @field("Visit__c") visit;
  @field("Account__c") account;
  @field("SKU__c") sku;
  @field("Stock_Check_Date__c") stockCheckDate;
  @field("CreatedDate") createdDate;
  @field("Checked_By__c") checkedBy;
  @field("Persona__c") persona;
  @field("Visit_Date__c") visitDate;

  @field("Opening_Stock_Qty__c") openingStockQty;
  @field("Opening_MT__c") openingMT;
  @field("Opening_Value__c") openingValue;

  @field("Primary_Stock_Qty__c") primaryStockQty;
  @field("Primary_MT__c") primaryMT;
  @field("Primary_Value__c") primaryValue;

  @field("Secondary_Stock_Qty__c") secondaryStockQty;
  @field("Secondary_MT__c") secondaryMT;
  @field("Secondary_Value__c") secondaryValue;

  @field("Current_Stock_Qty__c") currentStockQty;
  @field("Current_Stock_MT__c") currentStockMT;
  @field("Current_Stock_Value__c") currentStockValue;

  @field("Today_Secondary_Sales_Qty__c") todaySecondarySalesQty;
  @field("Today_Secondary_Sales_MT__c") todaySecondarySalesMT;
  @field("Today_Secondary_Sales_Value__c") todaySecondarySalesValue;

  @field("Closing_Stock_Qty__c") closingStockQty;
  @field("Closing_MT__c") closingMT;
  @field("Closing_Value__c") closingValue;

  @field("Available__c") available;
  @field("Not_Available__c") notAvailable;
  @field("Beat_Day__c") beatDay;

  @field("ProductName__c") productName__c;
  @field("Expiration_Date__c") expiration_Date__c;
  @field("Facing__c") facing__c;
  @field("Photo__c") photo__c;
  @field("Quantity__c") quantity__c;
  @field("Oil_Type__c") oil_Type__c;
  @field("Category__c") category__c;
  @field("UOM__c") uom__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;

  static columns = {
    sfId: "Sf_Id",

    name: "Name",
    visit: "Visit__c",
    account: "Account__c",
    sku: "SKU__c",
    stockCheckDate: "Stock_Check_Date__c",
    createdDate: "CreatedDate",
    checkedBy: "Checked_By__c",
    persona: "Persona__c",
    visitDate: "Visit_Date__c",

    openingStockQty: "Opening_Stock_Qty__c",
    openingMT: "Opening_MT__c",
    openingValue: "Opening_Value__c",

    primaryStockQty: "Primary_Stock_Qty__c",
    primaryMT: "Primary_MT__c",
    primaryValue: "Primary_Value__c",

    secondaryStockQty: "Secondary_Stock_Qty__c",
    secondaryMT: "Secondary_MT__c",
    secondaryValue: "Secondary_Value__c",

    currentStockQty: "Current_Stock_Qty__c",
    currentStockMT: "Current_Stock_MT__c",
    currentStockValue: "Current_Stock_Value__c",

    todaySecondarySalesQty: "Today_Secondary_Sales_Qty__c",
    todaySecondarySalesMT: "Today_Secondary_Sales_MT__c",
    todaySecondarySalesValue: "Today_Secondary_Sales_Value__c",

    closingStockQty: "Closing_Stock_Qty__c",
    closingMT: "Closing_MT__c",
    closingValue: "Closing_Value__c",

    available: "Available__c",
    notAvailable: "Not_Available__c",
    beatDay: "Beat_Day__c",

    productName__c: "ProductName__c",
    expiration_Date__c: "Expiration_Date__c",
    facing__c: "Facing__c",
    photo__c: "Photo__c",
    quantity__c: "Quantity__c",
    oil_Type__c: "Oil_Type__c",
    category__c: "Category__c",
    uom__c: "UOM__c",

    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    errorMsg: "ErrorMsg",
  };

  @field("ErrorMsg") errorMsg;
}
