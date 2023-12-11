function addToWaitlist(appointment, animalInfoArray = undefined) {
  // console.log(`appointment ${appointment.id} at top of addToWaitlist()`);

  // grab correct location's waitlist sheet
  const sheetName = `${whichLocation(appointment.resources[0].id)} Wait List`;

  // downtown doesnt have a waitlist anymore
  if (sheetName === 'DT Wait List') {
    console.log('returning from dt waitlist');
    return;
  }

  let waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  // console.log(`appointment ${appointment.id}: waitlist sheet grabbed`);

  const newRow = findHighestEmptyRow(waitlistSheet, appointment.consult_id);
  // the findHighestEmptyRow function only checks up to row 50. if all rows up to 50 are populated with something, dont do anything (return)
  if (!newRow) return;
  // console.log(`appointment ${appointment.id}: highest empty row found, row ${newRow}`);
  const rowRange = waitlistSheet.getRange('B' + newRow + ':K' + newRow);
  rowRange.setBackground('#f3f3f3');
  rowRange.setBorder(true, true, true, true, true, true);

  // get info about animal to populate cells
  let animalName, animalSpecies, lastName;
  if (!animalInfoArray) {
    const { animalInfo, contactLastName } = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);
    [animalName, animalSpecies] = animalInfo;
    lastName = contactLastName;
  }
  else {
    [animalName, animalSpecies] = animalInfoArray;
    lastName = getLastName(appointment.contact_id);
  }

  // console.log(`appointment ${appointment.id}: completed fetches for animalname and lastname`);

  // populate time cell
  const timeCell = rowRange.offset(0, 0, 1, 1);
  timeCell.setValue(getTime(appointment.created_at));

  // populate name cell
  const patientCell = rowRange.offset(0, 1, 1, 2).merge();
  const patientText = `${animalName} ${lastName}`;
  const link = makeLink(patientText, `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`);
  patientCell.setRichTextValue(link);

  // populate cat or dog dropdown
  const speciesCell = rowRange.offset(0, 3, 1, 1);
  speciesCell.setValue(animalSpecies);

  // reason for visit
  const reasonCell = rowRange.offset(0, 7, 1, 2).merge();
  reasonCell.setValue(appointment.description);

  // in ezyVet?
  const ezyVetCell = rowRange.offset(0, 9, 1, 1);
  ezyVetCell.setDataValidation(createCheckbox()).setValue(true);

  // console.log(`appointment ${appointment.id}: populated all cells and at bottom of addToWaitlist()`);

  return;
}

function findHighestEmptyRow(waitlistSheet, consultID) {
  const allRowsRange = waitlistSheet.getRange(`B7:J75`);
  const rowContents = allRowsRange.getValues();
  const patientNameRichText = allRowsRange.getRichTextValues();

  for (let i = 0; i < rowContents.length; i++) {
    const link = patientNameRichText[i][1].getLinkUrl();
    // if we find that one of the patient cell links has the consult id, that means it's already on the waitlist, so return
    if (link && link.includes(consultID)) return;

    // if every item within the rowContents array is an empty string
    if (rowContents[i].every(cell => cell === '')) {
      // return that row bc it's the highest empty row
      return i + 7
    }
  }
}