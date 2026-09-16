// =========================================================================
// AbsensiMap — Google Apps Script Backend
// SISTEM ABSENSI MANUAL
// Tidak menggunakan timer / durasi stay / verifikasi map
// =========================================================================


// ============================================================
// ROUTING
// ============================================================

function doOptions(e) {
  return buildResponse({
    success: true
  }, 200);
}


function doGet(e) {
  return handleRequest(e);
}


function doPost(e) {
  return handleRequest(e);
}


// ============================================================
// MAIN CONTROLLER
// ============================================================

function handleRequest(e) {

  try {

    let params = e.parameter || {};

    // Support JSON POST
    if (
      e.postData &&
      e.postData.contents
    ) {

      try {

        const body =
          JSON.parse(
            e.postData.contents
          );

        params = {
          ...params,
          ...body
        };

      } catch (err) {
        // Abaikan jika bukan JSON
      }
    }


    const action =
      params.action;


    if (!action) {

      return buildResponse({
        error: 'Action required'
      }, 400);

    }


    // ========================================================
    // PUBLIC
    // ========================================================

    if (action === 'register') {
      return register(params);
    }


    if (action === 'login') {
      return login(params);
    }


    // ========================================================
    // SESSION
    // ========================================================

    const token =
      params.token;


    const session =
      getSession(token);


    if (!session) {

      return buildResponse({
        error:
          'Unauthorized. Silakan login kembali.'
      }, 401);

    }


    const user =
      getUserById(
        session.user_id
      );


    if (!user) {

      return buildResponse({
        error:
          'User tidak ditemukan'
      }, 401);

    }


    // ========================================================
    // USER ENDPOINTS
    // ========================================================

    if (action === 'logout') {

      return logout(token);

    }


    if (action === 'me') {

      return buildResponse({

        user: {

          id: user.id,

          username:
            user.username,

          role:
            user.role

        }

      });

    }


    if (action === 'getItems') {

      return getItems();

    }


    if (action === 'getProgress') {

      return getProgress(
        user,
        params.userId
      );

    }


    if (action === 'updateProgress') {

      return updateProgress(
        user,
        params
      );

    }


    if (action === 'resetProgress') {

      return resetProgress(
        user,
        params.userId
      );

    }


    // ========================================================
    // ADMIN ONLY
    // ========================================================

    if (user.role !== 'admin') {

      return buildResponse({

        error:
          'Forbidden. Akses Admin dibutuhkan.'

      }, 403);

    }


    if (action === 'getUsers') {

      return getUsers();

    }


    if (action === 'addItem') {

      return addItem(params);

    }


    if (action === 'editItem') {

      return editItem(params);

    }


    if (action === 'deleteItem') {

      return deleteItem(params);

    }


    return buildResponse({

      error:
        'Unknown action'

    }, 400);


  } catch (err) {

    return buildResponse({

      error:
        err.toString()

    }, 500);

  }

}


// ============================================================
// AUTH — REGISTER
// ============================================================

function register(params) {

  const username =
    String(
      params.username || ''
    ).trim();


  const password =
    String(
      params.password || ''
    );


  if (
    !username ||
    !password
  ) {

    return buildResponse({

      error:
        'Username dan password wajib diisi'

    }, 400);

  }


  if (
    username.length < 3 ||
    password.length < 6
  ) {

    return buildResponse({

      error:
        'Username min 3, password min 6 karakter'

    }, 400);

  }


  const usersSheet =
    getSheet('Users');


  const users =
    getSheetData(
      usersSheet
    );


  const usernameLower =
    username.toLowerCase();


  const exists =
    users.some(function (u) {

      return (
        String(
          u.username
        ).toLowerCase()
        === usernameLower
      );

    });


  if (exists) {

    return buildResponse({

      error:
        'Username sudah digunakan'

    }, 400);

  }


  // User pertama otomatis admin
  const role =
    users.length === 0
      ? 'admin'
      : 'user';


  const id =
    'user_' +
    generateUUID();


  const passHash =
    hashPassword(
      password
    );


  const now =
    new Date()
      .toISOString();


  usersSheet.appendRow([

    id,

    username,

    passHash,

    role,

    now

  ]);


  return buildResponse({

    success: true,

    message:
      'Registrasi berhasil',

    user: {

      id:
        id,

      username:
        username,

      role:
        role

    }

  });

}


// ============================================================
// AUTH — LOGIN
// ============================================================

