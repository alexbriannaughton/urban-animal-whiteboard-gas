// for manually adding to in patient column based on changing an appointment to inpatient status in ezyvet
function addInPatient(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  if (location === 'CH') {
    // arguments for findHighestEmptyCell:
    // R - S is the merged cell where the name/link is inputted
    // in patient box is from row 3 to 23
    const [nameCell, row] = findHighestEmptyCell(locationSheet, 'R', 'S', 3, 36, appointment.consult_id);

    // if name cell doesnt exist that means there's no room in the in patient box.
    // in that case dont do anything
    if (!nameCell) return;

    const { animalName, animalSpecies, contactLastName } = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);

    // color the row gray
    locationSheet.getRange(`R${row}:W${row}`).setBackground('#f3f3f3');

    populateInpatientRow(
      animalName,
      animalSpecies,
      contactLastName,
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
    const [nameCell, row] = findHighestEmptyCell(locationSheet, 'B', 'C', 14, 42, appointment.consult_id);

    if (!nameCell) return;

    const { animalName, animalSpecies, contactLastName } = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);

    // color the row cyan if dt and magenta if wc
    const fullRow = locationSheet.getRange(`B${row}:H${row}`);
    if (location === 'DT') {
      fullRow.setBackground('#d0e0e3')
    }
    else fullRow.setBackground('#ead1dc')

    populateInpatientRow(
      animalName,
      animalSpecies,
      contactLastName,
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
  return checkIfProcedureColumn(appts.items);
}

function checkIfProcedureColumn(arr) {
  // check if appointment is in the procedure column via the ezyvet resource id number

  // CH Procedure 1, 2 = resource ids 29, 30,
  // CH INT MED, IM procedure resource ids = 27, 65
  const chProcedureIDs = ['29', '30', '27', '65'];

  // DT Procedure 1, 2 = resource ids 57, 58
  const dtProcedureIDs = ['57', '58'];

  // WC Procedure 1, 2 = resource ids 61, 62
  const wcProcedureIDs = ['61', '62'];

  // initializing with empty object so that sort/colorize function can be hit even if only one procedure
  const chProcedures = [{}];
  const dtProcedures = [{}];
  const wcProcedures = [{}];


  arr.forEach((appt) => {
    const resourceID = appt.appointment.details.resource_list[0]; // returns a strings

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

// procedure cells start at B14:C14, E14:F14 for both WC and DT
function addScheduledProcedures(
  procedureArr,
  location,
  nameCols = ['B', 'C'],
  row = 14,
  reasonCols = ['E', 'F']
) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  clearInPatientBox(sheet, location);

  const defaultColorMap = new Map([
    ['CH', '#f3f3f3'],
    ['DT', '#d0e0e3'],
    ['WC', '#ead1dc']
  ]);

  for (let i = 0; i < procedureArr.length; i++) {
    const procedure = procedureArr[i];

    // skip the empty object
    if (!procedure.animal_id) continue;

    const lastCol = location === 'CH' ? 'W' : 'H';
    sheet.getRange(`${nameCols[0]}${row}:${lastCol}${row}`)
      .setBackground(procedure.color || defaultColorMap.get(location));

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
    inpatientBox = sheet.getRange('B14:H42');
  }

  inpatientBox
    .clearContent()
    .setBackground(color)
    .setFontColor('black')
    .setFontLine(null);

  return;
}

function sortAndColorProcedures(allProcedures) {
  const typeIDToNameMap = new Map();

  // ezyVet typeID: procedure name

  // surgery type ids:
  // 7: surgery
  // 76: spay/neuter
  // 89: downtown - spay/neuter
  // 90: downtown - surgery
  ['7', '76', '89', '90'].forEach(id => typeIDToNameMap.set(id, 'sx'));

  // ultrasound types ids:
  // 29: ultrasound
  // 91: downtown - ultrasound
  ['29', '91'].forEach(id => typeIDToNameMap.set(id, 'aus'));

  // echocardiogram, just one id, and it's its own category. echo id is 30
  typeIDToNameMap.set('30', 'echo');

  // dental type ids:
  // 28: dental
  // 86: downtown - dental
  // 94: dental - wc friday
  ['28', '86', '94'].forEach(id => typeIDToNameMap.set(id, 'dental'));

  // secondary type ids:
  // 31: acth stim test
  // 32: bile acids test
  // 33: glucose curve
  // 36: sedated procedure
  // 38: LDDST
  // 82: drop off
  // 83: hospitalized patient
  // 88: downtown sedated procedure
  const secondaryTypeIDs = ['31', '32', '33', '36', '38', '82', '83', '88'];
  secondaryTypeIDs.forEach(id => typeIDToNameMap.set(id, 'secondary'))

  // im type ids:
  // 26: IM consult (department set to CH)
  // 27: IM recheck(dept set to CH)
  // 34: IM procedure(dept set to CH)
  // 35: IM tech appt(dept set to ch)
  // however, we are sorting a coloring IM appts based on their resource ID.
  // other words: anything in IM column, despite appt type, is sorted/colorized as IM

  // health certificate appointments, just one id, and it's its own category. health certificate is 81
  typeIDToNameMap.set('81', 'h/c');

  function getColorAndSortValue(procedure) {
    // this function also adds a color to the procedure/appointment object
    const resourceID = procedure.resource_list?.at(0);
    if (!resourceID) return;

    const procedureName = typeIDToNameMap.get(procedure.appointment_type_id);

    // anything that is in the IM column, despite the appointment_type, will be grouped as IM
    if (resourceID === '27' || resourceID === '65') {
      procedure.color = '#d9d2e9'; // light purple
      return 5;
    }
    else if (procedureName === 'sx') {
      procedure.color = '#d9ead3'; // light green
      return 0;
    }
    else if (procedureName === 'aus') {
      procedure.color = '#fce5cd'; // light orangish
      return 1;
    }
    else if (procedureName === 'echo') {
      procedure.color = '#f4cccc'; // light red
      return 2;
    }
    else if (procedureName === 'secondary') {
      procedure.color = '#cfe2f3'; // light blue 3
      return 3;
    }
    else if (procedureName === 'dental') {
      procedure.color = '#fff2cc'; // light yellowish
      return 4;
    }
    else if (procedureName === 'h/c') {
      procedure.color = '#d9d2e9'; // light purple
      return 6;
    }
    else return 7; // put last if type_id not covered
  }

  for (const locationProcedures of allProcedures) {
    locationProcedures.sort((a, b) => getColorAndSortValue(a) - getColorAndSortValue(b));
  }

  return;

}

function getTodayRange() {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const todayStart = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000); // midnight today in seconds
  const todayEnd = Math.floor(new Date(now).setHours(23, 59, 59, 999) / 1000); // end of day in seconds

  return [todayStart, todayEnd];
}