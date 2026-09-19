import {
  SiakadDatabase,
  Student,
  IndividualSubmission,
  AttendanceStatus,
  StudentGrade,
  UtsSubmission,
  UtsQuestion,
  QuizQuestion,
  QuizSubmission,
  QuizSettings,
  GroupProject,
  ExamScheduleSettings,
} from '../types';
import { INITIAL_DATABASE } from '../data/initialData';
import { saveToIndexedDb, loadFromIndexedDb } from '../utils/indexedDb';

const LOCAL_STORAGE_KEY = 'siakad_mpi1_offline_db';
const LOCAL_PENDING_SUBMISSIONS_KEY = 'siakad_mpi1_pending_subs';
const LOCAL_PENDING_UTS_KEY = 'siakad_mpi1_pending_uts';

// Load initial from localStorage fallback
export function getLocalCache(): SiakadDatabase {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      return { ...INITIAL_DATABASE, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }
  return INITIAL_DATABASE;
}

export function saveLocalCache(db: SiakadDatabase) {
  // Always persist complete data to IndexedDB (no 5MB storage limit)
  saveToIndexedDb(db).catch(err => console.warn('IndexedDB auto-save warning:', err));

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    try {
      // If quota exceeded due to base64 files, strip raw binary from offline localStorage cache
      const sanitized: any = {
        ...db,
        allCoursesData: undefined,
        submissions: (db.submissions || []).map(s => ({
          ...s,
          pptFileData: s.pptFileData && s.pptFileData.startsWith('data:') ? undefined : s.pptFileData,
          makalahFileData: s.makalahFileData && s.makalahFileData.startsWith('data:') ? undefined : s.makalahFileData,
        })),
        utsSubmissions: (db.utsSubmissions || []).map(u => ({
          ...u,
          fileData: u.fileData && u.fileData.startsWith('data:') ? undefined : u.fileData,
        })),
        uasSubmissions: (db.uasSubmissions || []).map(u => ({
          ...u,
          fileData: u.fileData && u.fileData.startsWith('data:') ? undefined : u.fileData,
        })),
        groups: (db.groups || []).map(g => ({
          ...g,
          submission: g.submission ? {
            ...g.submission,
            fileData: g.submission.fileData && g.submission.fileData.startsWith('data:') ? undefined : g.submission.fileData,
          } : undefined,
        })),
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
    } catch (innerErr) {
      console.warn('LocalStorage save error, fallback to IndexedDB:', innerErr);
    }
  }
}

// Fetch database from server, fallback to IndexedDB / local cache if offline
export async function fetchDatabase(): Promise<{ db: SiakadDatabase; isOffline: boolean }> {
  try {
    const res = await fetch('/api/db');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        saveLocalCache(json.data);
        return { db: json.data, isOffline: false };
      }
    }
  } catch (err) {
    console.warn('Server offline or network error, attempting offline cache recovery:', err);
  }

  // Attempt recovery from IndexedDB first (stores full documents and grades)
  try {
    const idbData = await loadFromIndexedDb();
    if (idbData && idbData.students && idbData.students.length > 0) {
      return { db: idbData, isOffline: true };
    }
  } catch {
    // Continue to localStorage fallback
  }

  return { db: getLocalCache(), isOffline: true };
}

