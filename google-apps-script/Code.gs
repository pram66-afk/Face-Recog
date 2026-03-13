/**
 * AMS QR — VTU Attendance System
 * Google Apps Script Backend (acts as REST API for the React frontend)
 * 
 * SETUP:
 * 1. Create a Google Sheet with these tabs: Users, Sessions, Attendance, Subjects, Timetable, Rooms, Notifications
 * 2. Copy the Sheet ID from the URL (the long string between /d/ and /edit)
 * 3. Paste it in SHEET_ID below
 * 4. Deploy this script as a Web App: Deploy > New Deployment > Web App > "Anyone" access
 * 5. Copy the deployment URL into your React app's .env.local as VITE_APPS_SCRIPT_URL
 */

// ============================================================
// CONFIGURATION — UPDATE THIS WITH YOUR GOOGLE SHEET ID
// ============================================================
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';
const SECRET_KEY = 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING_FOR_PRODUCTION'; // Secret for HMAC

// ============================================================
// HELPERS
// ============================================================

function getSheet(tabName) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(tabName);
}

function sheetToJSON(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateToken() {
  // Legacy function - kept for compatibility if needed, but unused in new flow
  return 'TKN_' + Date.now() + '_' + Utilities.getUuid().replace(/-/g, '').substring(0, 10);
}

function generateSignedToken(sessionId) {
  const timestamp = Date.now();
  const data = sessionId + '::' + timestamp;
  const signature = Utilities.computeHmacSha256Signature(data, SECRET_KEY);
  const signatureHex = signature.map(function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
  
  return `TKN_HMAC_${sessionId}_${timestamp}_${signatureHex}`;
}

function generateId() {
  return 'id_' + Utilities.getUuid().replace(/-/g, '').substring(0, 10);
}

// ============================================================
// GET HANDLER (doGet)
// ============================================================

function doGet(e) {
  try {
    const action = e.parameter.action;

    switch (action) {
      case 'login':
        return handleLogin(e.parameter);
      case 'getActiveSession':
        return handleGetActiveSession(e.parameter);
      case 'getTimetable':
        return handleGetTimetable(e.parameter);
      case 'getAttendanceLogs':
        return handleGetAttendanceLogs(e.parameter);
      case 'getStudentStats':
        return handleGetStudentStats(e.parameter);
      case 'getAdminStats':
        return handleGetAdminStats();
      case 'getRooms':
        return handleGetRooms();
      case 'getStudentHistory':
        return handleGetStudentHistory(e.parameter);
      case 'getAllStudents':
        return handleGetAllStudents();
      case 'getStudentsForSection':
        return handleGetStudentsForSection(e.parameter);
      case 'getFacultyRecords':
        return handleGetFacultyRecords(e.parameter);
      case 'getSubjects':
        return handleGetSubjects(e.parameter);
      case 'getSwappableClasses':
        return handleGetSwappableClasses(e.parameter);
      case 'getNotifications':
        return handleGetNotifications(e.parameter);
      case 'getFaceData':
        return handleGetFaceData(e.parameter);
      case 'forgotPassword':
        return handleForgotPassword(e.parameter);
      case 'seedData':
        seedData();
        return jsonResponse({ success: true, message: 'Seed data created successfully' });
      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// POST HANDLER (doPost)
// ============================================================

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {
      case 'createSession':
        return handleCreateSession(body);
      case 'rotateToken':
        return handleRotateToken(body);
      case 'registerFace':
        return handleRegisterFace(body);
      case 'endSession':
        return handleEndSession(body);
      case 'markAttendance':
        return handleMarkAttendance(body);
      case 'markManualAttendance':
        return handleMarkManualAttendance(body);
      case 'addClass':
        return handleAddClass(body);
      case 'changePassword':
        return handleChangePassword(body);
      case 'cancelClass':
        return handleCancelClass(body);
      case 'swapClass':
        return handleSwapClass(body); // Updated logic
      case 'markNotificationRead':
        return handleMarkNotificationRead(body);
      default:
        return jsonResponse({ success: false, error: 'Unknown POST action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// AUTH
// ============================================================

function handleLogin(params) {
  const { userId, password } = params;
  const sheet = getSheet('Users');
  const users = sheetToJSON(sheet);

  const user = users.find(u => 
    (u.USN === userId || u.Email === userId) && String(u.Password) === String(password)
  );

  if (!user) {
    return jsonResponse({ success: false, error: 'Invalid credentials' });
  }

  // Log the login session
  try {
    const logSheet = getSheet('LoginLogs');
    if (logSheet) {
      logSheet.appendRow([
        user.USN || user.Email,
        user.Role,
        new Date().toISOString(),
        params.userAgent || 'Unknown'
      ]);
    }
  } catch (e) {
    console.error('Failed to log login session', e);
  }

  return jsonResponse({
    success: true,
    user: {
      id: user.USN || user.Email,
      name: user.Name,
      role: user.Role,
      email: user.Email,
      usn: user.USN || '',
      semester: user.Semester || '',
      section: user.Section || '',
      department: user.Department || '',
      avatarInitials: user.Name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    }
  });
}

function handleChangePassword(body) {
  const { userId, oldPassword, newPassword } = body;
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const usnCol = headers.indexOf('USN');
  const emailCol = headers.indexOf('Email');
  const passwordCol = headers.indexOf('Password');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if ((String(row[usnCol]) === String(userId) || String(row[emailCol]) === String(userId))) {
      if (String(row[passwordCol]) === String(oldPassword)) {
        sheet.getRange(i + 1, passwordCol + 1).setValue(newPassword);
        return jsonResponse({ success: true, message: 'Password changed successfully' });
      } else {
        return jsonResponse({ success: false, error: 'Incorrect previous password' });
      }
    }
  }

  return jsonResponse({ success: false, error: 'User not found' });
}

function handleForgotPassword(params) {
  const { email } = params;
  const sheet = getSheet('Users');
  const users = sheetToJSON(sheet);
  const user = users.find(u => String(u.Email).toLowerCase() === String(email).toLowerCase());

  if (!user) {
    return jsonResponse({ success: false, error: 'No user found with this email' });
  }

  try {
    const subject = 'Password Recovery - AMS Attendance System';
    const body = `Hello ${user.Name},\n\nYour current password for the AMS Attendance System is: ${user.Password}\n\nPlease log in and change your password for security.\n\nBest regards,\nAMS System Admin`;
    
    // Switch to GmailApp as it's more robust for Web Apps
    GmailApp.sendEmail(email, subject, body);
    return jsonResponse({ success: true, message: 'Password reset email sent' });
  } catch (e) {
    const errorMsg = e.toString();
    if (errorMsg.includes('permission')) {
      return jsonResponse({ 
        success: false, 
        error: 'Email permission not granted. Please open the Script Editor, run any function manually once to authorize, and then re-deploy as a New Version.' 
      });
    }
    return jsonResponse({ success: false, error: 'Failed to send email: ' + errorMsg });
  }
}

/**
 * AUTHORIZATION HELPER:
 * Run this function manually once in the Apps Script editor (press "Run")
 * to trigger the permission popup for Gmail/Email.
 */
function authorizeEmail() {
  GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Auth Test', 'Permissions granted!');
}

// ============================================================
// SESSIONS
// ============================================================

function handleCreateSession(body) {
  const sheet = getSheet('Sessions');
  const sessionId = generateId();
  const token = generateSignedToken(sessionId);
  const now = new Date();

  // body: { facultyId, subjectCode, subjectName, room, section, endTime }
  sheet.appendRow([
    sessionId,
    body.facultyId,
    body.subjectCode,
    body.subjectName,
    body.room,
    body.section || '',
    token,
    now.toISOString(),
    body.endTime || '',
    'ONGOING',
    body.lat || '',
    body.lng || ''
  ]);

  return jsonResponse({
    success: true,
    session: {
      sessionId: sessionId,
      token: token,
      startTime: now.toISOString(),
      status: 'ONGOING'
    }
  });
}

function handleGetActiveSession(params) {
  const sheet = getSheet('Sessions');
  const sessions = sheetToJSON(sheet);

  // Find all ONGOING sessions, optionally filter by facultyId
  let activeSessions = sessions.filter(s => s.Status === 'ONGOING');
  
  if (params.facultyId) {
    activeSessions = activeSessions.filter(s => s.FacultyID === params.facultyId);
  }

  if (params.sessionId) {
    activeSessions = activeSessions.filter(s => s.SessionID === params.sessionId);
  }

  return jsonResponse({
    success: true,
    sessions: activeSessions.map(s => ({
      sessionId: s.SessionID,
      facultyId: s.FacultyID,
      subjectCode: s.SubjectCode,
      subjectName: s.SubjectName,
      room: s.Room,
      section: s.Section,
      token: s.Token,
      startTime: s.StartTime,
      endTime: s.EndTime,
      status: s.Status,
      lat: s.Lat,
      lng: s.Lng
    }))
  });
}

function handleRotateToken(body) {
  const sheet = getSheet('Sessions');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const sessionIdCol = headers.indexOf('SessionID');
  const tokenCol = headers.indexOf('Token');

  const newToken = generateSignedToken(body.sessionId);

  for (let i = 1; i < data.length; i++) {
    if (data[i][sessionIdCol] === body.sessionId) {
      sheet.getRange(i + 1, tokenCol + 1).setValue(newToken);
      return jsonResponse({ success: true, token: newToken });
    }
  }

  return jsonResponse({ success: false, error: 'Session not found' });
}

function handleEndSession(body) {
  const sheet = getSheet('Sessions');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const sessionIdCol = headers.indexOf('SessionID');
  const statusCol = headers.indexOf('Status');

  for (let i = 1; i < data.length; i++) {
    if (data[i][sessionIdCol] === body.sessionId) {
      sheet.getRange(i + 1, statusCol + 1).setValue('COMPLETED');
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ success: false, error: 'Session not found' });
}

// ============================================================
// FACULTY ACTIONS (CANCEL / SWAP)
// ============================================================

function handleGetSwappableClasses(params) {
  const { ttId } = params;
  const sheet = getSheet('Timetable');
  const timetable = sheetToJSON(sheet);
  
  // Find the source class
  const sourceClass = timetable.find(t => String(t.ID) === String(ttId));
  if (!sourceClass) {
    return jsonResponse({ success: false, error: 'Class not found' });
  }

  const { Day, Section, Semester, FacultyID } = sourceClass;

  // Find all other classes for the same section + semester on the same day
  // Exclude the current class itself
  const swappable = timetable.filter(t => 
    t.Day === Day &&
    String(t.Section) === String(Section) &&
    // Check semester if it exists in data (using flexible check)
    (Semester ? String(t.Semester) === String(Semester) : true) &&
    String(t.ID) !== String(ttId) &&
    t.Status !== 'CANCELLED' // Don't swap with cancelled classes
  );

  return jsonResponse({
    success: true,
    classes: swappable.map(c => ({
      id: c.ID,
      subjectCode: c.SubjectCode,
      subjectName: c.SubjectName,
      startTime: c.StartTime,
      endTime: c.EndTime,
      facultyId: c.FacultyID,
      room: c.Room
    }))
  });
}

function handleSwapClass(body) {
  // body: { sourceTTId, targetTTId, initiatorId }
  const sheet = getSheet('Timetable');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID');
  
  // Column Indices
  const dayCol = headers.indexOf('Day');
  const startCol = headers.indexOf('StartTime');
  const endCol = headers.indexOf('EndTime');
  const subCol = headers.indexOf('SubjectCode');
  const subNameCol = headers.indexOf('SubjectName');
  const facCol = headers.indexOf('FacultyID');
  const secCol = headers.indexOf('Section');

  let sourceRowIndex = -1;
  let targetRowIndex = -1;

  // Find rows
  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][idCol]);
    if (rowId === String(body.sourceTTId)) sourceRowIndex = i + 1;
    if (rowId === String(body.targetTTId)) targetRowIndex = i + 1;
  }

  if (sourceRowIndex === -1 || targetRowIndex === -1) {
    return jsonResponse({ success: false, error: 'One or both classes not found' });
  }

  // Get current values
  const sourceStart = sheet.getRange(sourceRowIndex, startCol + 1).getValue();
  const sourceEnd = sheet.getRange(sourceRowIndex, endCol + 1).getValue();

  const targetStart = sheet.getRange(targetRowIndex, startCol + 1).getValue();
  const targetEnd = sheet.getRange(targetRowIndex, endCol + 1).getValue();

  const sourceSub = sheet.getRange(sourceRowIndex, subNameCol + 1).getValue() || sheet.getRange(sourceRowIndex, subCol + 1).getValue();
  const targetSub = sheet.getRange(targetRowIndex, subNameCol + 1).getValue() || sheet.getRange(targetRowIndex, subCol + 1).getValue();

  const sourceFacId = sheet.getRange(sourceRowIndex, facCol + 1).getValue();
  const targetFacId = sheet.getRange(targetRowIndex, facCol + 1).getValue();
  const section = sheet.getRange(sourceRowIndex, secCol + 1).getValue();

  // Perform Swap (Exchange Times)
  sheet.getRange(sourceRowIndex, startCol + 1).setValue(targetStart);
  sheet.getRange(sourceRowIndex, endCol + 1).setValue(targetEnd);

  sheet.getRange(targetRowIndex, startCol + 1).setValue(sourceStart);
  sheet.getRange(targetRowIndex, endCol + 1).setValue(sourceEnd);

  // Send Notifications
  const msgBody = `Timetable Update: Classes for ${sourceSub} and ${targetSub} have been swapped. ${sourceSub} is now at ${targetStart}, and ${targetSub} is at ${sourceStart}.`;
  
  // 1. Notify Students
  notifySection(section, 'Class Swapped: ' + sourceSub + ' <> ' + targetSub, msgBody);
  
  // 2. Notify Target Faculty (if different from initiator)
  if (String(targetFacId) !== String(body.initiatorId)) {
    createNotification(targetFacId, 'Class Swapped Request', `Your class ${targetSub} has been swapped with ${sourceSub} by faculty ${body.initiatorId}.`);
    // Try email too
    const targetEmail = getUserEmail(targetFacId);
    if (targetEmail) {
      try {
        GmailApp.sendEmail(targetEmail, 'Class Swapped Notification', `Your class ${targetSub} has been swapped with ${sourceSub}. New time: ${sourceStart}.`);
      } catch(e) { console.error(e); }
    }
  }

  return jsonResponse({ success: true, message: 'Classes swapped successfully' });
}

function handleCancelClass(body) {
  const sheet = getSheet('Timetable');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID');

  let found = false;
  let subjectName = '';
  let section = '';
  let facultyId = '';

  // Delete the row
   for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(body.ttId)) {
      subjectName = data[i][headers.indexOf('SubjectName')] || data[i][headers.indexOf('SubjectCode')];
      section = data[i][headers.indexOf('Section')];
      facultyId = data[i][headers.indexOf('FacultyID')];
      sheet.deleteRow(i + 1);
      found = true;
      break;
    }
  }

  if (!found) return jsonResponse({ success: false, error: 'Class not found' });

  // Send Notifications
  const msg = `The class for ${subjectName} has been cancelled.`;
  notifySection(section, 'Class Cancelled: ' + subjectName, msg);
  
  // Create system notification for faculty history (optional)
  createNotification(facultyId, 'Class Cancelled', `You cancelled ${subjectName}.`);

  return jsonResponse({ success: true });
}

// ============================================================
// NOTIFICATIONS
// ============================================================

function createNotification(recipientId, title, message) {
  const sheet = getSheet('Notifications');
  if (!sheet) return; // Should exist if seeded
  
  sheet.appendRow([
    generateId(),
    recipientId,
    title,
    message,
    new Date().toISOString(),
    'UNREAD'
  ]);
}

function notifySection(section, subject, message) {
    if (!section) return;
    try {
        const sheet = getSheet('Users');
        const users = sheetToJSON(sheet);
        // Find students in this section
        const students = users.filter(u => u.Role === 'STUDENT' && String(u.Section) === String(section));
        
        // Log internal notifications for each student (for Notification Center)
        students.forEach(s => {
          createNotification(s.USN, subject, message);
        });

        // EMAIL REMOVED AS PER REQUIREMENT
        // const emails = students.map(s => s.Email).filter(e => e).join(',');
        // if (emails) {
        //      GmailApp.sendEmail(emails, subject, message);
        // }
    } catch (e) {
        console.error("Failed to send notification: " + e.toString());
    }
}

function handleGetNotifications(params) {
  const sheet = getSheet('Notifications');
  if (!sheet) return jsonResponse({ success: true, notifications: [] });

  const raw = sheetToJSON(sheet);
  // Filter by RecipientID
  const myNotes = raw.filter(n => String(n.RecipientID) === String(params.userId));
  
  // Sort by date desc
  myNotes.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

  return jsonResponse({
    success: true,
    notifications: myNotes.map(n => ({
      id: n.ID,
      title: n.Title,
      message: n.Message,
      timestamp: n.Timestamp,
      read: n.ReadStatus === 'READ'
    }))
  });
}

function handleMarkNotificationRead(body) {
  const sheet = getSheet('Notifications');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID');
  const readCol = headers.indexOf('ReadStatus');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(body.id)) {
      sheet.getRange(i + 1, readCol + 1).setValue('READ');
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false });
}

