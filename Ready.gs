function handleReadyStatus(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const readyCell = findRoomCell(location, locationSheet, appointment.consult_id, 3);

  if (readyCell && readyCell.isBlank()) {
    const time = getTime(appointment.modified_at);
    const text = `ready@${time}`;
    readyCell.setValue(text);
  }
}