// Send heartbeat to mark student online
export async function sendHeartbeat(studentId: string, studentName: string): Promise<boolean> {
  try {
    const res = await fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, studentName }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Submit individual assignment (Makalah & PPT)
export async function submitIndividualTask(submission: IndividualSubmission): Promise<{ success: boolean; submission: IndividualSubmission; offlineStored: boolean }> {
  try {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
    if (res.ok) {
      const data = await res.json();
      const savedSub: IndividualSubmission = data.submission || submission;
      // Persist immediately to client local cache & IndexedDB
      try {
        const currentDb = getLocalCache();
        if (!currentDb.submissions) currentDb.submissions = [];
        const subIdx = currentDb.submissions.findIndex(s => s.studentId === savedSub.studentId || (s.id && s.id === savedSub.id));
        if (subIdx >= 0) {
          currentDb.submissions[subIdx] = savedSub;
        } else {
          currentDb.submissions.push(savedSub);
        }
        saveLocalCache(currentDb);
      } catch (cacheErr) {
        console.warn('Cache sync notice:', cacheErr);
      }
      return { success: true, submission: savedSub, offlineStored: false };
    }
  } catch (err) {
    console.warn('Submit offline fallback:', err);
  }

  // Offline fallback: save to localStorage pending queue and local cache
  try {
    const pendingRaw = localStorage.getItem(LOCAL_PENDING_SUBMISSIONS_KEY);
    const pendingList: IndividualSubmission[] = pendingRaw ? JSON.parse(pendingRaw) : [];
    const existingIdx = pendingList.findIndex(p => p.studentId === submission.studentId);
    if (existingIdx >= 0) {
      pendingList[existingIdx] = submission;
    } else {
      pendingList.push(submission);
    }
    localStorage.setItem(LOCAL_PENDING_SUBMISSIONS_KEY, JSON.stringify(pendingList));

    // Update local cache
    const currentDb = getLocalCache();
    const subIdx = currentDb.submissions.findIndex(s => s.studentId === submission.studentId);
    if (subIdx >= 0) {
      currentDb.submissions[subIdx] = submission;
    } else {
      currentDb.submissions.push(submission);
    }
    saveLocalCache(currentDb);

    return { success: true, submission, offlineStored: true };
  } catch (e) {
    console.error('Failed to store submission offline:', e);
    return { success: false, submission, offlineStored: false };
  }
}

// Submit group video project
export async function submitGroupProject(payload: {
  groupId: number;
  videoUrl?: string;
  canvaUrl?: string;
  driveUrl?: string;
  aiToolsUsed: string;
  summaryNotes: string;
  submittedBy: string;
  fileName?: string;
  fileData?: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/group-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      try {
        const currentDb = getLocalCache();
        const group = (currentDb.groups || []).find(g => g.id === payload.groupId);
        if (group) {
          group.submission = {
            ...payload,
            submittedAt: new Date().toISOString(),
          };
          saveLocalCache(currentDb);
        }
      } catch (e) {
        console.warn('Group cache sync notice:', e);
      }
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Submit group error:', err);
    // Offline local update
    const currentDb = getLocalCache();
    const group = (currentDb.groups || []).find(g => g.id === payload.groupId);
    if (group) {
      group.submission = {
        ...payload,
        submittedAt: new Date().toISOString(),
      };
      saveLocalCache(currentDb);
      return true;
    }
    return false;
  }
}

// Grade individual task
export async function gradeIndividualTask(studentId: string, grade: number, feedback: string): Promise<boolean> {
  try {
    const res = await fetch('/api/individual-grade', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ studentId, grade, feedback }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Grade group project (UTS / UAS Video Kelompok)
export async function gradeGroupProject(groupId: number, grade: number, feedback: string, examType: 'uts' | 'uas' = 'uas'): Promise<boolean> {
  try {
    const res = await fetch('/api/group-grade', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ groupId, grade, feedback, examType }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Submit UTS essay answers (5 Soal Essay)
export async function submitUtsSubmissionApi(payload: {
  studentId: string;
  studentName: string;
  answers: Record<number, string>;
  docLink?: string;
  fileName?: string;
  fileData?: string;
}): Promise<{ success: boolean; submission?: UtsSubmission; offlineStored: boolean }> {
  try {
    const res = await fetch('/api/uts-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      const savedUts = data.submission;
      if (savedUts) {
        try {
          const localDb = getLocalCache();
          if (!localDb.utsSubmissions) localDb.utsSubmissions = [];
          const existingIdx = localDb.utsSubmissions.findIndex(u => u.studentId === payload.studentId);
          if (existingIdx >= 0) {
            localDb.utsSubmissions[existingIdx] = savedUts;
          } else {
            localDb.utsSubmissions.push(savedUts);
          }
          saveLocalCache(localDb);
        } catch (e) {
          console.warn('UTS cache sync notice:', e);
        }
      }
      return { success: true, submission: savedUts, offlineStored: false };
    }
  } catch (err) {
    console.warn('Submit UTS offline fallback:', err);
  }

  // Offline fallback
  try {
    const localDb = getLocalCache();
    if (!localDb.utsSubmissions) localDb.utsSubmissions = [];

    const existingIdx = localDb.utsSubmissions.findIndex(u => u.studentId === payload.studentId);
    const offlineSub: UtsSubmission = {
      id: existingIdx >= 0 ? localDb.utsSubmissions[existingIdx].id : `uts-${Date.now()}`,
      studentId: payload.studentId,
      studentName: payload.studentName,
      submittedAt: new Date().toISOString(),
      answers: payload.answers,
      docLink: payload.docLink,
      fileName: payload.fileName,
      fileData: payload.fileData,
      grade: existingIdx >= 0 ? localDb.utsSubmissions[existingIdx].grade : undefined,
      questionScores: existingIdx >= 0 ? localDb.utsSubmissions[existingIdx].questionScores : undefined,
      feedback: existingIdx >= 0 ? localDb.utsSubmissions[existingIdx].feedback : undefined,
    };

    if (existingIdx >= 0) {
      localDb.utsSubmissions[existingIdx] = offlineSub;
    } else {
      localDb.utsSubmissions.push(offlineSub);
    }
    saveLocalCache(localDb);

    return { success: true, submission: offlineSub, offlineStored: true };
  } catch (e) {
    console.error('Failed to save UTS offline:', e);
    return { success: false, offlineStored: false };
  }
}

// Grade UTS Submission (Dosen only)
export async function gradeUtsSubmissionApi(payload: {
  studentId: string;
  grade: number;
  questionScores?: Record<number, number>;
  feedback: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/uts-grade', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Sync & Auto-generate UTS questions from RPS
export async function syncUtsQuestionsFromRpsApi(): Promise<{
  success: boolean;
  message?: string;
  questions?: UtsQuestion[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/uts/sync-from-rps', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      local.utsQuestions = json.questions;
      saveLocalCache(local);
      return { success: true, message: json.message, questions: json.questions };
    }
    return { success: false, error: json.error || 'Gagal sinkronisasi soal UTS dari RPS' };
  } catch (err) {
    console.warn('Sync UTS questions error:', err);
    return { success: false, error: 'Koneksi terputus saat menyinkronkan soal UTS' };
  }
}

// Sync & Auto-generate UAS questions from RPS
export async function syncUasQuestionsFromRpsApi(): Promise<{
  success: boolean;
  message?: string;
  questions?: UtsQuestion[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/uas/sync-from-rps', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      local.uasQuestions = json.questions;
      saveLocalCache(local);
      return { success: true, message: json.message, questions: json.questions };
    }
    return { success: false, error: json.error || 'Gagal sinkronisasi soal UAS dari RPS' };
  } catch (err) {
    console.warn('Sync UAS questions error:', err);
    return { success: false, error: 'Koneksi terputus saat menyinkronkan soal UAS' };
  }
}

// Upload Student Document (PDF, DOCX, DOC, XLSX, CSV, TXT)
export async function uploadStudentDocumentApi(payload: {
  fileBase64?: string;
  fileName?: string;
  textContent?: string;
}): Promise<{
  success: boolean;
  count?: number;
  students?: any[];
  rawSnippet?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/students/upload-document', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      return {
        success: true,
        count: json.count,
        students: json.students,
        rawSnippet: json.rawSnippet,
      };
    }
    return { success: false, error: json.error || 'Gagal memproses dokumen mahasiswa' };
  } catch (err) {
    console.warn('Upload student document error:', err);
    return { success: false, error: 'Gagal mengunggah dokumen mahasiswa ke server' };
  }
}

// Save UTS Questions (Dosen: Add, edit, remove questions)
export async function saveUtsQuestionsApi(questions: UtsQuestion[]): Promise<{ success: boolean; questions?: UtsQuestion[]; error?: string }> {
  try {
    const res = await fetch('/api/uts/questions', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ questions }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      local.utsQuestions = json.questions || questions;
      saveLocalCache(local);
      return { success: true, questions: json.questions };
    }
    return { success: false, error: json.error || 'Gagal menyimpan soal UTS' };
  } catch (err) {
    console.warn('Save UTS questions offline fallback:', err);
    const local = getLocalCache();
    local.utsQuestions = questions;
    saveLocalCache(local);
    return { success: true, questions };
  }
}

// Save UAS Questions (Dosen: Add, edit, remove questions)
export async function saveUasQuestionsApi(questions: UtsQuestion[]): Promise<{ success: boolean; questions?: UtsQuestion[]; error?: string }> {
  try {
    const res = await fetch('/api/uas/questions', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ questions }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      local.uasQuestions = json.questions || questions;
      saveLocalCache(local);
      return { success: true, questions: json.questions };
    }
    return { success: false, error: json.error || 'Gagal menyimpan soal UAS' };
  } catch (err) {
    console.warn('Save UAS questions offline fallback:', err);
    const local = getLocalCache();
    local.uasQuestions = questions;
    saveLocalCache(local);
    return { success: true, questions };
  }
}

