import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class CompetitorLineItem extends Model {
  static table = "Competitor_LineItem__c";

  static columns = {
    sfId: "Sf_Id",
    activity: "Activity__c",
    competitor: "Competitor__c",
    grammage: "Grammage__c",
    grammageBeforePromotion: "Grammage_Before_Promotion__c",
    mrp: "MRP__c",
    oilType: "OilType__c",
    photo: "Photo__c",
    productName: "Product_Name__c",
    promotion: "Promotion__c",
    remarks: "Remarks__c",
    sellingPrice: "Selling_Price__c",
    type: "Type__c",
    merchandiser: "Merchandiser__c",
    customer: "Customer__c",
    category__c: "Category__c",
    name: "Name",
    product__c: "Product__c",
    sub_Category__c: "Sub_Category__c",
    price_MT__c: "Price_MT__c",
    state__c: "State__c",
    city__c: "City__c",
    vertical__c: "Vertical__c",
    date__c: "Date__c",
    pTD__c: "PTD__c",
    grammage_Type__c: "Grammage_Type__c",

    // Sync fields
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  // Core fields
  @field("Sf_Id") sfId;
  @field("Activity__c") activity;
  @field("Competitor__c") competitor;
  @field("Grammage__c") grammage;
  @field("Grammage_Before_Promotion__c") grammageBeforePromotion;
  @field("MRP__c") mrp;
  @field("Photo__c") photo;
  @field("Product_Name__c") productName;
  @field("Promotion__c") promotion;
  @field("Remarks__c") remarks;
  @field("Selling_Price__c") sellingPrice;
  @field("Type__c") type;
  @field("Merchandiser__c") merchandiser;
  @field("Customer__c") customer;
  @field("Category__c") category__c;
  @field("Sub_Category__c") sub_Category__c;
  @field("Name") name;
  @field("Price_MT__c") price_MT__c;
  @field("Product__c") product__c;
  @field("State__c") state__c;
  @field("City__c") city__c;
  @field("Vertical__c") vertical__c;
  @field("Date__c") date__c;
  @field("PTD__c") pTD__c;
  @field("OilType__c") oilType;
  @field("Grammage_Type__c") grammage_Type__c;

  // Sync fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  @field("ErrorMsg") errorMsg;
}
