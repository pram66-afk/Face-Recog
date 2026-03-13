import { Student, Faculty, Subject, TimetableEntry, SubjectStats } from './types';

// Subjects
export const SUBJECTS: Subject[] = [
  { id: 's1', code: '18CS61', name: 'System Software', semester: 6 },
  { id: 's2', code: '18CS62', name: 'Computer Graphics', semester: 6 },
  { id: 's3', code: '18CS63', name: 'Web Technology', semester: 6 },
  { id: 's4', code: '18CS64', name: 'Data Mining', semester: 6 },
  { id: 's5', code: '18CS65', name: 'Cloud Computing', semester: 6 },
];

// Faculty
export const FACULTY_MEMBERS: Faculty[] = [
  { id: 'f1', name: 'Prof. Harshitha', role: 'FACULTY', email: 'harshitha@vtu.ac.in', avatarInitials: 'PH', department: 'CE' },
  { id: 'f2', name: 'Dr. Ramesh', role: 'FACULTY', email: 'ramesh@vtu.ac.in', avatarInitials: 'DR', department: 'CE' },
];

// Students
export const STUDENTS: Student[] = [
  { id: 'st1', name: 'Asha Bhat', role: 'STUDENT', email: 'asha@vtu.edu', avatarInitials: 'AB', usn: '4PM21CS001', semester: 6, section: 'A', parentEmail: 'parent1@gmail.com', parentPhone: '9988776655', overallAttendance: 92 },
  { id: 'st2', name: 'Ravi Kumar', role: 'STUDENT', email: 'ravi@vtu.edu', avatarInitials: 'RK', usn: '4PM21CS010', semester: 6, section: 'A', parentEmail: 'parent2@gmail.com', parentPhone: '9988776644', overallAttendance: 78 }, // Low attendance
  { id: 'st3', name: 'Sneha P', role: 'STUDENT', email: 'sneha@vtu.edu', avatarInitials: 'SP', usn: '4PM21CS015', semester: 6, section: 'B', parentEmail: 'parent3@gmail.com', parentPhone: '9988776633', overallAttendance: 86 },
];

// Timetable (Initial Dummy Data)
// Requirement: 3 classes, first 2 completed.
export const TODAY_TIMETABLE: TimetableEntry[] = [
  { id: 'tt1', dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', subjectId: 's1', facultyId: 'f1', section: '6A', room: 'LH-101', status: 'COMPLETED' },
  { id: 'tt2', dayOfWeek: 'Monday', startTime: '10:00', endTime: '11:00', subjectId: 's2', facultyId: 'f2', section: '6A', room: 'LH-101', status: 'COMPLETED' },
  { id: 'tt3', dayOfWeek: 'Monday', startTime: '11:15', endTime: '12:15', subjectId: 's3', facultyId: 'f1', section: '6A', room: 'LAB-2', status: 'UPCOMING' },
  { id: 'tt4', dayOfWeek: 'Monday', startTime: '12:15', endTime: '13:15', subjectId: 's4', facultyId: 'f2', section: '6A', room: 'LH-102', status: 'UPCOMING' },
  { id: 'tt5', dayOfWeek: 'Monday', startTime: '14:00', endTime: '15:00', subjectId: 's5', facultyId: 'f1', section: '6A', room: 'LH-103', status: 'UPCOMING' },
  { id: 'tt6', dayOfWeek: 'Monday', startTime: '15:00', endTime: '16:00', subjectId: 's1', facultyId: 'f2', section: '6A', room: 'LH-101', status: 'UPCOMING' },
  // Tuesday
  { id: 'tt7', dayOfWeek: 'Tuesday', startTime: '09:00', endTime: '10:00', subjectId: 's4', facultyId: 'f1', section: '6A', room: 'LH-102', status: 'UPCOMING' },
  { id: 'tt8', dayOfWeek: 'Tuesday', startTime: '10:00', endTime: '11:00', subjectId: 's5', facultyId: 'f2', section: '6A', room: 'LH-102', status: 'UPCOMING' },
  { id: 'tt9', dayOfWeek: 'Tuesday', startTime: '11:15', endTime: '12:15', subjectId: 's1', facultyId: 'f1', section: '6A', room: 'LH-101', status: 'UPCOMING' },
  // Wednesday
  { id: 'tt10', dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '10:00', subjectId: 's3', facultyId: 'f2', section: '6A', room: 'LAB-2', status: 'UPCOMING' },
  { id: 'tt11', dayOfWeek: 'Wednesday', startTime: '10:00', endTime: '11:00', subjectId: 's2', facultyId: 'f1', section: '6A', room: 'LH-101', status: 'UPCOMING' },
];

// Student Stats (Specific to Student View)
export const STUDENT_SUBJECT_STATS: SubjectStats[] = [
  { subjectId: 's1', subjectName: 'System Software', subjectCode: '18CS61', totalClasses: 24, attendedClasses: 22, percentage: 91.6 },
  { subjectId: 's2', subjectName: 'Computer Graphics', subjectCode: '18CS62', totalClasses: 24, attendedClasses: 18, percentage: 75.0 }, // Alert
  { subjectId: 's3', subjectName: 'Web Technology', subjectCode: '18CS63', totalClasses: 20, attendedClasses: 18, percentage: 90.0 },
  { subjectId: 's4', subjectName: 'Data Mining', subjectCode: '18CS64', totalClasses: 22, attendedClasses: 18, percentage: 81.8 }, // Alert
];

export const CURRENT_USER_MOCK = {
  ADMIN: { id: 'adm1', name: 'Admin User', role: 'ADMIN', email: 'admin@vtu.ac.in', avatarInitials: 'AD' },
  FACULTY: FACULTY_MEMBERS[0],
  STUDENT: STUDENTS[0],
};