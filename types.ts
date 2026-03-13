export type Role = 'ADMIN' | 'FACULTY' | 'STUDENT';

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  avatarInitials: string;
}

export interface Student extends User {
  usn: string;
  semester: number;
  section: string;
  parentEmail: string;
  parentPhone: string;
  overallAttendance: number;
}

export interface Faculty extends User {
  department: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  semester: number;
}

export interface TimetableEntry {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subjectId: string;
  facultyId: string;
  section: string;
  room: string;
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED';
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  subjectId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT';
}

export interface SubjectStats {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
}