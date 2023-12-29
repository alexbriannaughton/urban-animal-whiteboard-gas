// singular get request to ezyvet api that will grab a new token if we get a 401 reponse
function fetchAndParse(url) {
  const options = {
    muteHttpExceptions: true,
    method: "GET",
    headers: {
      authorization: token
    }
  };

  let response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() === 401) {
    options.headers.authorization = updateToken();
    response = UrlFetchApp.fetch(url, options);
  }

  const json = response.getContentText();
  return JSON.parse(json);
}

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
// note: webhooks send resourceIDs as numbers, but get requests for appointments send resourceIDs as strings
// this function only works for parsing webhooks (resourceIDs as numbers)
function whichLocation(resourceID) {
  const resourceIDToLocationMap = new Map();

  // calendar resource ids for CH:
  // 24: CH DVM 1
  // 25: CH DVM 2
  // 26: CH DVM 3
  // 27: CH INT MED
  // 28: CH Tech
  // 29: CH Procedure 1
  // 30: CH Procedure 2
  // 65: CH IM Procedure
  // 1063: CH DVM 4
  // 1081: Walk Ins (with CH as dept)
  [24, 25, 26, 27, 28, 29, 30, 65, 1063, 1081]
    .forEach(id => resourceIDToLocationMap
      .set(id, 'CH')
    );

  // calendar resource ids for DT:
  // 35: DT DVM 1(Light)
  // 55: DT DVM 2(West)
  // 56: DT Tech
  // 57: DT Procedure 1
  // 58: DT Procedure 2
  // 1015: DT DVM 3(Kreyenhagen)
  // 1082: Walk Ins(Relief DVM)(with DT as dept)
  [35, 55, 56, 57, 58, 1015, 1082]
    .forEach(id => resourceIDToLocationMap
      .set(id, 'DT')
    );

  // calendar resource ids for WC:
  // 39: WC DVM 1
  // 59: WC DVM 2
  // 60: WC Tech
  // 61: WC Procedure 1
  // 62: WC Procedure 2
  // 1083: Walk Ins(with WC as dept)
  // 1384: WC DVM 3
  [39, 59, 60, 61, 62, 1083, 1384]
    .forEach(id => resourceIDToLocationMap
      .set(id, 'WC')
    );

  return resourceIDToLocationMap.get(resourceID);
}

// check if status ID is an appointment status for being in a room
function isRoomStatus(statusID) {
  // rooms two through ten are have status ids of 25 through 33
  // the following status ids we also handle as if they are a room status
  // 18, // room 1
  // 36, // room 11,
  // 39, // in dog lobby,
  // 40, // in cat lobby

  return (statusID >= 25 && statusID <= 33) || [18, 36, 39, 40].includes(statusID);
}

// use fetchAndParse() to store pet name and species from /animal endpoint
function getAnimalInfo(animalID) {
  const url = `${proxy}/v1/animal/${animalID}`;
  const animal = fetchAndParse(url).items.at(-1).animal;
  const speciesMap = { 1: 'K9', 2: 'FEL' };
  const species = speciesMap[animal.species_id] || '';

  return [animal.name, species];
}

// use fetchAndParse() to store last name from /contact endpoint
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
    animalRequest.headers.authorization = updateToken();
    contactRequest.headers.authorization = token;
    [animalResponse, contactResponse] = UrlFetchApp.fetchAll([animalRequest, contactRequest]);
  }

  const animalJSON = animalResponse.getContentText();
  const parsedAnimal = JSON.parse(animalJSON);
  const animal = parsedAnimal.items.at(-1).animal;
  const speciesMap = { 1: 'K9', 2: 'FEL' };
  const animalSpecies = speciesMap[animal.species_id] || '';

  const contactJSON = contactResponse.getContentText();
  const parsedContact = JSON.parse(contactJSON);
  const contactLastName = parsedContact.items.at(-1).contact.last_name;

  return [animalSpecies, animal.name, contactLastName]
}

function makeLink(text, webAddress) {
  return SpreadsheetApp
    .newRichTextValue()
    .setText(text)
    .setLinkUrl(webAddress)
    .build();
}

function createCheckbox() {
  return SpreadsheetApp
    .newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(false)
    .build();
}

// for this appointments room, findTargetCell() returns the range object for the cell that we want to manipulate, i.e. the ready cell or the ok to checkout cell
// returns undefined if we do not find a cell that contains a link with this appointments consult id or contact id
function findTargetCell(
  location,
  sheet,
  appointment,
  targetCellRowsBelowMain // number of rows down that the target cell is from the patient cell
) {

  const locationPtCellRanges = getLocationPtCellRanges(location, sheet);

  return checkLinksForID(
    locationPtCellRanges,
    appointment,
    targetCellRowsBelowMain
  );

}

function getLocationPtCellRanges(location, sheet) {
  // if location === 'WC', these are the only coords
  const possCoords = ['C4:C4', 'D4:D4', 'E4:E4', 'F4:F4', 'G4:G4'];

  if (location === 'DT') possCoords.push('H4:H4', 'I4:I4');

  else if (location === 'CH') {
    possCoords.push('H4:H4', 'I4:I4', 'C14:C14', 'D14:D14', 'E14:E14', 'F14:F14', 'G14:G14', 'H14:H14', 'I14:I14');
  }

  return sheet.getRangeList(possCoords).getRanges();
}

function checkLinksForID(
  locationPtCellRanges,
  appointment,
  targetCellRowsBelowMain
) {

  for (let i = 0; i < locationPtCellRanges.length; i++) {
    const ptCell = locationPtCellRanges[i];
    const link = ptCell.getRichTextValue().getLinkUrl();

    if (!link) continue;

    if (foundCorrectRoom(link, appointment)) {
      return ptCell.offset(targetCellRowsBelowMain, 0);
    }
  }

}

function foundCorrectRoom(link, appointment) {
  const linkIDInfo = link.split('?')[1] // this is the query string
    .split('&') // this is the params
    .map((str) => str.split('=')[1]); // this is [idType, id]
  const linkIDType = linkIDInfo[0];
  const linkID = parseInt(linkIDInfo[1]);
  return (linkIDType === 'Consult' && linkID === appointment.consult_id) || (linkIDType === 'Contact' && linkID === appointment.contact_id)
}

// findRowRange() returns the range for the highest unpopulated row within the given range
// this will return undefined in 2 conditions:
// 1 - there's already a link with this appointment's consult id within the range
// (meaning the consult is already there, so we do want to populate it again)
// 2 - theres no room to put anything in this range
function findRowRange(range, consultID, keyToConsultID) {
  const rowContents = range.getValues();
  const patientNameRichText = range.getRichTextValues();
  let emptyRowRange;

  for (let i = 0; i < rowContents.length; i++) {
    const link = patientNameRichText[i][keyToConsultID].getLinkUrl();
    // if we find that one of the patient cell links has the consult id, that means it's already on the waitlist, so return undefined
    if (link?.includes(consultID)) return;

    // if we haven't already found the highest empty row and every item within this rowContents array is falsy, this is the highest empty row
    if (!emptyRowRange && rowContents[i].every(cellContents => !cellContents)) {
      emptyRowRange = range.offset(i, 0, 1)
    }
  }

  return emptyRowRange;
}