function getUserEmail(userId) {
  const sheet = getSheet('Users');
  const users = sheetToJSON(sheet);
  const u = users.find(user => user.USN === userId || user.Email === userId);
  return u ? u.Email : null;
}

// ============================================================
// ATTENDANCE
// ============================================================

function handleMarkAttendance(body) {
  // body: { usn, studentName, sessionId, token, gpsLat, gpsLng }
  
  // 1. Validate session exists and is ONGOING
  const sessSheet = getSheet('Sessions');
  const sessions = sheetToJSON(sessSheet);
  const session = sessions.find(s => s.SessionID === body.sessionId && s.Status === 'ONGOING');

  if (!session) {
    return jsonResponse({ success: false, error: 'No active session found', code: 'SESSION_EXPIRED' });
  }

  // 2. Validate Token (Stateful Check)
  // We compare the scanned token DIRECTLY with the token stored in the Session sheet.
  // This eliminates time drift issues. If the tokens match, it's valid.
  if (session.Token !== body.token) {
      return jsonResponse({ success: false, error: 'QR code has expired (mismatch).', code: 'INVALID_TOKEN' });
  }

  // Legacy Check (Optional - keep format validation just in case)
  const parts = body.token.split('_');
  if (parts[0] !== 'TKN' || parts[1] !== 'HMAC') {
     return jsonResponse({ success: false, error: 'Invalid QR format.', code: 'INVALID_TOKEN' });
  }
  
  // We skip timestamp checks because we trust the database state.
  // As long as the QR is currently on the teacher's screen (and thus in DB), it's valid.

  // 3. Check for duplicate scan
  const attSheet = getSheet('Attendance');
  const records = sheetToJSON(attSheet);
  const duplicate = records.find(r => r.USN === body.usn && r.SessionID === body.sessionId);

  if (duplicate) {
    return jsonResponse({ success: false, error: 'You have already marked attendance for this session. Status: ' + (duplicate.VerifyStatus || 'PRESENT'), code: 'DUPLICATE' });
  }



  // 5. Mark attendance
  const now = new Date();
  attSheet.appendRow([
    body.usn,
    body.studentName,
    body.sessionId,
    session.SubjectCode || '',
    session.SubjectName || '',
    now.toISOString(),
    body.gpsLat || '',
    body.gpsLng || '',
    'PRESENT'
  ]);

  return jsonResponse({ 
    success: true, 
    message: 'Attendance marked successfully',
    subjectName: session.SubjectName
  });
}

