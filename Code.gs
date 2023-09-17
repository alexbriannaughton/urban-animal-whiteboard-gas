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
  const newToken = JSON.parse(json).access_token;
  props.setProperty('ezyVet_token', `Bearer ${newToken}`);
  console.log('TOKEN UPDATED: ', newToken);
  return;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(60000);

  try {
    let isARetry = false;
    for (let n = 0; n < 5; n++) {
      try {
        handleWebhook(e, isARetry);
        return ContentService.createTextOutput("staus = 200 !!!!").setMimeType(ContentService.MimeType.JSON);
      }
      catch (error) {
        if (error.toString().includes('simultaneous invocations')) {
          console.log("GASRetry " + n + ": " + error);
          if (n === 4) {
            throw error;
          }
          Utilities.sleep((Math.pow(2, n) * 1000) + (Math.round(Math.random() * 1000)));
        }
        else throw error;
      }
    }
  }
  catch (error) {
    console.log('hit the outer catchblockerror');
    throw error;
  }
  finally {
    lock.releaseLock();
  }
  return;
}

// handle webhook events
function handleWebhook(e) {
  // console.log('raw JSON: ', e.postData.contents);
  const params = JSON.parse(e.postData.contents);
  const last = params.items.length - 1;

  if (!params.items[last] || !params.items[last].appointment) {
    console.log('PARAMS ERROR: ', params);
    return;
  }

  const appointment = params.items[last].appointment;

  // console.log('HANDLE WEBHOOK: ', appointment)

  if (isTodayPST(appointment.start_at) && appointment.active) {
    const inARoom = ifRoomStatus(appointment.status_id);

    //  if it's an appointment_created webhook event
    if (params.meta.event === "appointment_created") {

      // if it already has a status of being in a room
      if (inARoom) {
        return moveToRoom(appointment);
      }

      // else, if it's a walk-in doctor visit
      // appointment type 37 = walk in, appointment type 77 = new client walk in
      else if (appointment.type_id === 37 || appointment.type_id === 77) {
        return addToWaitlist(appointment);
      }

      // or, if it has a tech appointment type, add to tech appt column
      else if (appointment.type_id === 19) {
        return addTechAppt(appointment);
      }
    }

    // or, if it's an appointment_updated webhook event (that's happening today)
    // else if (params.meta.event === "appointment_updated") {
    else {
      // if the appointment has a status of being in a room
      if (inARoom) {
        return moveToRoom(appointment);
      }

      // if it has a ready status
      else if (appointment.status_id === 22) {
        return handleReadyStatus(appointment);
      }

      // 34 is inpatient status
      else if (appointment.status_id === 34) {
        return addInPatient(appointment);
      }

      // 19 is ok to check out
      else if (appointment.status_id === 19) {
        return okToCheckOut(appointment);
      }

      // 17 is 'on wait list'
      else if (appointment.status_id === 17) {
        return addToWaitlist(appointment);
      }
    }

    // we are not using the below assign dvm stuff. it is commented out everywhere else in the code too.
    // if it is in a room or if it has a ready status, check if there's a doctor resource and assign that doctor to the room
    // if (inARoom || appointment.status_id === 22) {
    //   const dvmResourceIDs = [24, 25, 26, 1063, 35, 55, 1015, 39, 59, 1384, 65, 27];
    //   // if it has a specific doctor resource, assign that doctor on the room
    //   if (dvmResourceIDs.includes(appointment.resources[0].id)) {
    //     assignDvm(appointment, inARoom);
    //   }
    // }

  }

  return;
}

// check if status ID has a room status
function ifRoomStatus(statusID) {
  return statusID === 18 ||
    (statusID >= 25 && statusID <= 33) ||
    statusID === 36;
}

function fetchAndParse(url) {
  const options = {
    muteHttpExceptions: true,
    method: "GET",
    headers: {
      authorization: token
    }
  };

  let response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() === 401) {
    updateToken();
    token = `${PropertiesService.getScriptProperties().getProperty('ezyVet_token')}`;
    options.headers.authorization = token;
    response = UrlFetchApp.fetch(url, options);
  }

  const json = response.getContentText();
  return JSON.parse(json);
}

function testAuth() {
  const url = `${proxy}/v1/animal/67143`;
  fetchAndParse(url);
}