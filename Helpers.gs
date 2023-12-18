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
  if (chResourceIDs.includes(resourceID)) return "CH";

  // 1082 = DT walk in calendar resource
  // 56 = DT Tech appt calendar resource
  // 35, 55, 1015 = DT DVM 1, 2 and 3
  // DT Procedure 1, 2 = 57, 58
  const dtResourceIDs = [1082, 56, 35, 55, 1015, 57, 58];
  if (dtResourceIDs.includes(resourceID)) return "DT";

  // 1083 = WC walk cal resource
  // 60 = WC tech appt cal resource
  // 39, 59, 1384 = WC DVM 1, 2 and 3
  // WC Procedure 1, 2 = 61, 62
  const wcResourceIDs = [1083, 60, 39, 59, 1384, 61, 62];
  if (wcResourceIDs.includes(resourceID)) return "WC";
}

// store info from /animal endpoint
function getAnimalInfo(animalID) {
  const url = `${proxy}/v1/animal/${animalID}`;
  const animal = fetchAndParse(url).items.at(-1).animal;
  const speciesID = animal.species_id;

  let species = '';
  if (speciesID === '1') species = 'K9';
  else if (speciesID === '2') species = 'FEL';

  return [animal.name, species];
}

function getLastName(contactID) {
  const url = `${proxy}/v1/contact/${contactID}`;
  const lastName = fetchAndParse(url).items.at(-1).contact.last_name;

  return lastName;
}

// this is like a promise.all to get animal name and last name at the same time
function getAnimalInfoAndLastName(animalID, contactID) {
  const animalRequest = {
    muteHttpExceptions: true,
    url: `${proxy}/v1/animal/${animalID}`,
    method: "GET",
    headers: {
      authorization: token
    }
  };

  const contactRequest = {
    muteHttpExceptions: true,
    url: `${proxy}/v1/contact/${contactID}`,
    method: "GET",
    headers: {
      authorization: token
    }
  };

  let [animalResponse, contactResponse] = UrlFetchApp.fetchAll([animalRequest, contactRequest]);

  if (animalResponse.getResponseCode() === 401 || contactResponse.getResponseCode() === 401) {
    updateToken();
    token = `${PropertiesService.getScriptProperties().getProperty('ezyVet_token')}`;
    animalRequest.headers.authorization = token;
    contactRequest.headers.authorization = token;
    [animalResponse, contactResponse] = UrlFetchApp.fetchAll([animalRequest, contactRequest]);
  }

  const animalJSON = animalResponse.getContentText();
  const parsedAnimal = JSON.parse(animalJSON);
  const animal = parsedAnimal.items.at(-1).animal;
  const speciesMap = { 1: 'K9', 2: 'FEL' };
  const animalSpecies = speciesMap[animal.species_id];
  const animalName = animal.name;

  const contactJSON = contactResponse.getContentText();
  const parsedContact = JSON.parse(contactJSON);
  const contactLastName = parsedContact.items.at(-1).contact.last_name;

  return { animalSpecies, animalName, contactLastName }
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

// findHighestEmptyCell() returns an array where array[0] = the highest empty cell and array[1] = its row number
// currently used to:
// add in patients manually, InPatient.gs
// add tech appointments, TechAppts.gs
// if firstCol != lastCol that means we're handling a merged cell
// if there's no empty cell in whatever range youre searching through,
// or if we find a link with the consult id already in this range
// returns an empty array
function findHighestEmptyCell(sheet, firstCol, lastCol, firstRow, lastRow, consultID) {
  const range = sheet.getRange(`${firstCol}${firstRow}:${lastCol}${lastRow}`);
  const rows = range.getValues();
  const nameRichTexts = range.getRichTextValues();
  let emptySpot;

  for (let i = 0; i < rows.length; i++) {
    const curContent = rows[i][0];

    if (!emptySpot && !curContent) {
      emptySpot = [
        range.offset(i, 0, 1, lastCol.charCodeAt(0) - firstCol.charCodeAt(0) + 1),
        firstRow + i
      ];
    }

    if (consultID) {
      const link = nameRichTexts[i][0].getLinkUrl();
      if (link && link.includes(consultID)) return [];
    }
  }

  return emptySpot || [];
}

// searches through all of a locations rooms, looking to match the consult id which is held inside each patient's link
// returns the coords for cell that we want to manipulate
function searchForRoomCell(location, sheet, consultID, distanceBelowMain, contactID) {
  const possMainCoords = ['C4', 'D4', 'E4', 'F4', 'G4'];

  if (location === 'DT') {
    possMainCoords.push('H4', 'I4');
  }
  else if (location === 'CH') {
    possMainCoords.push('H4', 'I4', 'C14', 'D14', 'E14', 'F14', 'G14', 'H14');
  }

  let resCoords = checkLinksForID(possMainCoords, sheet, consultID, distanceBelowMain);

  if (!resCoords) {
    resCoords = checkLinksForID(possMainCoords, sheet, contactID, distanceBelowMain);
  }

  return resCoords ? sheet.getRange(resCoords) : undefined;
}

function checkLinksForID(possMainCoords, sheet, id, distanceBelowMain) {
  for (let i = 0; i < possMainCoords.length; i++) {
    const curCoords = possMainCoords[i];
    const cell = sheet.getRange(curCoords);
    const link = cell.getRichTextValue().getLinkUrl();

    if (link && link.includes(id)) {
      const row = parseInt(curCoords.slice(1)) + distanceBelowMain;
      return `${curCoords[0]}${row}`;
    }
  }
}