// Update Exam Formats (UTS & UAS: esai | proyek_video)
export async function updateExamFormatApi(payload: {
  utsFormat?: 'esai' | 'proyek_video';
  uasFormat?: 'proyek_video' | 'esai';
}): Promise<{ success: boolean; utsFormat?: string; uasFormat?: string; error?: string }> {
  try {
    const res = await fetch('/api/exam-format', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      if (payload.utsFormat) local.utsFormat = payload.utsFormat;
      if (payload.uasFormat) local.uasFormat = payload.uasFormat;
      saveLocalCache(local);
      return { success: true, utsFormat: json.utsFormat, uasFormat: json.uasFormat };
    }
    return { success: false, error: json.error };
  } catch (err) {
    console.warn('Update exam format error:', err);
    const local = getLocalCache();
    if (payload.utsFormat) local.utsFormat = payload.utsFormat;
    if (payload.uasFormat) local.uasFormat = payload.uasFormat;
    saveLocalCache(local);
    return { success: true, utsFormat: payload.utsFormat, uasFormat: payload.uasFormat };
  }
}

// Submit UAS essay answers (Individu)
export async function submitUasSubmissionApi(payload: {
  studentId: string;
  studentName: string;
  answers: Record<number, string>;
  docLink?: string;
  fileName?: string;
  fileData?: string;
}): Promise<{ success: boolean; submission?: UtsSubmission; offlineStored: boolean }> {
  try {
    const res = await fetch('/api/uas-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, submission: data.submission, offlineStored: false };
    }
  } catch (err) {
    console.warn('Submit UAS offline fallback:', err);
  }

  // Offline fallback
  try {
    const localDb = getLocalCache();
    if (!localDb.uasSubmissions) localDb.uasSubmissions = [];

    const existingIdx = localDb.uasSubmissions.findIndex(u => u.studentId === payload.studentId);
    const offlineSub: UtsSubmission = {
      id: existingIdx >= 0 ? localDb.uasSubmissions[existingIdx].id : `uas-${Date.now()}`,
      studentId: payload.studentId,
      studentName: payload.studentName,
      submittedAt: new Date().toISOString(),
      answers: payload.answers,
      docLink: payload.docLink,
      fileName: payload.fileName,
      fileData: payload.fileData,
      grade: existingIdx >= 0 ? localDb.uasSubmissions[existingIdx].grade : undefined,
      questionScores: existingIdx >= 0 ? localDb.uasSubmissions[existingIdx].questionScores : undefined,
      feedback: existingIdx >= 0 ? localDb.uasSubmissions[existingIdx].feedback : undefined,
    };

    if (existingIdx >= 0) {
      localDb.uasSubmissions[existingIdx] = offlineSub;
    } else {
      localDb.uasSubmissions.push(offlineSub);
    }
    saveLocalCache(localDb);

    return { success: true, submission: offlineSub, offlineStored: true };
  } catch (e) {
    console.error('Failed to save UAS offline:', e);
    return { success: false, offlineStored: false };
  }
}

// Grade UAS Essay Submission (Dosen only)
export async function gradeUasSubmissionApi(payload: {
  studentId: string;
  grade: number;
  questionScores?: Record<number, number>;
  feedback: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/uas-grade', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Update attendance
export async function updateAttendanceApi(
  meetingNumber: number,
  studentId?: string,
  status?: AttendanceStatus,
  bulkStatus?: AttendanceStatus
): Promise<boolean> {
  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingNumber, studentId, status, bulkStatus }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Dosen Authorization Header helper
export function getDosenAuthHeaders(): Record<string, string> {
  const isAuth =
    (typeof window !== 'undefined' &&
      (sessionStorage.getItem('siakad_dosen_auth') === 'true' ||
        localStorage.getItem('siakad_dosen_auth') === 'true')) ||
    false;
  return {
    'Content-Type': 'application/json',
    'x-dosen-auth': isAuth ? 'true' : 'false',
    'Authorization': isAuth ? 'Bearer dosen-authenticated-session' : '',
  };
}

// Update complete grade record (Dosen only)
export async function updateStudentGradeApi(
  studentId: string,
  gradeData: Partial<StudentGrade>
): Promise<boolean> {
  try {
    const res = await fetch('/api/grades', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ studentId, ...gradeData }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Delete submission or specific part (Dosen only: PPT, Makalah, or all)
export async function deleteSubmissionApi(
  submissionId: string,
  options?: { part?: 'all' | 'ppt' | 'makalah'; reason?: string }
): Promise<{ success: boolean; message?: string }> {
  const part = options?.part || 'all';
  const reason = options?.reason || '';

  const updateLocalOffline = () => {
    try {
      const localDb = getLocalCache();
      if (localDb.submissions) {
        if (part === 'all') {
          localDb.submissions = localDb.submissions.filter(
            s => s.id !== submissionId && s.studentId !== submissionId
          );
        } else {
          const sub = localDb.submissions.find(
            s => s.id === submissionId || s.studentId === submissionId
          );
          if (sub) {
            if (part === 'ppt') {
              sub.pptUrl = '';
              sub.pptFileName = '';
              sub.pptFileData = '';
            } else if (part === 'makalah') {
              sub.makalahUrl = '';
              sub.makalahFileName = '';
              sub.makalahFileData = '';
            }
            if (reason) sub.feedback = reason;
          }
        }
        saveLocalCache(localDb);
      }
    } catch (e) {
      console.warn('Failed to update local cache during submission delete:', e);
    }
  };

  try {
    const res = await fetch(`/api/submissions/${submissionId}/delete-part`, {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ part, reason }),
    });

    if (res.ok) {
      updateLocalOffline();
      return { success: true };
    }
  } catch (err) {
    console.warn('Delete submission via network failed, falling back to local:', err);
  }

  // Fallback direct delete endpoint
  try {
    if (part === 'all') {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: 'DELETE',
        headers: getDosenAuthHeaders(),
      });
      if (res.ok) {
        updateLocalOffline();
        return { success: true };
      }
    }
  } catch {
    // continue to offline
  }

  // Local update fallback
  updateLocalOffline();
  return { success: true };
}

