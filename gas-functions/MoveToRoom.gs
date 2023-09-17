// appointment.status_id 18 = room 1 = C3, C4, C5
// appointment.status_id 25 = room 2 = D3, D4, D5
// appointment.status_id 26 = room 3 = E3, E4, E5
// appointment.status_id 27 = room 4 = F3, F4, F5
// appointment.status_id 28 = room 5 = G3, G4, G5
// appointment.status_id 29 = room 6 = CH: C13, C14, C15, DT: H3, H4, H5
// appointment.status_id 30 = room 7 = CH: D13, D14, D15, DT: I3, I4, I5
// appointment.status_id 31 = room 8 = CH: E13, E14, E15 
// appointment.status_id 32 = room 9 = CH: F13, F14, F15 
// appointment.status_id 33 = room10 = CH: G13, G14, G15
// appointment.status_id 36 = room11 = CH: H13, H14, H15

function moveToRoom(appointment, isARetry) {
  // console.log('APPT ID: ', appointment.id, ' at Beginnging of MoveToRoom()')

  const resourceID = appointment.resources[0].id;
  const location = whichLocation(resourceID);

  // if we're moving into a room that doesn't exist... don't
  if (appointment.status_id >= 31 && location === 'DT' || appointment.status_id >= 29 && location === 'WC') {
    return stopMovingToRoom(appointment);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const roomRange = findRoomRange(sheet, appointment.status_id, location);

  const curPtCell = roomRange.offset(1, 0, 1, 1);
  const curLink = curPtCell.getRichTextValue().getLinkUrl() || undefined;

  // if this appointment is already in the room, don't worry about it
  if (curLink && curLink.includes(appointment.consult_id)) {
    if (isARetry) return deleteFromWaitlist(location, appointment.consult_id);
    return;
  }

  // console.log('APPT ID: ', appointment.id, 'MoveToRoom() before fetching animal info')
  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);
  // console.log('APPT ID: ', appointment.id, 'After fetching animal info')

  const incomingAnimalText = `${techText(appointment.type_id)}${animalName} (${animalSpecies})`;

  const roomValues = roomRange.getValues();
  const curPtCellContent = roomValues[1][0];

  // if the current patient name cell already has something in it
  if (curPtCellContent) {
    // if the current text in the patient cell is text without a link, don't do anything so we don't overwrite whatever is there
    if (!curLink) return;

    // another check to see if it's already in the room, since multiple pet room will not carry the consult id
    if (curPtCellContent.includes(incomingAnimalText)) return;


    // then, check if the animal currently in the room has the same contact ID as the incoming animal
    // console.log('APPT ID: ', appointment.id, 'Before locating the contact ID')
    // first, grab the id at the end of the link
    const curID = curLink.split('=')[2];
    let curContactID;
    let alreadyMultiplePets = false;
    // if this link is a contact id, that means there are already multiple pets in this room
    // therefore, we already have the contact id
    if (curLink.includes('Contact')) {
      curContactID = curID;
      alreadyMultiplePets = true;
    }
    // otherwise there's only one pet, meaning the link contains the consult id
    // which we'll use to find the contact id
    else curContactID = fetch1(curID);

    // console.log('APPT ID: ', appointment.id, 'After locating the contact ID')

    // if that contact id matches the contact id of the appointment we're trying to move to this room, handle a multiple pet room
    if (parseInt(curContactID) === appointment.contact_id) {

      handleMultiplePetRoom(
        curContactID,
        appointment.description,
        incomingAnimalText,
        curPtCell,
        alreadyMultiplePets,
        roomRange,
        roomValues,
        appointment
      );

      deleteFromWaitlist(location, appointment.consult_id);

      return;
    }

    // otherwise dont move to room because the room is taken
    return stopMovingToRoom(appointment, [animalName, animalSpecies]);
  }

  const bgColor = getRoomColor(appointment.type_id, resourceID);
  roomRange.offset(0, 0, 8, 1)
    .setBackground(bgColor);

  // time cell
  roomRange.offset(0, 0, 1, 1)
    .setValue(getTime(appointment.modified_at));

  // name/species/link cell
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(incomingAnimalText, webAddress);
  curPtCell.setRichTextValue(link);

  // reason cell
  roomRange.offset(2, 0, 1, 1)
    .setValue(`${appointment.description}`);

  // mark room as dirty
  roomRange.offset(8, 0, 1, 1)
    .setValue('d');

  // console.log('APPT ID: ', appointment.id, 'After adding to the room')

  // delete from the waitlist
  deleteFromWaitlist(location, appointment.consult_id);

  return;
}

