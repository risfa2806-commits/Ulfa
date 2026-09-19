import React, { useState } from 'react';
import { GroupProject, Student } from '../types';
import {
  submitGroupProject,
  addGroupMemberApi,
  removeGroupMemberApi,
  createGroupApi,
  updateGroupApi,
  deleteGroupApi,
  updateStudentApi,
  reorganizeGroupsApi,
} from '../services/api';
import {
  Video,
  Users,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Award,
  Film,
  Send,
  Link as LinkIcon,
  Bot,
  Layers,
  Clock,
  Youtube,
  UserPlus,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Edit2,
  Save,
  FolderPlus,
  Shuffle,
} from 'lucide-react';

interface GroupProjectViewProps {
  groups: GroupProject[];
  students: Student[];
  currentStudent: Student | null;
  onRefreshData: () => Promise<void>;
  isDosen?: boolean;
}

export const GroupProjectView: React.FC<GroupProjectViewProps> = ({
  groups = [],
  students = [],
  currentStudent,
  onRefreshData,
  isDosen = false,
}) => {
  const defaultGroupId = currentStudent?.groupId || 1;
  const [activeGroupId, setActiveGroupId] = useState<number>(defaultGroupId);

  const activeGroup = (groups || []).find(g => g.id === activeGroupId) || groups?.[0] || {
    id: 1,
    name: 'Kelompok 1',
    title: 'Ontologi Filsafat',
    description: 'Hakikat ilmu pengetahuan dalam MPI',
    toolsSuggested: 'ChatGPT & Canva AI',
    members: [],
  };

  // Form states
  const [videoUrl, setVideoUrl] = useState<string>(activeGroup?.submission?.videoUrl || '');
  const [aiToolsUsed, setAiToolsUsed] = useState<string>(
    activeGroup?.submission?.aiToolsUsed || activeGroup?.toolsSuggested || ''
  );
  const [summaryNotes, setSummaryNotes] = useState<string>(activeGroup?.submission?.summaryNotes || '');
  const [submittedBy, setSubmittedBy] = useState<string>(
    activeGroup?.submission?.submittedBy || currentStudent?.name || ''
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Member management states
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMode, setAddMode] = useState<'existing' | 'new'>('existing');
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberNim, setNewMemberNim] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberActionMsg, setMemberActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Group creation modal state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupNumber, setNewGroupNumber] = useState((groups?.length || 0) + 1);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupTools, setNewGroupTools] = useState('ChatGPT, Canva Video & ElevenLabs AI');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Group edit modal state
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupTitle, setEditGroupTitle] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupTools, setEditGroupTools] = useState('');
  const [isEditingGroup, setIsEditingGroup] = useState(false);

  // Member name edit state
  const [editingMember, setEditingMember] = useState<{
    originalName: string;
    newName: string;
    studentId?: string;
  } | null>(null);
  const [isSavingMemberName, setIsSavingMemberName] = useState(false);

  // Group and member deletion states (replaces window.confirm for iframe reliability)
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<string | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Group reorganize modal state (Auto group count adjustment across semesters)
  const [showReorganizeModal, setShowReorganizeModal] = useState(false);
  const [targetGroupCount, setTargetGroupCount] = useState<number>(groups?.length || 5);
  const [reorganizeMode, setReorganizeMode] = useState<'even' | 'random'>('even');
  const [isReorganizing, setIsReorganizing] = useState(false);
  const [reorganizeMsg, setReorganizeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleReorganizeGroups = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetGroupCount < 2 || targetGroupCount > 15) {
      setReorganizeMsg({ type: 'error', text: 'Jumlah kelompok harus antara 2 sampai 15.' });
      return;
    }
    setIsReorganizing(true);
    setReorganizeMsg(null);
    try {
      const res = await reorganizeGroupsApi(targetGroupCount, reorganizeMode);
      if (res.success) {
        setReorganizeMsg({
          type: 'success',
          text: res.message || `Berhasil mengatur ulang mahasiswa menjadi ${targetGroupCount} kelompok!`,
        });
        await onRefreshData();
        setTimeout(() => {
          setShowReorganizeModal(false);
          setReorganizeMsg(null);
        }, 1500);
      } else {
        setReorganizeMsg({ type: 'error', text: res.error || 'Gagal membagi ulang kelompok.' });
      }
    } catch {
      setReorganizeMsg({ type: 'error', text: 'Terjadi gangguan jaringan saat membagi ulang kelompok.' });
    } finally {
      setIsReorganizing(false);
    }
  };

  // When group changes, update form fields
  const handleGroupSelect = (grp: GroupProject) => {
    setActiveGroupId(grp.id);
    setVideoUrl(grp.submission?.videoUrl || '');
    setAiToolsUsed(grp.submission?.aiToolsUsed || grp.toolsSuggested || '');
    setSummaryNotes(grp.submission?.summaryNotes || '');
    setSubmittedBy(grp.submission?.submittedBy || currentStudent?.name || '');
    setSuccessMsg(null);
    setErrorMsg(null);
    setShowAddMember(false);
    setMemberActionMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!videoUrl.trim()) {
      setErrorMsg('Harap masukkan link Video (YouTube, Google Drive, atau Canva).');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await submitGroupProject({
        groupId: activeGroup.id,
        videoUrl: videoUrl.trim(),
        aiToolsUsed: aiToolsUsed.trim(),
        summaryNotes: summaryNotes.trim(),
        submittedBy: submittedBy.trim() || currentStudent?.name || 'Perwakilan Kelompok',
      });

      if (ok) {
        setSuccessMsg('Proyek Video Edukasi Kelompok berhasil disimpan dan tersinkronisasi ke Dosen!');
        await onRefreshData();
      } else {
        setErrorMsg('Gagal mengirim proyek video. Silakan coba kembali.');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle adding member to group
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberActionMsg(null);

    let payload: {
      studentName?: string;
      studentId?: string;
      nim?: string;
      rpsPart?: string;
      topic?: string;
      meetingNumber?: number;
    } = {};

    if (addMode === 'existing') {
      if (!selectedExistingId) {
        setMemberActionMsg({ type: 'error', text: 'Pilih mahasiswa yang ingin ditambahkan.' });
        return;
      }
      const existingStd = students.find(s => s.id === selectedExistingId);
      if (!existingStd) return;
      payload = {
        studentId: existingStd.id,
        studentName: existingStd.name,
      };
    } else {
      if (!newMemberName.trim()) {
        setMemberActionMsg({ type: 'error', text: 'Nama mahasiswa baru wajib diisi.' });
        return;
      }
      payload = {
        studentName: newMemberName.trim().toUpperCase(),
        nim: newMemberNim.trim() || undefined,
        topic: `Tugas Kelompok ${activeGroup.id}: ${activeGroup.title}`,
        rpsPart: `Kelompok ${activeGroup.id}`,
      };
    }

    setIsAddingMember(true);
    try {
      const res = await addGroupMemberApi(activeGroup.id, payload);
      if (res.success) {
        setMemberActionMsg({
          type: 'success',
          text: `Berhasil menambahkan ${payload.studentName || 'mahasiswa'} ke ${activeGroup.name}!`,
        });
        setNewMemberName('');
        setNewMemberNim('');
        setSelectedExistingId('');
        setShowAddMember(false);
        await onRefreshData();
      } else {
        setMemberActionMsg({ type: 'error', text: res.error || 'Gagal menambahkan anggota.' });
      }
    } catch {
      setMemberActionMsg({ type: 'error', text: 'Terjadi kesalahan jaringan.' });
    } finally {
      setIsAddingMember(false);
    }
  };

  // Handle removing member from group
  const handleRemoveMember = async (nameToRemove: string) => {
    setConfirmRemoveMember(null);
    try {
      const res = await removeGroupMemberApi(activeGroup.id, nameToRemove);
      if (res.success) {
        setMemberActionMsg({
          type: 'success',
          text: `${nameToRemove} berhasil dihapus dari kelompok.`,
        });
        await onRefreshData();
      } else {
        setMemberActionMsg({ type: 'error', text: res.error || 'Gagal menghapus anggota.' });
      }
    } catch {
      setMemberActionMsg({ type: 'error', text: 'Terjadi kesalahan saat menghapus anggota.' });
    }
  };

  // Handle creating new group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupTitle.trim()) {
      alert('Nama dan Judul Proyek Kelompok wajib diisi!');
      return;
    }
    setIsCreatingGroup(true);
    try {
      const created = await createGroupApi({
        id: Number(newGroupNumber) || (groups?.length || 0) + 1,
        name: newGroupName.trim(),
        title: newGroupTitle.trim(),
        description: newGroupDesc.trim() || 'Proyek Video Edukasi Filsafat Ilmu',
        toolsSuggested: newGroupTools.trim() || 'ChatGPT & Canva AI',
        members: [],
      });
      if (created) {
        await onRefreshData();
        setActiveGroupId(created.id);
        setShowCreateGroupModal(false);
        setNewGroupName('');
        setNewGroupTitle('');
        setNewGroupDesc('');
      } else {
        alert('Gagal membuat kelompok baru.');
      }
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Handle opening edit group modal
  const handleStartEditGroup = () => {
    setEditGroupName(activeGroup.name);
    setEditGroupTitle(activeGroup.title);
    setEditGroupDesc(activeGroup.description);
    setEditGroupTools(activeGroup.toolsSuggested);
    setShowEditGroupModal(true);
  };

  // Handle saving edited group
  const handleSaveEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingGroup(true);
    try {
      const updated = await updateGroupApi(activeGroup.id, {
        name: editGroupName.trim(),
        title: editGroupTitle.trim(),
        description: editGroupDesc.trim(),
        toolsSuggested: editGroupTools.trim(),
      });
      if (updated) {
        await onRefreshData();
        setShowEditGroupModal(false);
      } else {
        alert('Gagal memperbarui kelompok.');
      }
    } finally {
      setIsEditingGroup(false);
    }
  };

  // Handle deleting active group
  const handleDeleteGroup = async () => {
    if ((groups?.length || 0) <= 1) {
      setMemberActionMsg({ type: 'error', text: 'Minimal harus ada 1 kelompok tersisa.' });
      setConfirmDeleteGroupId(null);
      return;
    }
    setIsDeletingGroup(true);
    try {
      const success = await deleteGroupApi(activeGroup.id);
      if (success) {
        setConfirmDeleteGroupId(null);
        await onRefreshData();
        const nextGroup = (groups || []).find(g => g.id !== activeGroup.id);
        if (nextGroup) setActiveGroupId(nextGroup.id);
      } else {
        setMemberActionMsg({ type: 'error', text: 'Gagal menghapus kelompok.' });
      }
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // Handle saving edited student name
  const handleSaveMemberName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editingMember.newName.trim()) return;
    setIsSavingMemberName(true);
    try {
      if (editingMember.studentId) {
        await updateStudentApi(editingMember.studentId, {
          name: editingMember.newName.trim().toUpperCase(),
        });
      } else {
        // Update member array in group
        const newMembers = (activeGroup?.members || []).map(m =>
          m === editingMember.originalName ? editingMember.newName.trim().toUpperCase() : m
        );
        await updateGroupApi(activeGroup.id, { members: newMembers });
      }
      setEditingMember(null);
      await onRefreshData();
    } finally {
      setIsSavingMemberName(false);
    }
  };

  // Filter students that are not yet in this active group
  const availableExistingStudents = (students || []).filter(
    s => !(activeGroup?.members || []).some(m => m.trim().toUpperCase() === s.name.trim().toUpperCase())
  );

  return (
    <div className="space-y-6">
      {/* Banner / Specs Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-indigo-800/40 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/30 text-indigo-200 text-xs font-semibold px-2.5 py-1 rounded-full border border-indigo-400/30 mb-2">
              <Film size={13} />
              <span>Tugas UAS Khusus: Proyek Video Edukasi AI Kelompok (Pertemuan 16)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif-title tracking-tight">
              Tugas Ujian Akhir Semester (UAS): Video Edukasi Digital Berbasis AI
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100/90 mt-1 max-w-2xl leading-relaxed">
              Tugas UAS resmi untuk mahasiswa MPI 1 yang terbagi dalam kelompok kolaboratif. Video edukasi membedah tema filsafat ilmu dengan integrasi AI (ChatGPT, Canva AI, ElevenLabs, D-ID) dan ditayangkan pada Festival UAS Pertemuan ke-16.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-white/10 p-2.5 rounded-xl border border-white/10 text-xs">
              <span className="text-indigo-200 block text-[10px]">Bobot Nilai UAS</span>
              <strong className="text-white text-sm">25% SIAKAD</strong>
            </div>

            {isDosen && (
              <div className="flex items-center gap-2">
                <button
                  id="btn-reorganize-groups"
                  onClick={() => {
                    setTargetGroupCount(groups?.length || 5);
                    setReorganizeMsg(null);
                    setShowReorganizeModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                  title="Atur ulang atau ubah jumlah kelompok mahasiswa secara otomatis (berurutan / acak)"
                >
                  <Shuffle size={14} />
                  <span>Rubah Jumlah Kelompok</span>
                </button>

                <button
                  onClick={() => {
                    setNewGroupNumber((groups?.length || 0) + 1);
                    setNewGroupName(`Kelompok ${(groups?.length || 0) + 1}`);
                    setShowCreateGroupModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  <FolderPlus size={14} />
                  <span>+ Tambah Kelompok</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Group Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {groups.map((grp) => {
          const isSelected = grp.id === activeGroupId;
          const isMyGroup = currentStudent && grp.members.includes(currentStudent.name);
          const hasSubmitted = Boolean(grp.submission?.videoUrl);

          return (
            <button
              key={grp.id}
              onClick={() => handleGroupSelect(grp)}
              className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-indigo-900 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400/30'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${isSelected ? 'text-indigo-200' : 'text-indigo-800'}`}>
                    {grp.name}
                  </span>
                  {hasSubmitted && (
                    <CheckCircle2 size={13} className={isSelected ? 'text-emerald-400' : 'text-emerald-600'} />
                  )}
                </div>
                <div className={`text-[10px] mt-1 font-semibold ${isSelected ? 'text-indigo-100' : 'text-slate-600'}`}>
                  {grp.members?.length || 0} Anggota
                </div>
              </div>

              {isMyGroup && (
                <span className={`text-[9px] font-extrabold uppercase mt-2 px-1.5 py-0.5 rounded ${
                  isSelected ? 'bg-indigo-700 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  Kelompok Anda
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Group Project Detail & Submission Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Group Info & Members */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black bg-indigo-900 text-white px-3 py-1 rounded-md">
                {activeGroup.name}
              </span>
              {isDosen && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleStartEditGroup}
                    className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                    title="Edit Nama Kelompok & Judul Proyek"
                  >
                    <Edit2 size={13} />
                  </button>
                  {(groups?.length || 0) > 1 && (
                    confirmDeleteGroupId === activeGroup.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-lg">
                        <span className="text-[10px] text-rose-800 font-bold">Hapus?</span>
                        <button
                          type="button"
                          onClick={handleDeleteGroup}
                          disabled={isDeletingGroup}
                          className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                        >
                          {isDeletingGroup ? '...' : 'Ya'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteGroupId(null)}
                          className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteGroupId(activeGroup.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        title="Hapus Kelompok Ini"
                      >
                        <Trash2 size={13} />
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                Judul Proyek Video Edukasi:
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                "{activeGroup.title}"
              </h3>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
              <span className="font-bold text-slate-900 block mb-1">Deskripsi Isi Video:</span>
              {activeGroup.description}
            </div>

            {/* Members List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Users size={13} className="text-indigo-600" />
                  <span>Anggota Kelompok ({activeGroup.members?.length || 0} Orang):</span>
                </span>
                {isDosen && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMember(!showAddMember);
                      setMemberActionMsg(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200"
                  >
                    {showAddMember ? <X size={13} /> : <UserPlus size={13} />}
                    <span>{showAddMember ? 'Batal' : '+ Tambah Mahasiswa'}</span>
                  </button>
                )}
              </div>

              {/* Status feedback message */}
              {memberActionMsg && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    memberActionMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {memberActionMsg.type === 'success' ? (
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="text-rose-600 shrink-0" />
                  )}
                  <span>{memberActionMsg.text}</span>
                </div>
              )}

              {/* Add Member Form */}
              {showAddMember && (
                <form
                  onSubmit={handleAddMember}
                  className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5 text-xs animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-indigo-200/80">
                    <span className="font-bold text-indigo-950 flex items-center gap-1">
                      <UserPlus size={14} /> Tambah ke {activeGroup.name}
                    </span>
                    <div className="flex rounded-md bg-white p-0.5 border border-indigo-200 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setAddMode('existing')}
                        className={`px-2 py-0.5 rounded font-semibold ${
                          addMode === 'existing'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Pilih Terdaftar
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddMode('new')}
                        className={`px-2 py-0.5 rounded font-semibold ${
                          addMode === 'new'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Mahasiswa Baru
                      </button>
                    </div>
                  </div>

                  {addMode === 'existing' ? (
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">
                        Pilih Mahasiswa MPI 1:
                      </label>
                      {availableExistingStudents.length === 0 ? (
                        <p className="text-slate-500 italic text-[11px] py-1">
                          Semua mahasiswa terdaftar sudah menjadi anggota kelompok ini.
                        </p>
                      ) : (
                        <select
                          value={selectedExistingId}
                          onChange={e => setSelectedExistingId(e.target.value)}
                          className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">-- Pilih Mahasiswa ({availableExistingStudents.length} tersedia) --</option>
                          {availableExistingStudents.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.nim}) - Saat ini: Kel. {s.groupId}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Nama Lengkap Mahasiswa *
                        </label>
                        <input
                          type="text"
                          required
                          value={newMemberName}
                          onChange={e => setNewMemberName(e.target.value)}
                          placeholder="Contoh: MUHAMMAD RIZKY"
                          className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          NIM (Opsional)
                        </label>
                        <input
                          type="text"
                          value={newMemberNim}
                          onChange={e => setNewMemberNim(e.target.value)}
                          placeholder="Contoh: 20260116"
                          className="w-full p-2 bg-white rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isAddingMember || (addMode === 'existing' && !selectedExistingId)}
                    className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isAddingMember ? (
                      <span>Menyimpan...</span>
                    ) : (
                      <>
                        <Plus size={13} />
                        <span>Tambahkan ke {activeGroup.name}</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Members List Cards */}
              <div className="space-y-1.5">
                {activeGroup.members.map((name, idx) => {
                  const isCur = currentStudent?.name === name;
                  const matchedStudent = students.find(
                    s => s.name.trim().toUpperCase() === name.trim().toUpperCase()
                  );

                  const isEditingThis = editingMember?.originalName === name;

                  return (
                    <div
                      key={`${name}-${idx}`}
                      className={`p-2 rounded-lg text-xs flex items-center justify-between ${
                        isCur
                          ? 'bg-emerald-50 border border-emerald-300 font-bold text-emerald-950'
                          : 'bg-slate-50 border border-slate-200 text-slate-800 font-medium'
                      }`}
                    >
                      {isEditingThis ? (
                        <form onSubmit={handleSaveMemberName} className="flex items-center gap-1 w-full">
                          <input
                            type="text"
                            required
                            value={editingMember.newName}
                            onChange={e =>
                              setEditingMember({ ...editingMember, newName: e.target.value })
                            }
                            className="flex-1 px-2 py-0.5 text-xs bg-white border border-indigo-400 rounded uppercase font-bold"
                          />
                          <button
                            type="submit"
                            disabled={isSavingMemberName}
                            className="p-1 text-emerald-700 hover:bg-emerald-100 rounded"
                            title="Simpan Nama"
                          >
                            <Save size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMember(null)}
                            className="p-1 text-slate-400 hover:bg-slate-200 rounded"
                            title="Batal"
                          >
                            <X size={13} />
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-5 w-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <div className="truncate">
                              <span className="truncate block">{name}</span>
                              {matchedStudent?.nim && (
                                <span className="text-[10px] text-slate-500 block font-normal">
                                  NIM: {matchedStudent.nim}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {isCur && (
                              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">
                                Anda
                              </span>
                            )}
                            {isDosen && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingMember({
                                      originalName: name,
                                      newName: name,
                                      studentId: matchedStudent?.id,
                                    })
                                  }
                                  className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors"
                                  title="Edit Nama Mahasiswa (Dosen Only)"
                                >
                                  <Edit2 size={12} />
                                </button>
                                {(activeGroup?.members?.length || 0) > 1 && (
                                  confirmRemoveMember === name ? (
                                    <div className="flex items-center gap-1 bg-rose-50 border border-rose-300 px-1 py-0.5 rounded">
                                      <span className="text-[9px] text-rose-800 font-bold">Hapus?</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveMember(name)}
                                        className="px-1 py-0.2 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold cursor-pointer"
                                      >
                                        Ya
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmRemoveMember(null)}
                                        className="px-1 py-0.2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[9px] cursor-pointer"
                                      >
                                        Batal
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmRemoveMember(name)}
                                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                                      title="Hapus dari kelompok (Dosen Only)"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )
                                )}
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Submission Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Video size={18} className="text-indigo-700" />
                <h3 className="font-bold text-base text-slate-900">
                  Form Pengumpulan Proyek Video: {activeGroup.name}
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                UAS Semester Ganjil 2026/2027
              </span>
            </div>

            {/* Alert messages */}
            {successMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>{successMsg}</div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div>{errorMsg}</div>
              </div>
            )}

            {/* Input 1: Video Link */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <LinkIcon size={14} className="text-indigo-600" />
                <span>1. Tautan / Link Video Proyek UAS (YouTube / Google Drive / Canva) *</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://youtu.be/... atau https://drive.google.com/..."
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Jika menggunakan Google Drive, pastikan izin akses tautan diatur ke <em>"Siapa saja yang memiliki link dapat melihat"</em>.
              </p>
            </div>

            {/* Input 2: AI Tools Used */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Bot size={14} className="text-indigo-600" />
                <span>2. AI Tools yang Digunakan dalam Pembuatan Video</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: ChatGPT-4o (Naskah), ElevenLabs (Voiceover), Canva AI (Animasi)"
                value={aiToolsUsed}
                onChange={e => setAiToolsUsed(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Input 3: Submitter Name */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                3. Nama Pengirim / Perwakilan Anggota:
              </label>
              <input
                type="text"
                placeholder="Nama anggota yang mewakili pengiriman..."
                value={submittedBy}
                onChange={e => setSubmittedBy(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Input 4: Summary Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                4. Sinopsis / Catatan Inti Video untuk Dosen:
              </label>
              <textarea
                rows={3}
                placeholder="Tuliskan pesan utama, argumen filosofis, dan refleksi yang disajikan dalam video..."
                value={summaryNotes}
                onChange={e => setSummaryNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Submit button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Nilai akan otomatis masuk ke Rekapitulasi Nilai Seluruh Mahasiswa</span>
              </span>

              <button
                id="btn-kirim-proyek-uas"
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={15} />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Proyek UAS (Tersinkron Dosen)'}</span>
              </button>
            </div>

          </form>
        </div>

      </div>

      {/* CREATE GROUP MODAL */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleCreateGroup}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus size={18} className="text-indigo-600" />
                <span>Tambah Kelompok Tugas Presentasi Baru</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Kelompok *</label>
              <input
                type="text"
                required
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                placeholder="Contoh: Kelompok 6"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Judul Topik / Proyek *</label>
              <input
                type="text"
                required
                value={newGroupTitle}
                onChange={e => setNewGroupTitle(e.target.value)}
                placeholder="Contoh: Filsafat Teknologi & Etika AI dalam Manajemen Pendidikan"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Deskripsi Tugas</label>
              <textarea
                rows={2}
                value={newGroupDesc}
                onChange={e => setNewGroupDesc(e.target.value)}
                placeholder="Deskripsi tugas kajian filsafat kelompok..."
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tools AI yang Disarankan</label>
              <input
                type="text"
                value={newGroupTools}
                onChange={e => setNewGroupTools(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isCreatingGroup}
                className="px-4 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg font-bold shadow-xs flex items-center gap-1"
              >
                <Save size={13} />
                <span>{isCreatingGroup ? 'Menyimpan...' : 'Simpan Kelompok'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT GROUP MODAL */}
      {showEditGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveEditGroup}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 size={18} className="text-indigo-600" />
                <span>Edit Info {activeGroup.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditGroupModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Kelompok *</label>
              <input
                type="text"
                required
                value={editGroupName}
                onChange={e => setEditGroupName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Judul Topik / Proyek *</label>
              <input
                type="text"
                required
                value={editGroupTitle}
                onChange={e => setEditGroupTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Deskripsi Tugas</label>
              <textarea
                rows={3}
                value={editGroupDesc}
                onChange={e => setEditGroupDesc(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tools AI yang Disarankan</label>
              <input
                type="text"
                value={editGroupTools}
                onChange={e => setEditGroupTools(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditGroupModal(false)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isEditingGroup}
                className="px-4 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg font-bold shadow-xs flex items-center gap-1"
              >
                <Save size={13} />
                <span>{isEditingGroup ? 'Menyimpan...' : 'Perbarui Kelompok'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reorganize Groups & Adjust Count Modal */}
      {showReorganizeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleReorganizeGroups}
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-base">
                <Shuffle size={20} className="text-amber-600" />
                <span>Atur Ulang / Rubah Jumlah Kelompok</span>
              </div>
              <button
                type="button"
                onClick={() => setShowReorganizeModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Fitur ini memungkinkan Dosen mengatur ulang jumlah kelompok secara otomatis (misalnya saat ganti semester atau penyesuaian mahasiswa baru). Seluruh mahasiswa aktif ({students.length} orang) akan didistribusikan merata ke kelompok baru dan disinkronkan ke jadwal presentasi 16 pertemuan RPS.
            </p>

            {reorganizeMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  reorganizeMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border border-rose-300'
                }`}
              >
                {reorganizeMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{reorganizeMsg.text}</span>
              </div>
            )}

            <div>
              <label className="block font-bold text-xs text-slate-700 mb-1.5">
                Jumlah Kelompok yang Diinginkan:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={2}
                  max={15}
                  value={targetGroupCount}
                  onChange={e => setTargetGroupCount(parseInt(e.target.value) || 2)}
                  className="w-24 px-3 py-2 text-base font-bold text-center rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
                <span className="text-xs text-slate-500">
                  (Rata-rata ~{Math.ceil(students.length / Math.max(1, targetGroupCount))} mahasiswa per kelompok)
                </span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-xs text-slate-700 mb-1.5">
                Metode Distribusi Mahasiswa:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReorganizeMode('even')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                    reorganizeMode === 'even'
                      ? 'border-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-400'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div>Urut Merata (Even)</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">Sesuai urutan NIM/Daftar</div>
                </button>

                <button
                  type="button"
                  onClick={() => setReorganizeMode('random')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                    reorganizeMode === 'random'
                      ? 'border-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-400'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div>Acak Otomatis (Shuffle)</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">Pemerataan acak sistem</div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReorganizeModal(false)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isReorganizing}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Shuffle size={14} />
                <span>{isReorganizing ? 'Membagi Ulang...' : 'Terapkan Pembagian Kelompok'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