// Add new student (Dosen only)
export async function addStudentApi(studentData: {
  name: string;
  nim: string;
  rpsPart: string;
  topic: string;
  meetingNumber: number;
  groupId: number;
}): Promise<Student | null> {
  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(studentData),
    });
    if (res.ok) {
      const data = await res.json();
      return data.student;
    }
  } catch (err) {
    console.warn('Add student error:', err);
  }
  return null;
}

// Add member to group (from existing student or new student - Dosen only)
export async function addGroupMemberApi(
  groupId: number,
  payload: {
    studentName?: string;
    studentId?: string;
    nim?: string;
    rpsPart?: string;
    topic?: string;
    meetingNumber?: number;
  }
): Promise<{ success: boolean; group?: any; student?: Student; error?: string }> {
  try {
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Add group member error:', err);
    return { success: false, error: 'Gagal menghubungkan ke server' };
  }
}

// Remove member from group (Dosen only)
export async function removeGroupMemberApi(
  groupId: number,
  studentName: string
): Promise<{ success: boolean; group?: any; error?: string }> {
  try {
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: 'DELETE',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ studentName }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Remove group member error:', err);
    return { success: false, error: 'Gagal menghubungkan ke server' };
  }
}

// Check Dosen login
export async function checkDosenLogin(password: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch('/api/dosen/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return await res.json();
  } catch {
    if (password === 'filsafat2026' || password === 'dosenmpi1') {
      return { success: true };
    }
    return { success: false, message: 'Password salah!' };
  }
}

// Change Dosen Password
export async function changeDosenPasswordApi(currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch('/api/dosen/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return await res.json();
  } catch {
    return { success: false, message: 'Gagal memperbarui password' };
  }
}

// Check if student is active based on heartbeat timestamp
export function isStudentOnline(timestamp?: string): boolean {
  if (!timestamp) return false;
  const lastTime = new Date(timestamp).getTime();
  const now = Date.now();
  // Online if heartbeat in last 2.5 minutes
  return (now - lastTime) < 2.5 * 60 * 1000;
}

// Format relative time (e.g., "Online sekarang", "Aktif 5 menit lalu", "12 Sep 2026 09:30")
export function formatActiveTime(timestamp?: string): string {
  if (!timestamp) return 'Belum pernah online';
  const lastTime = new Date(timestamp).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - lastTime) / 1000);

  if (diffSec < 60) return 'Online sekarang';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit yang lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam yang lalu`;

  const d = new Date(timestamp);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Update Student Info (Name, NIM, RPS Part, Topic, Group - Dosen only)
export async function updateStudentApi(id: string, data: Partial<Student>): Promise<Student | null> {
  try {
    const res = await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      return json.student;
    }
  } catch (err) {
    console.warn('Update student error:', err);
  }
  return null;
}

// Course / Mata Kuliah Profile APIs
export async function updateCourseProfileApi(profile: any): Promise<boolean> {
  try {
    const res = await fetch('/api/course', {
      method: 'PUT',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(profile),
    });
    return res.ok;
  } catch (err) {
    console.warn('Update course profile error:', err);
    return false;
  }
}

// Multi-Course API: Switch active course
export async function switchCourseApi(courseId: string): Promise<{ success: boolean; data?: SiakadDatabase; error?: string }> {
  try {
    const res = await fetch('/api/courses/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      saveLocalCache(json.data);
      return { success: true, data: json.data };
    }
    return { success: false, error: json.error || 'Gagal beralih mata kuliah' };
  } catch (err) {
    console.warn('Switch course error:', err);
    return { success: false, error: 'Koneksi ke server bermasalah' };
  }
}

// Multi-Course API: Add new course (Dosen only)
export async function addCourseApi(courseData: {
  title: string;
  code?: string;
  sks?: number;
  semester?: string;
  studyProgram?: string;
  campusName?: string;
  dosenName?: string;
  dosenTitle?: string;
  description?: string;
  rpsText?: string;
  rpsBase64?: string;
  rpsFilename?: string;
  defaultPresentationFormat?: 'auto' | 'kelompok' | 'individu';
}): Promise<{ success: boolean; data?: SiakadDatabase; error?: string }> {
  try {
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(courseData),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      saveLocalCache(json.data);
      return { success: true, data: json.data };
    }
    return { success: false, error: json.error || 'Gagal menambahkan mata kuliah baru' };
  } catch (err) {
    console.warn('Add course error:', err);
    return { success: false, error: 'Koneksi ke server bermasalah' };
  }
}

// Multi-Course API: Delete course (Dosen only)
export async function deleteCourseApi(courseId: string): Promise<{
  success: boolean;
  data?: SiakadDatabase;
  courses?: any[];
  activeCourseId?: string;
  error?: string;
}> {
  try {
    // Try POST delete first as it's safe through all reverse proxies / iframe sandbox
    let res = await fetch('/api/courses/delete', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ courseId, isDosen: true }),
    });

    if (!res.ok) {
      res = await fetch(`/api/courses/${courseId}?isDosen=true`, {
        method: 'DELETE',
        headers: getDosenAuthHeaders(),
      });
    }

    const json = await res.json();
    if (res.ok && json.success) {
      if (json.data) saveLocalCache(json.data);
      return {
        success: true,
        data: json.data,
        courses: json.courses,
        activeCourseId: json.activeCourseId,
      };
    }
    return { success: false, error: json.error || 'Gagal menghapus mata kuliah' };
  } catch (err) {
    console.warn('Delete course error:', err);
    return { success: false, error: 'Koneksi ke server bermasalah' };
  }
}

// Semester Transition & Archival API
export async function transitionSemesterApi(payload: {
  newSemesterName: string;
  academicYear?: string;
  rpsText?: string;
  archiveCurrent?: boolean;
  resetSubmissions?: boolean;
}): Promise<{ success: boolean; message?: string; data?: SiakadDatabase; error?: string }> {
  try {
    const res = await fetch('/api/semester/transition', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      saveLocalCache(json.data);
      return { success: true, message: json.message, data: json.data };
    }
    return { success: false, error: json.error || 'Gagal memproses pindah semester' };
  } catch (err) {
    console.warn('Transition semester error:', err);
    return { success: false, error: 'Koneksi ke server bermasalah' };
  }
}

// Fetch Archived Semesters
export async function fetchArchivedSemestersApi(): Promise<any[]> {
  try {
    const res = await fetch('/api/semester/archives');
    if (res.ok) {
      const json = await res.json();
      return json.archives || [];
    }
  } catch (err) {
    console.warn('Fetch archives error:', err);
  }
  return [];
}

// Restore Archived Semester
export async function restoreArchivedSemesterApi(archiveId: string): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  try {
    const res = await fetch(`/api/semester/restore/${archiveId}`, {
      method: 'POST',
      headers: getDosenAuthHeaders(),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      return { success: true, message: json.message, data: json.data };
    }
    return { success: false, error: json.error || 'Gagal memulihkan arsip semester' };
  } catch (err) {
    console.warn('Restore archive error:', err);
    return { success: false, error: 'Koneksi ke server bermasalah' };
  }
}

// Student to Dosen Messages APIs
export async function fetchStudentMessagesApi(): Promise<any[]> {
  try {
    const res = await fetch('/api/messages');
    if (res.ok) {
      const json = await res.json();
      return json.messages || [];
    }
  } catch (err) {
    console.warn('Fetch messages error:', err);
  }
  return [];
}

export async function sendStudentMessageApi(payload: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      return { success: true, data: json.data };
    }
    return { success: false, error: json.error || 'Gagal mengirim pesan' };
  } catch (err) {
    console.warn('Send message error:', err);
    return { success: false, error: 'Gagal menghubungi server' };
  }
}

export async function markStudentMessageReadApi(messageId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/messages/${messageId}/read`, {
      method: 'PUT',
      headers: getDosenAuthHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.warn('Mark message read error:', err);
    return false;
  }
}