function handleMarkManualAttendance(body) {
    // body: { sessionId, usn, studentName, status, reason, facultyId }
    const sessSheet = getSheet('Sessions');
    const sessions = sheetToJSON(sessSheet);
    const session = sessions.find(s => s.SessionID === body.sessionId);
    if (!session) return jsonResponse({ success: false, error: 'Session not found' });

    const attSheet = getSheet('Attendance');
    const records = sheetToJSON(attSheet);
    
    // Check duplicate
    const duplicate = records.find(r => r.USN === body.usn && r.SessionID === body.sessionId);
    if (duplicate) {
         // Update existing? For now, just error or skip
         return jsonResponse({ success: false, error: 'Attendance already marked for this user' });
    }

    const now = new Date();
    attSheet.appendRow([
        body.usn,
        body.studentName,
        body.sessionId,
        session.SubjectCode || '',
        session.SubjectName || '',
        now.toISOString(),
        '', // No GPS
        '', // No GPS
        'MANUAL_PRESENT'
    ]);
    
    return jsonResponse({ success: true });
}

function handleGetAttendanceLogs(params) {
  const sheet = getSheet('Attendance');
  const records = sheetToJSON(sheet);

  const filtered = records.filter(r => r.SessionID === params.sessionId);

  return jsonResponse({
    success: true,
    logs: filtered.map(r => ({
      usn: r.USN,
      studentName: r.StudentName,
      timestamp: r.Timestamp,
      status: r.VerifyStatus || 'PRESENT'
    }))
  });
}

