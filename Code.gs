let token = PropertiesService.getScriptProperties().getProperty('ezyVet_token');
const proxy = 'https://api.ezyvet.com';
const sitePrefix = 'https://urbananimalnw.usw2.ezyvet.com';

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
  const dataObj = JSON.parse(json);
  token = `${dataObj.token_type} ${dataObj.access_token}`;
  props.setProperty('ezyVet_token', token);
  return token;
}

// receive webhooks
function doPost(e) { // e = the webhook event
  const params = JSON.parse(e.postData.contents);
  const apptItems = params.items;
  for (let itemsIndex = 0; itemsIndex < apptItems.length; itemsIndex++) {
    const { appointment } = apptItems[itemsIndex];
    handleAppointment(params.meta.event, appointment);
  }
  return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.JSON);
}

// check if status ID is an appointment status for being in a room
function isRoomStatus(statusID) {
  // rooms two through ten are have status ids of 25 through 33
  // the following status ids we also handle as if they are a room status
  // 18, // room 1
  // 36, // room 11,
  // 39, // in dog lobby,
  // 40, // in cat lobby

  return (statusID >= 25 && statusID <= 33) || [18, 36, 39, 40].includes(statusID);
}

// handle the details we care about
function handleAppointment(webhookType, appointment) {
  if (isTodayPST(appointment.start_at) && appointment.active) {

    // if it has a room status (no matter the webhookType), move it to a room
    if (isRoomStatus(appointment.status_id)) {
      return moveToRoom(appointment);
    }

    //  if it's an appointment_created webhook event
    else if (webhookType === "appointment_created") {
      // appointment type 37 = walk in, appointment type 77 = new client walk in
      if (appointment.type_id === 37 || appointment.type_id === 77) return addToWaitlist(appointment);

      // or, if it has a tech appointment type, add to tech appt column
      else if (appointment.type_id === 19) return addTechAppt(appointment);
    }

    // or, if it's an appointment_updated webhook event (that's happening today)
    else { // else if (webhookType === "appointment_updated") {
      // status 22 = ready appointment status
      if (appointment.status_id === 22) return handleReadyStatus(appointment);

      // 34 is inpatient status
      else if (appointment.status_id === 34) return addInPatient(appointment);

      // 19 is ok to check out
      else if (appointment.status_id === 19) return okToCheckOut(appointment);

      // 17 is 'on wait list'
      else if (appointment.status_id === 17) return addToWaitlist(appointment);
    }
  }

  return;
}