// for manually adding to in patient column based on changing an appointment to inpatient status in ezyvet
function addInPatient(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const locationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);
  const lastName = getLastName(appointment.contact_id);

  if (location === 'CH') {

    const [nameCell, row] = findHighestMergedCell(locationSheet, ['R', 'S'], 3, 23, animalName, lastName)

    // if name cell doesnt exist that means there's no room in the in patient box.
    // in that case dont do anything
    if (nameCell) {
      populateInpatientRow(
        animalName,
        animalSpecies,
        lastName,
        appointment.consult_id,
        nameCell,
        row,
        locationSheet,
        appointment.description,
        ['U', 'V']
      );
    }
  }

  else {
    // else, its either at DT or WC and their inpatient box is in the same cell coordinates
    const [nameCell, row] = findHighestMergedCell(locationSheet, ['B', 'C'], 14, 29, animalName, lastName)

    if (nameCell) {
      populateInpatientRow(
        animalName,
        animalSpecies,
        lastName,
        appointment.consult_id,
        nameCell,
        row,
        locationSheet,
        appointment.description
      );
    }
  }
}

// this will run with a daily trigger to put scheduled procedures in the in patient box.
function getTodaysAppointments() {
  const today = getTodayRange()
  const url = `${proxy}/v1/appointment?time_range_start=${today[0]}&time_range_end=${today[1]}&limit=200`;
  const options = {
    method: "GET",
    headers: {
      authorization: token
    }
  };
  const response = UrlFetchApp.fetch(url, options);
  const json = response.getContentText();
  const appts = JSON.parse(json)
  checkIfProcedure(appts.items)
}

function checkIfProcedure(arr) {
  // resource IDS, i.e. the procedure columns in ezyVet calendar:
  // WC Procedure 1, 2 = 61, 62
  // CH Procedure 1, 2 = 29, 30
  // DT Procedure 1, 2 = 57, 58
  const chProcedureIDs = ['29', '30'];
  const chProcedures = [];
  const dtProcedureIDs = ['57', '58'];
  const dtProcedures = [];
  const wcProcedureIDs = ['61', '62'];
  const wcProcedures = [];

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

  sortProcedures([chProcedures, dtProcedures, wcProcedures]);

  addScheduledProcedures(chProcedures, 'CH', ['R', 'S'], 3, ['U', 'V']);
  addScheduledProcedures(dtProcedures, 'DT');
  addScheduledProcedures(wcProcedures, 'WC');
}

// procdure cells start at B14:C14, E14:F14 for both WC and DT
function addScheduledProcedures(
  procedureArr,
  sheetName,
  nameCols = ['B', 'C'],
  row = 14,
  reasonCols = ['E', 'F']
) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  for (let i = 0; i < procedureArr.length; i++) {
    const procedure = procedureArr[i];

    const [animalName, animalSpecies] = getAnimalInfo(procedure.animal_id);
    const lastName = getLastName(procedure.contact_id);

    const nameCell = sheet.getRange(`${nameCols[0]}${row}:${nameCols[1]}${row}`);

    populateInpatientRow(
      animalName,
      animalSpecies,
      lastName,
      procedure.consult_id,
      nameCell,
      row,
      sheet,
      procedure.description,
      reasonCols
    )

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
  reasonCols = ['E', 'F']
) {
  const text = `${animalName} ${lastName} (${animalSpecies})`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${consultID}`;
  const link = makeLink(text, webAddress);
  nameCell.setRichTextValue(link);

  const reasonCell = locationSheet.getRange(`${reasonCols[0]}${row}:${reasonCols[1]}${row}`);
  reasonCell.setValue(description);
}

// sort all procedures according to type_id unless its dental. dentals go last
function sortProcedures(locsProcsArray) {
  for (let i = 0; i < locsProcsArray.length; i++) {
    const locationProcedures = locsProcsArray[i];
    locationProcedures.sort((a, b) => {
      const a1 = a.appointment_type_id;
      const b1 = b.appointment_type_id;

      if (a1 === '28') {
        return 1;
      }
      else if (b1 === '28') {
        return -1;
      }
      else {
        return a1 - b1;
      }
    });
  }
}

function getTodayRange() {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const todayStart = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000); // midnight today in seconds
  const todayEnd = Math.floor(new Date(now).setHours(23, 59, 59, 999) / 1000); // end of day in seconds

  return [todayStart, todayEnd];
}