function handleGetStudentStats(params) {
  const attSheet = getSheet('Attendance');
  const records = sheetToJSON(attSheet);
  const sessSheet = getSheet('Sessions');
  const sessions = sheetToJSON(sessSheet);

  // Only count COMPLETED sessions for stats
  const completedSessions = sessions.filter(s => s.Status === 'COMPLETED');

  // Group by subject
  const subjectMap = {};

  completedSessions.forEach(s => {
    const key = s.SubjectCode;
    if (!subjectMap[key]) {
      subjectMap[key] = {
        subjectCode: s.SubjectCode,
        subjectName: s.SubjectName,
        totalClasses: 0,
        attendedClasses: 0
      };
    }
    subjectMap[key].totalClasses++;

    // Check if this student attended this session
    const attended = records.find(r => r.USN === params.usn && r.SessionID === s.SessionID);
    if (attended) {
      subjectMap[key].attendedClasses++;
    }
  });

  const stats = Object.values(subjectMap).map(s => ({
    ...s,
    percentage: s.totalClasses > 0 ? Math.round((s.attendedClasses / s.totalClasses) * 1000) / 10 : 0
  }));

  // Compute overall
  const totalClasses = stats.reduce((sum, s) => sum + s.totalClasses, 0);
  const totalAttended = stats.reduce((sum, s) => sum + s.attendedClasses, 0);
  const overall = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 1000) / 10 : 0;

  return jsonResponse({
    success: true,
    stats: stats,
    overall: overall
  });
}

