function assignDvm(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const dvmCell = findRoomCell(location, locationSheet, appointment.consult_id, 4, appointment.contact_id);

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
  const dvmName = sheet.getRange(dvmCoords).getValue();
  return dvmName;
}