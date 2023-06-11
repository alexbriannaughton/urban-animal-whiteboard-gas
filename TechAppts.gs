function addTechAppt(appointment) {
  // grab correct location and sheet
  const location = whichLocation(appointment.resources[0].id);
  const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  if (location === 'CH') {
    // ch tech appointments column has three cells that are merged so it requires unique handling
    return addCHTechAppt(appointment, locationSheet);
  }

  else {
    // this is a normal tech appointment handler, that doesn't require the merged cells like CH
    let mainColumn;
    let mainRow;

    if (location === "DT") {
      mainColumn = 'M';
      mainRow = '5';
    }

    else if (location === "WC") {
      mainColumn = 'L';
      mainRow = '4';
    }

    let mainCell = locationSheet.getRange(`${mainColumn}${mainRow}`);

    // find the highest tech cell that is blank
    while (!mainCell.isBlank()) {
      mainRow++;
      mainCell = locationSheet.getRange(`${mainColumn}${mainRow}`);
    }

    // dont do anything if there's no room in the tech box
    if (location === "DT" && mainRow > 11) return;
    if (location === "WC" && mainRow > 15) return;

    // fetch the animal's info
    const animalInfo = getAnimalInfo(appointment.animal_id);

    // add name and reason with a link to clinical record to mainCell
    const text = `${animalInfo[0]} (${animalInfo[1]}), ${appointment.description}`;
    const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`;
    const link = makeLink(text, webAddress);
    mainCell.setRichTextValue(link);

    // find column to left of mainCell and add time
    let column = String.fromCharCode(mainColumn.charCodeAt(0) - 1);
    locationSheet.getRange(`${column}${mainRow}`)
      .setValue(getTime(appointment.created_at));

    // check the ezyVet checkbox
    column = String.fromCharCode(mainColumn.charCodeAt(0) + 2);
    const checkboxCell = locationSheet.getRange(`${column}${mainRow}`);
    formatCell(checkboxCell);
    techCheckbox(checkboxCell);
  }
}

// bc of the merged cells in the tech column on the CH page, adding tech requires its own handling
function addCHTechAppt(appointment, locationSheet) {
  // grab highest available cell in tech column
  const [mainCell, row] = findHighestMergedCell(locationSheet, ['L', 'N'], 5, 21);

  // get the animal's info
  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);

  // add name and reason with a link to clinical record
  const text = `${animalName} (${animalSpecies}), ${appointment.description}`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(text, webAddress);
  mainCell.setRichTextValue(link);

  // add time to column k
  locationSheet.getRange(`K${row}`)
    .setValue(getTime(appointment.created_at));

  // check the ezyvet checkbox
  const checkboxCell = locationSheet.getRange(`P${row}`)
  techCheckbox(checkboxCell);
}

function techCheckbox(cell) {
  const checkbox = createCheckbox();
  cell.setDataValidation(checkbox).setValue(true);
}