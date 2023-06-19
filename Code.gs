const token = PropertiesService.getScriptProperties().getProperty('ezyVet_token');
const proxy = 'https://api.ezyvet.com';
const sitePrefix = 'https://urbananimalnw.usw2.ezyvet.com';

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

  let inARoom = roomStatus(appointment.status_id);

  if (isTodayPST(appointment.start_at) && appointment.active) {
    //  if it's an appointment_created webhook event
    if (params.meta.event === "appointment_created") {

      // if it already has a status of being in a room
      if (inARoom) {
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
      if (inARoom) {
        moveToRoom(appointment);
      }

      // if it has a ready status
      else if (appointment.status_id === 22) {
        handleReadyStatus(appointment);
      }

      // 34 is inpatient status
      else if (appointment.status_id === 34) {
        addInPatient(appointment);
      }

      // 19 is ok to check out
      else if (appointment.status_id === 19) {
        okToCheckOut(appointment);
      }

      // 17 is 'on wait list'
      else if (appointment.status_id === 17) {
        addToWaitlist(appointment);
      }
    }

    // if it is in a room or if it has a ready status, check if there's a doctor resource and assign that doctor to the room
    if (inARoom || appointment.status_id === 22) {
      const dvmResourceIDs = [24, 25, 26, 1063, 35, 55, 1015, 39, 59, 1384];
      // if it has a specific doctor resource, assign that doctor on the room
      if (dvmResourceIDs.includes(appointment.resources[0].id)) {
        assignDvm(appointment);
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

// check if status ID has a room status
function roomStatus(statusID) {
  return statusID === 18 ||
    (statusID >= 25 && statusID <= 33) ||
    statusID === 36;
}