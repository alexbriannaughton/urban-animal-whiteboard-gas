// check if utc timestamp is today in PST
function isTodayPST(timestamp) {
  const date = new Date(timestamp * 1000); // convert timestamp to a date object
  const pstDate = Utilities.formatDate(date, 'PST', 'yyyy-MM-dd'); // convert to PST date string
  const todayPST = Utilities.formatDate(new Date(), 'PST', 'yyyy-MM-dd'); // current date in PST
  return pstDate === todayPST // compare date components
}

// convert utc time stamp to 12 hour time
// used for converting ezyVet timestamps
function getTime(timestamp) {
  const now = new Date(timestamp * 1000);
  const hour = now.getHours() > 12
    ? now.getHours() - 12
    : now.getHours();
  const minute = now.getMinutes() < 10
    ? `0${now.getMinutes()}`
    : now.getMinutes();
  return hour + ":" + minute;
}

// check which urban animal facility based on appointment resource id
function whichLocation(resourceID) {

  // 1081 = calendar resource for CH walk-in
  // 28 = calendar resource for CH Tech appt
  // 24, 25, 26, 1063 = CH DVM 1, 2, 3 and 4
  // CH Procedure 1, 2 = 29, 30
  // IM columns = 65, 27
  const chResourceIDs = [1081, 28, 24, 25, 26, 1063, 29, 30, 65, 27];

  // 1082 = DT walk in calendar resource
  // 56 = DT Tech appt calendar resource
  // 35, 55, 1015 = DT DVM 1, 2 and 3
  // DT Procedure 1, 2 = 57, 58
  const dtResourceIDs = [1082, 56, 35, 55, 1015, 57, 58];

  // 1083 = WC walk cal resource
  // 60 = WC tech appt cal resource
  // 39, 59, 1384 = WC DVM 1, 2 and 3
  // WC Procedure 1, 2 = 61, 62
  const wcResourceIDs = [1083, 60, 39, 59, 1384, 61, 62];

  if (chResourceIDs.includes(resourceID)) return "CH";
  else if (dtResourceIDs.includes(resourceID)) return "DT";
  else if (wcResourceIDs.includes(resourceID)) return "WC";
}

// store info from /animal endpoint
function getAnimalInfo(animalID) {
  const url = `${proxy}/v1/animal/${animalID}`;
  const options = {
    method: "GET",
    headers: {
      authorization: token
    }
  };
  const response = UrlFetchApp.fetch(url, options);
  const json = response.getContentText();
  const animal = JSON.parse(json).items[0].animal;

  const species = animal.species_id === '1' ? "K9" : "FEL";

  return [animal.name, species];
}

function getLastName(contactID) {
  const url = `${proxy}/v1/contact/${contactID}`;
  const options = {
    method: "GET",
    headers: {
      authorization: token
    }
  };
  const response = UrlFetchApp.fetch(url, options);
  const json = response.getContentText();
  const lastName = JSON.parse(json).items[0].contact.last_name;

  return lastName;
}

function makeLink(text, webAddress) {
  const link = SpreadsheetApp.newRichTextValue()
    .setText(text)
    .setLinkUrl(webAddress)
    .build();
  return link;
}

function createCheckbox() {
  return SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build();
}

// format a plain cell
function formatCell(cell) {
  cell
    .setBackground('#f3f3f3')
    .setBorder(true, true, true, true, true, true);
}

// find the highest empty merged cell, return it and its row
function findHighestMergedCell(sheet, cols, row, rowLimit, animalName, lastName) {
  let cell = sheet.getRange(`${cols[0]}${row}:${cols[1]}${row}`);

  while (!cell.isBlank()) {
    // if a animalName and lastName is provided, we are checking to see if the pet is already somewhere in the column
    if (animalName && lastName) {
      if (cell.getValue().includes(`${animalName} ${lastName}`)) {
        return [];
      }
    }

    row++;

    // return empty array to properly handle if the box/column is full
    if (row > rowLimit) return [];
    
    cell = sheet.getRange(`${cols[0]}${row}:${cols[1]}${row}`);
  }

  return [cell, row];
}


// below this line are currently unused functions.

// get hour and minute from JS Date object
// function getJSTime() {
//   const currentDate = new Date(Date.now());

//   let hours = currentDate.getHours();
//   let minutes = currentDate.getMinutes();

//   hours = hours % 12 || 12; // Handle 0 and 12 as 12
//   minutes = minutes < 10 ? `0${minutes}` : minutes;

//   // Display the time
//   const time12HourFormat = `${hours}:${minutes}`;

//   return time12HourFormat;
// }

// function createDropdown(choicesArray) {
//   return SpreadsheetApp
//     .newDataValidation()
//     .requireValueInList(choicesArray)
//     .build();
// }

// function getRespTime(timestamp) {
//   const ezyVetTime = new Date(timestamp * 1000).getMinutes()
//   let timeReceived = new Date().getMinutes()
//   if (ezyVetTime > timeReceived) ezyVetTime += 60
//   return timeReceived - ezyVetTime
// }