function login(params) {

  const username =
    String(
      params.username || ''
    ).trim();


  const password =
    String(
      params.password || ''
    );


  if (
    !username ||
    !password
  ) {

    return buildResponse({

      error:
        'Username dan password wajib diisi'

    }, 400);

  }


  const users =
    getSheetData(
      getSheet('Users')
    );


  const user =
    users.find(function (u) {

      return (
        String(
          u.username
        ).toLowerCase()
        ===
        username.toLowerCase()
      );

    });


  if (
    !user ||
    user.password_hash
      !== hashPassword(password)
  ) {

    return buildResponse({

      error:
        'Username atau password salah'

    }, 401);

  }


  // ========================================================
  // CREATE SESSION
  // ========================================================

  const token =
    generateUUID();


  const expiresAt =
    new Date();


  expiresAt.setDate(
    expiresAt.getDate() + 30
  );


  const sessionsSheet =
    getSheet('Sessions');


  sessionsSheet.appendRow([

    token,

    user.id,

    new Date()
      .toISOString(),

    expiresAt
      .toISOString()

  ]);


  return buildResponse({

    success: true,

    message:
      'Login berhasil',

    token:
      token,

    user: {

      id:
        user.id,

      username:
        user.username,

      role:
        user.role

    }

  });

}


// ============================================================
// LOGOUT
// ============================================================

function logout(token) {

  const sheet =
    getSheet('Sessions');


  const data =
    sheet
      .getDataRange()
      .getValues();


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    if (
      String(data[i][0])
      === String(token)
    ) {

      sheet.deleteRow(
        i + 1
      );

      break;

    }

  }


  return buildResponse({

    success: true,

    message:
      'Logout berhasil'

  });

}


// ============================================================
// ITEMS
// ============================================================

function getItems() {

  const items =
    getSheetData(
      getSheet('Items')
    );


  return buildResponse({

    success: true,

    items:
      items

  });

}


// ============================================================
// GET PROGRESS
// ============================================================

function getProgress(
  currentUser,
  queryUserId
) {

  const targetId =
    queryUserId ||
    currentUser.id;


  // User hanya boleh melihat dirinya sendiri
  if (
    String(targetId)
    !==
    String(currentUser.id)
    &&
    currentUser.role !== 'admin'
  ) {

    return buildResponse({

      error:
        'Forbidden'

    }, 403);

  }


  const allProgress =
    getSheetData(
      getSheet('Progress')
    );


  // ========================================================
  // FILTER PROGRESS USER
  // ========================================================

  const userProgress =
    allProgress.filter(
      function (p) {

        return (

          String(p.user_id)
          ===
          String(targetId)

          &&

          (
            p.completed === true

            ||

            String(
              p.completed
            ).toUpperCase()
            === 'TRUE'
          )

        );

      }
    );


  const formatted = {};

  const progressDates = {};


  // ========================================================
  // FORMAT DATA
  // ========================================================

  userProgress.forEach(
    function (p) {

      const itemId =
        String(
          p.item_id
        );


      const dayNumber =
        parseInt(
          p.day_number,
          10
        );


      if (
        isNaN(dayNumber)
      ) {
        return;
      }


      if (
        !formatted[itemId]
      ) {

        formatted[itemId] = [];

      }


      if (
        !formatted[itemId]
          .includes(dayNumber)
      ) {

        formatted[itemId]
          .push(dayNumber);

      }


      // ====================================================
      // SIMPAN TANGGAL ABSENSI
      // ====================================================

      if (
        p.completed_at
      ) {

        if (
          !progressDates[itemId]
        ) {

          progressDates[itemId] = {};

        }


        progressDates[itemId][
          String(dayNumber)
        ] =
          formatAttendanceDate(
            p.completed_at
          );

      }

    }
  );


  // ========================================================
  // TANGGAL HARI INI MENURUT SPREADSHEET
  // ========================================================

  const today =
    formatAttendanceDate(
      new Date()
    );


  return buildResponse({

    success: true,

    progress:
      formatted,

    progressDates:
      progressDates,

    today:
      today

  });

}


// ============================================================
// UPDATE PROGRESS / ABSENSI
// ============================================================

