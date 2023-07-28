function addToWaitlist(appointment, animalInfoArray = undefined) {
  // console.log('APPT ID: ', appointment.id, 'beginning of addToWaitlist()')

  // grab correct location's waitlist sheet
  const sheetName = `${whichLocation(appointment.resources[0].id)} Wait List`;
  let waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  // this is to check for the highest empty row.
  let newRow = 7;
  let rowContents = waitlistSheet.getRange('B7:J7');
  const consultID = appointment.consult_id;
  while (!rowContents.isBlank()) {
    // console.log('current row: ', newRow)
    // const ptCell = waitlistSheet.getRange(`C${newRow}:D${newRow}`)
    // console.log('patient cell contents: ', ptCell.getValue(), 'is blank:', ptCell.isBlank());
    // const reasonCell = waitlistSheet.getRange(`I${newRow}:J${newRow}`)
    // console.log('reason cell contents: ', reasonCell.getValue(), 'is blank: ', reasonCell.isBlank());
    // const timeCell = waitlistSheet.getRange(`B${newRow}`)
    // console.log('time cell: ', timeCell.getValue(), 'is blank: ', timeCell.isBlank());
    // const speciesCell = waitlistSheet.getRange(`E${newRow}`)
    // console.log('species dropdown: ', speciesCell.getValue(), 'is blank: ', speciesCell.isBlank())
    // const notesCell = waitlistSheet.getRange(`F${newRow}`)
    // console.log('notes cell: ', notesCell.getValue(), 'is blank: ', notesCell.isBlank());
    // const triageCell = waitlistSheet.getRange(`G${newRow}`)
    // console.log('triage cell: ', triageCell.getValue(), 'is blank: ', triageCell.isBlank());
    // const phoneCell = waitlistSheet.getRange(`H${newRow}`)
    // console.log('phone cell: ', phoneCell.getValue(), 'is blank: ', phoneCell.isBlank());
    

    const link = waitlistSheet.getRange(`C${newRow}:D${newRow}`).getRichTextValue().getLinkUrl();
    // if we find that one of the patient cell links has the consult id, that means it's already on the waitlist
    if (link && link.includes(consultID)) return;
    newRow++;
    rowContents = waitlistSheet.getRange(`B${newRow}:J${newRow}`);

    // console.log('APPT ID: ', appointment.id, 'bottom of while loop for finding empty row on waitlist. new row to check is ', newRow);
  }

  // get info about animal to populate cells
  const [animalName, animalSpecies] = animalInfoArray ? animalInfoArray : getAnimalInfo(appointment.animal_id);
  const lastName = getLastName(appointment.contact_id);

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

  // console.log('APPT ID: ', appointment.id, 'bottom of addToWaitlist()')
  return;
}

// here down is for formatting/inserting content into each individual cell on the waitlist

function createTimeCell(sheet, newRow, time) {
  return formatCell(
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

  return;
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
  return;
}

function createReasonCell(sheet, newRow, reason = "") {
  formatCell(
    sheet
      .getRange('I' + newRow + ':J' + newRow)
      .merge()
      .setValue(reason)
  );
  return;
}

function createCheckboxCell(sheet, newRow, ifChecked) {
  const cell = sheet.getRange('K' + newRow);
  formatCell(cell);

  const rule = createCheckbox();
  cell.setDataValidation(rule);
  cell.setValue(ifChecked);

  return;
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