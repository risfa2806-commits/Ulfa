import React, { useState, useEffect } from 'react';
import { Student, IndividualSubmission } from '../types';
import {
  submitIndividualTask,
  deleteSubmissionApi,
  addStudentApi,
  addMeetingPresenterApi,
  removeMeetingPresenterApi,
  updateMeetingPresentationGroupApi,
} from '../services/api';
import {
  FileText,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  ExternalLink,
  Download,
  AlertCircle,
  Save,
  Clock,
  Sparkles,
  Award,
  Trash2,
  UserPlus,
  Plus,
  X,
  Users,
  Check,
  Lock,
  Unlock,
  Search,
  Printer,
  Eye,
  RotateCcw,
} from 'lucide-react';

interface IndividualTaskViewProps {
  students: Student[];
  currentStudent: Student | null;
  submissions: IndividualSubmission[];
  onRefreshData: () => Promise<void>;
  onSelectStudent: (student: Student) => void;
  selectedStudentForTask?: Student | null;
  isDosen?: boolean;
}

export const IndividualTaskView: React.FC<IndividualTaskViewProps> = ({
  students = [],
  currentStudent,
  submissions = [],
  onRefreshData,
  onSelectStudent,
  selectedStudentForTask,
  isDosen = false,
}) => {
  // Target student for task viewing/uploading: defaults to current logged in student or first student
  const [activeTargetId, setActiveTargetId] = useState<string>(
    selectedStudentForTask?.id || currentStudent?.id || students?.[0]?.id || ''
  );

  useEffect(() => {
    if (selectedStudentForTask) {
      setActiveTargetId(selectedStudentForTask.id);
    } else if (currentStudent) {
      setActiveTargetId(currentStudent.id);
    }
  }, [selectedStudentForTask, currentStudent]);

  const targetStudent = (students || []).find(s => s.id === activeTargetId) || students?.[0];
  const existingSubmission = (submissions || []).find(s => s.studentId === targetStudent?.id)
    || (submissions || []).find(s => targetStudent && (
      (Boolean(targetStudent.nim) && Boolean(s.nim) && s.nim === targetStudent.nim) ||
      (Boolean(s.studentName) && s.studentName.toLowerCase().trim() === targetStudent.name.toLowerCase().trim()) ||
      (Boolean(s.partnerName) && s.partnerName.toLowerCase().trim().includes(targetStudent.name.toLowerCase().trim())) ||
      (Boolean(targetStudent.meetingNumber) && Boolean(s.meetingNumber) && s.meetingNumber === targetStudent.meetingNumber && s.presentationType === 'kelompok')
    ));

  // Form states
  const [pptType, setPptType] = useState<'link' | 'file'>(existingSubmission?.pptType || 'link');
  const [pptUrl, setPptUrl] = useState<string>(existingSubmission?.pptUrl || '');
  const [pptFileName, setPptFileName] = useState<string>(existingSubmission?.pptFileName || '');
  const [pptFileData, setPptFileData] = useState<string>(existingSubmission?.pptFileData || '');

  const [makalahType, setMakalahType] = useState<'link' | 'file'>(existingSubmission?.makalahType || 'link');
  const [makalahUrl, setMakalahUrl] = useState<string>(existingSubmission?.makalahUrl || '');
  const [makalahFileName, setMakalahFileName] = useState<string>(existingSubmission?.makalahFileName || '');
  const [makalahFileData, setMakalahFileData] = useState<string>(existingSubmission?.makalahFileData || '');

  // Choice: 'both' | 'ppt_only' | 'makalah_only'
  const [submissionChoice, setSubmissionChoice] = useState<'both' | 'ppt_only' | 'makalah_only'>(
    existingSubmission?.submissionChoice || 'both'
  );

  const [notes, setNotes] = useState<string>(existingSubmission?.notes || '');
  const [partnerName, setPartnerName] = useState<string>(existingSubmission?.partnerName || '');
  const [presentationType, setPresentationType] = useState<'individu' | 'kelompok'>(
    existingSubmission?.presentationType || 'individu'
  );
  const [topic, setTopic] = useState<string>(existingSubmission?.topic || targetStudent?.topic || '');
  const [viewMode, setViewMode] = useState<'form' | 'gallery'>('form');
  const [gallerySearch, setGallerySearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add student form state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStdName, setNewStdName] = useState('');
  const [newStdNim, setNewStdNim] = useState('');
  const [newStdRpsPart, setNewStdRpsPart] = useState('');
  const [newStdTopic, setNewStdTopic] = useState('');
  const [newStdMeeting, setNewStdMeeting] = useState(2);
  const [newStdGroupId, setNewStdGroupId] = useState(1);
  const [isAddingNewStd, setIsAddingNewStd] = useState(false);
  const [addStdFeedback, setAddStdFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCreateNewStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStdName.trim()) {
      setAddStdFeedback({ type: 'error', text: 'Nama mahasiswa wajib diisi.' });
      return;
    }
    setIsAddingNewStd(true);
    setAddStdFeedback(null);
    try {
      const created = await addStudentApi({
        name: newStdName.trim().toUpperCase(),
        nim: newStdNim.trim() || `2026${String((students?.length || 0) + 1).padStart(4, '0')}`,
        rpsPart: newStdRpsPart.trim() || `Part ${String((students?.length || 0) + 1).padStart(2, '0')}`,
        topic: newStdTopic.trim() || 'Telaah Mandiri Filsafat Ilmu MPI',
        meetingNumber: Number(newStdMeeting) || 2,
        groupId: Number(newStdGroupId) || 1,
      });
      if (created) {
        setAddStdFeedback({
          type: 'success',
          text: `Mahasiswa ${created.name} berhasil ditambahkan!`,
        });
        await onRefreshData();
        setActiveTargetId(created.id);
        onSelectStudent(created);
        setNewStdName('');
        setNewStdNim('');
        setNewStdRpsPart('');
        setNewStdTopic('');
        setShowAddStudentModal(false);
      } else {
        setAddStdFeedback({ type: 'error', text: 'Gagal menambahkan mahasiswa baru.' });
      }
    } catch {
      setAddStdFeedback({ type: 'error', text: 'Terjadi kesalahan sistem.' });
    } finally {
      setIsAddingNewStd(false);
    }
  };

  // When target student changes, reload form with existing submission if available
  useEffect(() => {
    if (existingSubmission) {
      setPptType(existingSubmission.pptType);
      setPptUrl(existingSubmission.pptUrl || '');
      setPptFileName(existingSubmission.pptFileName || '');
      setPptFileData(existingSubmission.pptFileData || '');

      setMakalahType(existingSubmission.makalahType || 'link');
      setMakalahUrl(existingSubmission.makalahUrl || '');
      setMakalahFileName(existingSubmission.makalahFileName || '');
      setMakalahFileData(existingSubmission.makalahFileData || '');

      setNotes(existingSubmission.notes || '');
      setPartnerName(existingSubmission.partnerName || '');
      setPresentationType(existingSubmission.presentationType || 'individu');
      setTopic(existingSubmission.topic || targetStudent?.topic || '');
      setSubmissionChoice(existingSubmission.submissionChoice || 'both');
    } else {
      setPptType('link');
      setPptUrl('');
      setPptFileName('');
      setPptFileData('');
      setMakalahType('link');
      setMakalahUrl('');
      setMakalahFileName('');
      setMakalahFileData('');
      setNotes('');
      setPartnerName('');
      setPresentationType('individu');
      setTopic(targetStudent?.topic || '');
      setSubmissionChoice('both');
    }
    setSubmitSuccessMsg(null);
    setErrorMsg(null);
  }, [activeTargetId, existingSubmission]);

  // Handle PPT file upload
  const handlePptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('Ukuran file PPT maksimal 20MB. Anda juga dapat menggunakan opsi Link Canva / Google Drive.');
      return;
    }

    setPptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPptFileData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle Makalah file upload
  const handleMakalahFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('Ukuran file Makalah maksimal 15MB.');
      return;
    }

    setMakalahFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setMakalahFileData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Handler
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitSuccessMsg(null);

    // Validation based on submission choice
    const hasPpt = (pptType === 'link' && !!pptUrl.trim()) || (pptType === 'file' && !!pptFileData);
    const hasMakalah = (makalahType === 'link' && !!makalahUrl.trim()) || (makalahType === 'file' && !!makalahFileData);

    if (submissionChoice === 'ppt_only') {
      if (!hasPpt) {
        setErrorMsg('Harap masukkan link PPT / Canva atau upload file PPT Anda.');
        return;
      }
    } else if (submissionChoice === 'makalah_only') {
      if (!hasMakalah) {
        setErrorMsg('Harap masukkan link Makalah (Google Docs/Drive) atau upload file Makalah Anda.');
        return;
      }
    } else {
      // both: student chose both, or can provide at least one
      if (!hasPpt && !hasMakalah) {
        setErrorMsg('Harap unggah salah satu (PPT atau Makalah) atau keduanya sesuai pilihan Anda.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: IndividualSubmission = {
        id: existingSubmission?.id || `sub-${Date.now()}`,
        studentId: targetStudent.id,
        studentName: targetStudent.name,
        rpsPart: targetStudent.rpsPart,
        topic: topic.trim() || targetStudent.topic,
        partnerName: partnerName.trim() || undefined,
        presentationType,
        meetingNumber: targetStudent.meetingNumber,
        submissionChoice,
        pptType,
        pptUrl: pptType === 'link' ? pptUrl.trim() : undefined,
        pptFileName: pptType === 'file' ? pptFileName : undefined,
        pptFileData: pptType === 'file' ? pptFileData : undefined,
        makalahType,
        makalahUrl: makalahType === 'link' ? makalahUrl.trim() : undefined,
        makalahFileName: makalahType === 'file' ? makalahFileName : undefined,
        makalahFileData: makalahType === 'file' ? makalahFileData : undefined,
        notes: notes.trim(),
        submittedAt: new Date().toISOString(),
        grade: existingSubmission?.grade,
        feedback: existingSubmission?.feedback,
      };

      const result = await submitIndividualTask(payload);
      if (result.success) {
        setSubmitSuccessMsg(
          result.offlineStored
            ? 'Tugas berhasil disimpan di perangkat (Mode Offline) & akan disinkronkan otomatis ke dosen saat kembali online!'
            : 'Tugas berhasil dikirim dan tersimpan otomatis! Dosen dapat langsung mengakses tugas Anda.'
        );
        await onRefreshData();
      } else {
        setErrorMsg('Gagal mengirim tugas. Silakan coba kembali.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Terjadi kendala saat mengirim. Tugas disimpan di draft lokal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dosen deletion action (if lecturer is viewing this task page)
  const [isDosenDeleting, setIsDosenDeleting] = useState(false);
  const [isConfirmingDeleteSub, setIsConfirmingDeleteSub] = useState(false);

  const handleExecuteDosenDeleteSubmission = async () => {
    if (!existingSubmission) return;
    setIsDosenDeleting(true);
    try {
      await deleteSubmissionApi(existingSubmission.id, { part: 'all' });
      setSubmitSuccessMsg(
        `Tugas milik ${targetStudent.name} berhasil dihapus oleh Dosen. Mahasiswa dapat mengunggah kembali materi yang benar.`
      );
      setIsConfirmingDeleteSub(false);
      await onRefreshData();
    } catch {
      setErrorMsg('Gagal menghapus tugas mahasiswa.');
    } finally {
      setIsDosenDeleting(false);
    }
  };

  // Meeting Presenters & Group Management (Kelompok PPT/Makalah Ditentukan Dosen)
  const meetingPresenters = (students || []).filter(
    s => targetStudent?.meetingNumber !== undefined && s.meetingNumber === targetStudent.meetingNumber
  );
  const isGroupFormat = presentationType === 'kelompok' || (meetingPresenters?.length || 0) > 1;
  const [showAddPresenterModal, setShowAddPresenterModal] = useState(false);
  const [selectedStudentIdToAdd, setSelectedStudentIdToAdd] = useState('');
  const [customStudentNameToAdd, setCustomStudentNameToAdd] = useState('');
  const [customNimToAdd, setCustomNimToAdd] = useState('');
  const [isAddingPresenter, setIsAddingPresenter] = useState(false);
  const [presenterActionMsg, setPresenterActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check if any peer in this meeting group already submitted
  const peerSubmission = isGroupFormat && targetStudent?.meetingNumber
    ? (submissions || []).find(
        sub =>
          sub.meetingNumber === targetStudent.meetingNumber &&
          sub.studentId !== targetStudent.id &&
          (sub.pptUrl || sub.pptFileData || sub.makalahUrl || sub.makalahFileData)
      )
    : null;

  const handleAddPresenterToMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingPresenter(true);
    setPresenterActionMsg(null);
    try {
      let payload: any = {
        presentationFormat: 'kelompok',
        topic: topic || targetStudent.topic,
        rpsPart: targetStudent.rpsPart,
      };
      if (selectedStudentIdToAdd) {
        payload.studentId = selectedStudentIdToAdd;
      } else if (customStudentNameToAdd.trim()) {
        payload.studentName = customStudentNameToAdd.trim();
        payload.nim = customNimToAdd.trim();
      } else {
        setPresenterActionMsg({ type: 'error', text: 'Pilih mahasiswa dari kelas atau ketik nama mahasiswa baru.' });
        setIsAddingPresenter(false);
        return;
      }

      const res = await addMeetingPresenterApi(targetStudent.meetingNumber, payload);
      if (res.success) {
        setPresenterActionMsg({ type: 'success', text: 'Mahasiswa berhasil ditambahkan ke kelompok presentasi ini!' });
        setSelectedStudentIdToAdd('');
        setCustomStudentNameToAdd('');
        setCustomNimToAdd('');
        setPresentationType('kelompok');
        setTimeout(() => {
          setShowAddPresenterModal(false);
          setPresenterActionMsg(null);
        }, 1200);
        await onRefreshData();
      } else {
        setPresenterActionMsg({ type: 'error', text: res.error || 'Gagal menambahkan mahasiswa ke kelompok' });
      }
    } catch {
      setPresenterActionMsg({ type: 'error', text: 'Koneksi ke server bermasalah.' });
    } finally {
      setIsAddingPresenter(false);
    }
  };

  const handleRemovePresenterFromMeeting = async (studentName: string) => {
    try {
      const res = await removeMeetingPresenterApi(targetStudent.meetingNumber, studentName);
      if (res.success) {
        setSubmitSuccessMsg(`Mahasiswa ${studentName} berhasil dihapus dari kelompok presentasi.`);
        await onRefreshData();
      } else {
        setErrorMsg(res.error || 'Gagal menghapus mahasiswa dari kelompok');
      }
    } catch {
      setErrorMsg('Koneksi ke server bermasalah saat menghapus mahasiswa.');
    }
  };

  const handleTogglePresentationFormat = async (fmt: 'individu' | 'kelompok') => {
    setPresentationType(fmt);
    if (isDosen) {
      try {
        await updateMeetingPresentationGroupApi(targetStudent.meetingNumber, {
          presentationFormat: fmt,
        });
        await onRefreshData();
      } catch (e) {
        console.warn('Format update error:', e);
      }
    }
  };

  const filteredGallerySubmissions = (submissions || []).filter(sub => {
    const q = gallerySearch.toLowerCase().trim();
    if (!q) return true;
    const std = students.find(s => s.id === sub.studentId);
    return (
      (sub.studentName && sub.studentName.toLowerCase().includes(q)) ||
      (std?.name && std.name.toLowerCase().includes(q)) ||
      (sub.nim && sub.nim.toLowerCase().includes(q)) ||
      (std?.nim && std.nim.toLowerCase().includes(q)) ||
      (sub.topic && sub.topic.toLowerCase().includes(q)) ||
      (std?.topic && std.topic.toLowerCase().includes(q)) ||
      (sub.partnerName && sub.partnerName.toLowerCase().includes(q)) ||
      (sub.notes && sub.notes.toLowerCase().includes(q)) ||
      (sub.rpsPart && sub.rpsPart.toLowerCase().includes(q)) ||
      (std?.rpsPart && std.rpsPart.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full mb-2">
              <FileText size={13} />
              <span>Tugas Presentasi (Individu/Kelompok) Sesuai RPS</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif-title">
              Pengumpulan Tugas Presentasi (Individu/Kelompok) (Pertemuan 2 s/d Pertemuan 15)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed max-w-2xl">
              Mahasiswa mengunggah Makalah dan Slide Presentasi PPT (file PPTX/PDF atau Link Canva) sesuai pembagian tugas (individu atau kelompok) oleh dosen. Tugas yang dikirim otomatis tersimpan dan langsung terhubung ke portal Dosen.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-900 max-w-xs">
            <div className="font-bold flex items-center gap-1.5 text-emerald-950 mb-1">
              <Sparkles size={14} className="text-emerald-700" />
              <span>Otomatis Tersimpan</span>
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-800">
              Tidak perlu tekan Ctrl+S. Setelah klik tombol <strong>Kirim</strong>, data langsung aman dan tersimpan di server & portal dosen.
            </p>
          </div>
        </div>

        {/* Sub-Tab Navigation: Form Tugas vs Galeri Peer Review & Unduh */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="tab-btn-form-tugas"
              type="button"
              onClick={() => setViewMode('form')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'form'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <FileText size={14} />
              <span>Formulir Penyerahan Tugas</span>
            </button>
            <button
              id="tab-btn-galeri-tugas"
              type="button"
              onClick={() => setViewMode('gallery')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'gallery'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Users size={14} />
              <span>Galeri & Unduh PPT/Makalah Teman Sekelas</span>
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                viewMode === 'gallery' ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-600 text-white'
              }`}>
                {submissions.length} Terkumpul
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            {viewMode === 'form'
              ? '🔒 Aturan: Satu Kali Kirim (Revisi hanya jika direset oleh Dosen)'
              : '👥 Mahasiswa dapat meninjau, mereview & mengunduh berkas presentasi teman'}
          </div>
        </div>

        {/* Student Selector Quick Pills (Shown in Form Mode) */}
        {viewMode === 'form' && (
          <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pilih Mahasiswa untuk Melihat / Mengunggah Tugas:
            </label>
            {isDosen && (
              <button
                type="button"
                onClick={() => {
                  setShowAddStudentModal(!showAddStudentModal);
                  setAddStdFeedback(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs w-fit"
              >
                {showAddStudentModal ? <X size={14} /> : <UserPlus size={14} />}
                <span>{showAddStudentModal ? 'Tutup Form' : '+ Tambah Mahasiswa Baru'}</span>
              </button>
            )}
          </div>

          {/* Add Student Success/Error Message */}
          {addStdFeedback && (
            <div
              className={`p-3 mb-3 rounded-xl text-xs flex items-center gap-2 ${
                addStdFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}
            >
              {addStdFeedback.type === 'success' ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
              )}
              <span>{addStdFeedback.text}</span>
            </div>
          )}

          {/* Add Student Inline Form (Hanya Dosen) */}
          {isDosen && showAddStudentModal && (
            <form
              onSubmit={handleCreateNewStudent}
              className="p-4 mb-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 text-xs shadow-xs animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                  <UserPlus size={16} className="text-emerald-700" />
                  <span>Daftarkan Mahasiswa Baru (Individu & Kelompok)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nama Lengkap Mahasiswa *</label>
                  <input
                    type="text"
                    required
                    value={newStdName}
                    onChange={e => setNewStdName(e.target.value)}
                    placeholder="Contoh: AHMAD FAUZI"
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">NIM (Nomor Induk Mahasiswa)</label>
                  <input
                    type="text"
                    value={newStdNim}
                    onChange={e => setNewStdNim(e.target.value)}
                    placeholder={`Contoh: 2026${String((students?.length || 0) + 1).padStart(4, '0')}`}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Bagian RPS (Part/Pertemuan)</label>
                  <input
                    type="text"
                    value={newStdRpsPart}
                    onChange={e => setNewStdRpsPart(e.target.value)}
                    placeholder={`Contoh: Part ${String((students?.length || 0) + 1).padStart(2, '0')} atau Pertemuan 15`}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">Topik Makalah / Materi Kajian</label>
                  <input
                    type="text"
                    value={newStdTopic}
                    onChange={e => setNewStdTopic(e.target.value)}
                    placeholder="Contoh: Epistemologi & Landasan Filsafat Manajemen Pendidikan Islam"
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Masuk Kelompok Video UAS (1-5)</label>
                  <select
                    value={newStdGroupId}
                    onChange={e => setNewStdGroupId(Number(e.target.value))}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value={1}>Kelompok 1 (Ontologi Filsafat)</option>
                    <option value={2}>Kelompok 2 (Epistemologi Keilmuan)</option>
                    <option value={3}>Kelompok 3 (Aksiologi & Etika)</option>
                    <option value={4}>Kelompok 4 (Kritik Paradigma)</option>
                    <option value={5}>Kelompok 5 (Masa Depan AI & Filsafat)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-200">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAddingNewStd || !newStdName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {isAddingNewStd ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>Simpan & Pilih Mahasiswa Ini</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {students.map((std) => {
              const hasSubmitted = submissions.some(s => s.studentId === std.id);
              const isSelected = std.id === activeTargetId;

              return (
                <button
                  key={std.id}
                  onClick={() => setActiveTargetId(std.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs scale-[1.02]'
                      : hasSubmitted
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <span>{std.rpsPart}</span>
                  <span className="font-normal opacity-80 truncate max-w-[90px] sm:max-w-[130px]">{std.name.split(' ')[0]}</span>
                  {hasSubmitted && <CheckCircle2 size={12} className={isSelected ? 'text-emerald-400' : 'text-emerald-600'} />}
                </button>
              );
            })}
          </div>
        </div>
        )}
      </div>

      {/* VIEW MODE 1: GALERI & REVIEW TUGAS TEMAN SEKELAS */}
      {viewMode === 'gallery' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Gallery Header & Search Toolbar */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-emerald-700" />
                  <h3 className="font-bold text-base text-slate-900">
                    Galeri & Review Tugas Presentasi Rekan Mahasiswa
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mahasiswa dapat melihat materi kajian, mereview catatan, serta mengunduh berkas PPT dan Makalah milik teman sekelas.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border border-slate-200"
                >
                  <Printer size={14} />
                  <span>Cetak / PDF</span>
                </button>
                <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                  {submissions.length} dari {students.length} Mahasiswa Terkumpul
                </span>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={gallerySearch}
                onChange={e => setGallerySearch(e.target.value)}
                placeholder="Cari nama mahasiswa, NIM, materi kajian, atau part RPS..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              {gallerySearch && (
                <button
                  type="button"
                  onClick={() => setGallerySearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Submissions Cards Grid */}
          {filteredGallerySubmissions.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <FileText size={28} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                {gallerySearch ? 'Tidak Ada Tugas yang Cocok' : 'Belum Ada Tugas Presentasi yang Dikumpulkan'}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {gallerySearch
                  ? 'Silakan coba kata kunci lain untuk mencari nama atau topik materi mahasiswa.'
                  : 'Mahasiswa yang telah mengunggah PPT dan Makalah akan otomatis tampil di galeri ini agar teman sekelas dapat membaca dan mengunduh berkasnya.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGallerySubmissions.map((sub, idx) => {
                const std = students.find(s => s.id === sub.studentId) || {
                  name: sub.studentName || 'Mahasiswa',
                  nim: sub.nim || '-',
                  rpsPart: `Part ${idx + 1}`,
                  topic: sub.topic || 'Topik Presentasi',
                  meetingNumber: sub.meetingNumber || 2,
                  groupId: 1,
                };

                return (
                  <div
                    key={sub.id || idx}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold bg-emerald-800 text-white px-2.5 py-0.5 rounded-md">
                            {sub.rpsPart || std.rpsPart || `Part ${idx + 1}`}
                          </span>
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            Pertemuan {sub.meetingNumber || std.meetingNumber || 2}
                          </span>
                          <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                            {sub.presentationType === 'kelompok' ? '👥 Kelompok' : '👤 Individu'}
                          </span>
                        </div>
                        {sub.grade !== undefined && (
                          <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Award size={11} className="text-amber-700" />
                            Nilai: {sub.grade}
                          </span>
                        )}
                      </div>

                      {/* Presenter Name */}
                      <div>
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                          {sub.studentName || std.name}
                        </h4>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>NIM: {sub.nim || std.nim}</span>
                          {sub.partnerName && (
                            <>
                              <span>•</span>
                              <span className="text-slate-700 font-medium">Rekan: {sub.partnerName}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Topic */}
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">
                          Topik Kajian:
                        </span>
                        <p className="font-semibold text-slate-800 leading-relaxed">
                          {sub.topic || std.topic}
                        </p>
                      </div>

                      {/* Notes */}
                      {sub.notes && (
                        <div className="text-xs text-slate-600 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100 italic line-clamp-3">
                          "{sub.notes}"
                        </div>
                      )}

                      {/* Feedback */}
                      {sub.feedback && (
                        <div className="text-[11px] text-indigo-900 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
                          <strong className="text-indigo-950 font-bold block mb-0.5">Catatan Review Dosen:</strong>
                          <span>{sub.feedback}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions: PPT & Makalah */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center gap-2">
                        {sub.pptType === 'link' && sub.pptUrl ? (
                          <a
                            href={sub.pptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <ExternalLink size={13} />
                            <span>Buka Slide PPT</span>
                          </a>
                        ) : sub.pptFileData ? (
                          <a
                            href={sub.pptFileData}
                            download={sub.pptFileName || `PPT_${sub.studentName || 'Presentasi'}.pptx`}
                            className="flex-1 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Download size={13} />
                            <span>Unduh PPT</span>
                          </a>
                        ) : (
                          <div className="flex-1 px-3 py-2 bg-slate-100 text-slate-400 rounded-xl text-xs text-center font-medium italic">
                            Belum Ada PPT
                          </div>
                        )}

                        {sub.makalahType === 'link' && sub.makalahUrl ? (
                          <a
                            href={sub.makalahUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <ExternalLink size={13} />
                            <span>Buka Makalah</span>
                          </a>
                        ) : sub.makalahFileData ? (
                          <a
                            href={sub.makalahFileData}
                            download={sub.makalahFileName || `Makalah_${sub.studentName || 'Makalah'}.pdf`}
                            className="flex-1 px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Download size={13} />
                            <span>Unduh Makalah</span>
                          </a>
                        ) : (
                          <div className="flex-1 px-3 py-2 bg-slate-100 text-slate-400 rounded-xl text-xs text-center font-medium italic">
                            Belum Ada Makalah
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>Dikirim: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tersimpan'}</span>
                        <span className="text-emerald-700 font-semibold">Tersimpan Permanen</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: FORM TUGAS MAHASISWA */}
      {viewMode === 'form' && targetStudent && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: RPS Assignment Info Card */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold bg-emerald-800 text-white px-2.5 py-1 rounded-md">
                  {targetStudent.rpsPart}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Kelompok {targetStudent.groupId}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {targetStudent.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  NIM: {targetStudent.nim} • Kelompok Video: Kelompok {targetStudent.groupId}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                    Topik / Judul Materi Presentasi:
                  </span>
                  <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                    "{existingSubmission?.topic || targetStudent.topic}"
                  </p>
                </div>
                {existingSubmission?.partnerName && (
                  <div className="pt-1.5 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide block">
                      Rekan Teman Presentasi:
                    </span>
                    <p className="text-xs font-bold text-indigo-950">
                      👥 {existingSubmission.partnerName}
                    </p>
                  </div>
                )}
                {existingSubmission?.presentationType && (
                  <div className="text-[11px] text-slate-500">
                    Format: <span className="font-semibold text-slate-700">{existingSubmission.presentationType === 'kelompok' ? 'Presentasi Kelompok' : 'Presentasi Individu'}</span>
                  </div>
                )}
              </div>

              {/* Status Banner */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Status Tugas:</span>
                  {existingSubmission ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={13} /> Terkirim
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      <Clock size={13} /> Belum Dikirim
                    </span>
                  )}
                </div>

                {existingSubmission?.submittedAt && (
                  <div className="text-[11px] text-slate-400 mt-1.5">
                    Waktu Kirim: {new Date(existingSubmission.submittedAt).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </div>
                )}
              </div>

              {/* Dosen Grade & Feedback if available */}
              {existingSubmission?.grade !== undefined && (
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-300">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                      <Award size={14} className="text-emerald-700" />
                      Nilai Tugas Dosen:
                    </span>
                    <span className="text-base font-extrabold text-emerald-800">
                      {existingSubmission.grade} / 100
                    </span>
                  </div>
                  {existingSubmission.feedback && (
                    <p className="text-xs text-emerald-900 mt-1 italic bg-white/70 p-2 rounded border border-emerald-200">
                      "{existingSubmission.feedback}"
                    </p>
                  )}
                </div>
              )}

              {/* Download / Open existing PPT buttons */}
              {existingSubmission && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-700 mb-1">Akses File Terkirim:</div>
                  
                  {existingSubmission.pptType === 'link' && existingSubmission.pptUrl && (
                    <a
                      href={existingSubmission.pptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      <ExternalLink size={14} />
                      <span>Buka Link PPT / Canva</span>
                    </a>
                  )}

                  {existingSubmission.pptType === 'file' && existingSubmission.pptFileData && (
                    <a
                      href={existingSubmission.pptFileData}
                      download={existingSubmission.pptFileName || `PPT-${targetStudent.rpsPart}.pptx`}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      <Download size={14} />
                      <span>Download File PPT ({existingSubmission.pptFileName || 'PPT'})</span>
                    </a>
                  )}

                  {existingSubmission.makalahType === 'link' && existingSubmission.makalahUrl && (
                    <a
                      href={existingSubmission.makalahUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 transition-colors"
                    >
                      <ExternalLink size={14} />
                      <span>Buka Link Makalah</span>
                    </a>
                  )}

                  {existingSubmission.makalahType === 'file' && existingSubmission.makalahFileData && (
                    <a
                      href={existingSubmission.makalahFileData}
                      download={existingSubmission.makalahFileName || `Makalah-${targetStudent.rpsPart}.pdf`}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 transition-colors"
                    >
                      <Download size={14} />
                      <span>Download File Makalah</span>
                    </a>
                  )}

                  {/* Dosen Only: Delete / Reset Submission */}
                  {isDosen && (
                    <div className="pt-2">
                      {!isConfirmingDeleteSub ? (
                        <button
                          type="button"
                          onClick={() => setIsConfirmingDeleteSub(true)}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                          title="Hapus tugas mahasiswa ini (Akses Dosen)"
                        >
                          <Trash2 size={14} />
                          <span>Hapus / Reset Tugas (Akses Dosen)</span>
                        </button>
                      ) : (
                        <div className="p-3 bg-rose-100/90 border border-rose-300 rounded-xl space-y-2">
                          <p className="text-[11px] font-semibold text-rose-950">
                            Yakin hapus tugas milik <strong>{targetStudent.name}</strong>? Mahasiswa dapat mengunggah ulang.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsConfirmingDeleteSub(false)}
                              className="flex-1 py-1 px-2 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={isDosenDeleting}
                              onClick={handleExecuteDosenDeleteSubmission}
                              className="flex-1 py-1 px-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              <Trash2 size={12} />
                              <span>{isDosenDeleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Upload Form OR Locked Submission View */}
          <div className="lg:col-span-2">
            {existingSubmission && !isDosen ? (
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Lock size={18} className="text-emerald-700" />
                    <h3 className="font-bold text-base text-slate-900">
                      Formulir Terkunci: {targetStudent.rpsPart}
                    </h3>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    Tugas Telah Dikirim
                  </span>
                </div>

                {/* Graded by Lecturer Notification Banner */}
                {existingSubmission.grade !== undefined && (
                  <div className="p-4 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white rounded-xl shadow-md border border-emerald-400/40 flex items-center justify-between gap-4 animate-fadeIn">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center text-emerald-300 flex-shrink-0 mt-0.5">
                        <Award size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                            SUDAH DINILAI DOSEN
                          </span>
                          <span className="text-xs text-emerald-200 font-semibold">
                            Nilai Dosen: <strong className="text-sm text-yellow-300 font-extrabold">{existingSubmission.grade}</strong> / 100
                          </span>
                        </div>
                        <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
                          {existingSubmission.feedback
                            ? `Catatan Dosen: "${existingSubmission.feedback}"`
                            : 'Tugas presentasi telah diverifikasi dan dinilai permanen oleh Dosen Pengampu.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notice: One-Time Submission Locked */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <Lock size={15} className="text-emerald-700" />
                    <span>Aturan Pengumpulan: Satu Kali Kirim (One-Time Submission)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tugas presentasi Anda untuk <strong>{targetStudent.rpsPart}</strong> telah tercatat dan tersimpan secara permanen di basis data SIAKAD. Sistem secara otomatis mengunci formulir ini untuk menjaga keaslian data dan mencegah pengiriman ganda.
                  </p>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                    <AlertCircle size={15} className="text-amber-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Memerlukan Perbaikan / Revisi?</strong> Mahasiswa tidak dapat mengunggah ulang tugas secara mandiri. Akses pengumpulan hanya dapat dibuka kembali jika <strong>Dosen Pengampu</strong> mereset atau menghapus tugas sebelumnya di portal dosen.
                    </div>
                  </div>
                </div>

                {/* Submitted Files List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Berkas Tugas yang Telah Anda Kirim:</h4>

                  {/* PPT File Preview */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center flex-shrink-0 font-black text-xs">
                        PPT
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {existingSubmission.pptFileName || 'Slide Presentasi PPT'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {existingSubmission.pptType === 'link' ? (existingSubmission.pptUrl || 'Tautan Canva/Google Slides') : 'Berkas Slide Presentasi'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {existingSubmission.pptType === 'link' && existingSubmission.pptUrl ? (
                        <a
                          href={existingSubmission.pptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <ExternalLink size={13} />
                          <span>Buka Link PPT</span>
                        </a>
                      ) : existingSubmission.pptFileData ? (
                        <a
                          href={existingSubmission.pptFileData}
                          download={existingSubmission.pptFileName || `PPT_${targetStudent.name}.pptx`}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <Download size={13} />
                          <span>Unduh Berkas PPT</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Belum Ada PPT</span>
                      )}
                    </div>
                  </div>

                  {/* Makalah File Preview */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 font-black text-xs">
                        DOC
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {existingSubmission.makalahFileName || 'Makalah Lengkap (PDF/DOC)'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {existingSubmission.makalahType === 'link' ? (existingSubmission.makalahUrl || 'Tautan Google Docs/Drive') : 'Berkas Makalah Kajian'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {existingSubmission.makalahType === 'link' && existingSubmission.makalahUrl ? (
                        <a
                          href={existingSubmission.makalahUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <ExternalLink size={13} />
                          <span>Buka Link Makalah</span>
                        </a>
                      ) : existingSubmission.makalahFileData ? (
                        <a
                          href={existingSubmission.makalahFileData}
                          download={existingSubmission.makalahFileName || `Makalah_${targetStudent.name}.pdf`}
                          className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <Download size={13} />
                          <span>Unduh Berkas Makalah</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Belum Ada Makalah</span>
                      )}
                    </div>
                  </div>

                  {/* Details Card */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-700">Topik Kajian:</span>{' '}
                      <span className="text-slate-900">{existingSubmission.topic || targetStudent.topic}</span>
                    </div>
                    {existingSubmission.partnerName && (
                      <div>
                        <span className="font-bold text-slate-700">Rekan Presentasi (Kelompok):</span>{' '}
                        <span className="text-slate-900">{existingSubmission.partnerName}</span>
                      </div>
                    )}
                    {existingSubmission.notes && (
                      <div>
                        <span className="font-bold text-slate-700">Catatan/Abstrak Ringkasan:</span>
                        <p className="text-slate-600 italic mt-0.5">"{existingSubmission.notes}"</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100">
                    <span>Dikumpulkan: {existingSubmission.submittedAt ? new Date(existingSubmission.submittedAt).toLocaleString('id-ID') : 'Tersimpan'}</span>
                    <span className="text-emerald-700 font-bold">✓ Integritas Data Anti-Hilang Aktif</span>
                  </div>
                </div>
              </div>
            ) : (
            <form onSubmit={handleSubmitTask} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Upload size={18} className="text-emerald-700" />
                  <h3 className="font-bold text-base text-slate-900">
                    Form Upload PPT & Makalah: {targetStudent.rpsPart}
                  </h3>
                </div>
                <span className="text-xs text-slate-500">
                  {targetStudent.name}
                </span>
              </div>

              {/* Graded by Lecturer Notification Banner */}
              {existingSubmission?.grade !== undefined && (
                <div className="p-4 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white rounded-xl shadow-md border border-emerald-400/40 flex items-center justify-between gap-4 animate-fadeIn">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center text-emerald-300 flex-shrink-0 mt-0.5">
                      <Award size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                          SUDAH DINILAI DOSEN
                        </span>
                        <span className="text-xs text-emerald-200 font-semibold">
                          Nilai Dosen: <strong className="text-sm text-yellow-300 font-extrabold">{existingSubmission.grade}</strong> / 100
                        </span>
                      </div>
                      <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
                        {existingSubmission.feedback
                          ? `Catatan Dosen: "${existingSubmission.feedback}"`
                          : 'Tugas presentasi telah diverifikasi dan dinilai permanen oleh Dosen Pengampu.'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <span className="inline-block text-[11px] font-bold bg-white text-emerald-900 px-3 py-1.5 rounded-lg shadow-xs">
                      Telah Dinilai
                    </span>
                  </div>
                </div>
              )}

              {/* Alert Feedback Messages */}
              {submitSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>{submitSuccessMsg}</div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                  <AlertCircle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>{errorMsg}</div>
                </div>
              )}

              {/* Presentation Format & Kelompok PPT/Makalah Management (Ditentukan Dosen) */}
              <div className="space-y-4 bg-indigo-50/70 p-4 sm:p-5 rounded-xl border border-indigo-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Users size={16} className="text-indigo-700" />
                      <span>Format Presentasi PPT & Makalah (Pertemuan #{targetStudent.meetingNumber})</span>
                    </label>
                    <span className="text-[11px] text-indigo-700">
                      {isDosen ? 'Ditentukan oleh Dosen Pengampu' : 'Format penugasan pertemuan ini'}
                    </span>
                  </div>
                  {isDosen ? (
                    <div className="flex items-center bg-indigo-100 p-0.5 rounded-lg text-xs self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleTogglePresentationFormat('individu')}
                        className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                          presentationType === 'individu' ? 'bg-white text-indigo-950 shadow-xs' : 'text-indigo-700 hover:text-indigo-950'
                        }`}
                      >
                        Individu
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePresentationFormat('kelompok')}
                        className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                          presentationType === 'kelompok' ? 'bg-white text-indigo-950 shadow-xs' : 'text-indigo-700 hover:text-indigo-950'
                        }`}
                      >
                        Kelompok PPT & Makalah
                      </button>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-950 font-bold text-xs rounded-lg shadow-xs self-start sm:self-auto flex items-center gap-1.5">
                      <Users size={14} className="text-indigo-600" />
                      <span>Format: {presentationType === 'kelompok' ? 'Kelompok (PPT & Makalah)' : 'Individu'}</span>
                    </div>
                  )}
                </div>

                {/* Edit presentation topic */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Topik / Judul Materi Presentasi Pertemuan Ini:
                  </label>
                  {isDosen ? (
                    <input
                      type="text"
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      placeholder="Judul topik materi presentasi..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 font-medium">
                      {topic || 'Topik materi belum diatur oleh dosen pengampu.'}
                    </div>
                  )}
                </div>

                {/* Kelompok Presentasi: Roster Mahasiswa & Tambah Mahasiswa */}
                {isGroupFormat && (
                  <div className="p-3.5 bg-white rounded-xl border border-indigo-200/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Users size={14} className="text-indigo-600" />
                        <span>Anggota Kelompok PPT & Makalah ({meetingPresenters?.length || 0} Mahasiswa):</span>
                      </div>
                      {isDosen && (
                        <button
                          type="button"
                          onClick={() => setShowAddPresenterModal(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors self-start sm:self-auto"
                        >
                          <UserPlus size={13} />
                          <span>+ Tambah Mahasiswa</span>
                        </button>
                      )}
                    </div>

                    {/* Roster of Students in this Presentation Group */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(meetingPresenters || []).map(m => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/50 border border-indigo-100 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-indigo-200 text-indigo-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {m.name.charAt(0)}
                            </div>
                            <div className="truncate">
                              <p className="font-bold text-slate-900 truncate">{m.name}</p>
                              <p className="text-[10px] text-slate-500">NIM: {m.nim || '-'}</p>
                            </div>
                          </div>
                          {isDosen && (meetingPresenters?.length || 0) > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePresenterFromMeeting(m.name)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                              title="Hapus mahasiswa dari kelompok pertemuan ini"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add Presenter Modal / In-line Box */}
                    {showAddPresenterModal && (
                      <div className="p-3 bg-slate-50 border border-indigo-200 rounded-xl space-y-2.5 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-950">
                            Tambah Mahasiswa ke Kelompok Pertemuan #{targetStudent.meetingNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowAddPresenterModal(false)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {presenterActionMsg && (
                          <div
                            className={`p-2 rounded-lg text-xs font-medium ${
                              presenterActionMsg.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {presenterActionMsg.text}
                          </div>
                        )}

                        <div className="space-y-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Opsi 1: Pilih Mahasiswa yang Sudah Ada di Kelas:
                            </label>
                            <select
                              value={selectedStudentIdToAdd}
                              onChange={e => {
                                setSelectedStudentIdToAdd(e.target.value);
                                if (e.target.value) {
                                  setCustomStudentNameToAdd('');
                                  setCustomNimToAdd('');
                                }
                              }}
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 font-medium"
                            >
                              <option value="">-- Pilih dari daftar mahasiswa kelas --</option>
                              {students
                                .filter(s => !meetingPresenters.some(mp => mp.id === s.id))
                                .map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} ({s.nim || 'Tanpa NIM'}) - Jadwal Sekarang: {s.rpsPart}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="text-[11px] text-slate-400 text-center font-bold">-- ATAU --</div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Opsi 2: Input Mahasiswa Baru (Nama & NIM):
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={customStudentNameToAdd}
                                onChange={e => {
                                  setCustomStudentNameToAdd(e.target.value);
                                  if (e.target.value) setSelectedStudentIdToAdd('');
                                }}
                                placeholder="Nama Mahasiswa Baru..."
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                              />
                              <input
                                type="text"
                                value={customNimToAdd}
                                onChange={e => setCustomNimToAdd(e.target.value)}
                                placeholder="NIM Mahasiswa..."
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowAddPresenterModal(false)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={isAddingPresenter}
                              onClick={handleAddPresenterToMeeting}
                              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Check size={13} />
                              <span>{isAddingPresenter ? 'Menambahkan...' : 'Tambahkan ke Kelompok'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notice if group member already submitted */}
                    {peerSubmission && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span>Materi Kelompok Telah Diunggah oleh Rekan ({peerSubmission.studentName}):</span>
                        </div>
                        <p className="text-[11px] text-emerald-800">
                          Tugas PPT & Makalah kelompok ini sudah diunggah. Anda dapat mengunduh atau meninjau file materi yang sudah diunggah oleh rekan Anda.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {peerSubmission.pptUrl && (
                            <a
                              href={peerSubmission.pptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                            >
                              <ExternalLink size={12} />
                              <span>Buka Link PPT Kelompok</span>
                            </a>
                          )}
                          {peerSubmission.pptFileData && (
                            <a
                              href={peerSubmission.pptFileData}
                              download={peerSubmission.pptFileName || 'PPT-Kelompok.pptx'}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                            >
                              <Download size={12} />
                              <span>Unduh File PPT Kelompok</span>
                            </a>
                          )}
                          {peerSubmission.makalahUrl && (
                            <a
                              href={peerSubmission.makalahUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                            >
                              <ExternalLink size={12} />
                              <span>Buka Link Makalah Kelompok</span>
                            </a>
                          )}
                          {peerSubmission.makalahFileData && (
                            <a
                              href={peerSubmission.makalahFileData}
                              download={peerSubmission.makalahFileName || 'Makalah-Kelompok.pdf'}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                            >
                              <Download size={12} />
                              <span>Unduh File Makalah Kelompok</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Additional Partner Name Note (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-indigo-900">
                      Catatan Rekan / Teman Tambahan (Opsional):
                    </label>
                  </div>
                  <input
                    type="text"
                    value={partnerName}
                    onChange={e => setPartnerName(e.target.value)}
                    placeholder="Nama teman tambahan jika ada..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Pilihan Jenis Unggahan (Boleh salah satu atau keduanya) */}
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <FileText size={15} className="text-emerald-700" />
                    <span>Pilihan Unggahan: Boleh Pilih Salah Satu (PPT atau Makalah) atau Keduanya</span>
                  </label>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                    Fleksibel
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Sesuai ketentuan, mahasiswa diperbolehkan memilih untuk mengunggah <strong>hanya PPT</strong>, <strong>hanya Makalah</strong>, atau <strong>keduanya</strong>.
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSubmissionChoice('both')}
                    className={`py-2 px-2 text-center rounded-lg text-xs font-bold transition-all border ${
                      submissionChoice === 'both'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    PPT & Makalah (Keduanya)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmissionChoice('ppt_only')}
                    className={`py-2 px-2 text-center rounded-lg text-xs font-bold transition-all border ${
                      submissionChoice === 'ppt_only'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Hanya Slide PPT
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmissionChoice('makalah_only')}
                    className={`py-2 px-2 text-center rounded-lg text-xs font-bold transition-all border ${
                      submissionChoice === 'makalah_only'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Hanya Makalah
                  </button>
                </div>
              </div>

              {/* Section 1: Presentation Slides (PPT / Canva) */}
              <div className={`space-y-3 p-4 rounded-xl border transition-all ${
                submissionChoice === 'makalah_only' ? 'bg-slate-50/40 border-slate-200 opacity-60' : 'bg-slate-50/80 border-slate-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText size={15} className="text-emerald-700" />
                    <span>
                      1. Presentasi PPT (File PPTX/PDF atau Link Canva)
                      {submissionChoice === 'ppt_only' ? ' * (Wajib)' : submissionChoice === 'both' ? ' (Dianjurkan)' : ' (Opsional)'}
                    </span>
                  </label>
                  
                  {/* Mode switcher */}
                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setPptType('link')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all ${
                        pptType === 'link' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Link Canva / Drive
                    </button>
                    <button
                      type="button"
                      onClick={() => setPptType('file')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all ${
                        pptType === 'file' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Upload File PPT
                    </button>
                  </div>
                </div>

                {pptType === 'link' ? (
                  <div>
                    <div className="relative">
                      <LinkIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="url"
                        placeholder="Tempelkan link Canva / Google Slides / Drive Anda di sini (https://...)"
                        value={pptUrl}
                        onChange={e => setPptUrl(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Pastikan link Canva atau Google Drive diatur ke <em>"Siapa saja yang memiliki link dapat melihat"</em>.
                    </p>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept=".ppt,.pptx,.pdf"
                      onChange={handlePptFileChange}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-700 file:text-white hover:file:bg-emerald-800 cursor-pointer"
                    />
                    {pptFileName && (
                      <p className="text-xs text-emerald-800 font-medium mt-1.5 flex items-center gap-1">
                        <CheckCircle2 size={13} /> File terpilih: {pptFileName}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Makalah Dokumen */}
              <div className={`space-y-3 p-4 rounded-xl border transition-all ${
                submissionChoice === 'ppt_only' ? 'bg-slate-50/40 border-slate-200 opacity-60' : 'bg-slate-50/80 border-slate-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText size={15} className="text-emerald-700" />
                    <span>
                      2. Makalah Makul (PDF/DOCX atau Link Google Docs)
                      {submissionChoice === 'makalah_only' ? ' * (Wajib)' : submissionChoice === 'both' ? ' (Dianjurkan)' : ' (Opsional)'}
                    </span>
                  </label>

                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setMakalahType('link')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all ${
                        makalahType === 'link' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Link Docs / Drive
                    </button>
                    <button
                      type="button"
                      onClick={() => setMakalahType('file')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all ${
                        makalahType === 'file' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Upload File Makalah
                    </button>
                  </div>
                </div>

                {makalahType === 'link' ? (
                  <div>
                    <div className="relative">
                      <LinkIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="url"
                        placeholder="Link Google Docs / PDF Drive makalah (https://...)"
                        value={makalahUrl}
                        onChange={e => setMakalahUrl(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleMakalahFileChange}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-900 cursor-pointer"
                    />
                    {makalahFileName && (
                      <p className="text-xs text-slate-700 font-medium mt-1.5 flex items-center gap-1">
                        <CheckCircle2 size={13} /> File makalah: {makalahFileName}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Section 3: Notes / Ringkasan Pokok */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan / Ringkasan Inti Presentasi untuk Dosen:
                </label>
                <textarea
                  rows={3}
                  placeholder="Tuliskan poin penting kajian filsafat, rumusan masalah, atau catatan presentasi Anda..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Aturan Pengumpulan: Satu kali kirim. Hubungi Dosen jika memerlukan perbaikan (revisi).</span>
                </div>

                <button
                  id="btn-kirim-tugas-individu"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={16} />
                  <span>{isSubmitting ? 'Mengirim & Menyimpan...' : 'Kirim Tugas (Tersimpan Otomatis)'}</span>
                </button>
              </div>

            </form>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
