function handleReadyStatus(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const readyCell = findTargetCell(
    location,
    sheet,
    appointment,
    3 // number of rows down that the ready cell is from the patient cell
  );

  if (readyCell?.isBlank()) {
    const time = getTime(appointment.modified_at);
    const text = `ready@ ${time}`;
    readyCell.setValue(text);
  }

  return;
}