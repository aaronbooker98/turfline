// Turfline — website contact form catcher.
// Lives inside the info@yateartificialgrass.com Gmail account (Extensions >
// Apps Script). Every few minutes it checks for new "New Entry: Website
// Contact Form" emails, reads out the name/email/phone/message, and posts
// them into the Turfline CRM the same way WhatConverts does for phone calls.
//
// Setup: paste this whole file into script.google.com (while logged into
// info@yateartificialgrass.com) as one project, run checkForms() once to
// authorise it, then add a time-driven trigger (every 5–10 minutes) that
// calls checkForms. See supabase/DEPLOY-WEBFORM.md for full steps.

var INGEST_URL = "https://jhkhchhszwmtlhnhmowr.supabase.co/functions/v1/ingest?token=tf_6e53b6d70bad3c0d93fc36ac73ab9285b8848399c8b95dcb";
var LABEL_NAME = "turfline-processed";
var SEARCH = 'subject:"New Entry: Website Contact Form" -label:' + LABEL_NAME;

function checkForms() {
  var label = GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME);
  var threads = GmailApp.search(SEARCH, 0, 20);

  threads.forEach(function (thread) {
    // Always read the FIRST message in the thread — if Aaron's replied to the
    // notification, later messages are his reply (with the original quoted
    // and prefixed with "> ", which won't match the plain layout below).
    var msg = thread.getMessages()[0];
    var body = msg.getPlainBody();
    var data = parseFormEmail(body);
    var parsedOk = !!(data.name || data.email || data.phone || data.message);

    var payload = {
      lead_type: "form",
      crm_source: "Website form",
      contact_name: data.name || "",
      email_address: data.email || "",
      phone_number: data.phone || "",
      // If the usual field labels weren't found (an older/different layout),
      // save the raw email text instead of losing the enquiry.
      notes: data.message || (parsedOk ? "" : body.slice(0, 1500)),
      id: msg.getId()
    };

    var resp = UrlFetchApp.fetch(INGEST_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    if (resp.getResponseCode() === 200) {
      thread.addLabel(label);
      Logger.log((parsedOk ? "Sent to CRM: " : "Sent to CRM, could NOT read the fields — raw text saved instead: ")
        + (data.name || data.email || data.phone || "(check the lead's notes)"));
    } else {
      Logger.log("Failed (" + resp.getResponseCode() + "): " + resp.getContentText());
    }
  });
}

// Pulls Name / Email Address / Phone Number / Comment or Message out of the
// plain-text version of the notification email.
function parseFormEmail(body) {
  var lines = body.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
  var labels = { "Name": "name", "Email Address": "email", "Phone Number": "phone", "Comment or Message": "message" };
  var data = {};
  for (var i = 0; i < lines.length; i++) {
    var key = labels[lines[i]];
    if (!key) continue;
    var val = [];
    var j = i + 1;
    while (j < lines.length && !labels[lines[j]] && lines[j].indexOf("Sent from") !== 0) {
      val.push(lines[j]);
      j++;
    }
    data[key] = val.join(" ").trim();
  }
  return data;
}
