function addToWaitlist(appointment) {
  // grab correct location's waitlist sheet
  const sheetName = `${whichLocation(appointment.resources[0].id)} Wait List`;
  const waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  // get info about animal to populate cells
  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);
  const lastName = getLastName(appointment.contact_id);

  // this is to check for the highest empty cell. it only checks if the time, name, and reason are empty
  let newRow = 7;
  let rowContents1 = waitlistSheet.getRange('B7:C7');
  let rowContents2 = waitlistSheet.getRange('I7:J7')
  while (!rowContents1.isBlank() && !rowContents2.isBlank()) {
    newRow++;
    rowContents1 = waitlistSheet.getRange(`B${newRow}:C${newRow}`);
    rowContents2 = waitlistSheet.getRange(`I${newRow}:J${newRow}`)
  }

  // time
  createTimeCell(waitlistSheet, newRow, getTime(appointment.created_at));

  // name
  createPatientCell(waitlistSheet, newRow, animalName, lastName, appointment.consult_id);

  // cat or dog
  createSpeciesCell(waitlistSheet, newRow, animalSpecies);

  // notes/triaged/phone sections
  formatCell(
    waitlistSheet.getRange('F' + newRow + ':H' + newRow)
  );

  // no need to create triage dropdown.
  // sheet will try to format like cells above it, and the dropdown from the sheet UI looks better.
  // createTriageDropdown(waitlistSheet, newRow);

  // reason for visit
  createReasonCell(waitlistSheet, newRow, appointment.description);

  // in ezyVet?
  createCheckboxCell(waitlistSheet, newRow, true);
}


// here down is for formatting/inserting content into each individual cell on the waitlist

function createTimeCell(sheet, newRow, time) {
  formatCell(
    sheet
      .getRange('B' + newRow)
      .setValue(time)
  )
}

function createPatientCell(sheet, newRow, patientName = "", lastName = "", consultID = undefined) {
  const cell = sheet.getRange('C' + newRow + ':D' + newRow).merge();
  formatCell(cell);
  
  if (consultID !== undefined) {
    const text = `${patientName} ${lastName}`
    const link = makeLink(text, `${sitePrefix}/?recordclass=Consult&recordid=${consultID}`);
    cell.setRichTextValue(link);
  }
}

function createSpeciesCell(sheet, newRow, species = "") {
  // again, we are not currently creating dropdowns through Apps Script. The Sheets UI one is better.
  // const catDogDropdown = createDropdown(['', 'K9', 'FEL']);
  formatCell(
    sheet
      .getRange('E' + newRow)
      // .setDataValidation(catDogDropdown)
      .setValue(species)
  );
}

function createReasonCell(sheet, newRow, reason = "") {
  formatCell(
    sheet
      .getRange('I' + newRow + ':J' + newRow)
      .merge()
      .setValue(reason)
  );
}

function createCheckboxCell(sheet, newRow, ifChecked) {
  const cell = sheet.getRange('K' + newRow);
  formatCell(cell);

  const rule = createCheckbox();
  cell.setDataValidation(rule);
  cell.setValue(ifChecked);
}

// this is currently unused. using dropdown created directly from Sheet UI instead.
// function createTriageDropdown(sheet, newRow) {
//   const triageDropdown = createDropdown(['Triaging', 'Bumped', 'OKTW', 'Declined'])
//   sheet
//     .getRange('G' + newRow)
//     .setDataValidation(triageDropdown);
// }

// for manually adding patients to waitlist
// this isn't being used. i think it would require giving everyone direct access to the apps script
// function addRow() {
//   const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
//   const newRow = sheet.getLastRow() + 1;

//   // current time
//   createTimeCell(sheet, newRow, getJSTime())

//   // patient
//   createPatientCell(sheet, newRow);

//   // cat or dog
//   createSpeciesCell(sheet, newRow);

//   // format notes/triaged/phone sections.
//   formatCell(
//     sheet.getRange('F' + newRow + ':H' + newRow)
//   );

//   // no need to create triage dropdown.
//   // sheet will try to format like cells above it, and the dropdown from the sheet UI looks better.
//   // createTriageDropdown(sheet, newRow);

//   // reason for visit
//   createReasonCell(sheet, newRow);

//   // in ezyVet ?
//   createCheckboxCell(sheet, newRow, false)
// }