const token = PropertiesService.getScriptProperties().getProperty('ezyVet_token');
const proxy = 'https://api.ezyvet.com';
const sitePrefix = 'https://urbananimalnw.usw2.ezyvet.com/';

// this runs with a weekly trigger
function updateToken() {
  const url = `${proxy}/v2/oauth/access_token`;
  const props = PropertiesService.getScriptProperties();
  const payload = {
    partner_id: props.getProperty('partner_id'),
    client_id: props.getProperty('client_id'),
    client_secret: props.getProperty('client_secret'),
    grant_type: props.getProperty('grant_type'),
    scope: props.getProperty('scope')
  };
  const options = {
    crossDomain: true,
    method: "POST",
    payload: payload
  };
  const response = UrlFetchApp.fetch(url, options);
  const json = response.getContentText();
  const newToken = JSON.parse(json).access_token;
  props.setProperty('ezyVet_token', `Bearer ${newToken}`);
}

// receive+handle webhook events
function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const last = params.items.length - 1;
  const appointment = params.items[last].appointment;

  if (isTodayPST(appointment.start_at) && appointment.active) {
    //  if it's an appointment_created webhook event
    if (params.meta.event === "appointment_created") {

      // if it already has a status of being in a room
      if (appointment.status_id === 18 || (appointment.status_id >= 25 && appointment.status_id <= 33)) {
        moveToRoom(appointment);
      }

      // else, if it's a walk-in doctor visit
      // appointment type 37 = walk in, appointment type 77 = new client walk in
      else if (appointment.type_id === 37 || appointment.type_id === 77) {
        addToWaitlist(appointment);
      }

      // or, if it has a tech appointment type, add to tech appt column
      else if (appointment.type_id === 19) {
        addTechAppt(appointment);
      }
    }

    // or, if it's an appointment_updated webhook event (that's happening today)
    else if (params.meta.event === "appointment_updated") {
      // if the appointment has a status of being in a room
      if (appointment.status_id === 18 || (appointment.status_id >= 25 && appointment.status_id <= 33)) {
        moveToRoom(appointment);
      }
      else if (appointment.status_id === 34) {
        addInPatient(appointment);
      }
    }
  }

  // Create response object
  const jsonResponse = {
    success: true,
    message: "Webhook event received and processed successfully."
  };

  // Set response content type
  const outputContent = JSON.stringify(jsonResponse);
  const outputMimeType = ContentService.MimeType.JSON;
  const response = ContentService.createTextOutput(outputContent).setMimeType(outputMimeType);

  // Send response
  return response;
}