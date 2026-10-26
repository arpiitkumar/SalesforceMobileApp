import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Competitor__Product extends Model {
  static table = "Competitor__Product";
  @field("Sf_Id") sfId;
  @field("Name") name;
  @field("Brand__c") brand;
  @field("Category__c") category;
  @field("SubCategory__c") subCategory;
  @field("OilType__c") oilType__c;
  @field("Vertical__c") vertical__c;
  @field("IsBaseSKU__c") isBaseSKU__c;
  @field("IsActive") isActive;
  @field("ProductImageURL__c") productImageUrl;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    brand: "Brand__c",
    category: "Category__c",
    subCategory: "SubCategory__c",
    oilType__c: "OilType__c",
    vertical__c: "Vertical__c",
    isBaseSKU__c: "IsBaseSKU__c",
    isActive: "IsActive",
    productImageUrl: "ProductImageURL__c",

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
