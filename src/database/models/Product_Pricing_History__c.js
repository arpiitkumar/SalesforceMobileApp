import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Product_Pricing_History__c extends Model {
  static table = "Product_Pricing_History__c";

  @field("Sf_Id") sfId;
  @field("Fraction__c") fraction__c;
  @field("PTD_PTSS__c") pTD_PTSS__c;
  @field("Amount__c") amount__c;
  @field("PTR__c") pTR__c;
  @field("Condition_type__c") condition_type__c;
  @field("Division__c") division__c;
  @field("Distribution_Channel__c") distribution_Channel__c;
  @field("Customer_Group__c") customer_Group__c;
  @field("Customer_Price_Group__c") customer_Price_Group__c;
  @field("IsActive__c") isActive__c;
  @field("Valid_From__c") valid_From__c;
  @field("Valid_To__c") valid_To__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    fraction__c: "Fraction__c",
    pTD_PTSS__c: "PTD_PTSS__c",
    amount__c: "Amount__c",
    pTR__c: "PTR__c",
    condition_type__c: "Condition_type__c",
    division__c: "Division__c",
    distribution_Channel__c: "Distribution_Channel__c",
    customer_Group__c: "Customer_Group__c",
    customer_Price_Group__c: "Customer_Price_Group__c",
    isActive__c: "IsActive__c",
    valid_From__c: "Valid_From__c",
    valid_To__c: "Valid_To__c",

    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  @field("ErrorMsg") errorMsg;
}
