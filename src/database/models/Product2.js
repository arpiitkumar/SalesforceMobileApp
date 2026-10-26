import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Product2 extends Model {
  static table = "Product2";
  @field("Sf_Id") sfId;
  @field("PTR__c") ptr;
  @field("PTD__c") ptd;
  @field("SGST__c") sgst;
  @field("CGST__c") cgst;
  @field("PriceBookId") priceBookId;
  @field("PriceBookMainId") priceBookMainId;
  @field("MRP__c") mRP__c;
  @field("UnitperCase__c") unitPerCase;
  @field("Name") name;
  @field("Brand__c") brand;
  @field("Category__c") category;
  @field("SubCategory__c") subCategory;
  @field("SKUCodeinDMS__c") skuCodeInDms;
  @field("ProductCode__c") productCode;
  @field("Name__c") name__c;
  @field("Variant__c") variant;
  @field("GSTPercentage__c") gstPercentage;
  @field("UnitperCase__c") unitPerCase;
  @field("WeightKG__c") weightKg;
  @field("WeightMT__c") weightMt;
  @field("IsActive") isActive;
  @field("ProductImageURL__c") productImageUrl;
  @field("Active_in_SFA__c") activeInSfa;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    ptr: "PTR__c",
    ptd: "PTD__c",
    sgst: "SGST__c",
    cgst: "CGST__c",
    priceBookId: "PriceBookId",
    priceBookMainId: "PriceBookMainId",
    mRP__c: "MRP__c",
    unitPerCase: "UnitperCase__c",
    name: "Name",
    brand: "Brand__c",
    category: "Category__c",
    subCategory: "SubCategory__c",
    skuCodeInDms: "SKUCodeinDMS__c",
    productCode: "ProductCode__c",
    name__c: "Name__c",
    variant: "Variant__c",
    gstPercentage: "GSTPercentage__c",
    unitPerCase: "UnitperCase__c",
    weightKg: "WeightKG__c",
    weightMt: "WeightMT__c",
    isActive: "IsActive",
    productImageUrl: "ProductImageURL__c",
    activeInSfa: "Active_in_SFA__c",

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
