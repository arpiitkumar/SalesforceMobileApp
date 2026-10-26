// utils/amountInWords.js (simple rupee words, works up to crores; adjust if you need full coverage)
function numberToWords(num) {
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
 
  function toWords(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + toWords(n % 100) : "");
    if (n < 100000) return toWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + toWords(n % 1000) : "");
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + toWords(n % 100000) : "");
    return toWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + toWords(n % 10000000) : "");
  }
 
  return toWords(num);
}
 
export const orderInvice = ({ invoice = {}, items = [], customer = {}, meta = {}, selectedAccount = {},ParentcustomerRecord={}, RouteName }) => {
  // safe numeric parse util
  const asNum = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };
 
 
  // console.log('invoice... ACCCCCCC IN THE DOWN LOAD ', selectedAccount)
  // compute totals (summing available numeric fields)
  //return
  const totals = items.reduce(
    (acc, it) => {
      acc.qty += asNum(it.InvoiceQuantityPcs__c);
      acc.gross += asNum(it.Gross_Amount__c);
      acc.taxable += asNum(it.Taxable_Amount__c) || asNum(it.Gross_Amount__c);
      acc.cgst += asNum(it.CGSTAmount__c);
      acc.sgst += asNum(it.SGSTAmount__c);
      acc.igst += asNum(it.IGSTAmount__c);
      acc.lineTotal += (asNum(it.Gross_Amount__c) + asNum(it.CGSTAmount__c) + asNum(it.SGSTAmount__c) + asNum(it.IGSTAmount__c) - (asNum(it.AdditionalDiscount__c) || 0));
      return acc;
    },
    { qty: 0, gross: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, lineTotal: 0 }
  );
 
  // Net amount prefer invoice field if present, otherwise computed
  const netAmount = asNum(invoice.Total_Net_Amount__c) || totals.lineTotal || 0;
  const amountInteger = Math.floor(netAmount);
  const amountDecimal = Math.round((netAmount - amountInteger) * 100);
 
  const amountInWords = `${numberToWords(amountInteger)} Rupees${amountDecimal ? ` and ${numberToWords(amountDecimal)} Paise` : ""} Only`;
 
  // invoice metadata fallbacks
  const invoiceNo = invoice.InvoiceNo__c || invoice.Name || "";
  const invoiceDate = invoice.InvoiceDate__c ? new Date(invoice.InvoiceDate__c).toLocaleDateString("en-GB") : "";
 
  // customer fallbacks
  const custName = ParentcustomerRecord?.Name || selectedAccount[0]?.Name || 'NA';
  const custAddress = ParentcustomerRecord?.BillingAddress || selectedAccount[0]?.BillingAddress || 'NA';
  const custGST = ParentcustomerRecord?.GSTIN_Number__c || selectedAccount[0]?.GSTIN_Number__c || 'NA';
  const custPhone = ParentcustomerRecord?.Phone || selectedAccount[0]?.Phone || 'NA';
  const custPan = ParentcustomerRecord?.PAN_Number__c || selectedAccount[0]?.PAN_Number__c || 'NA';
  const custFSSAI = ParentcustomerRecord?.FSSAI_No__c || selectedAccount[0]?.FSSAI_No__c || 'NA';
  const custState = ParentcustomerRecord?.BillingState || selectedAccount[0]?.BillingState || 'NA';
  const custParty = ParentcustomerRecord?.Party_Code__c || selectedAccount[0]?.Party_Code__c || 'NA';
  // console.log("items in the item code ............yes",selectedAccount)
  // Build table rows for items (preserve columns as in your HTML)
  const itemRowsHtml = items.map((it, idx) => {
    
    const hsn = it.ProductCode || it.HSN || ""; // try common fields
    const desc = it.Name || it.Description || "";
    const qty = it.InvoiceQuantityPcs__c || "";
    const freeQty = it.FreeQuantity || it.FreeQty || 0;
    const rate = it.RatePerPC__c || it.Rate || it.UnitRate || "";
    const gross = it.Gross_Amount__c || 0;
    const schemePct = it.SchemePct || it.SchemePercent || 0;
    const schemeAmt = it.SchemeAmount || 0;
    const addDisc = it.AdditionalDiscount__c || 0;
    const taxable = it.Taxable_Amount__c || gross;
    const cgstPct = it.CGSTRate__c || it.CGSTPercent__c || it.CGSTRate || "";
    const sgstPct = it.SGSTRate__c || it.SGSTPercent__c || it.SGSTRate || "";
    const igstPct = it.IGSTRate__c || it.IGSTPercent__c || it.IGSTRate || "";
    const cgstAmt = it.CGSTAmount__c || 0;
    const sgstAmt = it.SGSTAmount__c || 0;
    const igstAmt = it.IGSTAmount__c || 0;
    const totalAmt = (asNum(gross) + asNum(cgstAmt) + asNum(sgstAmt) + asNum(igstAmt) - asNum(addDisc)).toFixed(2);
 
    return `<tr>
     
      <td>${hsn}</td>
      <td class="text-left">${desc}</td>
      <td>${qty}</td>
      
      <td>${rate}</td>
      <td>${parseFloat(gross).toFixed(2)}</td>
      <td>${parseFloat(schemePct).toFixed(2)}</td>
      <td>${parseFloat(schemeAmt).toFixed(2)}</td>
      <td>${parseFloat(addDisc).toFixed(2)}</td>
      <td>${parseFloat(taxable).toFixed(2)}</td>
      <td>${cgstPct}</td>
      <td>${parseFloat(cgstAmt).toFixed(2)}</td>
      <td>${sgstPct}</td>
      <td>${parseFloat(sgstAmt).toFixed(2)}</td>
      <td>${igstPct}</td>
      <td>${parseFloat(igstAmt).toFixed(2)}</td>
      <td>${totalAmt}</td>
    </tr>`;
  }).join("\n");
 
  // Summary rows (keeps your original summary rows layout)
  const summaryRowsHtml = `
    <tr class="bold">
     <td></td><td class="text-right">Total</td>
      <td>${totals.qty}</td>
      
      <td></td>
      <td>${totals.gross.toFixed(2)}</td>
      <td></td><td></td><td></td>
      <td>${totals.taxable.toFixed(2)}</td>
      <td></td><td>${totals.cgst.toFixed(2)}</td>
      <td></td><td>${totals.sgst.toFixed(2)}</td>
      <td></td><td>${totals.igst.toFixed(2)}</td>
      <td>${(totals.lineTotal).toFixed(2)}</td>
    </tr>
    <tr class="bold">
     <td></td><td class="text-right">Cash Discount</td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      <td>${parseFloat(invoice.AdditionalDiscount__c || 0).toFixed(2)}</td>
    </tr>
    <tr class="bold">
      <td></td><td class="text-right">Round Off</td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      <td>${parseFloat(invoice.RoundOff__c || 0).toFixed(2)}</td>
    </tr>
    <tr class="bold">
   <td></td><td class="text-right">Net Amount</td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      <td>${netAmount.toFixed(2)}</td>
    </tr>
    <tr>
      <td colspan="6" class="align-left">
        <p><strong>Amount in Words:</strong> ${amountInWords}</p>
        <p><strong>Tax Details:</strong><br>
          CGST: ${totals.cgst.toFixed(2)}<br>
          SGST: ${totals.sgst.toFixed(2)}<br>
          IGST: ${totals.igst.toFixed(2)}
        </p>
        <p><strong>Declaration:</strong></p>
      </td>
      <td colspan="6">
        <!-- second tax group area kept similar to your original template -->
      </td>
      <td colspan="6" style="text-align: right; vertical-align: bottom;">
        <strong>For S B Enterprise Signature</strong>
      </td>
    </tr>
  `;
 
  // Final HTML: keep your CSS & structure unchanged, only replace tbody contents
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 10px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid black; padding: 4px; text-align: center; vertical-align: top; }
    .no-border { border: none; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .double-border { border-top: 2px solid black; }
    .title { text-align: center; font-size: 14px; font-weight: bold; padding: 6px 0; }
    .align-left { text-align: left !important; }
  </style>
</head>
<body>
  <table style="width:100%; border-collapse: collapse;">
    <tr><td colspan="12"><div class="title">TAX INVOICE</div></td></tr>
    <tr>
      <td style="width:40%" class="text-left">
        <strong>${custName}</strong><br>
        <strong>Distributior Address:</strong> ${custAddress}<br>
          <strong>Phone No:  </strong>${custPhone}
      </td>
      <td style="width:35%" class="text-left">
        <strong>PAN NO: </strong>${custPan}<br>
        <strong>State Name: </strong>${custState}<br>
       <strong>FSSAI NO: </strong>${custFSSAI}<br>
        <strong>GST NO:</strong> ${custGST}<br>
        <strong>Party Code:</strong> ${custParty}<br>
      </td>
       <td style="width:25%" class="text-left">
        <strong>Invoice No.:</strong> ${invoiceNo}<br>
        <strong>Invoice Date:</strong> ${invoiceDate}
      </td>
     
    </tr>
    <tr>
      <td style="width:40%" class="text-left">
        <strong>${selectedAccount[0]?.Name}</strong><br>
       <strong> Retailer Billing Address:</strong> ${selectedAccount[0]?.BillingAddress}<br>
        <strong>Phone No:  </strong>${selectedAccount[0]?.Phone}
      </td>
      <td style="width:35%" class="text-left">
        <strong>PAN NO:</strong> ${selectedAccount[0]?.PAN_Number__c}<br>
        <strong>State Name: </strong>${selectedAccount[0]?.BillingState}<br>
        <strong>FSSAI NO:</strong>  ${selectedAccount[0]?.FSSAI_No__c}<br>
        <strong>GST NO:</strong> ${selectedAccount[0]?.GSTIN_Number__c}<br>
        <strong>Party Code:</strong> ${selectedAccount[0]?.Party_Code__c}<br>
      </td>
     <td style="width:25%" class="text-left">
         <strong>Route Name:</strong> ${RouteName}<br>
      </td>
    </tr>
   <!-- <tr>
      <td colspan="4" class="text-left">
        <strong>To:</strong><br>
        ${custName}<br>
        Address: ${custAddress}
      </td>
      <td colspan="3" class="text-left">
        <strong>GSTIN NO:</strong> ${custGST}<br>
        State Name: WEST BENGAL<br>
        Phone No: ${custPhone}<br>
      </td>
      <td colspan="3" class="text-left">
        <strong>Salesman Name : ${meta.salesman || "Sandeep Sharma"}</strong><br>
        <strong>Route Name : ${meta.route || "Vaishali Nager"}</strong>
      </td>
    </tr>
  </table> -->
 
  <table>
    <thead>
      <tr>
       
        <th rowspan="2">Product Code</th>
        <th rowspan="2">Item Description</th>
        <th rowspan="2">QTY in pcs</th>
        
        <th rowspan="2">Rate Per pcs</th>
        <th rowspan="2">Gross Amt</th>
        <th rowspan="2">Scheme %</th>
        <th rowspan="2">Scheme Amt</th>
        <th rowspan="2">Add. Disc.</th>
        <th rowspan="2">Taxable Amt</th>
        <th colspan="2">CGST</th>
        <th colspan="2">SGST</th>
        <th colspan="2">IGST</th>
        <th rowspan="2">Total Amount</th>
      </tr>
      <tr>
        <th>%</th><th>Amt</th><th>%</th><th>Amt</th><th>%</th><th>Amt</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHtml}
      ${summaryRowsHtml}
    </tbody>
  </table>
</body>
</html>`;
};