function handleGetStudentHistory(params) {
  const sheet = getSheet('Attendance');
  const records = sheetToJSON(sheet);

  const filtered = records
    .filter(r => r.USN === params.usn)
    .map(r => ({
      subjectCode: r.SubjectCode,
      subjectName: r.SubjectName,
      date: r.Timestamp,
      status: r.VerifyStatus || 'PRESENT'
    }))
    .reverse(); // newest first

  return jsonResponse({ success: true, history: filtered });
}

// ============================================================
// ADMIN
// ============================================================

function handleGetAdminStats() {
  const usersSheet = getSheet('Users');
  const users = sheetToJSON(usersSheet);
  const sessSheet = getSheet('Sessions');
  const sessions = sheetToJSON(sessSheet);
  const attSheet = getSheet('Attendance');
  const records = sheetToJSON(attSheet);
  const subjectsSheet = getSheet('Subjects');
  const subjects = sheetToJSON(subjectsSheet);

  const students = users.filter(u => u.Role === 'STUDENT');
  const faculty = users.filter(u => u.Role === 'FACULTY');
  const activeSessions = sessions.filter(s => s.Status === 'ONGOING');

  // Compute per-student overall attendance
  const completedSessions = sessions.filter(s => s.Status === 'COMPLETED');
  const lowAttendance = [];

  students.forEach(st => {
    const totalSessions = completedSessions.length;
    const attended = records.filter(r => r.USN === st.USN).length;
    const pct = totalSessions > 0 ? Math.round((attended / totalSessions) * 1000) / 10 : 100;

    if (pct < 85) {
      lowAttendance.push({
        usn: st.USN,
        name: st.Name,
        email: st.Email,
        attendance: pct
      });
    }
  });

  return jsonResponse({
    success: true,
    totalStudents: students.length,
    totalFaculty: faculty.length,
    totalSubjects: subjects.length,
    activeClasses: activeSessions.length,
    lowAttendance: lowAttendance,
    todayAttendance: records.length
  });
}