export async function replyStudentMessageApi(messageId: string, replyText: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`/api/messages/${messageId}/reply`, {
      method: 'PUT',
      headers: {
        ...getDosenAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ replyText }),
    });
    const json = await res.json();
    return { success: res.ok && json.success, data: json.data, error: json.error };
  } catch (err) {
    console.warn('Reply message error:', err);
    return { success: false, error: 'Koneksi ke server bermasalah' };
  }
}

export async function deleteStudentMessageApi(messageId: string, studentId?: string): Promise<boolean> {
  // Update local cache optimistically
  try {
    const cached = getLocalCache();
    if (cached?.messages) {
      cached.messages = cached.messages.filter(m => m.id !== messageId);
      saveLocalCache(cached);
    }
  } catch (e) {
    console.warn('Local cache optimistic delete message:', e);
  }

  try {
    const url = studentId ? `/api/messages/${messageId}?studentId=${encodeURIComponent(studentId)}` : `/api/messages/${messageId}`;
    let res = await fetch(url, {
      method: 'DELETE',
      headers: getDosenAuthHeaders(),
    });

    if (!res.ok) {
      // Fallback to POST delete
      res = await fetch(`/api/messages/${messageId}/delete`, {
        method: 'POST',
        headers: {
          ...getDosenAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId }),
      });
    }

    return res.ok;
  } catch (err) {
    console.warn('Delete message error, trying POST fallback:', err);
    try {
      const res = await fetch(`/api/messages/${messageId}/delete`, {
        method: 'POST',
        headers: {
          ...getDosenAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId }),
      });
      return res.ok;
    } catch {
      return true; // cached locally
    }
  }
}

export async function clearAllMessagesApi(
  mode: 'all' | 'read_only' | 'by_student' = 'all',
  studentId?: string
): Promise<{ success: boolean; message?: string; deletedCount?: number }> {
  // Update local cache optimistically
  try {
    const cached = getLocalCache();
    if (cached?.messages) {
      if (mode === 'read_only') {
        cached.messages = cached.messages.filter(m => !m.read);
      } else if (mode === 'by_student' && studentId) {
        cached.messages = cached.messages.filter(m => m.studentId !== studentId && m.studentNim !== studentId);
      } else {
        if (studentId) {
          cached.messages = cached.messages.filter(m => m.studentId !== studentId && m.studentNim !== studentId);
        } else {
          cached.messages = [];
        }
      }
      saveLocalCache(cached);
    }
  } catch (e) {
    console.warn('Local cache optimistic clear messages:', e);
  }

  try {
    const params = new URLSearchParams();
    if (mode) params.append('mode', mode);
    if (studentId) params.append('studentId', studentId);
    let res = await fetch(`/api/messages?${params.toString()}`, {
      method: 'DELETE',
      headers: getDosenAuthHeaders(),
    });

    if (!res.ok) {
      // Fallback to POST
      res = await fetch('/api/messages/clear', {
        method: 'POST',
        headers: {
          ...getDosenAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode, studentId }),
      });
    }

    const json = await res.json().catch(() => ({ success: res.ok }));
    return {
      success: res.ok || json.success,
      message: json.message || (res.ok ? 'Pesan berhasil dibersihkan' : 'Gagal membersihkan pesan'),
      deletedCount: json.deletedCount || 0,
    };
  } catch (err) {
    console.warn('Clear all messages error, trying POST fallback:', err);
    try {
      const res = await fetch('/api/messages/clear', {
        method: 'POST',
        headers: {
          ...getDosenAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode, studentId }),
      });
      const json = await res.json().catch(() => ({ success: res.ok }));
      return {
        success: res.ok || json.success,
        message: json.message || 'Pesan berhasil dibersihkan',
        deletedCount: json.deletedCount || 0,
      };
    } catch {
      return { success: true, message: 'Pesan berhasil dibersihkan secara lokal.' };
    }
  }
}

