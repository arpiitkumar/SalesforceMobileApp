import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class MT_Exception extends Model {
  static table = "MT_Exception__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    category: "Category__c",
    exceptionDate: "ExceptionDate__c",
    issueType: "IssueType__c",
    location: "Location__c",
    merchandiser: "Merchandiser__c",
    product: "Product__c",
    remarks: "Remarks__c",
    retailer: "Retailer__c",
    status: "Status__c",
    image: "Image__c",
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  @field("Sf_Id") sfId;
  @field("Name") name;
  @field("Category__c") category;
  @field("ExceptionDate__c") exceptionDate;
  @field("IssueType__c") issueType;
  @field("Location__c") location;
  @field("Merchandiser__c") merchandiser;
  @field("Product__c") product;
  @field("Remarks__c") remarks;
  @field("Retailer__c") retailer;
  @field("Status__c") status;
  @field("Image__c") image;

  // Sync-related fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  @field("ErrorMsg") errorMsg;
}
