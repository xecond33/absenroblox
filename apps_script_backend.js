// =========================================================================
// AbsensiMap — Google Apps Script Backend
// Petunjuk: Copy seluruh kode ini dan paste di editor Google Apps Script.
// =========================================================================

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// ---- Routing: Handle CORS & Methods ----
function doOptions(e) {
  return buildResponse({ success: true }, 200);
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

// ---- Main Controller ----
function handleRequest(e) {
  try {
    let params = e.parameter;
    
    // Support application/json from POST body
    if (e.postData && e.postData.contents) {
      try {
        const body = JSON.parse(e.postData.contents);
        params = { ...params, ...body };
      } catch (err) {}
    }

    const action = params.action;
    if (!action) return buildResponse({ error: 'Action required' }, 400);

    // Public endpoints
    if (action === 'register') return register(params);
    if (action === 'login') return login(params);

    // Private endpoints (require token)
    const token = params.token;
    const session = getSession(token);
    if (!session) return buildResponse({ error: 'Unauthorized. Silakan login kembali.' }, 401);
    
    const user = getUserById(session.user_id);
    if (!user) return buildResponse({ error: 'User tidak ditemukan' }, 401);

    // User Endpoints
    if (action === 'logout') return logout(token);
    if (action === 'me') return buildResponse({ user: { id: user.id, username: user.username, role: user.role } });
    if (action === 'getItems') return getItems();
    if (action === 'getProgress') return getProgress(user, params.userId);
    if (action === 'updateProgress') return updateProgress(user, params);
    if (action === 'resetProgress') return resetProgress(user, params.userId);

    // Admin Endpoints
    if (user.role !== 'admin') return buildResponse({ error: 'Forbidden. Akses Admin dibutuhkan.' }, 403);

    if (action === 'getUsers') return getUsers();
    if (action === 'addItem') return addItem(params);
    if (action === 'editItem') return editItem(params);
    if (action === 'deleteItem') return deleteItem(params);

    return buildResponse({ error: 'Unknown action' }, 400);
  } catch (err) {
    return buildResponse({ error: err.toString() }, 500);
  }
}

// ---- Auth Functions ----
function register(params) {
  const { username, password } = params;
  if (!username || !password) return buildResponse({ error: 'Username dan password wajib diisi' }, 400);
  if (username.length < 3 || password.length < 6) return buildResponse({ error: 'Username min 3, password min 6 karakter' }, 400);

  const usersSheet = getSheet('Users');
  const users = getSheetData(usersSheet);

  const usernameLower = username.toLowerCase();
  const exists = users.find(u => u.username.toLowerCase() === usernameLower);
  if (exists) return buildResponse({ error: 'Username sudah digunakan' }, 400);

  const role = users.length === 0 ? 'admin' : 'user';
  const id = 'user_' + generateUUID();
  const passHash = hashPassword(password);
  const now = new Date().toISOString();

  usersSheet.appendRow([id, username, passHash, role, now]);

  return buildResponse({ message: 'Registrasi berhasil', user: { id, username, role } });
}

function login(params) {
  const { username, password } = params;
  if (!username || !password) return buildResponse({ error: 'Username dan password wajib diisi' }, 400);

  const users = getSheetData(getSheet('Users'));
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user || user.password_hash !== hashPassword(password)) {
    return buildResponse({ error: 'Username atau password salah' }, 401);
  }

  // Create session
  const token = generateUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
  
  const sessionsSheet = getSheet('Sessions');
  sessionsSheet.appendRow([token, user.id, new Date().toISOString(), expiresAt.toISOString()]);

  return buildResponse({
    message: 'Login berhasil',
    token: token,
    user: { id: user.id, username: user.username, role: user.role }
  });
}

function logout(token) {
  const sheet = getSheet('Sessions');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === token) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return buildResponse({ message: 'Logout berhasil' });
}

// ---- Data Functions ----
function getItems() {
  const items = getSheetData(getSheet('Items'));
  return buildResponse({ items });
}

function getProgress(currentUser, queryUserId) {
  const targetId = queryUserId || currentUser.id;
  
  // User only sees their own, Admin can see anyone's
  if (targetId !== currentUser.id && currentUser.role !== 'admin') {
    return buildResponse({ error: 'Forbidden' }, 403);
  }

  const allProgress = getSheetData(getSheet('Progress'));
  const userProgress = allProgress.filter(p => p.user_id === targetId && p.completed === true || p.completed === "TRUE");

  // Format to { item_id: [day1, day2] }
  const formatted = {};
  userProgress.forEach(p => {
    if (!formatted[p.item_id]) formatted[p.item_id] = [];
    formatted[p.item_id].push(parseInt(p.day_number));
  });

  return buildResponse({ progress: formatted });
}

function updateProgress(currentUser, params) {
  const { itemId, dayNumber, completed } = params;
  if (!itemId || !dayNumber) return buildResponse({ error: 'Invalid params' }, 400);
  
  const isCompleted = completed === true || completed === 'true';
  const sheet = getSheet('Progress');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const idIdx = headers.indexOf('id');
  const userIdx = headers.indexOf('user_id');
  const itemIdx = headers.indexOf('item_id');
  const dayIdx = headers.indexOf('day_number');
  const compIdx = headers.indexOf('completed');
  
  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][userIdx] === currentUser.id && data[i][itemIdx] === itemId && data[i][dayIdx].toString() === dayNumber.toString()) {
      foundRow = i + 1;
      break;
    }
  }

  if (isCompleted) {
    if (foundRow > -1) {
      // Update existing
      sheet.getRange(foundRow, compIdx + 1).setValue(true);
      sheet.getRange(foundRow, headers.indexOf('completed_at') + 1).setValue(new Date().toISOString());
    } else {
      // Insert new
      sheet.appendRow([generateUUID(), currentUser.id, itemId, dayNumber, true, new Date().toISOString()]);
    }
  } else {
    // Remove completion
    if (foundRow > -1) {
      sheet.deleteRow(foundRow);
    }
  }

  return buildResponse({ message: 'Progress updated' });
}

