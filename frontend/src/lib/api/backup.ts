import api from './client';

export const getBackupGroups = async () => (await api.get('/backup/groups')).data;
export const previewBackupFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return (await api.post('/backup/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
export const exportBackup = async (
    groups: string[],
    includeImages = true,
): Promise<{ blob: Blob; filename: string }> => {
    const res = await api.post('/backup/export', { groups, includeImages }, { responseType: 'blob' });
    // Nama file ditentukan server (sudah memuat slug nama toko). Baca dari Content-Disposition.
    const cd = (res.headers['content-disposition'] || res.headers['Content-Disposition'] || '') as string;
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    const filename = match?.[1]
        ? decodeURIComponent(match[1])
        : `backup-${new Date().toISOString().split('T')[0]}.zip`;
    return { blob: res.data, filename };
};
export const restoreBackup = async (file: File, mode: 'skip' | 'overwrite', tables?: string[]) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    if (tables && tables.length > 0) formData.append('tables', tables.join(','));
    return (await api.post('/backup/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};

// ── Rclone ────────────────────────────────────────────────────────────────────
export const getRcloneStatus = async () => (await api.get('/backup/rclone/status')).data;
export const saveRcloneSettings = async (data: {
    enabled: boolean;
    remote?: string;
    schedule?: string;
    keepCount?: number;
}) => (await api.post('/backup/rclone/settings', data)).data;
export const triggerRcloneBackup = async () => (await api.post('/backup/rclone/trigger')).data;