function handleGetAllStudents() {
  const sheet = getSheet('Users');
  const users = sheetToJSON(sheet);
  const students = users.filter(u => u.Role === 'STUDENT');

  return jsonResponse({
    success: true,
    students: students.map(s => ({
      usn: s.USN,
      name: s.Name,
      email: s.Email,
      section: s.Section,
      semester: s.Semester
    }))
  });
}

function handleGetStudentsForSection(params) {
   const { semester, section } = params;
   const sheet = getSheet('Users');
   const users = sheetToJSON(sheet);
   
   // Flexible string comparison
   const students = users.filter(u => 
       u.Role === 'STUDENT' && 
       String(u.Section).toLowerCase() === String(section).toLowerCase() && 
       (String(u.Semester) === String(semester) || !semester) // Optional Semester check
   );

   return jsonResponse({
       success: true,
       students: students.map(s => ({
           usn: s.USN,
           name: s.Name,
           email: s.Email,
           section: s.Section,
           semester: s.Semester
       }))
   });
}

// ============================================================
// SESSIONS
// ============================================================

function handleCreateSession(body) {
  const sheet = getSheet('Sessions');
  const sessionId = generateId();
  const token = generateSignedToken(sessionId);
  const now = new Date();

  // body: { facultyId, subjectCode, subjectName, room, section, endTime, semester, lat, lng }
  sheet.appendRow([
    sessionId,
    body.facultyId,
    body.subjectCode,
    body.subjectName,
    body.room,
    body.section || '',
    token,
    now.toISOString(),
    body.endTime || '',
    'ONGOING',
    body.lat || '',
    body.lng || '',
    body.semester || '' // Added Semester
  ]);

  return jsonResponse({
    success: true,
    session: {
      sessionId: sessionId,
      token: token,
      startTime: now.toISOString(),
      status: 'ONGOING'
    }
  });
}




function handleRotateToken(body) {
  const sessSheet = getSheet('Sessions');
  const sessionId = body.sessionId;
  
  // ROBUST ROW FINDING: Use TextFinder to get exact row
  const finder = sessSheet.createTextFinder(sessionId);
  const found = finder.findNext();
  
  if (!found) {
    return jsonResponse({ success: false, error: 'Session ID not found in sheet' });
  }
  
  const rowIndex = found.getRow();
  const sessionStatus = sessSheet.getRange(rowIndex, 10).getValue(); // Status is Col 10 (J)
  
  if (sessionStatus !== 'ONGOING') {
    return jsonResponse({ success: false, error: 'Session is not active (Status: ' + sessionStatus + ')' });
  }

  // Generate new signed token
  const newToken = generateSignedToken(sessionId);

  // STATEFUL UPDATE: Save the new token to the sheet
  // 'Token' is the 7th column (Column G)
  sessSheet.getRange(rowIndex, 7).setNumberFormat('@').setValue(newToken);
  SpreadsheetApp.flush(); // Force update immediately
  
  return jsonResponse({
    success: true,
    token: newToken,
    debug: {
      updatedRow: rowIndex,
      status: sessionStatus,
      timestamp: new Date().toISOString()
    }
  });
}

function handleGetActiveSession(params) {
  const sheet = getSheet('Sessions');
  const sessions = sheetToJSON(sheet);

  // Find all ONGOING sessions
  let activeSessions = sessions.filter(s => s.Status === 'ONGOING');
  
  // Filter by Faculty
  if (params.facultyId) {
    activeSessions = activeSessions.filter(s => s.FacultyID === params.facultyId);
  }

  // Filter by Session ID
  if (params.sessionId) {
    activeSessions = activeSessions.filter(s => s.SessionID === params.sessionId);
  }

  // Filter for Student (REMOVED: Show all active sessions to students)
  /*
  if (params.section) {
    activeSessions = activeSessions.filter(s => 
      String(s.Section) === String(params.section)
    );
  }
  */

  return jsonResponse({
    success: true,
    sessions: activeSessions.map(s => ({
      sessionId: s.SessionID,
      facultyId: s.FacultyID,
      subjectCode: s.SubjectCode,
      subjectName: s.SubjectName,
      room: s.Room,
      section: s.Section,
      semester: s.Semester,
      token: s.Token,
      startTime: s.StartTime,
      endTime: s.EndTime,
      status: s.Status,
      lat: s.Lat,
      lng: s.Lng
    }))
  });
}

function handleRotateToken(body) {
  const sheet = getSheet('Sessions');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const sessionIdCol = headers.indexOf('SessionID');
  const tokenCol = headers.indexOf('Token');

  const newToken = generateSignedToken(body.sessionId);

  for (let i = 1; i < data.length; i++) {
    if (data[i][sessionIdCol] === body.sessionId) {
      sheet.getRange(i + 1, tokenCol + 1).setValue(newToken);
      return jsonResponse({ success: true, token: newToken });
    }
  }

  return jsonResponse({ success: false, error: 'Session not found' });
}

function handleEndSession(body) {
  const sheet = getSheet('Sessions');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const sessionIdCol = headers.indexOf('SessionID');
  const statusCol = headers.indexOf('Status');

  for (let i = 1; i < data.length; i++) {
    if (data[i][sessionIdCol] === body.sessionId) {
      sheet.getRange(i + 1, statusCol + 1).setValue('COMPLETED');
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ success: false, error: 'Session not found' });
}