function updateProgress(
  currentUser,
  params
) {

  const itemId =
    params.itemId;


  const dayNumber =
    params.dayNumber;


  const completed =
    params.completed;


  if (
    !itemId ||
    dayNumber === undefined ||
    dayNumber === null ||
    dayNumber === ''
  ) {

    return buildResponse({

      error:
        'Item ID dan Day wajib diisi'

    }, 400);

  }


  const isCompleted =
    completed === true
    ||
    String(completed)
      .toLowerCase()
      === 'true';


  const sheet =
    getSheet('Progress');


  const data =
    sheet
      .getDataRange()
      .getValues();


  const headers =
    data[0];


  const userIdx =
    headers.indexOf(
      'user_id'
    );


  const itemIdx =
    headers.indexOf(
      'item_id'
    );


  const dayIdx =
    headers.indexOf(
      'day_number'
    );


  const compIdx =
    headers.indexOf(
      'completed'
    );


  const completedAtIdx =
    headers.indexOf(
      'completed_at'
    );


  if (
    userIdx === -1 ||
    itemIdx === -1 ||
    dayIdx === -1 ||
    compIdx === -1 ||
    completedAtIdx === -1
  ) {

    return buildResponse({

      error:
        'Kolom pada sheet Progress tidak lengkap'

    }, 500);

  }


  // ========================================================
  // CARI DATA YANG SUDAH ADA
  // ========================================================

  let foundRow = -1;


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    const rowUser =
      String(
        data[i][userIdx]
      );


    const rowItem =
      String(
        data[i][itemIdx]
      );


    const rowDay =
      String(
        data[i][dayIdx]
      );


    if (

      rowUser
      ===
      String(currentUser.id)

      &&

      rowItem
      ===
      String(itemId)

      &&

      rowDay
      ===
      String(dayNumber)

    ) {

      foundRow =
        i + 1;

      break;

    }

  }


  // ========================================================
  // ABSEN / CENTANG DAY
  // ========================================================

  if (isCompleted) {

    const now =
      new Date();


    const attendanceDate =
      formatAttendanceDate(
        now
      );


    // ------------------------------------------------------
    // Jika data sudah ada
    // ------------------------------------------------------

    if (
      foundRow > -1
    ) {

      sheet
        .getRange(
          foundRow,
          compIdx + 1
        )
        .setValue(true);


      sheet
        .getRange(
          foundRow,
          completedAtIdx + 1
        )
        .setValue(
          now.toISOString()
        );

    }

    // ------------------------------------------------------
    // Jika belum ada, buat data baru
    // ------------------------------------------------------

    else {

      sheet.appendRow([

        generateUUID(),

        currentUser.id,

        String(itemId),

        Number(dayNumber),

        true,

        now.toISOString()

      ]);

    }


    SpreadsheetApp.flush();


    return buildResponse({

      success: true,

      message:
        'Absensi berhasil dicatat',

      itemId:
        String(itemId),

      dayNumber:
        Number(dayNumber),

      date:
        attendanceDate,

      today:
        attendanceDate

    });

  }


  // ========================================================
  // BATALKAN ABSEN
  // ========================================================

  if (
    foundRow > -1
  ) {

    sheet.deleteRow(
      foundRow
    );


    SpreadsheetApp.flush();

  }


  return buildResponse({

    success: true,

    message:
      'Absensi dibatalkan',

    itemId:
      String(itemId),

    dayNumber:
      Number(dayNumber)

  });

}


// ============================================================
// RESET PROGRESS
// ============================================================

function resetProgress(
  currentUser,
  targetUserId
) {

  const targetId =
    targetUserId ||
    currentUser.id;


  if (
    String(targetId)
    !==
    String(currentUser.id)
    &&
    currentUser.role !== 'admin'
  ) {

    return buildResponse({

      error:
        'Forbidden'

    }, 403);

  }


  const sheet =
    getSheet('Progress');


  const data =
    sheet
      .getDataRange()
      .getValues();


  let deletedCount = 0;


  // Hapus dari bawah
  for (
    let i = data.length - 1;
    i >= 1;
    i--
  ) {

    if (
      String(data[i][1])
      ===
      String(targetId)
    ) {

      sheet.deleteRow(
        i + 1
      );

      deletedCount++;

    }

  }


  return buildResponse({

    success: true,

    message:
      'Progress di-reset',

    deleted:
      deletedCount

  });

}


// ============================================================
// ADMIN — USERS
// ============================================================

function getUsers() {

  const users =
    getSheetData(
      getSheet('Users')
    );


  const result =
    users.map(
      function (u) {

        return {

          id:
            u.id,

          username:
            u.username,

          role:
            u.role

        };

      }
    );


  return buildResponse({

    success: true,

    users:
      result

  });

}


