function okToCheckOut(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const okCheckbox = findRoomCell(location, locationSheet, appointment.consult_id, 5, appointment.contact_id);

  if (!okCheckbox) return;

  okCheckbox.setValue(true);
}
