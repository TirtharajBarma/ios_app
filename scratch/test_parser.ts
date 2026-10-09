import { parseFinancialText } from '../utils/financialParser';

const testCases = [
  // 1. UPI - HDFC Bank
  {
    name: 'HDFC UPI Debit',
    text: 'Dear Customer, Rs 150.00 debited from HDFC Bank a/c **1234 on 08-OCT-26 to VPA swiggy@icici Ref 4281928192. Avail Bal: Rs 15,400.00',
    expectedType: 'expense',
    expectedAmount: 150,
  },
  // 2. UPI - SBI
  {
    name: 'SBI UPI Debit',
    text: 'Your a/c no. XXXXXXXX5678 is debited for Rs 250.00 on 08-10-26 by UPI ref no 4281928192 - SBI',
    expectedType: 'expense',
    expectedAmount: 250,
  },
  // 3. UPI - ICICI
  {
    name: 'ICICI UPI Swiggy',
    text: 'Dear Customer, your Acct XX123 debited for INR 500.00 on 08-Oct-26 by UPI/Swiggy. UPI Ref 4281928192. Avail Bal: INR 12,000.',
    expectedType: 'expense',
    expectedAmount: 500,
  },
  // 4. Google Pay / PhonePe app notification
  {
    name: 'Google Pay Notification',
    text: 'Paid ₹180 to Chai Point via Google Pay',
    expectedType: 'expense',
    expectedAmount: 180,
  },
  {
    name: 'PhonePe Notification',
    text: '₹450 paid successfully to Starbucks',
    expectedType: 'expense',
    expectedAmount: 450,
  },
  // 5. Credit Card - HDFC
  {
    name: 'HDFC Credit Card',
    text: "Alert: You've spent INR 2,499.00 on your HDFC Bank Credit Card ending 5678 at AMAZON on 08-OCT-26.",
    expectedType: 'expense',
    expectedAmount: 2499,
  },
  // 6. Credit Card - ICICI
  {
    name: 'ICICI Credit Card Tranx',
    text: 'Tranx of INR 1,200.00 done on ICICI Bank Card XX5678 at ZARA on 08-Oct-26. Avail Limit: INR 85,000.',
    expectedType: 'expense',
    expectedAmount: 1200,
  },
  // 6b. Kotak Credit Card
  {
    name: 'Kotak Credit Card Shell',
    text: 'Rs 850.00 spent on Kotak Credit Card xx9876 at SHELL on 08-Oct-26.',
    expectedType: 'expense',
    expectedAmount: 850,
  },
  // 6c. Axis Bank UPI
  {
    name: 'Axis Bank UPI',
    text: 'Dear Customer, INR 350.00 debited from Axis Bank A/c no. XX1234 on 08-Oct-26 towards UPI/swiggy@icici. UPI Ref 4281928192. Avail Bal INR 14,000.',
    expectedType: 'expense',
    expectedAmount: 350,
  },
  // 6d. Paytm
  {
    name: 'Paytm UPI Send',
    text: 'Sent Rs 200 to Ramesh Kumar via Paytm UPI',
    expectedType: 'expense',
    expectedAmount: 200,
  },
  // 6e. CRED Bill Pay
  {
    name: 'CRED Payment',
    text: 'Credit Card bill of ₹15,400 paid successfully via CRED',
    expectedType: 'expense',
    expectedAmount: 15400,
  },
  // 6f. Refund Credit
  {
    name: 'Zomato Refund',
    text: 'Refund of Rs 450.00 for order from ZOMATO has been credited to your HDFC Bank a/c **1234',
    expectedType: 'income',
    expectedAmount: 450,
  },
  // 6g. Promo Offer (Must be false)
  {
    name: 'Promo Loan Offer (Must be false)',
    text: 'Congratulations! Pre-approved personal loan of Rs 5,00,000 at zero interest. Apply now.',
    expectedType: undefined,
    expectedAmount: undefined,
  },
  // 6h. Statement Generated (Must be false)
  {
    name: 'Credit Card Bill Statement Due (Must be false)',
    text: 'Your HDFC Bank Credit Card statement is generated. Total amount due: Rs 14,500. Minimum due Rs 750. Payment is due on 25-Oct-26.',
    expectedType: undefined,
    expectedAmount: undefined,
  },
  // 7. IMPS / Bank Transfer
  {
    name: 'IMPS Transfer',
    text: 'Rs. 5,000.00 transferred from A/c XX1234 to A/c XX9999 via IMPS on 08-OCT-26.',
    expectedType: 'expense',
    expectedAmount: 5000,
  },
  // 8. ATM Cash Withdrawal
  {
    name: 'ATM Cash Withdrawal',
    text: 'Rs 2,000.00 withdrawn from ATM using Debit Card XX1234 on 08-OCT-26. Avail Bal Rs 8,000.',
    expectedType: 'expense',
    expectedAmount: 2000,
  },
  // 9. Salary Credit
  {
    name: 'Salary Credit',
    text: 'INR 85,000.00 credited to A/c XX1234 on 01-OCT-26 by SALARY from TECH CORP. Avail Bal INR 92,000.',
    expectedType: 'income',
    expectedAmount: 85000,
  },
  // 10. OTP Message (Should be rejected)
  {
    name: 'OTP Message (Must be false)',
    text: 'Your OTP for transaction of Rs 500.00 on HDFC Card ending 1234 is 482910. Do not share with anyone.',
    expectedType: undefined,
    expectedAmount: undefined,
  },
];

let failed = 0;
for (const tc of testCases) {
  const res = parseFinancialText(tc.text);
  const ok =
    tc.expectedType === undefined
      ? !res.isFinancial
      : res.isFinancial && res.type === tc.expectedType && res.amount === tc.expectedAmount;

  if (ok) {
    console.log(`✅ [PASS] ${tc.name} -> amount: ${res.amount}, merchant: ${res.merchant}, cat: ${res.categorySuggestion}`);
  } else {
    console.log(`❌ [FAIL] ${tc.name} -> isFinancial: ${res.isFinancial}, amount: ${res.amount}, type: ${res.type}, reason: ${res.reason}`);
    failed++;
  }
}

if (failed === 0) {
  console.log('\nAll test cases PASSED!');
} else {
  console.log(`\n${failed} test cases FAILED!`);
}
