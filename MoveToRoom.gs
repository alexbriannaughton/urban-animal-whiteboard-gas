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

function findCellsOnSpreadsheet(status_id, location) {
  // we have already weeded out rooms that do not exist
  const cellCoords = {};

  // if it's CH rooms 6 - 11. handle for the lower columns
  if (status_id >= 29 && location === 'CH') {
    cellCoords.row = 13;
    cellCoords.column = String.fromCharCode(status_id + 38);
  }

  // else, coords are handled similarly at all locations
  else {
    cellCoords.row = 3;

    // if it's room 1, put in column C
    if (status_id === 18) {
      cellCoords.column = 'C';
    }

    else {
      cellCoords.column = String.fromCharCode(status_id + 43);
      // 43 = status_id - correct column letter's CharCode
    }
  }

  return cellCoords;
}

function colorRoom(sheet, row, column, typeID) {
  const bgColor = getRoomColor(typeID);
  sheet.getRange(`${column}${row}:${column}${row + 7}`)
    .setBackground(bgColor);
}

function getRoomColor(typeID) {
  // if it's a tech make the background green
  if (typeID === 19) return '#90EE90';

  // if it's IM make the background purple
  const imTypeIDs = [26, 34, 27, 35];
  if (imTypeIDs.includes(typeID)) return '#d9d2e9';

  // if it's a pet with a procedure make the background orange
  const procedureTypes = [31, 32, 28, 82, 30, 33, 83, 38, 36, 76, 7, 29, 81];
  if (procedureTypes.includes(typeID)) return '#fce5cd';

  // if it's a euthanasia make the background blue
  if (typeID === 80) return '#cfe2f3';

  // else do the standard gray
  return '#f3f3f3';
}

function techText(typeID) {
  return typeID === 19 ? "TECH: " : "";
}

function stopMovingToRoom(appointment) {
  // add it to the waitlist if it was just created
  if (appointment.created_at === appointment.modified_at) {
    addToWaitlist(appointment);
  }
  // stop running the moveToRoom() function
  return;
}

function moveToRoom(appointment) {
  const location = whichLocation(appointment.resources[0].id);

  // if we're moving into a room that doesn't exist, don't
  if (appointment.status_id >= 31 && location === 'DT' || appointment.status_id >= 29 && location === 'WC') {
    return stopMovingToRoom(appointment);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);
  const { row, column } = findCellsOnSpreadsheet(appointment.status_id, location);

  // if there is something already in this room, stop
  if (!sheet.getRange(`${column}${row}:${column}${row + 5}`).isBlank()) {
    return stopMovingToRoom(appointment);
  };

  colorRoom(sheet, row, column, appointment.type_id);

  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);

  // time cell
  sheet.getRange(`${column}${row}`)
    .setValue(getTime(appointment.modified_at));

  // name/species/link cell
  const text = `${techText(appointment.type_id)}${animalName} (${animalSpecies})`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(text, webAddress);
  sheet.getRange(`${column}${row + 1}`)
    .setRichTextValue(link);

  // reason cell
  sheet.getRange(`${column}${row + 2}`)
    .setValue(`${appointment.description}`);

  // delete from the waitlist
  // const lastName = getLastName(appointment.contact_id);
  deleteFromWaitlist(location, appointment.consult_id);
}

function deleteFromWaitlist(location, consultID) {
  const waitlist = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`${location} Wait List`);
  let row = 7;
  let nameCell = waitlist.getRange('C7:D7');

  while (!nameCell.isBlank()) {
    const link = nameCell.getRichTextValue().getLinkUrl();
    if (link.includes(consultID)) {
      waitlist.deleteRow(row);
    }
    row++;
    nameCell = waitlist.getRange(`C${row}:D${row}`);
  }
}