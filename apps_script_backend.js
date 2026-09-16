// ============================================================
// GET PROGRESS USER
// ============================================================
function getProgress(currentUser, queryUserId) {
  const targetId = queryUserId || currentUser.id;

  // User hanya boleh melihat progress sendiri.
  // Admin boleh melihat progress user lain.
  if (targetId !== currentUser.id && currentUser.role !== 'admin') {
    return buildResponse({ error: 'Forbidden' }, 403);
  }

  const allProgress = getSheetData(getSheet('Progress'));

  // FIX: pastikan user_id DAN completed sama-sama cocok
  const userProgress = allProgress.filter(
    p =>
      p.user_id === targetId &&
      (p.completed === true || p.completed === "TRUE")
  );

  /*
    Format:

    progress:
    {
      item_id: [1, 2, 3]
    }

    progressDates:
    {
      item_id: {
        "1": "2026-09-16",
        "2": "2026-09-17"
      }
    }
  */

  const formatted = {};
  const progressDates = {};

  userProgress.forEach(p => {
    const itemId = p.item_id;
    const dayNumber = parseInt(p.day_number);

    if (!formatted[itemId]) {
      formatted[itemId] = [];
    }

    if (!formatted[itemId].includes(dayNumber)) {
      formatted[itemId].push(dayNumber);
    }

    // Simpan tanggal saat Day tersebut dikerjakan
    if (!progressDates[itemId]) {
      progressDates[itemId] = {};
    }

    if (p.completed_at) {
      progressDates[itemId][dayNumber] =
        formatAttendanceDate(p.completed_at);
    }
  });

  return buildResponse({
    progress: formatted,
    progressDates: progressDates
  });
}


// ============================================================
// UPDATE PROGRESS
// ============================================================
function updateProgress(currentUser, params) {
  const { itemId, dayNumber, completed } = params;

  if (!itemId || !dayNumber) {
    return buildResponse({
      error: 'Invalid params'
    }, 400);
  }

  const isCompleted =
    completed === true ||
    completed === 'true';

  const sheet = getSheet('Progress');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const userIdx = headers.indexOf('user_id');
  const itemIdx = headers.indexOf('item_id');
  const dayIdx = headers.indexOf('day_number');
  const compIdx = headers.indexOf('completed');
  const completedAtIdx = headers.indexOf('completed_at');

  if (
    userIdx === -1 ||
    itemIdx === -1 ||
    dayIdx === -1 ||
    compIdx === -1 ||
    completedAtIdx === -1
  ) {
    return buildResponse({
      error: 'Kolom Progress tidak lengkap'
    }, 500);
  }

  let foundRow = -1;

  // Cari progress milik user ini untuk item + day tersebut
  for (let i = 1; i < data.length; i++) {
    if (
      data[i][userIdx] === currentUser.id &&
      data[i][itemIdx] === itemId &&
      data[i][dayIdx].toString() === dayNumber.toString()
    ) {
      foundRow = i + 1;
      break;
    }
  }

  // ==========================================================
  // JIKA USER MENYELESAIKAN DAY
  // ==========================================================
  if (isCompleted) {

    const now = new Date();
    const attendanceDate = formatAttendanceDate(now);

    if (foundRow > -1) {

      // Sudah ada → update
      sheet
        .getRange(foundRow, compIdx + 1)
        .setValue(true);

      sheet
        .getRange(foundRow, completedAtIdx + 1)
        .setValue(now.toISOString());

    } else {

      // Belum ada → tambah
      const id = generateUUID();

      sheet.appendRow([
        id,
        currentUser.id,
        itemId,
        dayNumber,
        true,
        now.toISOString()
      ]);
    }

    return buildResponse({
      message: 'Absensi berhasil dicatat',
      itemId: itemId,
      dayNumber: parseInt(dayNumber),
      date: attendanceDate
    });
  }

  // ==========================================================
  // JIKA USER MEMBATALKAN CHECKLIST DAY
  // ==========================================================
  if (foundRow > -1) {
    sheet.deleteRow(foundRow);
  }

  return buildResponse({
    message: 'Absensi dibatalkan',
    itemId: itemId,
    dayNumber: parseInt(dayNumber)
  });
}


// ============================================================
// FORMAT TANGGAL ABSENSI
// Format: YYYY-MM-DD
// ============================================================
function formatAttendanceDate(dateValue) {
  const date = new Date(dateValue);

  // Menggunakan timezone Spreadsheet
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
