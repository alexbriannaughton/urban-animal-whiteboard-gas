// appointment.status_id 18 = room 1 = C3, C4, C5
// appointment.status_id 25 = room 2 = D3, D4, D5
// appointment.status_id 26 = room 3 = E3, E4, E5
// appointment.status_id 27 = room 4 = F3, F4, F5
// appointment.status_id 28 = room 5 = G3, G4, G5
// appointment.status_id 29 = room 6 = CH cells: C13, C14, C15, DT: H3, H4, H5
// appointment.status_id 30 = room 7 = CH cells: D13, D14, D15, DT: I3, I4, I5
// appointment.status_id 31 = room 8 = CH cells: E13, E14, E15 
// appointment.status_id 32 = room 9 = CH cells: F13, F14, F15 
// appointment.status_id 33 = room10 = CH cells: G13, G14, G15
// appointment.status_id 36 = room11 = CH cells: H13, H14, H15

// status 40 = cat lobby = CH cells: H3, H4, H5 & I3, I4, I5
// status 39 = dog lobby = CH cells: I13, I14, I15
function moveToRoom(appointment) {
  // console.log(`appointment ${appointment.id} at top of moveToRoom()`);

  const resourceID = appointment.resources[0].id;
  const location = whichLocation(resourceID);

  // if we're moving into a room that doesn't exist... don't
  if (appointment.status_id >= 31 && location === 'DT' || appointment.status_id >= 29 && location === 'WC') {
    return stopMovingToRoom(appointment);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const { roomRange, incomingAnimalText, curPtCell } = parseTheRoom(sheet, appointment) || {};

  if (roomRange) {
    handleSinglePetRoom(appointment, resourceID, roomRange, incomingAnimalText, location, curPtCell)
  }

  return;
}

function handleSinglePetRoom(appointment, resourceID, roomRange, incomingAnimalText, location, curPtCell) {
  console.log('from handlesingpetroom:  ')
  console.log(roomRange)

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

  // delete from the waitlist
  deleteFromWaitlist(location, appointment.consult_id);
}

function parseTheRoom(sheet, appointment, rangeForSecondCatLobbyColumn, curContactID) {
  const roomRange = !rangeForSecondCatLobbyColumn
    ? findRoomRange(sheet, appointment.status_id)
    : rangeForSecondCatLobbyColumn;
  const curPtCell = roomRange.offset(1, 0, 1, 1);
  const curLink = curPtCell?.getRichTextValue()?.getLinkUrl();

  // if this appointment is already in the room, don't worry about it
  if (curLink && curLink.includes(appointment.consult_id)) {
    // we return deleteFromWaitlist bc there's a chance that this execution is a retry from too many simultaneous invocations
    return deleteFromWaitlist(location, appointment.consult_id);
  }

  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);

  const incomingAnimalText = `${techText(appointment.type_id)}${animalName} (${animalSpecies})`;

  const roomValues = roomRange.getValues();
  const curPtCellContent = roomValues[1][0];

  // if the current patient name cell already has something in it
  if (curPtCellContent) {
    // if the current text in the patient cell is text without a link, don't do anything so we don't overwrite whatever is there
    if (!curLink) {
      return stopMovingToRoom(appointment);
    }

    // another check to see if it's already in the room, since multiple pet room will not carry the consult id
    if (curPtCellContent.includes(incomingAnimalText)) return stopMovingToRoom(appointment);

    let alreadyMultiplePets = false;

    // then, check if the animal currently in the room has the same contact ID as the incoming animal
    // console.log('APPT ID: ', appointment.id, 'Before locating the contact ID')
    // first, grab the id at the end of the link
    if (!curContactID) {
      const curID = curLink.split('=')[2];
      // if this link is a contact id, that means there are already multiple pets in this room
      // therefore, we already have the contact id
      if (curLink.includes('Contact')) {
        curContactID = curID;
        alreadyMultiplePets = true;
      }
      // otherwise there's only one pet, meaning the link contains the consult id
      // which we'll use to find the contact id
      else curContactID = getContactIDFromConsultID(curID);
    }


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

    // and if we are checking the first cat lobby cell range
    if (appointment.status_id === 40 && roomRange.getColumn() === 8) {
      // we want to check the second cat lobby cell range
      return parseTheRoom(sheet, appointment, sheet.getRange('I3:I11'), curContactID);
    }

    // otherwise dont move to room because the room is taken
    return stopMovingToRoom(appointment);
  }

  return { roomRange, incomingAnimalText, curPtCell };
}

function roomIsEmpty(roomValues) {
  return roomValues // is an array of arrays
    .slice(0, -1) // we are not checking the last cell of the room, which is the indicator for clean or dirty
    .every(array => {
      return array.every(val => !val); // an empty room will only have values of '' or false
    });
}

// note that we have already weeded out status ids >= 31 at DT and status ids >= 29 at WC earlier in moveToRoom()
function findRoomRange(sheet, statusID) {
  // we're finding the time cell to use as a starting place

  // coords for rooms 1-5 CH and WC and 1-7 DT are handled similarly
  let timeRow = 3
  let timeColumn = statusID === 18
    ? 'C' : String.fromCharCode(statusID + 43);
  // 43 = statusID minus the correct column letter's CharCode;
  // this doesnt work for room 1 though (status id 18), so we would just assign that to 'C'

  // status ids for rooms 6 - 11 and dog/cat lobby statuses are 29 and greater
  // (these are only handled for CH) bc they should already be weeded out if this is for DT OR WC
  if (statusID >= 29) {
    // handle for cat or dog lobby statuses
    if (statusID === 40 || statusID === 39) {
      timeRow = statusID === 40 ? 3 : 13;
      timeColumn = statusID === 40 ? 'H' : 'I';
    }

    // else we're handling for rooms 6 - 11
    else {
      timeRow = 13;

      // if room 11 (status id = 36), just assign to room H
      timeColumn = statusID === 36 ? 'H' : String.fromCharCode(statusID + 38);
      // otherwise we can say that 38 = statusID minus the correct column letter's CharCode
    }
  }

  return sheet.getRange(`${timeColumn}${timeRow}:${timeColumn}${timeRow + 8}`);
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

function stopMovingToRoom(appointment) {
  // add it to the waitlist if it was just created
  if (appointment.created_at === appointment.modified_at) {
    addToWaitlist(appointment);
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
    roomRange.offset(0, 0, 8, 1).setBackground('#f3f3f3');
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

function getContactIDFromConsultID(consultID) {
  const url1 = `${proxy}/v1/consult/${consultID}`;
  const animalID = fetchAndParse(url1).items[0].consult.animal_id;

  const url2 = `${proxy}/v1/animal/${animalID}`
  const contactID = fetchAndParse(url2).items[0].animal.contact_id;

  return contactID;

}

function deleteFromWaitlist(location, consultID) {
  // console.log(`appointment ${appointment.id} at top of deleteFromWaitlist()`);
  if (location === 'DT') return;
  const waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`${location} Wait List`);
  const patientNameRichText = waitlistSheet.getRange(`C7:D75`).getRichTextValues();

  const len = patientNameRichText.length;

  for (let i = 0; i < len; i++) {
    const link = patientNameRichText[i][0].getLinkUrl();
    if (link && link.includes(consultID)) {
      return waitlistSheet.deleteRow(i + 7);
    }
  }

  // console.log(`appointment ${appointment.id} at bottom deleteFromWaitlist()`);

  return;
}