// for manually adding to in patient column based on changing an appointment to inpatient status in ezyvet
function addInPatient(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);
  const lastName = getLastName(appointment.contact_id);
  const dvm = getDvm(appointment.resources[0].id, locationSheet) || undefined;

  if (location === 'CH') {
    const [nameCell, row] = findHighestMergedCell(locationSheet, ['R', 'S'], 3, 23, animalName, lastName);

    // if name cell doesnt exist that means there's no room in the in patient box.
    // in that case dont do anything
    if (!nameCell) return;

    populateInpatientRow(
      animalName,
      animalSpecies,
      lastName,
      appointment.consult_id,
      nameCell,
      row,
      locationSheet,
      appointment.description,
      dvm,
      ['U', 'V']
    );
  }

  else {
    // else, its either at DT or WC and their inpatient box is in the same cell coordinates
    const [nameCell, row] = findHighestMergedCell(locationSheet, ['B', 'C'], 14, 40, animalName, lastName);

    if (!nameCell) return;

    populateInpatientRow(
      animalName,
      animalSpecies,
      lastName,
      appointment.consult_id,
      nameCell,
      row,
      locationSheet,
      appointment.description,
      dvm
    );
  }
}

// this will run with a daily trigger to put scheduled procedures in the in patient box.
function getTodaysAppointments() {
  const today = getTodayRange();
  const url = `${proxy}/v1/appointment?time_range_start=${today[0]}&time_range_end=${today[1]}&limit=200`;
  const options = {
    method: "GET",
    headers: {
      authorization: token
    }
  };
  const response = UrlFetchApp.fetch(url, options);
  const json = response.getContentText();
  const appts = JSON.parse(json);
  checkIfProcedure(appts.items);
}

function checkIfProcedure(arr) {
  // resource IDS, i.e. the procedure columns in ezyVet calendar:
  // WC Procedure 1, 2 = 61, 62
  // CH Procedure 1, 2 = 29, 30, IM = 65, 27
  // DT Procedure 1, 2 = 57, 58
  const chProcedureIDs = ['29', '30', '65', '27'];
  const chProcedures = [{}];
  const dtProcedureIDs = ['57', '58'];
  const dtProcedures = [{}];
  const wcProcedureIDs = ['61', '62'];
  const wcProcedures = [{}];
  // initializing with empty array so that sort/colorize method will be hit even if only one procedure

  arr.forEach((appt) => {
    const resourceID = appt.appointment.details.resource_list[0];
    if (chProcedureIDs.includes(resourceID)) {
      chProcedures.push(appt.appointment.details);
    }
    else if (dtProcedureIDs.includes(resourceID)) {
      dtProcedures.push(appt.appointment.details);
    }
    else if (wcProcedureIDs.includes(resourceID)) {
      wcProcedures.push(appt.appointment.details);
    }
  })

  sortAndColorProcedures([chProcedures, dtProcedures, wcProcedures]);

  addScheduledProcedures(chProcedures, 'CH', ['R', 'S'], 3, ['U', 'V']);
  addScheduledProcedures(dtProcedures, 'DT');
  addScheduledProcedures(wcProcedures, 'WC');
}

// procdure cells start at B14:C14, E14:F14 for both WC and DT
function addScheduledProcedures(
  procedureArr,
  location,
  nameCols = ['B', 'C'],
  row = 14,
  reasonCols = ['E', 'F']
) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  clearInPatientBox(sheet, location)

  for (let i = 0; i < procedureArr.length; i++) {
    const procedure = procedureArr[i];

    // skip the empty object
    if (!procedure.animal_id) continue;

    const lastCol = String.fromCharCode(nameCols[0].charCodeAt(0) + 6);
    sheet.getRange(`${nameCols[0]}${row}:${lastCol}${row}`)
      .setBackground(procedure.color);

    const [animalName, animalSpecies] = getAnimalInfo(procedure.animal_id);
    const lastName = getLastName(procedure.contact_id);

    const nameCell = sheet.getRange(`${nameCols[0]}${row}:${nameCols[1]}${row}`);

    const dvm = getDvm(procedure.resource_list[0], sheet);

    populateInpatientRow(
      animalName,
      animalSpecies,
      lastName,
      procedure.consult_id,
      nameCell,
      row,
      sheet,
      procedure.description,
      dvm,
      reasonCols
    );

    row++;
  }

}

function populateInpatientRow(
  animalName,
  animalSpecies,
  lastName,
  consultID,
  nameCell,
  row,
  locationSheet,
  description,
  dvm,
  reasonCols = ['E', 'F']
) {
  const text = `${animalName} ${lastName} (${animalSpecies})`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${consultID}`;
  const link = makeLink(text, webAddress);
  nameCell.setRichTextValue(link);

  const reasonCell = locationSheet.getRange(`${reasonCols[0]}${row}:${reasonCols[1]}${row}`);
  reasonCell.setValue(description);

  const dvmColumn = String.fromCharCode((reasonCols[0].charCodeAt(0) - 1));
  if (dvm) locationSheet.getRange(`${dvmColumn}${row}`).setValue(dvm);
}

function clearInPatientBox(sheet, location) {
  // clear the in patient box
  let color = '#d0e0e3';
  let inpatientBox = sheet.getRange('B14:H40');

  if (location === 'CH') {
    color = '#f3f3f3';
    inpatientBox = sheet.getRange('R3:W23');
  }
  else if (location === 'WC') color = '#ead1dc';

  inpatientBox.clearContent();
  inpatientBox.setBackground(color);
}

// sort all procedures according to type_id unless its dental. dentals go last
function sortAndColorProcedures(locsProcsArray) {
  // surgery types = surgery, spay/neuter
  const sxTypeIDs = ['7', '76'];
  const ausTypeID = '29';
  const echoTypeID = '30';
  // secondary procedures = acth stim, bile acids, drop off, bgc, hosp patient, lddst, sedated procedure, walk in
  const secondaryTypeIDs = ['31', '32', '82', '33', '83', '38', '36', '37'];
  const dentalTypeID = '28';
  const imTypeIDs = ['26', '34', '27', '35'];
  const healthCertID = '81';

  function getSortValue(procedure) {
    // this function also adds a color to the procedure/appointment object
    const typeID = procedure.appointment_type_id;
    if (typeID === ausTypeID) {
      procedure.color = '#f4cccc';
      return 0;
    }
    else if (typeID === echoTypeID) {
      procedure.color = '#f4cccc';
      return 1;
    }
    else if (sxTypeIDs.includes(typeID)) {
      procedure.color = '#d9ead3';
      return 2;
    }
    else if (secondaryTypeIDs.includes(typeID)) {
      procedure.color = '#fce5cd';
      return 3;
    }
    else if (typeID === dentalTypeID) {
      procedure.color = '	#cfe2f3';
      return 4;
    }
    else if (imTypeIDs.includes(typeID)) {
      procedure.color = '#d9d2e9';
      return 5;
    }
    else if (typeID === healthCertID) {
      procedure.color = '#fff2cc';
      return 6;
    }
    else {
      procedure.color = '#f3f3f3';
      return 7; // Assign a higher value for any other type_id not covered
    }
  }

  for (let i = 0; i < locsProcsArray.length; i++) {
    const locationProcedures = locsProcsArray[i];
    locationProcedures.sort((a, b) => getSortValue(a) - getSortValue(b));
  }
}

function getTodayRange() {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const todayStart = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000); // midnight today in seconds
  const todayEnd = Math.floor(new Date(now).setHours(23, 59, 59, 999) / 1000); // end of day in seconds

  return [todayStart, todayEnd];
}