// ============================================================
// TIMETABLE
// ============================================================

function handleGetTimetable(params) {
  const sheet = getSheet('Timetable');
  const timetable = sheetToJSON(sheet);

  let filtered = timetable;

  // Filter by Faculty
  if (params.facultyId) {
    filtered = filtered.filter(t => t.FacultyID === params.facultyId);
  }

  // Filter by Student (REMOVED: Show all classes to students)
  /*
  if (params.section) {
    filtered = filtered.filter(t => 
      String(t.Section) === String(params.section)
    );
  }
  */

  // Filter by Day
  if (params.day) {
    filtered = filtered.filter(t => t.Day === params.day);
  }

  // If no classes found for "today" (e.g. Sunday or empty day), find the next active day
  // Only do this if we are NOT specifically querying a non-today date logic
  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  let currentDayIndex = daysOrder.indexOf(params.day);
  let displayDay = params.day;

  if (filtered.length === 0 && currentDayIndex !== -1 && !params.facultyId) { // Auto-advance logic mostly for students
    // Check next 6 days
    for (let i = 1; i <= 6; i++) {
      const nextDayIndex = (currentDayIndex + i) % 7;
      const nextDay = daysOrder[nextDayIndex];
      // Skip Sunday if no classes usually
      if (nextDay === 'Sunday') continue;

      let nextDayClasses = timetable;
      if (params.facultyId) {
        nextDayClasses = timetable.filter(t => t.FacultyID === params.facultyId);
      }
      nextDayClasses = nextDayClasses.filter(t => t.Day === nextDay);

      // Re-apply student filters for the next day
      if (params.semester && params.section) {
        nextDayClasses = nextDayClasses.filter(t => 
          String(t.Semester) === String(params.semester) && 
          String(t.Section) === String(params.section)
        );
      }

      if (nextDayClasses.length > 0) {
        filtered = nextDayClasses;
        displayDay = nextDay;
        break;
      }
    }
  }

  // Check if sessions are active for these timetable entries and update status
  const sessSheet = getSheet('Sessions');
  const sessions = sheetToJSON(sessSheet);

  const enriched = filtered.map(t => {
    // Find active session matching Subject, Section, and Semester (if available)
    const activeSession = sessions.find(s => 
      s.SubjectCode === t.SubjectCode && 
      s.Status === 'ONGOING' &&
      String(s.Section) === String(t.Section) &&
      String(s.Semester) === String(t.Semester) // Added Semester check
    );
    return {
      id: t.ID || (t.Day + '_' + t.StartTime + '_' + t.SubjectCode),
      day: t.Day,
      startTime: t.StartTime,
      endTime: t.EndTime,
      subjectCode: t.SubjectCode,
      subjectName: t.SubjectName || '',
      facultyId: t.FacultyID,
      section: t.Section,
      room: t.Room,
      semester: t.Semester,
      status: activeSession ? 'ONGOING' : (t.Status || 'UPCOMING'),
      sessionId: activeSession ? activeSession.SessionID : null
    };
  });

  return jsonResponse({ success: true, timetable: enriched, displayDay: displayDay });
}

function handleAddClass(body) {
  const sheet = getSheet('Timetable');
  const existing = sheetToJSON(sheet);
  const day = body.day || getDayName();

  // Duplicate check: same faculty + subject + start time + day
  const duplicate = existing.find(t =>
    t.FacultyID === body.facultyId &&
    t.SubjectCode === body.subjectCode &&
    t.StartTime === body.startTime &&
    t.Day === day
  );
  if (duplicate) {
    return jsonResponse({ success: false, error: 'This class already exists in the timetable', code: 'DUPLICATE' });
  }

  const id = generateId();
  sheet.appendRow([
    id,
    day,
    body.startTime,
    body.endTime,
    body.subjectCode,
    body.subjectName || '',
    body.facultyId,
    body.section || '',
    body.room || 'LH-101',
    'UPCOMING',
    body.semester || '6' // Added Semester default 6
  ]);

  return jsonResponse({ success: true, id: id });
}

// ============================================================
// ROOMS
// ============================================================

function handleGetRooms() {
  const sheet = getSheet('Rooms');
  const rooms = sheetToJSON(sheet);

  return jsonResponse({
    success: true,
    rooms: rooms.map(r => ({
      name: r.RoomName,
      lat: parseFloat(r.Latitude) || 0,
      lng: parseFloat(r.Longitude) || 0,
      radius: parseFloat(r.RadiusMeters) || 100
    }))
  });
}

function handleGetSubjects(params) {
  const sheet = getSheet('Subjects');
  const subjects = sheetToJSON(sheet);

  let filtered = subjects;
  if (params.facultyId) {
    const targetId = String(params.facultyId).trim().toLowerCase();
    filtered = subjects.filter(s => {
      // Check multiple possible header names for robustness
      const rawId = s.FacultyID || s['Faculty ID'] || s.FacultyId || s.FID || ''; 
      return String(rawId).trim().toLowerCase() === targetId;
    });
  }

  return jsonResponse({
    success: true,
    subjects: filtered.map(s => ({
      code: s.Code || s['Subject Code'] || s.SubjectCode || '',
      name: s.Name || s['Subject Name'] || s.SubjectName || '',
      semester: s.Semester || s.Sem || '',
      facultyId: s.FacultyID || s['Faculty ID'] || ''
    }))
  });
}

