function assignDvm(appointment, inARoom) {
  const location = whichLocation(appointment.resources[0].id);
  const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  let dvmCell;

  // if it has status_id of a room, find the room based on that
  if (inARoom) {
    const { row, column } = findCellsOnSpreadsheet(appointment.status_id, location);
    dvmCell = locationSheet.getRange(`${column}${row + 5}`);
  }
  // if it has a ready status, look through all of the rooms for the matching id
  else dvmCell = findRoomCell(location, locationSheet, appointment.consult_id, 4, appointment.contact_id);

  if (!dvmCell) return;

  const dvmName = getDvm(appointment.resources[0].id, locationSheet);

  if (alreadyThere(dvmName, dvmCell.getValue())) return;

  const text = `${dvmName}@ ${getTime(appointment.modified_at)}`;

  dvmCell.setValue(text);
}

function alreadyThere(dvmName, cellContents) {
  const curr = cellContents.split('@')[0];
  return dvmName === curr;
}

function getDvm(resourceID, sheet) {
  if (resourceID == 65 || resourceID == 27) {
    return "PP"
  }
  const dvmObj = {
    '24': 'U25',
    '25': 'U26',
    '26': 'U27',
    '1063': 'U28',
    '35': 'N14',
    '55': 'N15',
    '1015': 'N16',
    '39': 'M20',
    '59': 'M21',
    '1384': 'M22'
  };

  const dvmCoords = dvmObj[resourceID];
  if (dvmCoords) {
    return sheet.getRange(dvmCoords).getValue();
  }
}