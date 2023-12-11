// for manually adding to in patient column based on changing an appointment to inpatient status in ezyvet
function addInPatient(appointment) {


  const location = whichLocation(appointment.resources[0].id);
  const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  if (location === 'CH') {
    // arguments for findHighestEmptyCell:
    // R - S is the merged cell where the name/link is inputted
    // in patient box is from row 3 to 23
    const [nameCell, row] = findHighestEmptyCell(locationSheet, 'R', 'S', 3, 23, appointment.consult_id);

    // if name cell doesnt exist that means there's no room in the in patient box.
    // in that case dont do anything
    if (!nameCell) return;

    const {
      animalInfo: [animalName, animalSpecies],
      contactLastName: lastName
    } = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);

    // color the row gray
    locationSheet.getRange(`R${row}:W${row}`).setBackground('#f3f3f3');

    populateInpatientRow(
      animalName,
      animalSpecies,
      lastName,
      appointment.consult_id,
      nameCell,
      row,
      locationSheet,
      appointment.description,
      // dvm,
      ['U', 'V']
    );
  }

  else {
    // else, its either at DT or WC and their inpatient box is in the same cell coordinates

    const lowestInpatientRow = location === 'DT' ? 23 : 42;

    const [nameCell, row] = findHighestEmptyCell(locationSheet, 'B', 'C', 14, lowestInpatientRow, appointment.consult_id);

    if (!nameCell) return;

    const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);
    const lastName = getLastName(appointment.contact_id);

    // color the row cyan if dt and magenta if wc
    const fullRow = locationSheet.getRange(`B${row}:H${row}`);
    if (location === 'DT') {
      fullRow.setBackground('#d0e0e3')
    }
    else fullRow.setBackground('#ead1dc')

    populateInpatientRow(
      animalName,
      animalSpecies,
      lastName,
      appointment.consult_id,
      nameCell,
      row,
      locationSheet,
      appointment.description,
      // dvm
    );
  }

  // console.log(`appointment ${appointment.id} at bottom of addInPatient()`);

  return;
}

// this will run with a daily trigger to put scheduled procedures in the in patient box.
function getTodaysAppointments() {
  const today = getTodayRange();
  const url = `${proxy}/v1/appointment?time_range_start=${today[0]}&time_range_end=${today[1]}&limit=200`;
  const appts = fetchAndParse(url);
  return checkIfProcedure(appts.items);
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
  // initializing with empty object so that sort/colorize method will be hit even if only one procedure

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

  return;
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

  clearInPatientBox(sheet, location);

  for (let i = 0; i < procedureArr.length; i++) {
    // stop if were getting into today's exam's on the dt sheet
    if (location === 'DT' && row > 23) return;

    const procedure = procedureArr[i];

    // skip the empty object
    if (!procedure.animal_id) continue;

    const lastCol = location === 'CH' ? 'W' : 'H';
    sheet.getRange(`${nameCols[0]}${row}:${lastCol}${row}`)
      .setBackground(procedure.color);

    const [animalName, animalSpecies] = getAnimalInfo(procedure.animal_id);
    const lastName = getLastName(procedure.contact_id);

    const nameCell = sheet.getRange(`${nameCols[0]}${row}:${nameCols[1]}${row}`);

    // const dvm = getDvm(procedure.resource_list[0], sheet);

    populateInpatientRow(
      animalName,
      animalSpecies,
      lastName,
      procedure.consult_id,
      nameCell,
      row,
      sheet,
      procedure.description,
      // dvm,
      reasonCols
    );

    row++;
  }

  return;
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
  // dvm,
  reasonCols = ['E', 'F']
) {
  const text = `${animalName} ${lastName} (${animalSpecies})`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${consultID}`;
  const link = makeLink(text, webAddress);
  nameCell.setRichTextValue(link);

  const reasonCell = locationSheet.getRange(`${reasonCols[0]}${row}:${reasonCols[1]}${row}`);
  reasonCell.setValue(description);

  // const dvmColumn = String.fromCharCode((reasonCols[0].charCodeAt(0) - 1));
  // if (dvm) locationSheet.getRange(`${dvmColumn}${row}`).setValue(dvm);

  return;
}

function clearInPatientBox(sheet, location) {
  let color;
  let inpatientBox;

  if (location === 'CH') {
    color = '#f3f3f3';
    inpatientBox = sheet.getRange('R3:W36');
  }
  else if (location === 'WC') {
    color = '#ead1dc';
    inpatientBox = sheet.getRange('B14:H42');
  }
  // else if location === 'DT'
  else {
    color = '#d0e0e3';
    inpatientBox = sheet.getRange('B14:H23');
  }

  inpatientBox
    .clearContent()
    .setBackground(color)
    .setFontColor('black')
    .setFontLine(null);

  return;
}

// sort all procedures according to type_id unless its dental. dentals go last
function sortAndColorProcedures(locsProcsArray) {
  // surgery types = surgery, spay/neuter
  const sxTypeIDs = ['7', '76'];
  const ausTypeID = '29';
  const echoTypeID = '30';
  // secondary procedures = acth stim, bile acids, drop off, bgc, hosp patient, lddst, sedated procedure, walk in, tech
  const secondaryTypeIDs = ['31', '32', '82', '33', '83', '38', '36', '37', '17'];
  const dentalTypeID = '28';
  const imTypeIDs = ['26', '34', '27', '35'];
  const healthCertID = '81';

  function getSortValue(procedure) {
    // this function also adds a color to the procedure/appointment object
    if (!procedure.resource_list) return;
    const resource = procedure.resource_list[0];
    const typeID = procedure.appointment_type_id;

    // anything that is in the IM column, despite the appointment_type, will be grouped as IM
    if (imTypeIDs.includes(typeID) || resource == 27 || resource == 65) {
      procedure.color = '#d9d2e9';
      return 5;
    }
    else if (typeID === ausTypeID) {
      procedure.color = '#f4cccc';
      return 0;
    }
    else if (typeID === echoTypeID) {
      procedure.color = '#f4cccc';
      return 1;
    }
    else if (sxTypeIDs.includes(typeID)) {
      // light green 3
      procedure.color = '#d9ead3';
      return 2;
    }
    else if (secondaryTypeIDs.includes(typeID)) {
      procedure.color = '#fce5cd';
      return 3;
    }
    else if (typeID === dentalTypeID) {
      // light blue 3
      procedure.color = '#cfe2f3';
      return 4;
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

  return;
}

function getTodayRange() {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const todayStart = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000); // midnight today in seconds
  const todayEnd = Math.floor(new Date(now).setHours(23, 59, 59, 999) / 1000); // end of day in seconds

  return [todayStart, todayEnd];
}