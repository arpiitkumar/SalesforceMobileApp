import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Account extends Model {
  static table = "Account";

  @field("Sf_Id") sfId;
  @field("ParentId") parentId;
  @field("Replace_SubDb__c") replace_SubDb__c;

  @field("RecordTypeId") recordTypeId;
  @field("Account_Approve__c") account_Approve__c;
  @field("Type") type;
  @field("FSSAI_No__c") fSSAI_No__c;
  @field("Party_Code__c") partyCode;
  @field("Name") name;
  @field("Outlet_Visit_Day__c") visitDay;
  @field("Channel__c") channel;
  // @field("SubChannel__c") subChannel;
  // @field("SubChannel1__c") subChannel1;
  // @field("SubChannel2__c") subChannel2;
  @field("Class__c") outletClass;
  @field("BillingAddress") billingAddress;
  @field("Phone") phone;
  @field("Email__c") email;
  @field("PAN_Number__c") panNumber;
  @field("GSTIN_Number__c") gstNumber;
  @field("BillingLatitude") billingLatitude;
  @field("BillingLongitude") billingLongitude;
  @field("OTPVerified__c") otpVerified;
  @field("OTPVerifiedDate__c") otpVerifiedDate;
  @field("KYC_Updated__c") kycUpdated;
  @field("CreditLimit__c") creditLimit;
  @field("CreditDays__c") creditDays;
  @field("CensusCode__c") censusCode;
  // @field("Beat__c") beat;
  @field("DBType__c") dbType;
  @field("OwnerId") ownerId;
  @field("CreatedDate") createdDate;
  @field("BillingStreet") billingStreet;
  @field("BillingState") billingState;
  @field("BillingPostalCode") billingPostalCode;
  @field("BillingCity") billingCity;
  @field("BillingCountry") billingCountry;

  @field("FIFO_Done__c") fifoDone;
  @field("Active__c") isActive__c;
  // @field("Hired_Type__c") hiredType;
  @field("VIsibility__c") visibility;
  @field("Visibility_Image__c") visibilityImage;
  @field("Other_Promotion_Activity__c") otherPromotionActivity;
  // @field("Other_Promotion_Activity_2__c") otherPromotionActivity2;

  @field("Region__c") Region__c;
  @field("State__c") State__c;
  @field("ManagerId") ManagerId;
  @field("Outlet_Owner_Name__c") outlet_Owner_Name__c;
  @field("isPerfect__c") isPerfect;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    parentId: "ParentId",
    replace_SubDb__c: "Replace_SubDb__c",
    account_Approve__c: "Account_Approve__c",
    type: "Type",
    fSSAI_No__c: "FSSAI_No__c",
    recordTypeId: "RecordTypeId",
    partyCode: "Party_Code__c",
    name: "Name",
    visitDay: "Outlet_Visit_Day__c",
    channel: "Channel__c",
    // subChannel: "SubChannel__c",
    // subChannel1: "SubChannel1__c",
    // subChannel2: "SubChannel2__c",
    outletClass: "Class__c",
    billingAddress: "BillingAddress",
    phone: "Phone",
    email: "Email__c",
    panNumber: "PAN_Number__c",
    gstNumber: "GSTIN_Number__c",
    billingLatitude: "BillingLatitude",
    billingLongitude: "BillingLongitude",
    otpVerified: "OTPVerified__c",
    otpVerifiedDate: "OTPVerifiedDate__c",
    kycUpdated: "KYC_Updated__c",
    creditLimit: "CreditLimit__c",
    creditDays: "CreditDays__c",
    censusCode: "CensusCode__c",
    // beat: "Beat__c",
    dbType: "DBType__c",
    ownerId: "OwnerId",
    createdDate: "CreatedDate",
    billingStreet: "BillingStreet",
    billingState: "BillingState",
    billingPostalCode: "BillingPostalCode",
    billingCity: "BillingCity",
    billingCountry: "BillingCountry",

    fifoDone: "FIFO_Done__c",
    isActive__c: "Active__c",
    // hiredType: "Hired_Type__c",
    visibility: "VIsibility__c",
    visibilityImage: "Visibility_Image__c",
    otherPromotionActivity: "Other_Promotion_Activity__c",
    // otherPromotionActivity2: "Other_Promotion_Activity_2__c",

    ManagerId: "ManagerId",
    Region__c: "Region__c",
    State__c: "State__c",
    outlet_Owner_Name__c: "Outlet_Owner_Name__c",
    isPerfect: "isPerfect__c",

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