function resetProgress(currentUser, targetUserId) {
  const targetId = targetUserId || currentUser.id;
  if (targetId !== currentUser.id && currentUser.role !== 'admin') return buildResponse({ error: 'Forbidden' }, 403);
  
  const sheet = getSheet('Progress');
  const data = sheet.getDataRange().getValues();
  
  // Delete rows backward to maintain index
  let deletedCount = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === targetId) { // col 1 is user_id
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }

  return buildResponse({ message: 'Progress di-reset' });
}

// ---- Admin Functions ----
function getUsers() {
  const users = getSheetData(getSheet('Users')).map(u => ({
    id: u.id,
    username: u.username,
    role: u.role
  }));
  return buildResponse({ users });
}

function addItem(params) {
  const { name, duration_days, map_name, required_minutes } = params;
  const sheet = getSheet('Items');
  const id = generateUUID();
  const now = new Date().toISOString();
  
  sheet.appendRow([id, name, duration_days, map_name, required_minutes, now, now]);
  
  return buildResponse({ message: 'Item added', item: { id, name, duration_days, map_name, required_minutes } });
}

function editItem(params) {
  const { id, name, duration_days, map_name, required_minutes } = params;
  const sheet = getSheet('Items');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) { // col 0 is id
      sheet.getRange(i + 1, 2).setValue(name);
      sheet.getRange(i + 1, 3).setValue(duration_days);
      sheet.getRange(i + 1, 4).setValue(map_name);
      sheet.getRange(i + 1, 5).setValue(required_minutes);
      sheet.getRange(i + 1, 7).setValue(new Date().toISOString()); // updated_at
      
      // Clean up progress beyond new duration
      cleanupOutdatedProgress(id, duration_days);
      
      return buildResponse({ message: 'Item updated' });
    }
  }
  return buildResponse({ error: 'Item not found' }, 404);
}

function deleteItem(params) {
  const { id } = params;
  const sheet = getSheet('Items');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      
      // Delete associated progress
      const progSheet = getSheet('Progress');
      const progData = progSheet.getDataRange().getValues();
      for (let j = progData.length - 1; j >= 1; j--) {
        if (progData[j][2] === id) { // col 2 is item_id
          progSheet.deleteRow(j + 1);
        }
      }
      
      return buildResponse({ message: 'Item deleted' });
    }
  }
  return buildResponse({ error: 'Item not found' }, 404);
}

function cleanupOutdatedProgress(itemId, maxDays) {
  const sheet = getSheet('Progress');
  const data = sheet.getDataRange().getValues();
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][2] === itemId && parseInt(data[i][3]) > parseInt(maxDays)) {
      sheet.deleteRow(i + 1);
    }
  }
}

// ---- Utility Functions ----
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Initialize headers if new
    if (name === 'Users') sheet.appendRow(['id', 'username', 'password_hash', 'role', 'created_at']);
    if (name === 'Items') {
      sheet.appendRow(['id', 'name', 'duration_days', 'map_name', 'required_minutes', 'created_at', 'updated_at']);
      // Seed data
      const now = new Date().toISOString();
      sheet.appendRow([generateUUID(), '404', 30, '404 Map', 30, now, now]);
      sheet.appendRow([generateUUID(), '90s blok', 30, '90s Block', 45, now, now]);
      sheet.appendRow([generateUUID(), 'flux', 30, 'Flux Map', 30, now, now]);
      sheet.appendRow([generateUUID(), 'lawson', 30, 'Lawson Map', 60, now, now]);
      sheet.appendRow([generateUUID(), 'la miami', 30, 'La Miami Map', 30, now, now]);
      sheet.appendRow([generateUUID(), 'noir pulse', 30, 'Noir Pulse Map', 30, now, now]);
    }
    if (name === 'Progress') sheet.appendRow(['id', 'user_id', 'item_id', 'day_number', 'completed', 'completed_at']);
    if (name === 'Sessions') sheet.appendRow(['token', 'user_id', 'created_at', 'expires_at']);
  }
  return sheet;
}

function getSheetData(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = data[i][j];
    }
    rows.push(rowObj);
  }
  return rows;
}

function getSession(token) {
  if (!token) return null;
  const sessions = getSheetData(getSheet('Sessions'));
  const session = sessions.find(s => s.token === token);
  if (!session) return null;
  
  const expires = new Date(session.expires_at);
  if (expires < new Date()) {
    logout(token);
    return null; // expired
  }
  return session;
}

function getUserById(id) {
  const users = getSheetData(getSheet('Users'));
  return users.find(u => u.id === id);
}

function hashPassword(password) {
  // Simple hashing mechanism using GAS built-in
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  let txtHash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];
    if (hashVal < 0) {
      hashVal += 256;
    }
    if (hashVal.toString(16).length == 1) {
      txtHash += '0';
    }
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

function generateUUID() {
  return Utilities.getUuid();
}

function buildResponse(payload, statusCode = 200) {
  // Always return 200 for JSONP/CORS compatibility in GAS, but include the actual status in payload
  const finalPayload = {
    ...payload,
    status: statusCode
  };
  
  return ContentService.createTextOutput(JSON.stringify(finalPayload))
    .setMimeType(ContentService.MimeType.JSON);
}