// ============================================================
// ADMIN — ADD ITEM
// ============================================================

function addItem(params) {

  const name =
    params.name;


  const duration_days =
    params.duration_days;


  const map_name =
    params.map_name || '';


  const required_minutes =
    params.required_minutes || 0;


  const sheet =
    getSheet('Items');


  const id =
    generateUUID();


  const now =
    new Date()
      .toISOString();


  sheet.appendRow([

    id,

    name,

    duration_days,

    map_name,

    required_minutes,

    now,

    now

  ]);


  return buildResponse({

    success: true,

    message:
      'Item added',

    item: {

      id:
        id,

      name:
        name,

      duration_days:
        duration_days,

      map_name:
        map_name,

      required_minutes:
        required_minutes

    }

  });

}


// ============================================================
// ADMIN — EDIT ITEM
// ============================================================

function editItem(params) {

  const id =
    params.id;


  const name =
    params.name;


  const duration_days =
    params.duration_days;


  const map_name =
    params.map_name || '';


  const required_minutes =
    params.required_minutes || 0;


  const sheet =
    getSheet('Items');


  const data =
    sheet
      .getDataRange()
      .getValues();


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    if (
      String(data[i][0])
      ===
      String(id)
    ) {

      // Nama
      sheet
        .getRange(
          i + 1,
          2
        )
        .setValue(
          name
        );


      // Durasi hari
      sheet
        .getRange(
          i + 1,
          3
        )
        .setValue(
          duration_days
        );


      // Map
      sheet
        .getRange(
          i + 1,
          4
        )
        .setValue(
          map_name
        );


      // Required minutes
      sheet
        .getRange(
          i + 1,
          5
        )
        .setValue(
          required_minutes
        );


      // Updated at
      sheet
        .getRange(
          i + 1,
          7
        )
        .setValue(
          new Date()
            .toISOString()
        );


      // Hapus progress Day
      // yang melebihi durasi baru
      cleanupOutdatedProgress(
        id,
        duration_days
      );


      return buildResponse({

        success: true,

        message:
          'Item updated'

      });

    }

  }


  return buildResponse({

    error:
      'Item not found'

  }, 404);

}


// ============================================================
// ADMIN — DELETE ITEM
// ============================================================

function deleteItem(params) {

  const id =
    params.id;


  const sheet =
    getSheet('Items');


  const data =
    sheet
      .getDataRange()
      .getValues();


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    if (
      String(data[i][0])
      ===
      String(id)
    ) {

      // Hapus item
      sheet.deleteRow(
        i + 1
      );


      // Hapus progress terkait
      const progSheet =
        getSheet('Progress');


      const progData =
        progSheet
          .getDataRange()
          .getValues();


      for (
        let j =
          progData.length - 1;
        j >= 1;
        j--
      ) {

        if (
          String(progData[j][2])
          ===
          String(id)
        ) {

          progSheet.deleteRow(
            j + 1
          );

        }

      }


      return buildResponse({

        success: true,

        message:
          'Item deleted'

      });

    }

  }


  return buildResponse({

    error:
      'Item not found'

  }, 404);

}


// ============================================================
// CLEANUP PROGRESS
// ============================================================

function cleanupOutdatedProgress(
  itemId,
  maxDays
) {

  const sheet =
    getSheet('Progress');


  const data =
    sheet
      .getDataRange()
      .getValues();


  for (
    let i = data.length - 1;
    i >= 1;
    i--
  ) {

    const rowItem =
      String(
        data[i][2]
      );


    const rowDay =
      parseInt(
        data[i][3],
        10
      );


    if (
      rowItem ===
      String(itemId)

      &&

      rowDay >
      parseInt(
        maxDays,
        10
      )
    ) {

      sheet.deleteRow(
        i + 1
      );

    }

  }

}


// ============================================================
// SHEET MANAGEMENT
// ============================================================

