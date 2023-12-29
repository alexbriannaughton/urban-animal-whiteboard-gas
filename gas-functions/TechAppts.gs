function addTechAppt(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const techBoxCoordsMap = new Map([
    ['CH', 'K6:P21'],
    ['DT', 'L3:O11'],
    ['WC', 'K4:N12']
  ]);
  const techBoxCoords = techBoxCoordsMap.get(location);
  const techApptRange = sheet.getRange(techBoxCoords);

  const rowRange = findRowRange(techApptRange, appointment.consult_id, 1);
  if (!rowRange) return;

  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);

  const mainCell = rowRange.offset(0, 1, 1);

  // populate main cell: name, species, reason... and make it a link
  const text = `${animalName} (${animalSpecies}): ${appointment.description}`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(text, webAddress);
  mainCell.setRichTextValue(link);

  // find column to left of mainCell and add time
  mainCell.offset(0, -1, 1, 1).setValue(getTime(appointment.created_at));

  // check the ezyVet checkbox
  const checkboxCell = rowRange.offset(0, rowRange.getNumColumns() - 1, 1, 1);
  checkboxCell.setDataValidation(createCheckbox()).setValue(true);

  return;
}