// return something like D3:D5
function findRoomRange(sheet, status_id, location) {
  // we have already weeded out rooms that do not exist
  let timeRow, timeColumn;

  // if it's CH rooms 6 - 11, handle for the lower rows
  if (status_id >= 29 && location === 'CH') {
    timeRow = 13;

    // room 11 status id = 36, and it doesn't work the same as below
    if (status_id === 36) {
      timeColumn = 'H'
    }

    else timeColumn = String.fromCharCode(status_id + 38);
  }

  // else, coords are handled similarly at all locations
  else {
    timeRow = 3;

    // if it's room 1, put in column C
    if (status_id === 18) {
      timeColumn = 'C';
    }

    else timeColumn = String.fromCharCode(status_id + 43);
    // 43 = status_id - correct column letter's CharCode
  }

  return sheet.getRange(`${timeColumn}${timeRow}:${timeColumn}${timeRow + 8}`);

}

function findCellsOnSpreadsheet(status_id, location) {
  // we have already weeded out rooms that do not exist
  const cellCoords = {};

  // if it's CH rooms 6 - 11, handle for the lower rows
  if (status_id >= 29 && location === 'CH') {
    cellCoords.row = 13;

    // room 11 status id = 36, and it doesn't work the same as below
    if (status_id === 36) {
      cellCoords.column = 'H'
    }

    else cellCoords.column = String.fromCharCode(status_id + 38);
  }

  // else, coords are handled similarly at all locations
  else {
    cellCoords.row = 3;

    // if it's room 1, put in column C
    if (status_id === 18) {
      cellCoords.column = 'C';
    }

    else cellCoords.column = String.fromCharCode(status_id + 43);
    // 43 = status_id - correct column letter's CharCode
  }
  return cellCoords;
}

function getRoomColor(typeID, resourceID) {
  // if it's a tech make the background green
  if (typeID === 19) return '#90EE90';

  // if it's IM make the background purple
  const imTypeIDs = [26, 34, 27, 35];
  if (
    imTypeIDs.includes(typeID) ||
    resourceID == 65 ||
    resourceID == 27
  ) {
    return '#d9d2e9';
  }

  // if it's a pet with a procedure make the background orange
  const procedureTypes = [31, 32, 28, 82, 30, 33, 83, 38, 36, 76, 7, 29, 81];
  if (procedureTypes.includes(typeID)) return '#fce5cd';

  // if it's a euthanasia make the background blue
  if (typeID === 80) return '#cfe2f3';

  // else do the standard gray
  return '#f3f3f3';
}

function techText(typeID) {
  return typeID === 19 ? "TECH - " : "";
}

function stopMovingToRoom(appointment, [animalName, animalSpecies] = []) {
  // add it to the waitlist if it was just created
  if (appointment.created_at === appointment.modified_at) {
    if (animalName) addToWaitlist(appointment, [animalName, animalSpecies]);
    else addToWaitlist(appointment);

  }
  // console.log('APPT ID: ', appointment.id, 'at End of stopMovingToRoom()')
  return;
}

function handleMultiplePetRoom(
  contactID,
  incomingReason,
  incomingAnimalText,
  ptCell,
  alreadyMultiplePets,
  roomRange,
  roomValues,
  appointment
) {
  const curAnimalText = roomValues[1][0];
  const curAnimalReasonText = roomValues[2][0];

  const newPtCellText = `${curAnimalText} & ${incomingAnimalText}`;

  // if the incoming one isnt a tech or if the ones already there don't include a tech, make the background gray
  if (!curAnimalText.includes('TECH - ') || !incomingAnimalText.includes('TECH - ')) {
    roomRange.setBackground('#f3f3f3');
  }

  const webAddress = `${sitePrefix}/?recordclass=Contact&recordid=${contactID}`;
  const link = makeLink(newPtCellText, webAddress);
  ptCell.setRichTextValue(link);

  let reasonText;

  alreadyMultiplePets
    ? reasonText = `${curAnimalReasonText},\n${incomingAnimalText.split(" (")[0]}: ${incomingReason}`
    : reasonText = `${curAnimalText.split(" (")[0]}: ${curAnimalReasonText},\n${incomingAnimalText.split(" (")[0]}: ${incomingReason}`;

  const reasonCell = roomRange.offset(2, 0, 1, 1);
  reasonCell.setValue(reasonText);

  // console.log('APPT ID: ', appointment.id, 'End of handleMultiplePetRoom()')

  return;
}

// fetch1 retreives a animal_id based on a consult_id
function fetch1(consultID) {
  const url = `${proxy}/v1/consult/${consultID}`;
  const consult = fetchAndParse(url).items[0].consult;

  return fetch2(consult.animal_id);
}
// fetch2 retreives a contact id from an animal id
function fetch2(animalID) {
  const url = `${proxy}/v1/animal/${animalID}`
  const animal = fetchAndParse(url).items[0].animal;

  return animal.contact_id;
}

function deleteFromWaitlist(location, consultID) {
  const waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`${location} Wait List`);
  const patientNameRichText = waitlistSheet.getRange(`C7:D50`).getRichTextValues();

  const len = patientNameRichText.length;

  for (let i = 0; i < len; i++) {
    const link = patientNameRichText[i][0].getLinkUrl();
    if (link && link.includes(consultID)) {
      return waitlistSheet.deleteRow(i + 7);
    }
  }

  return;
}