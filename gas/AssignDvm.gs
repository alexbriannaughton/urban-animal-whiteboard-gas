// function assignDvm(appointment, inARoom) {
//   const location = whichLocation(appointment.resources[0].id);
//   const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

//   let dvmCell;
//   let row1;
//   let roomColumn;

//   // if it has status_id of a room, find the room based on that
//   if (inARoom) {
//     const { row, column } = findCellsOnSpreadsheet(appointment.status_id, location);
//     dvmCell = locationSheet.getRange(`${column}${row + 5}`);
//     row1 = row;
//     roomColumn = column;
//   }
//   // if it has a ready status, look through all of the rooms for the matching id
//   else {
//     dvmCell = searchForRoomCell(location, locationSheet, appointment.consult_id, 4, appointment.contact_id);
//   }

//   if (!dvmCell) return;

//   const dvmName = getDvm(appointment.resources[0].id, locationSheet);

//   if (dvmAlreadyThere(dvmName, dvmCell.getValue())) return;

//   // if its PP and it's not already purple, color the room purple
//   if (dvmName === 'PP' && dvmCell.getBackground() !== '#d9d2e9') {
//     if (!row1 && !roomColumn) {
//       // if row1 and roomColumn were not defined already, find them
//       const dvmCoords = dvmCell.getA1Notation();
//       row1 = parseInt(dvmCoords.slice(1)) - 5;
//       roomColumn = dvmCoords[0];
//     }
//     locationSheet
//       .getRange(`${roomColumn}${row1}:${roomColumn}${row1 + 7}`)
//       .setBackground('#d9d2e9');
//   }

//   const text = `${dvmName}@ ${getTime(appointment.modified_at)}`;
//   dvmCell.setValue(text);
// }

// function dvmAlreadyThere(dvmName, cellContents) {
//   const curr = cellContents.split('@')[0];
//   return dvmName === curr;
// }

// function getDvm(resourceID, sheet) {
//   if (resourceID == 65 || resourceID == 27) {
//     return "PP"
//   }
//   const dvmObj = {
//     '24': 'U25',
//     '25': 'U26',
//     '26': 'U27',
//     '1063': 'U28',
//     '35': 'N14',
//     '55': 'N15',
//     '1015': 'N16',
//     '39': 'M20',
//     '59': 'M21',
//     '1384': 'M22'
//   };

//   const dvmCoords = dvmObj[resourceID];
//   if (dvmCoords) {
//     return sheet.getRange(dvmCoords).getValue();
//   }
// }