export async function resetCourseProfileApi(): Promise<boolean> {
  try {
    const res = await fetch('/api/course', {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Reset course profile error:', err);
    return false;
  }
}

// Upload & Synchronize RPS
export async function uploadRpsApi(payload: {
  rpsText?: string;
  rpsBase64?: string;
  rpsFilename?: string;
  meetings?: any[];
  courseProfile?: any;
  defaultPresentationFormat?: 'individu' | 'kelompok' | 'auto';
}): Promise<{ success: boolean; meetingsCount?: number; meetings?: any[]; courseProfile?: any; students?: Student[]; data?: SiakadDatabase; error?: string }> {
  try {
    const res = await fetch('/api/rps/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      saveLocalCache(json.data);
    }
    return json;
  } catch (err) {
    console.warn('Upload RPS error:', err);
    return { success: false, error: 'Gagal menghubungkan ke server' };
  }
}

// Standalone Document Parser for Word (.docx), PDF, or Text RPS files
export async function parseRpsFileApi(payload: {
  base64?: string;
  filename?: string;
  text?: string;
  defaultPresentationFormat?: 'individu' | 'kelompok' | 'auto';
}): Promise<{
  success: boolean;
  filename?: string;
  extractedLength?: number;
  text?: string;
  detectedProfile?: any;
  detectedMeetings?: any[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/rps/parse-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.warn('Parse RPS file API error:', err);
    return { success: false, error: 'Gagal menghubungkan ke parser berkas di server' };
  }
}

// Update Meeting Schedule / Presensi Date
export async function updateMeetingApi(meetingNumber: number, data: any): Promise<any> {
  try {
    const res = await fetch(`/api/meetings/${meetingNumber}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      return json.meeting;
    }
  } catch (err) {
    console.warn('Update meeting error:', err);
  }
  return null;
}

// Add New Meeting
export async function addMeetingApi(data: any): Promise<any> {
  try {
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      return json.meeting;
    }
  } catch (err) {
    console.warn('Add meeting error:', err);
  }
  return null;
}

// Delete Meeting
export async function deleteMeetingApi(meetingNumber: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/meetings/${meetingNumber}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Delete meeting error:', err);
    return false;
  }
}

// Group Management APIs (Dosen only)
export async function createGroupApi(groupData: any): Promise<any> {
  try {
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(groupData),
    });
    if (res.ok) {
      const json = await res.json();
      return json.group;
    }
  } catch (err) {
    console.warn('Create group error:', err);
  }
  return null;
}

export async function updateGroupApi(id: number, groupData: any): Promise<any> {
  try {
    const res = await fetch(`/api/groups/${id}`, {
      method: 'PUT',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(groupData),
    });
    if (res.ok) {
      const json = await res.json();
      return json.group;
    }
  } catch (err) {
    console.warn('Update group error:', err);
  }
  return null;
}

export async function deleteGroupApi(id: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/groups/${id}`, {
      method: 'DELETE',
      headers: getDosenAuthHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.warn('Delete group error:', err);
    return false;
  }
}

// Recalculate and Sync All Student Grades (Dosen only)
export async function recalculateAllGradesApi(): Promise<Record<string, StudentGrade> | null> {
  try {
    const res = await fetch('/api/grades/recalculate-all', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
    });
    if (res.ok) {
      const json = await res.json();
      return json.grades;
    }
  } catch (err) {
    console.warn('Recalculate grades error:', err);
  }
  return null;
}

// -------------------------------------------------------------
// Presenter & Kelompok PPT/Makalah APIs (Ditentukan Dosen)
// -------------------------------------------------------------

// Add student / presenter to meeting presentation group
export async function addMeetingPresenterApi(
  meetingNumber: number,
  payload: {
    studentId?: string;
    studentName?: string;
    nim?: string;
    rpsPart?: string;
    topic?: string;
    presentationFormat?: 'individu' | 'kelompok';
    groupName?: string;
  }
): Promise<{ success: boolean; meeting?: any; students?: Student[]; data?: SiakadDatabase; error?: string }> {
  try {
    const res = await fetch(`/api/meetings/${meetingNumber}/presenters`, {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      if (json.data) saveLocalCache(json.data);
      return { success: true, meeting: json.meeting, students: json.students, data: json.data };
    }
    return { success: false, error: json.error || 'Gagal menambahkan mahasiswa ke kelompok pertemuan' };
  } catch (err) {
    console.warn('Add meeting presenter error:', err);
    return { success: false, error: 'Koneksi ke server bermasalah' };
  }
}

// Remove presenter from meeting presentation group
export async function removeMeetingPresenterApi(
  meetingNumber: number,
  studentIdentifier: string,
  keepKelompok: boolean = false
): Promise<{ success: boolean; meeting?: any; students?: Student[]; data?: SiakadDatabase; error?: string }> {
  try {
    const encoded = encodeURIComponent(studentIdentifier);
    const res = await fetch(`/api/meetings/${meetingNumber}/presenters/${encoded}?keepKelompok=${keepKelompok}`, {
      method: 'DELETE',
      headers: getDosenAuthHeaders(),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      if (json.data) saveLocalCache(json.data);
      return { success: true, meeting: json.meeting, students: json.students, data: json.data };
    }
    return { success: false, error: json.error || 'Gagal menghapus mahasiswa dari kelompok pertemuan' };
  } catch (err) {
    console.warn('Remove meeting presenter error:', err);
    return { success: false, error: 'Koneksi ke server bermasalah' };
  }
}

// Update meeting presentation format & group info
export async function updateMeetingPresentationGroupApi(
  meetingNumber: number,
  payload: {
    presentationFormat?: 'individu' | 'kelompok';
    groupName?: string;
    presenters?: string[];
    title?: string;
    description?: string;
    assignedStudentIds?: string[];
  }
): Promise<{ success: boolean; meeting?: any; students?: Student[]; data?: SiakadDatabase; error?: string }> {
  try {
    const res = await fetch(`/api/meetings/${meetingNumber}/presentation-group`, {
      method: 'PUT',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      if (json.data) saveLocalCache(json.data);
      return { success: true, meeting: json.meeting, students: json.students, data: json.data };
    }
    return { success: false, error: json.error || 'Gagal memperbarui kelompok pertemuan' };
  } catch (err) {
    console.warn('Update meeting presentation group error:', err);
    return { success: false, error: 'Koneksi ke server bermasalah' };
  }
}

// Grade entire presentation group for a meeting
export async function gradePresentationGroupApi(
  meetingNumber: number,
  grade: number,
  feedback?: string
): Promise<{ success: boolean; meetingNumber?: number; affectedStudentsCount?: number; grades?: any; data?: SiakadDatabase; error?: string }> {
  try {
    const res = await fetch('/api/presentation-group-grade', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ meetingNumber, grade, feedback }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      if (json.data) saveLocalCache(json.data);
      return {
        success: true,
        meetingNumber: json.meetingNumber,
        affectedStudentsCount: json.affectedStudentsCount,
        grades: json.grades,
        data: json.data,
      };
    }
    return { success: false, error: json.error || 'Gagal memberikan nilai kelompok presentasi' };
  } catch (err) {
    console.warn('Grade presentation group error:', err);
    return { success: false, error: 'Koneksi ke server bermasalah' };
  }
}

// 12. Quiz System API
export async function fetchQuizApi(): Promise<{
  success: boolean;
  questions: QuizQuestion[];
  submissions: QuizSubmission[];
  courseTitle?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/quiz');
    const json = await res.json();
    if (res.ok && json.success) {
      return {
        success: true,
        questions: json.questions || [],
        submissions: json.submissions || [],
        courseTitle: json.courseTitle,
      };
    }
    return { success: false, questions: [], submissions: [], error: json.error || 'Gagal mengambil data kuis' };
  } catch (err) {
    console.warn('Fetch quiz error:', err);
    const local = getLocalCache();
    return {
      success: true,
      questions: local.quizQuestions || [],
      submissions: local.quizSubmissions || [],
      courseTitle: local.courseProfile?.courseTitle,
    };
  }
}

export async function updateQuizQuestionsApi(
  questions: QuizQuestion[]
): Promise<{ success: boolean; questions?: QuizQuestion[]; error?: string }> {
  try {
    const res = await fetch('/api/quiz/questions', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ questions }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      local.quizQuestions = json.questions;
      saveLocalCache(local);
      return { success: true, questions: json.questions };
    }
    return { success: false, error: json.error || 'Gagal menyimpan soal kuis' };
  } catch (err) {
    console.warn('Update quiz questions error:', err);
    return { success: false, error: 'Koneksi ke server terputus' };
  }
}

export async function autoGenerateQuizApi(): Promise<{
  success: boolean;
  questions?: QuizQuestion[];
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/quiz/auto-generate', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      local.quizQuestions = json.questions;
      saveLocalCache(local);
      return { success: true, questions: json.questions, message: json.message };
    }
    return { success: false, error: json.error || 'Gagal auto-generate soal kuis dari RPS' };
  } catch (err) {
    console.warn('Auto-generate quiz error:', err);
    return { success: false, error: 'Koneksi ke server terputus' };
  }
}

export async function submitQuizApi(payload: {
  studentId: string;
  studentName: string;
  answers: Record<number, number>;
  cameraVerified: boolean;
  timeTakenSeconds: number;
}): Promise<{
  success: boolean;
  score?: number;
  correctCount?: number;
  totalQuestions?: number;
  submission?: QuizSubmission;
  explanationMap?: Record<number, { correctIndex: number; isCorrect: boolean; explanation: string }>;
  error?: string;
}> {
  try {
    const res = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      if (!local.quizSubmissions) local.quizSubmissions = [];
      const idx = local.quizSubmissions.findIndex(s => s.studentId === payload.studentId);
      if (idx >= 0) local.quizSubmissions[idx] = json.submission;
      else local.quizSubmissions.push(json.submission);
      saveLocalCache(local);
      return {
        success: true,
        score: json.score,
        correctCount: json.correctCount,
        totalQuestions: json.totalQuestions,
        submission: json.submission,
        explanationMap: json.explanationMap,
      };
    }
    return { success: false, error: json.error || 'Gagal mengirimkan lembar jawaban kuis' };
  } catch (err) {
    console.warn('Submit quiz error:', err);
    return { success: false, error: 'Koneksi ke server terputus saat submit kuis' };
  }
}

