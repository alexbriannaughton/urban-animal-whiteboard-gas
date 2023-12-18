function addTechAppt(appointment) {
  // console.log(`appointment ${appointment.id} at top of addTechAppt()`);

  const location = whichLocation(appointment.resources[0].id);
  const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  let firstColumn, lastColumn, firstRow, lastRow;
  if (location === 'CH') {
    firstColumn = 'L';
    lastColumn = 'N';
    firstRow = 6;
    lastRow = 21;
  }
  else if (location === "DT") {
    firstColumn = 'M';
    lastColumn = 'M';
    firstRow = 5;
    lastRow = 11
  }
  else if (location === "WC") {
    firstColumn = 'L';
    lastColumn = 'L'
    firstRow = 4;
    lastRow = 15;
  }

  const [ mainCell, mainRow ] = findHighestEmptyCell(locationSheet, firstColumn, lastColumn, firstRow, lastRow);

  if (!mainCell) return;

  const [ animalName, animalSpecies ] = getAnimalInfo(appointment.animal_id);

  // populate main cell: name, species, reason... and make it a link
  const text = `${animalName} (${animalSpecies}), ${appointment.description}`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(text, webAddress);
  mainCell.setRichTextValue(link);

  // find column to left of mainCell and add time
  mainCell.offset(0, -1, 1, 1).setValue(getTime(appointment.created_at));

  // check the ezyVet checkbox
  const checkboxOffsetColumn = lastColumn.charCodeAt(0) - firstColumn.charCodeAt(0) + 2;
  const checkboxCell = mainCell.offset(0, checkboxOffsetColumn, 1, 1);
  checkboxCell.setDataValidation(createCheckbox()).setValue(true);

  // console.log(`appointment ${appointment.id} at bottom of addTechAppt()`);
  
  return;
}