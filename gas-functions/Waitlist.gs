function addToWaitlist(appointment) {
  // grab correct location's waitlist sheet
  const sheetName = `${whichLocation(appointment.resources[0].id)} Wait List`;

  // downtown doesnt have a waitlist anymore
  if (sheetName === 'DT Wait List') return;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  const waitlistRange = sheet.getRange(`B7:K75`);
  // only checking up through row 75 on the waitlist
  // meaning only up to 69 pets can currently be on the waitlist (it never gets that high currently)
  const rowRange = findRowRange(waitlistRange, appointment.consult_id, 1);
  if (!rowRange) return;

  rowRange.setBackground('#f3f3f3');
  rowRange.setBorder(true, true, true, true, true, true);

  // request from ezyvet to get info about animal to populate cells
  const [animalSpecies, animalName, contactLastName] = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);

  // populate time cell
  const timeCell = rowRange.offset(0, 0, 1, 1);
  timeCell.setValue(getTime(appointment.created_at));

  // populate name cell
  const patientCell = rowRange.offset(0, 1, 1, 2).merge();
  const patientText = `${animalName} ${contactLastName}`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`
  const link = makeLink(patientText, webAddress);
  patientCell.setRichTextValue(link);

  // populate cat or dog dropdown
  const speciesCell = rowRange.offset(0, 3, 1, 1);
  speciesCell.setValue(animalSpecies);

  // reason for visit
  const reasonCell = rowRange.offset(0, 7, 1, 2).merge();
  reasonCell.setValue(appointment.description);

  // set 'in ezyVet?' checkbox to true
  const ezyVetCell = rowRange.offset(0, 9, 1, 1);
  ezyVetCell.setDataValidation(createCheckbox()).setValue(true);

  return;
}