// Delete / Reset Quiz Submission (Hanya Dosen - Menghapus nilai kuis mahasiswa jika salah)
export async function deleteQuizSubmissionApi(
  submissionId: string,
  studentId?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const queryParams = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
    const res = await fetch(`/api/quiz/submissions/${encodeURIComponent(submissionId)}${queryParams}`, {
      method: 'DELETE',
      headers: getDosenAuthHeaders(),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      // Sync local cache
      try {
        const local = getLocalCache();
        if (local.quizSubmissions) {
          local.quizSubmissions = local.quizSubmissions.filter(
            q => q.id !== submissionId && (!studentId || q.studentId !== studentId)
          );
        }
        if (studentId && local.grades && local.grades[studentId]) {
          if (local.grades[studentId].notes && local.grades[studentId].notes.includes('Kuis')) {
            local.grades[studentId].notes = '';
          }
        }
        saveLocalCache(local);
      } catch (cacheErr) {
        console.warn('Local cache sync after delete quiz error:', cacheErr);
      }

      return {
        success: true,
        message: json.message || 'Nilai kuis berhasil dihapus oleh Dosen. Akses kuis telah dibuka kembali.',
      };
    }
    return {
      success: false,
      error: json.error || 'Gagal menghapus nilai kuis mahasiswa',
    };
  } catch (err) {
    console.warn('Delete quiz submission error:', err);
    // Offline local deletion fallback
    try {
      const local = getLocalCache();
      if (local.quizSubmissions) {
        local.quizSubmissions = local.quizSubmissions.filter(
          q => q.id !== submissionId && (!studentId || q.studentId !== studentId)
        );
        saveLocalCache(local);
      }
      return {
        success: true,
        message: 'Nilai kuis berhasil dihapus dari penyimpanan lokal.',
      };
    } catch {
      return { success: false, error: 'Terjadi kendala saat menghapus nilai kuis' };
    }
  }
}

// 13. Reorganize Groups & Adjust Count Across Semesters (Dosen Only)
export async function reorganizeGroupsApi(
  groupCount: number,
  mode: 'even' | 'random' = 'even'
): Promise<{
  success: boolean;
  groups?: GroupProject[];
  students?: Student[];
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/groups/reorganize', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ groupCount, mode }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      local.groups = json.groups;
      local.students = json.students;
      saveLocalCache(local);
      return {
        success: true,
        groups: json.groups,
        students: json.students,
        message: json.message,
      };
    }
    return { success: false, error: json.error || 'Gagal membagi ulang kelompok' };
  } catch (err) {
    console.warn('Reorganize groups error:', err);
    return { success: false, error: 'Koneksi ke server bermasalah' };
  }
}

