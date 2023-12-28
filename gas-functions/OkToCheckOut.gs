function okToCheckOut(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const okCheckbox = findTargetCell(
    location,
    locationSheet,
    appointment,
    5 // number of rows down that the 'ok to check out' cell is from the patient cell
  );

  if (!okCheckbox || okCheckbox.getValue()) return;

  okCheckbox.setDataValidation(createCheckbox()).setValue(true);

  return;
}