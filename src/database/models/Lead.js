import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";
import { isLowRamDevice } from "react-native-device-info";

export default class Lead extends Model {
  static table = "Lead";

  // identity / basic
  @field("Sf_Id") sfId;
  @field("Name") name;
  @field("Status") status;
  @field("OwnerId") ownerId;
  @field("LeadSource") leadSource;
  @field("LastName") lastName;
  @field("Outlet_Name__c") outletName__c;
  @field("Company") company;
  @field("Email") email;
  @field("Phone") phone;
  @field("Designation__c") designation__c;
  @field("Supplier__c") supplier__c;
  @field("Customer_Type__c") customerType__c;
  @field("Industry") industry;
  @field("Sub_segment__c") subSegment__c;
  @field("KYC_mode__c") kycMode__c;
  @field("FSSAI_NO__c") fssaiNo__c;
  @field("PANNumber__c") panNumber__c;
  @field("GSTN__c") gstn__c;
  @field("Trade_License__c") tradeLicense__c;
  @field("Buying_Frequency__c") buyingFrequency__c;

  // numeric / counters
  @field("Value_Potential__c") valuePotential__c;
  @field("Volume_Potential__c") volumePotential__c;
  @field("Visit_Count__c") visitCount__c;

  // visit / location
  @field("Date_Of_Visit__c") dateOfVisit__c;
  @field("Visit_Remarks__c") visitRemarks__c;
  @field("Lost_Reason__c") lostReason__c;
  @field("Lost_Remarks__c") lostRemarks__c;
  @field("Address") address;
  @field("Geo_Location__c") geoLocation__c;

  // sync/meta fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    status: "Status",
    ownerId: "OwnerId",
    leadSource: "LeadSource",
    lastName: "LastName",
    outletName__c: "Outlet_Name__c",
    company: "Company",
    email: "Email",
    phone: "Phone",
    designation__c: "Designation__c",
    supplier__c: "Supplier__c",
    customerType__c: "Customer_Type__c",
    industry: "Industry",
    subSegment__c: "Sub_segment__c",
    kycMode__c: "KYC_mode__c",
    fssaiNo__c: "FSSAI_NO__c",
    panNumber__c: "PANNumber__c",
    gstn__c: "GSTN__c",
    tradeLicense__c: "Trade_License__c",
    buyingFrequency__c: "Buying_Frequency__c",
    valuePotential__c: "Value_Potential__c",
    volumePotential__c: "Volume_Potential__c",
    visitCount__c: "Visit_Count__c",
    dateOfVisit__c: "Date_Of_Visit__c",
    visitRemarks__c: "Visit_Remarks__c",
    lostReason__c: "Lost_Reason__c",
    lostRemarks__c: "Lost_Remarks__c",
    address: "Address",
    geoLocation__c: "Geo_Location__c",
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
