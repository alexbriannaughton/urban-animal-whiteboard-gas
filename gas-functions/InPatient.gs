const inpatientDefaultColorMap = new Map([
  ['CH', '#f3f3f3'], // gray for cap hill
  ['DT', '#d0e0e3'], // cyan for downtown
  ['WC', '#ead1dc'] // magenta for white center
]);

// returns the range coords for the location's inpatient box
function inpatientBoxCoords(location) {
  return location === 'CH'
    ? 'R3:W36' // coords for cap hills inpatient box
    : 'B14:H42'; // coords for dt and wc inpatient boxes
};

// for manually adding to in patient column based on changing an appointment to inpatient status in ezyvet
function addInPatient(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);
  const inpatientBoxRange = sheet.getRange(inpatientBoxCoords(location));
  const rowRange = findRowRange(inpatientBoxRange, appointment.consult_id, 0);
  if (!rowRange) return;
  rowRange.setBackground(inpatientDefaultColorMap.get(location));
  populateInpatientRow(appointment, rowRange);
  return;
};

function populateInpatientRow(appointment, rowRange) {
  const [animalName, animalSpecies, contactLastName] = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);
  const nameCell = rowRange.offset(0, 0, 1, 1);
  const text = `${animalName} ${contactLastName} (${animalSpecies})`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(text, webAddress);
  nameCell.setRichTextValue(link);
  const reasonCell = rowRange.offset(0, 3, 1, 1);
  reasonCell.setValue(appointment.description);
  return;
};

// this will run with a daily trigger to put scheduled procedures in the in patient box.
function getTodaysAppointments() {
  const today = getTodayRange();
  const url = `${proxy}/v1/appointment?time_range_start=${today[0]}&time_range_end=${today[1]}&limit=200`;
  const appts = fetchAndParse(url);
  return handleTodaysProcedures(appts.items);
};

function getTodayRange() {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const todayStart = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000); // midnight today in seconds
  const todayEnd = Math.floor(new Date(now).setHours(23, 59, 59, 999) / 1000); // end of day in seconds
  return [todayStart, todayEnd];
};

function handleTodaysProcedures(apptItems) {
  // check if appointment is in the procedure column via the ezyvet resource id number, and put it into its corresponding location's array
  const allLocationProcedures = checkIfProcedure(apptItems);

  // sort the procedures based on if its surgery, im, dental, etc.
  // and give it a color based on those categories
  sortAndColorProcedures(allLocationProcedures);

  // allLocationProcedures = [chProcedures, dtProcedures, wcProcedures], therefore,
  const indexToLocationMap = new Map([
    [0, 'CH'],
    [1, 'DT'],
    [2, 'WC']
  ]);

  // add the filtered / sorted procedures to the inpatient box
  allLocationProcedures.forEach((oneLocationProcedures, i) => {
    addScheduledProcedures(oneLocationProcedures, indexToLocationMap.get(i));
  });

  return;
};

function checkIfProcedure(apptItems) {
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


  apptItems.forEach(({ appointment }) => {
    const resourceID = appointment.details.resource_list[0];

    if (chProcedureIDs.includes(resourceID)) {
      chProcedures.push(appointment.details);
    }
    else if (dtProcedureIDs.includes(resourceID)) {
      dtProcedures.push(appointment.details);
    }
    else if (wcProcedureIDs.includes(resourceID)) {
      wcProcedures.push(appointment.details);
    }
  })

  return [chProcedures, dtProcedures, wcProcedures];
};

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
    else return 7; // put last if type_id not mentioned above
  }

  for (const oneLocationProcedures of allProcedures) {
    oneLocationProcedures.sort((a, b) => getColorAndSortValue(a) - getColorAndSortValue(b));
  }

  return;
};

// procedure cells start at B14:C14, E14:F14 for both WC and DT
function addScheduledProcedures(oneLocationProcedures, location) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);
  const inpatientBox = sheet.getRange(inpatientBoxCoords(location));
  clearInpatientBox(inpatientBox, location);
  const numOfColumnsInBox = inpatientBox.getNumColumns();
  let rowOfInpatientBox = 0;
  for (const procedure of oneLocationProcedures) {
    if (!procedure.animal_id) continue; // skip the empty object
    const rowRange = inpatientBox.offset(rowOfInpatientBox++, 0, 1, numOfColumnsInBox);
    rowRange.setBackground(procedure.color || inpatientDefaultColorMap.get(location));
    populateInpatientRow(procedure, rowRange);
  }
  return;
};

function clearInpatientBox(inpatientBox, location) {
  const color = inpatientDefaultColorMap.get(location);
  inpatientBox
    .clearContent()
    .setBackground(color)
    .setFontColor('black')
    .setFontLine(null);
  return;
};