function getSheet(name) {

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  let sheet =
    ss.getSheetByName(name);


  if (!sheet) {

    sheet =
      ss.insertSheet(name);


    // ======================================================
    // USERS
    // ======================================================

    if (
      name === 'Users'
    ) {

      sheet.appendRow([

        'id',

        'username',

        'password_hash',

        'role',

        'created_at'

      ]);

    }


    // ======================================================
    // ITEMS
    // ======================================================

    if (
      name === 'Items'
    ) {

      sheet.appendRow([

        'id',

        'name',

        'duration_days',

        'map_name',

        'required_minutes',

        'created_at',

        'updated_at'

      ]);


      const now =
        new Date()
          .toISOString();


      // Data awal
      sheet.appendRow([

        generateUUID(),

        '404',

        30,

        '404 Map',

        30,

        now,

        now

      ]);


      sheet.appendRow([

        generateUUID(),

        '90s blok',

        30,

        '90s Block',

        45,

        now,

        now

      ]);


      sheet.appendRow([

        generateUUID(),

        'flux',

        30,

        'Flux Map',

        30,

        now,

        now

      ]);


      sheet.appendRow([

        generateUUID(),

        'lawson',

        30,

        'Lawson Map',

        60,

        now,

        now

      ]);


      sheet.appendRow([

        generateUUID(),

        'la miami',

        30,

        'La Miami Map',

        30,

        now,

        now

      ]);


      sheet.appendRow([

        generateUUID(),

        'noir pulse',

        30,

        'Noir Pulse Map',

        30,

        now,

        now

      ]);

    }


    // ======================================================
    // PROGRESS
    // ======================================================

    if (
      name === 'Progress'
    ) {

      sheet.appendRow([

        'id',

        'user_id',

        'item_id',

        'day_number',

        'completed',

        'completed_at'

      ]);

    }


    // ======================================================
    // SESSIONS
    // ======================================================

    if (
      name === 'Sessions'
    ) {

      sheet.appendRow([

        'token',

        'user_id',

        'created_at',

        'expires_at'

      ]);

    }

  }


  return sheet;

}


// ============================================================
// GET SHEET DATA
// ============================================================

function getSheetData(sheet) {

  const data =
    sheet
      .getDataRange()
      .getValues();


  if (
    data.length <= 1
  ) {

    return [];

  }


  const headers =
    data[0];


  const rows = [];


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    const rowObj = {};


    for (
      let j = 0;
      j < headers.length;
      j++
    ) {

      rowObj[
        headers[j]
      ] =
        data[i][j];

    }


    rows.push(
      rowObj
    );

  }


  return rows;

}


// ============================================================
// SESSION CHECK
// ============================================================

function getSession(token) {

  if (!token) {
    return null;
  }


  const sessions =
    getSheetData(
      getSheet('Sessions')
    );


  const session =
    sessions.find(
      function (s) {

        return (
          String(s.token)
          ===
          String(token)
        );

      }
    );


  if (!session) {

    return null;

  }


  const expires =
    new Date(
      session.expires_at
    );


  if (
    expires < new Date()
  ) {

    logout(token);

    return null;

  }


  return session;

}


// ============================================================
// GET USER
// ============================================================

function getUserById(id) {

  const users =
    getSheetData(
      getSheet('Users')
    );


  return users.find(
    function (u) {

      return (
        String(u.id)
        ===
        String(id)
      );

    }
  ) || null;

}


// ============================================================
// PASSWORD HASH
// ============================================================

function hashPassword(
  password
) {

  const rawHash =
    Utilities.computeDigest(

      Utilities.DigestAlgorithm
        .SHA_256,

      password,

      Utilities.Charset.UTF_8

    );


  let txtHash = '';


  for (
    let i = 0;
    i < rawHash.length;
    i++
  ) {

    let hashVal =
      rawHash[i];


    if (
      hashVal < 0
    ) {

      hashVal += 256;

    }


    let hex =
      hashVal.toString(16);


    if (
      hex.length === 1
    ) {

      txtHash += '0';

    }


    txtHash += hex;

  }


  return txtHash;

}


// ============================================================
// UUID
// ============================================================

function generateUUID() {

  return Utilities.getUuid();

}


// ============================================================
// FORMAT TANGGAL ABSENSI
// ============================================================

function formatAttendanceDate(
  dateValue
) {

  const date =
    new Date(
      dateValue
    );


  const timezone =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSpreadsheetTimeZone();


  return Utilities.formatDate(

    date,

    timezone,

    'yyyy-MM-dd'

  );

}


// ============================================================
// RESPONSE
// ============================================================

function buildResponse(
  payload,
  statusCode
) {

  if (
    statusCode === undefined
  ) {

    statusCode = 200;

  }


  const finalPayload = {

    ...payload,

    status:
      statusCode

  };


  return ContentService

    .createTextOutput(
      JSON.stringify(
        finalPayload
      )
    )

    .setMimeType(
      ContentService.MimeType.JSON
    );

}