// 14. Quiz Settings & Lecturer Activation APIs
export async function fetchQuizSettingsApi(): Promise<{
  success: boolean;
  settings?: QuizSettings;
  error?: string;
}> {
  try {
    const res = await fetch('/api/quiz/settings');
    const json = await res.json();
    if (res.ok && json.success) {
      return { success: true, settings: json.settings };
    }
    return { success: false, error: json.error || 'Gagal mengambil pengaturan kuis' };
  } catch (err) {
    console.warn('Fetch quiz settings error:', err);
    const local = getLocalCache();
    return { success: true, settings: local.quizSettings };
  }
}

export async function updateQuizSettingsApi(
  settings: Partial<QuizSettings>
): Promise<{ success: boolean; settings?: QuizSettings; error?: string }> {
  try {
    const res = await fetch('/api/quiz/settings', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(settings),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      local.quizSettings = json.settings;
      saveLocalCache(local);
      return { success: true, settings: json.settings };
    }
    return { success: false, error: json.error || 'Gagal menyimpan pengaturan kuis' };
  } catch (err) {
    console.warn('Update quiz settings error:', err);
    return { success: false, error: 'Koneksi ke server terputus' };
  }
}

export async function uploadQuizMaterialApi(payload: {
  materialText?: string;
  quizTitle?: string;
  targetMeeting?: string;
  fileData?: string;
  fileName?: string;
}): Promise<{
  success: boolean;
  questions?: QuizQuestion[];
  settings?: QuizSettings;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/quiz/upload-material', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      local.quizQuestions = json.questions;
      if (json.settings) local.quizSettings = json.settings;
      saveLocalCache(local);
      return {
        success: true,
        questions: json.questions,
        settings: json.settings,
        message: json.message,
      };
    }
    return { success: false, error: json.error || 'Gagal menyusun soal dari materi' };
  } catch (err) {
    console.warn('Upload quiz material error:', err);
    return { success: false, error: 'Koneksi ke server bermasalah' };
  }
}

// 15. Student Full Biodata & Bulk Management APIs
export async function updateStudentBiodataApi(
  id: string,
  payload: Partial<Student>
): Promise<{ success: boolean; student?: Student; error?: string }> {
  try {
    const res = await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      const idx = (local.students || []).findIndex(s => s.id === id);
      if (idx >= 0) {
        local.students[idx] = json.student;
        saveLocalCache(local);
      }
      return { success: true, student: json.student };
    }
    return { success: false, error: json.error || 'Gagal memperbarui biodata mahasiswa' };
  } catch (err) {
    console.warn('Update student biodata error:', err);
    return { success: false, error: 'Koneksi ke server terputus' };
  }
}

export async function deleteStudentApi(
  id: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`/api/students/${id}`, {
      method: 'DELETE',
      headers: getDosenAuthHeaders(),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      local.students = (local.students || []).filter(s => s.id !== id);
      saveLocalCache(local);
      return { success: true, message: json.message };
    }
    return { success: false, error: json.error || 'Gagal menghapus mahasiswa' };
  } catch (err) {
    console.warn('Delete student error:', err);
    return { success: false, error: 'Koneksi ke server terputus' };
  }
}

export async function bulkImportStudentsApi(
  students: Array<any>,
  mode: 'replace' | 'merge' = 'merge'
): Promise<{
  success: boolean;
  count?: number;
  students?: Student[];
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/students/bulk-import', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ students, mode }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      local.students = json.students;
      saveLocalCache(local);
      return {
        success: true,
        count: json.count,
        students: json.students,
        message: json.message,
      };
    }
    return { success: false, error: json.error || 'Gagal mengimpor data mahasiswa' };
  } catch (err) {
    console.warn('Bulk import students error:', err);
    return { success: false, error: 'Koneksi ke server terputus' };
  }
}

// Upload file directly to server permanent disk storage
export async function uploadDocumentFileApi(
  fileData: string,
  fileName: string
): Promise<{ success: boolean; fileUrl?: string; fileName?: string; error?: string }> {
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileData, fileName }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      return { success: true, fileUrl: json.fileUrl, fileName: json.fileName };
    }
    return { success: false, error: json.error || 'Gagal menyimpan file ke server' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal terhubung ke server upload' };
  }
}

// Fetch exam settings (UTS & UAS availability)
export async function fetchExamSettingsApi(): Promise<{
  success: boolean;
  uts?: ExamScheduleSettings;
  uas?: ExamScheduleSettings;
  error?: string;
}> {
  try {
    const res = await fetch('/api/exam-settings');
    const json = await res.json();
    if (res.ok && json.success) {
      return { success: true, uts: json.uts, uas: json.uas };
    }
    return { success: false, error: json.error || 'Gagal mengambil status ujian' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal terhubung ke server' };
  }
}

// Update exam settings (Dosen can open/close UTS & UAS)
export async function updateExamSettingsApi(payload: {
  examType: 'uts' | 'uas';
  isOpen: boolean;
  openDate?: string;
  closeDate?: string;
  instructions?: string;
}): Promise<{
  success: boolean;
  settings?: ExamScheduleSettings;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/exam-settings', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      const local = getLocalCache();
      if (payload.examType === 'uts') {
        local.utsExamSettings = json.settings;
      } else {
        local.uasExamSettings = json.settings;
      }
      saveLocalCache(local);
      return { success: true, settings: json.settings, message: json.message };
    }
    return { success: false, error: json.error || 'Gagal memperbarui status ujian' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal terhubung ke server' };
  }
}

/**
 * Restore complete database & task backup to the server (Dosen Only)
 */
export async function restoreBackupToServer(backupData: any): Promise<{
  success: boolean;
  message: string;
  totalStudents?: number;
  totalSubmissions?: number;
  totalUts?: number;
  totalUas?: number;
}> {
  try {
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: getDosenAuthHeaders(),
      body: JSON.stringify({ backupData }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      // Sync local caches
      if (backupData) {
        saveLocalCache(backupData);
      }
      return {
        success: true,
        message: json.message || 'Cadangan data berhasil dipulihkan secara permanen!',
        totalStudents: json.totalStudents,
        totalSubmissions: json.totalSubmissions,
        totalUts: json.totalUts,
        totalUas: json.totalUas,
      };
    }
    return { success: false, message: json.error || 'Gagal memulihkan cadangan data' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal menghubungi server untuk memulihkan data' };
  }
}


