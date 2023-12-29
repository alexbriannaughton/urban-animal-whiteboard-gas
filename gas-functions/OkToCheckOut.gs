function okToCheckOut(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const okCheckbox = findTargetCell(
    location,
    sheet,
    appointment,
    5 // number of rows down that the 'ok to check out' cell is from the patient cell
  );

  if (!okCheckbox || okCheckbox.getValue()) return;

  okCheckbox.setDataValidation(createCheckbox()).setValue(true);

  return;
}