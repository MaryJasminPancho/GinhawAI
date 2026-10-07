// Features that exist in the code but are switched off for now.
//
// SMS (Semaphore or an Android phone gateway) is a future enhancement: email is
// the delivery channel for citizens' checklists and staff codes. To bring SMS
// back, set this to true AND set SMS_FEATURE_ENABLED = True in backend/app/sms.py.
export const SMS_ENABLED = false;

/** The channel checklist messages currently go out through (labels in reports). */
export const DELIVERY_CHANNEL = SMS_ENABLED ? "SMS" : "Email";