function handleGetFacultyRecords(params) {
  const sessSheet = getSheet('Sessions');
  const sessions = sheetToJSON(sessSheet);
  const attSheet = getSheet('Attendance');
  const records = sheetToJSON(attSheet);

  let facultySessions = sessions;
  if (params.facultyId) {
    facultySessions = sessions.filter(s => s.FacultyID === params.facultyId);
  }

  const result = facultySessions.map(s => {
    const sessionRecords = records.filter(r => r.SessionID === s.SessionID);
    return {
      sessionId: s.SessionID,
      subjectCode: s.SubjectCode,
      subjectName: s.SubjectName,
      room: s.Room,
      date: s.StartTime,
      status: s.Status,
      presentCount: sessionRecords.length,
      students: sessionRecords.map(r => ({
        usn: r.USN,
        name: r.StudentName,
        time: r.Timestamp
      }))
    };
  });

  return jsonResponse({ success: true, records: result });
}

// ============================================================
// UTILITY
// ============================================================

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in meters
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

function getDayName() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

// ============================================================
// SEED DATA — SAFELY ADDS MISSING TABS ONLY
// ============================================================

function seedData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // Helper to create sheet only if it doesn't exist
  function createSheetIfNotExists(name, headers) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers);
      return true; // Created new
    }
    return false; // Already exists
  }

  // --- Users Tab ---
  if (createSheetIfNotExists('Users', ['USN', 'Name', 'Role', 'Email', 'Password', 'Section', 'Semester', 'Department'])) {
    // Only add default admin if sheet was just created
    const sheet = ss.getSheetByName('Users');
    sheet.appendRow(['ADM001', 'Admin User', 'ADMIN', 'admin@vtu.ac.in', 'admin123', '', '', 'Admin']);
  }

  // --- Subjects Tab ---
  createSheetIfNotExists('Subjects', ['Code', 'Name', 'Semester', 'FacultyID']);

  // --- Sessions Tab ---
  createSheetIfNotExists('Sessions', ['SessionID', 'FacultyID', 'SubjectCode', 'SubjectName', 'Room', 'Section', 'Token', 'StartTime', 'EndTime', 'Status', 'Lat', 'Lng']);

  // --- Attendance Tab ---
  createSheetIfNotExists('Attendance', ['USN', 'StudentName', 'SessionID', 'SubjectCode', 'SubjectName', 'Timestamp', 'GPSLat', 'GPSLng', 'VerifyStatus']);
  
  // --- Timetable Tab ---
  createSheetIfNotExists('Timetable', ['ID', 'Day', 'StartTime', 'EndTime', 'SubjectCode', 'SubjectName', 'FacultyID', 'Section', 'Room', 'Status']);

  // --- Rooms Tab ---
  createSheetIfNotExists('Rooms', ['RoomName', 'Latitude', 'Longitude', 'RadiusMeters']);

  // --- LoginLogs Tab ---
  createSheetIfNotExists('LoginLogs', ['UserID', 'Role', 'Timestamp', 'UserAgent']);


  // --- Notifications Tab ---
  createSheetIfNotExists('Notifications', ['ID', 'RecipientID', 'Title', 'Message', 'Timestamp', 'ReadStatus']);
}

// =========================================
// FACE VERIFICATION HANDLERS (Drive-Backed)
// =========================================

function handleRegisterFace(body) {
  try {
    const usn = body.usn;
    const descriptor = body.descriptor; // JSON string of face descriptor

    if (!usn || !descriptor) {
      return jsonResponse({ success: false, error: 'Missing USN or Face Descriptor' });
    }

    const folder = getOrCreateFolder('FaceData');
    const fileName = usn + '.json';
    
    // Check if file exists, if so, update it
    const files = folder.getFilesByName(fileName);
    if (files.hasNext()) {
      const file = files.next();
      file.setContent(JSON.stringify(descriptor));
    } else {
      folder.createFile(fileName, JSON.stringify(descriptor), MimeType.PLAIN_TEXT);
    }

    return jsonResponse({ success: true, message: 'Face data registered successfully' });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function handleGetFaceData(params) {
  try {
    const usn = params.usn;
    if (!usn) return jsonResponse({ success: false, error: 'Missing USN' });

    const folder = getOrCreateFolder('FaceData');
    const files = folder.getFilesByName(usn + '.json');
    
    if (files.hasNext()) {
      const file = files.next();
      const content = file.getBlob().getDataAsString();
      return jsonResponse({ success: true, descriptor: JSON.parse(content) });
    } else {
      return jsonResponse({ success: false, error: 'Face data not found', code: 'NO_FACE_DATA' });
    }
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}
