import {
  schemaMigrations,
  addColumns,
  createTable,
} from "@nozbe/watermelondb/Schema/migrations";

export const migrations = schemaMigrations({
  migrations: [
    {
      // Account.isPerfect__c flags a Perfect Store retailer (shown on Beat Plan).
      toVersion: 197,
      steps: [
        addColumns({
          table: "Account",
          columns: [
            { name: "isPerfect__c", type: "boolean", isOptional: true },
          ],
        }),
      ],
    },
    {
      // Salesforce custom field API name is PlaceId__c; the column was
      // mistakenly created as "PlaceId". WatermelonDB migrations are additive
      // only, so the old "PlaceId" column stays as a harmless orphan on
      // already-installed devices; fresh installs get PlaceId__c from schema.js.
      toVersion: 196,
      steps: [
        addColumns({
          table: "Visit",
          columns: [
            { name: "PlaceId__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 195,
      steps: [
        addColumns({
          table: "Visit",
          columns: [
            { name: "Missing_Outlet_Reason__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 194,
      steps: [
        addColumns({
          table: "BeatDay__c",
          columns: [
            { name: "Missed_Outlet_Reasons__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 193,
      steps: [
        addColumns({
          table: "BeatDay__c",
          columns: [
            { name: "EOD_Comment__c", type: "string", isOptional: true },
            { name: "End_Time__c", type: "string", isOptional: true },
            { name: "Not_Visited_Outlets__c", type: "number", isOptional: true },
            { name: "Total_Time_in_Outlet__c", type: "string", isOptional: true },
            { name: "Visited_Outlets__c", type: "number", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 192,
      steps: [
        addColumns({
          table: "Survey_Assignment_Target__c",
          columns: [
            { name: "Outlet__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 191,
      steps: [
        addColumns({
          table: "Visit",
          columns: [
            { name: "Joint_Visit_User_Validated__c", type: "boolean", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 190,
      steps: [
        addColumns({
          table: "BeatDay__c",
          columns: [
            { name: "Joint_Working_Reason__c", type: "string", isOptional: true },
            { name: "Joint_Working_User__c", type: "string", isOptional: true },
            { name: "Joint_Working_User_Name__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 189,
      steps: [
        addColumns({
          table: "BeatDay__c",
          columns: [
            { name: "Approval_Status__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 188,
      steps: [
        addColumns({
          table: "Beat__c",
          columns: [
            { name: "Distributor__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 187,
      steps: [
        createTable({
          name: "Beat_Mapping__c",
          columns: [
            { name: "Sf_Id", type: "string" },
            { name: "Beat__c", type: "string" },
            { name: "Account__c", type: "string" },
            { name: "is_synced", type: "boolean", isOptional: true },
            { name: "last_modified", type: "number", isOptional: true },
            { name: "SoftDelete", type: "boolean", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 186,
      steps: [
        addColumns({
          table: "Visit",
          columns: [
            { name: "PlannedVisitStartTime__c", type: "string", isOptional: true },
            { name: "PlannedVisitEndTime__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 185,
      steps: [
        addColumns({
          table: "Visit",
          columns: [
            { name: "RecordType", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 184,
      steps: [
        createTable({
          name: "Survey_Response_Item__c",
          columns: [
            { name: "Sf_Id", type: "string" },
            { name: "Name", type: "string", isOptional: true },
            { name: "Survey_Response__c", type: "string" },
            { name: "Survey_Question__c", type: "string" },
            { name: "Answer_Text__c", type: "string", isOptional: true },
            { name: "Answer_Number__c", type: "number", isOptional: true },
            { name: "Answer_Decimal__c", type: "number", isOptional: true },
            { name: "Answer_Date__c", type: "string", isOptional: true },
            { name: "Answer_Time__c", type: "string", isOptional: true },
            { name: "Answer_Boolean__c", type: "boolean", isOptional: true },
            { name: "Rating__c", type: "number", isOptional: true },
            { name: "is_locally_changed", type: "boolean", isOptional: true },
            { name: "operation_type", type: "string", isOptional: true },
            { name: "last_modified", type: "number", isOptional: true },
            { name: "is_synced", type: "boolean", isOptional: true },
            { name: "sync_status", type: "string", isOptional: true },
            { name: "SoftDelete", type: "boolean", isOptional: true },
            { name: "ErrorMsg", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 183,
      steps: [
        addColumns({
          table: "User",
          columns: [
            { name: "Geography__c", type: "string", isOptional: true },
          ],
        }),
        createTable({
          name: "Survey_Template__c",
          columns: [
            { name: "Sf_Id", type: "string" },
            { name: "Name", type: "string" },
            { name: "Status__c", type: "string" },
            { name: "Frequency__c", type: "string" },
            { name: "Effective_From__c", type: "string" },
            { name: "Effective_To__c", type: "string" },
            { name: "is_locally_changed", type: "boolean", isOptional: true },
            { name: "operation_type", type: "string", isOptional: true },
            { name: "last_modified", type: "number", isOptional: true },
            { name: "is_synced", type: "boolean", isOptional: true },
            { name: "sync_status", type: "string", isOptional: true },
            { name: "SoftDelete", type: "boolean", isOptional: true },
            { name: "ErrorMsg", type: "string", isOptional: true },
          ],
        }),
        createTable({
          name: "Survey_Assignment__c",
          columns: [
            { name: "Sf_Id", type: "string" },
            { name: "Name", type: "string" },
            { name: "Survey_Template__c", type: "string" },
            { name: "Active__c", type: "boolean" },
            { name: "Assignment_Type__c", type: "string" },
            { name: "is_locally_changed", type: "boolean", isOptional: true },
            { name: "operation_type", type: "string", isOptional: true },
            { name: "last_modified", type: "number", isOptional: true },
            { name: "is_synced", type: "boolean", isOptional: true },
            { name: "sync_status", type: "string", isOptional: true },
            { name: "SoftDelete", type: "boolean", isOptional: true },
            { name: "ErrorMsg", type: "string", isOptional: true },
          ],
        }),
        createTable({
          name: "Survey_Assignment_Target__c",
          columns: [
            { name: "Sf_Id", type: "string" },
            { name: "Name", type: "string" },
            { name: "Survey_Assignment__c", type: "string" },
            { name: "Geography__c", type: "string", isOptional: true },
            { name: "User__c", type: "string", isOptional: true },
            { name: "Distributor__c", type: "string", isOptional: true },
            { name: "is_locally_changed", type: "boolean", isOptional: true },
            { name: "operation_type", type: "string", isOptional: true },
            { name: "last_modified", type: "number", isOptional: true },
            { name: "is_synced", type: "boolean", isOptional: true },
            { name: "sync_status", type: "string", isOptional: true },
            { name: "SoftDelete", type: "boolean", isOptional: true },
            { name: "ErrorMsg", type: "string", isOptional: true },
          ],
        }),
        createTable({
          name: "Survey_Question__c",
          columns: [
            { name: "Sf_Id", type: "string" },
            { name: "Name", type: "string" },
            { name: "Survey_Template__c", type: "string" },
            { name: "Question__c", type: "string" },
            { name: "Question_Order__c", type: "number" },
            { name: "Response_Type__c", type: "string" },
            { name: "Mandatory__c", type: "boolean" },
            { name: "Allow_Image__c", type: "boolean" },
            { name: "is_locally_changed", type: "boolean", isOptional: true },
            { name: "operation_type", type: "string", isOptional: true },
            { name: "last_modified", type: "number", isOptional: true },
            { name: "is_synced", type: "boolean", isOptional: true },
            { name: "sync_status", type: "string", isOptional: true },
            { name: "SoftDelete", type: "boolean", isOptional: true },
            { name: "ErrorMsg", type: "string", isOptional: true },
          ],
        }),
        createTable({
          name: "Survey_Question_Option__c",
          columns: [
            { name: "Sf_Id", type: "string" },
            { name: "Name", type: "string" },
            { name: "Survey_Question__c", type: "string" },
            { name: "Option__c", type: "string" },
            { name: "Sequence__c", type: "number" },
            { name: "is_locally_changed", type: "boolean", isOptional: true },
            { name: "operation_type", type: "string", isOptional: true },
            { name: "last_modified", type: "number", isOptional: true },
            { name: "is_synced", type: "boolean", isOptional: true },
            { name: "sync_status", type: "string", isOptional: true },
            { name: "ErrorMsg", type: "string", isOptional: true },
          ],
        }),
        createTable({
          name: "Survey_Response__c",
          columns: [
            { name: "Sf_Id", type: "string" },
            { name: "Name", type: "string", isOptional: true },
            { name: "Survey_Template__c", type: "string", isOptional: true },
            { name: "Visit__c", type: "string", isOptional: true },
            { name: "Outlet__c", type: "string", isOptional: true },
            { name: "Field_User__c", type: "string", isOptional: true },
            { name: "Status__c", type: "string", isOptional: true },
            { name: "Start_Time__c", type: "string", isOptional: true },
            { name: "Submit_Time__c", type: "string", isOptional: true },
            { name: "Geolocation__Latitude__s", type: "number", isOptional: true },
            { name: "Geolocation__Longitude__s", type: "number", isOptional: true },
            { name: "is_locally_changed", type: "boolean", isOptional: true },
            { name: "operation_type", type: "string", isOptional: true },
            { name: "last_modified", type: "number", isOptional: true },
            { name: "is_synced", type: "boolean", isOptional: true },
            { name: "sync_status", type: "string", isOptional: true },
            { name: "SoftDelete", type: "boolean", isOptional: true },
            { name: "ErrorMsg", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 182,
      steps: [
        addColumns({
          table: "Account",
          columns: [
            { name: "Party_Code__c", type: "string", isOptional: true },
            { name: "Active__c", type: "boolean", isOptional: true },
            { name: "GSTIN_Number__c", type: "string", isOptional: true },
            { name: "Outlet_Visit_Day__c", type: "string", isOptional: true },
            { name: "Email__c", type: "string", isOptional: true },
            { name: "PAN_Number__c", type: "string", isOptional: true },
            { name: "KYC_Updated__c", type: "string", isOptional: true },
            { name: "Account_Location_Latitude_Longitude__Longitude__s", type: "number", isOptional: true },
            { name: "Account_Location_Latitude_Longitude__Latitude__s", type: "number", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 181,
      steps: [
        addColumns({
          table: "BeatDay__c",
          columns: [
            { name: "TotalProductiveCallsDuration__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 180,
      steps: [
        addColumns({
          table: "Visit",
          columns: [
            { name: "AccountId__c", type: "string", isOptional: true },
            { name: "CheckInComment__c", type: "string", isOptional: true },
            { name: "NonProductiveCallReason__c", type: "string", isOptional: true },
            { name: "AdHocReason__c", type: "string", isOptional: true },
            { name: "WorkingWith__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 179,
      steps: [
        addColumns({
          table: "BeatDay__c",
          columns: [
            { name: "Beat_Date__c", type: "string", isOptional: true },
            { name: "Planned_Outlets__c", type: "number", isOptional: true },
            { name: "NonPjpProductiveCalls__c", type: "number", isOptional: true },
            { name: "Productive_Calls__c", type: "number", isOptional: true },
            { name: "ChangeBeatReason__c", type: "string", isOptional: true },
            { name: "Total_Calls__c", type: "number", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 178,
      steps: [
        addColumns({
          table: "User",
          columns: [
            { name: "Assigned_Latitude__c", type: "string", isOptional: true },
            { name: "Assigned_Longitude__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 177,
      steps: [
        addColumns({
          table: "Attendant__c",
          columns: [
            { name: "Approval_Status__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 176,
      steps: [
        addColumns({
          table: "Attendant__c",
          columns: [
            { name: "From_Date__c", type: "string", isOptional: true },
            { name: "To_Date__c", type: "string", isOptional: true },
            { name: "Deviceid__c", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 175,
      steps: [
        createTable({
          name: "Template_Response__c",
          columns: [
            { name: "Sf_Id", type: "string", isOptional: true },
            { name: "Visit__c", type: "string", isOptional: true },
            { name: "AccountId", type: "string", isOptional: true },
            { name: "Form_Template__c", type: "string", isOptional: true },
            { name: "CreatedById", type: "string", isOptional: true },
            { name: "is_locally_changed", type: "boolean", isOptional: true },
            { name: "operation_type", type: "string", isOptional: true },
            { name: "last_modified", type: "number", isOptional: true },
            { name: "is_synced", type: "boolean", isOptional: true },
            { name: "sync_status", type: "string", isOptional: true },
            { name: "SoftDelete", type: "boolean", isOptional: true },
            { name: "ErrorMsg", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 174,
      steps: [
        addColumns({
          table: "Visit",
          columns: [{ name: "Device_Id__c", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 173,
      steps: [
        addColumns({
          table: "Attendant__c",
          columns: [{ name: "Mobile_Unique_Id__c", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Visit",
          columns: [{ name: "Mobile_Unique_Id__c", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 172,
      steps: [
        ...[
          "User",
          "so_users",
          "Beat__c",
          "Attendant__c",
          "Route_Plans__c",
          "BeatDay__c",
          "Visit",
          "Account",
          "Order",
          "OrderItem",
          "Product2",
          "CartItems",
          "Invoice__c",
          "Collection__c",
          "Collection_Allocation__c",
          "Survey",
          "Competitor__c",
          "Form_Template__c",
          "Question__c",
          "Question_Option__c",
          "Invoice_Item__c",
          "FormJson",
          "Stock_Check__c",
          "cgcloud__Unit_of_Measure__c",
          "AllDataPicklist",
          "GamificationRank",
          "MT_Exception__c",
          "Assortment",
          "AssortmentProduct",
          "Competitor_LineItem__c",
          "HNT_Competitor_Price__c",
          "CompetitorMaster__c",
          "Target__c",
          "Lead",
          "Growth_Mapping_Entry__c",
          "IncotermAssignment__c",
          "Product_Pricing_History__c",
          "Line_SR_Distributor_Mapping__c",
          "Line_Product_Mapping__c",
          "Form_Template_Assignment__c",
          "PlantDepotRake__c",
          "Scheme__c",
          "Scheme_Participant_Filters__c",
          "Scheme_Slab_Phase__c",
          "Scheme_Product__c",
          "Pricing_Margin_Master__c",
          "SR_Beat_Assignment__c",
          "Competitor__Product",
          "Geography__c",
          "Priority__c",
          "Recommended_Product__c",
          "cgcloud__Inventory__c",
          "AttendanceRule",
          "LastSync",
          "Notification__c",
          "Product_Pricing___c",
          "Salary_Acknowledgement__c",
          "Gamification_Master__c",
          "Gamification_Reward_Master__c",
          "Gamification_Transaction__c",
        ].map((table) =>
          addColumns({
            table,
            columns: [
              { name: "sync_status", type: "string", isOptional: true },
            ],
          })
        ),
      ],
    },
    {
      toVersion: 171,
      steps: [
        addColumns({
          table: "OrderItem",
          columns: [{ name: "isFOC__c", type: "boolean" }],
        }),
      ],
    },
    {
      toVersion: 170,
      steps: [
        addColumns({
          table: "Order",
          columns: [{ name: "Mobile_Unique_Id__c", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 169,
      steps: [
        addColumns({
          table: "System_Log__c",
          columns: [{ name: "RetryCount", type: "number", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 168,
      steps: [
        addColumns({
          table: "User",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "so_users",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Beat__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Attendant__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Route_Plans__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "BeatDay__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Visit",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Account",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Order",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "OrderItem",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Product2",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "CartItems",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Invoice__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Collection__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Collection_Allocation__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Survey",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Competitor__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Form_Template__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Question__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Question_Option__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Invoice_Item__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "FormJson",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Stock_Check__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "cgcloud__Unit_of_Measure__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "AllDataPicklist",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "GamificationRank",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "MT_Exception__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Assortment",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "AssortmentProduct",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Competitor_LineItem__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "HNT_Competitor_Price__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "CompetitorMaster__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Target__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Lead",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Growth_Mapping_Entry__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "IncotermAssignment__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Product_Pricing_History__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Line_SR_Distributor_Mapping__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Line_Product_Mapping__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Form_Template_Assignment__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "PlantDepotRake__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Scheme__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Scheme_Participant_Filters__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Scheme_Slab_Phase__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Scheme_Product__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Pricing_Margin_Master__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "SR_Beat_Assignment__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Competitor__Product",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Geography__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Priority__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Recommended_Product__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "cgcloud__Inventory__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "AttendanceRule",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "LastSync",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Notification__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Product_Pricing___c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Salary_Acknowledgement__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Gamification_Master__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Gamification_Reward_Master__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "Gamification_Transaction__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
        addColumns({
          table: "System_Log__c",
          columns: [{ name: "ErrorMsg", type: "string", isOptional: true }],
        }),
      ],
    },

    {
      toVersion: 167,
      steps: [
        addColumns({
          table: "OrderItem",
          columns: [
            { name: "SRChangedPrice__c", type: "number", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 166,
      steps: [
        createTable({
          name: "System_Log__c",
          columns: [
            { name: "Sf_Id", type: "string", isOptional: true },
            { name: "Stacktrace__c", type: "string", isOptional: true },
            { name: "Log_Request__c", type: "string", isOptional: true },
            { name: "Log_Response__c", type: "string", isOptional: true },
            { name: "Log_Status_Code__c", type: "string", isOptional: true },
            { name: "Type__c", type: "string", isOptional: true },
            { name: "UserId__c", type: "string", isOptional: true },
            { name: "Source__c", type: "string", isOptional: true },
            { name: "Logging_Type__c", type: "string", isOptional: true },
            { name: "SyncStatus", type: "string", isOptional: true },
            { name: "CreatedDate", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 165,
      steps: [
        addColumns({
          table: "Form_Template_Assignment__c",
          columns: [
            { name: "Sf_Id", type: "string" },
            { name: "Name", type: "string", isOptional: true },
            { name: "Form_Template__c", type: "string", isOptional: true },
            {
              name: "Assigned_To__c",
              type: "string",
              isOptional: true,
            },
            // Standard / Common sync fields
            { name: "is_locally_changed", type: "boolean", isOptional: true },
            { name: "operation_type", type: "string", isOptional: true },
            { name: "last_modified", type: "number", isOptional: true },
            { name: "is_synced", type: "boolean", isOptional: true },
            { name: "SoftDelete", type: "boolean" },
          ],
        }),
      ],
    },
  ],
});
