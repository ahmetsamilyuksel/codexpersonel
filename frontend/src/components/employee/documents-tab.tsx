'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from '@/hooks/use-translations'
import { useLocaleStore, getLocalizedName } from '@/store/locale-store'
import apiClient from '@/lib/api-client'
import {
  FolderOpen, FolderClosed, Upload, FileText, Plus, X, Check, AlertTriangle,
  Download, Trash2, Eye, ChevronDown, ChevronRight, Clock, ShieldCheck,
  FileWarning, File, Image,
} from 'lucide-react'

interface DocumentsTabProps {
  employeeId: string
  workStatusType?: string
}

interface DocumentType {
  id: string
  code: string
  nameTr: string
  nameRu: string
  nameEn: string
  category: string
  hasExpiry: boolean
  defaultAlertDays: number
  sortOrder: number
}

interface DocumentFile {
  id: string
  fileName: string
  originalName: string
  mimeType: string
  size: number
  storagePath: string
  versionNo: number
  createdAt: string
}

interface EmployeeDocument {
  id: string
  documentTypeId: string
  documentNo: string | null
  documentName: string | null
  issuedBy: string | null
  issueDate: string | null
  expiryDate: string | null
  description: string | null
  isVerified: boolean
  versionNo: number
  createdAt: string
  documentType: DocumentType
  files: DocumentFile[]
}

const CATEGORY_ORDER = ['IDENTITY', 'IMMIGRATION', 'EMPLOYMENT', 'MEDICAL', 'SAFETY']

const CATEGORY_LABELS: Record<string, { tr: string; ru: string; en: string }> = {
  IDENTITY: { tr: 'Kimlik Belgeleri', ru: 'Удостоверения личности', en: 'Identity Documents' },
  IMMIGRATION: { tr: 'Göç Belgeleri', ru: 'Миграционные документы', en: 'Immigration Documents' },
  EMPLOYMENT: { tr: 'İstihdam Belgeleri', ru: 'Трудовые документы', en: 'Employment Documents' },
  MEDICAL: { tr: 'Sağlık Belgeleri', ru: 'Медицинские документы', en: 'Medical Documents' },
  SAFETY: { tr: 'Güvenlik Belgeleri', ru: 'Документы по ОТ', en: 'Safety Documents' },
}

function getDocumentStatus(doc: EmployeeDocument): { status: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' } {
  if (!doc.documentType.hasExpiry || !doc.expiryDate) {
    return doc.isVerified
      ? { status: 'VALID', variant: 'success' }
      : { status: 'UPLOADED', variant: 'secondary' }
  }

  const now = new Date()
  const expiry = new Date(doc.expiryDate)
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) return { status: 'EXPIRED', variant: 'destructive' }
  if (daysLeft <= doc.documentType.defaultAlertDays) return { status: 'EXPIRING_SOON', variant: 'warning' }
  return { status: 'VALID', variant: 'success' }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType === 'application/pdf') return FileText
  return File
}

export function DocumentsTab({ employeeId, workStatusType }: DocumentsTabProps) {
  const { t } = useTranslations()
  const { locale } = useLocaleStore()

  const [documents, setDocuments] = useState<EmployeeDocument[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER))
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())

  // Add document modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [newDocForm, setNewDocForm] = useState({
    documentNo: '', issuedBy: '', issueDate: '', expiryDate: '', description: '',
  })
  const [addSaving, setAddSaving] = useState(false)

  // Upload state
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [employeeId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [docsRes, typesRes] = await Promise.all([
        apiClient.get(`/employees/${employeeId}/documents`),
        apiClient.get('/document-types?limit=200'),
      ])
      setDocuments(docsRes.data?.data || [])
      setDocumentTypes(typesRes.data?.data || [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const toggleDoc = (docId: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId); else next.add(docId)
      return next
    })
  }

  // Group document types by category
  const typesByCategory = documentTypes.reduce<Record<string, DocumentType[]>>((acc, dt) => {
    const cat = dt.category || 'OTHER'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(dt)
    return acc
  }, {})

  // Map documents by type ID
  const docsByTypeId = documents.reduce<Record<string, EmployeeDocument[]>>((acc, doc) => {
    if (!acc[doc.documentTypeId]) acc[doc.documentTypeId] = []
    acc[doc.documentTypeId].push(doc)
    return acc
  }, {})

  const handleAddDocument = async () => {
    if (!selectedTypeId) return
    setAddSaving(true)
    try {
      await apiClient.post(`/employees/${employeeId}/documents`, {
        documentTypeId: selectedTypeId,
        documentNo: newDocForm.documentNo || null,
        issuedBy: newDocForm.issuedBy || null,
        issueDate: newDocForm.issueDate || null,
        expiryDate: newDocForm.expiryDate || null,
        description: newDocForm.description || null,
      })
      setShowAddModal(false)
      setSelectedTypeId('')
      setNewDocForm({ documentNo: '', issuedBy: '', issueDate: '', expiryDate: '', description: '' })
      await loadData()
    } catch { /* ignore */ } finally {
      setAddSaving(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadingDocId) return

    setUploadProgress(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await apiClient.post(`/documents/${uploadingDocId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await loadData()
    } catch { /* ignore */ } finally {
      setUploadProgress(false)
      setUploadingDocId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const triggerUpload = (docId: string) => {
    setUploadingDocId(docId)
    setTimeout(() => fileInputRef.current?.click(), 50)
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm(t('common.confirm') + '?')) return
    try {
      await apiClient.delete(`/documents/files/${fileId}`)
      await loadData()
    } catch { /* ignore */ }
  }

  // Count stats
  const totalDocs = documents.length
  const expiredDocs = documents.filter(d => getDocumentStatus(d).status === 'EXPIRED').length
  const expiringDocs = documents.filter(d => getDocumentStatus(d).status === 'EXPIRING_SOON').length

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.tiff"
        onChange={handleFileUpload}
      />

      {/* Header with stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span>{t('document.title')}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{totalDocs} {t('document.title').toLowerCase()}</Badge>
                {expiredDocs > 0 && (
                  <Badge variant="destructive">{expiredDocs} {t('document.expired')}</Badge>
                )}
                {expiringDocs > 0 && (
                  <Badge variant="warning">{expiringDocs} {t('document.expiringSoon')}</Badge>
                )}
              </div>
            </div>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-1" />{t('document.addNew')}
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Document folders by category */}
      {CATEGORY_ORDER.map(category => {
        const types = typesByCategory[category] || []
        if (types.length === 0) return null

        const categoryLabel = CATEGORY_LABELS[category]
          ? (locale === 'tr' ? CATEGORY_LABELS[category].tr : locale === 'ru' ? CATEGORY_LABELS[category].ru : CATEGORY_LABELS[category].en)
          : category

        const categoryDocCount = types.reduce((sum, dt) => sum + (docsByTypeId[dt.id]?.length || 0), 0)
        const isExpanded = expandedCategories.has(category)

        return (
          <Card key={category}>
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleCategory(category)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {isExpanded ? <FolderOpen className="h-5 w-5 text-amber-500" /> : <FolderClosed className="h-5 w-5 text-amber-500" />}
              <span className="font-semibold text-sm flex-1">{categoryLabel}</span>
              <Badge variant="secondary" className="text-xs">{categoryDocCount}</Badge>
            </div>

            {isExpanded && (
              <CardContent className="pt-0 pb-3">
                <div className="space-y-2">
                  {types.sort((a, b) => a.sortOrder - b.sortOrder).map(docType => {
                    const docs = docsByTypeId[docType.id] || []
                    const typeName = getLocalizedName(docType, locale)
                    const hasDocs = docs.length > 0

                    return (
                      <div key={docType.id} className="border rounded-lg overflow-hidden">
                        {/* Document type header */}
                        <div
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                            hasDocs ? 'hover:bg-muted/50' : 'hover:bg-muted/30'
                          }`}
                          onClick={() => hasDocs && toggleDoc(docType.id)}
                        >
                          {hasDocs ? (
                            expandedDocs.has(docType.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <div className="w-4" />
                          )}

                          <FileText className={`h-4 w-4 ${hasDocs ? 'text-blue-500' : 'text-muted-foreground/50'}`} />

                          <span className={`flex-1 text-sm ${hasDocs ? 'font-medium' : 'text-muted-foreground'}`}>
                            {typeName}
                          </span>

                          {docType.hasExpiry && (
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" title={t('document.expiryDate')} />
                          )}

                          {/* Status badges */}
                          {docs.map(doc => {
                            const { status, variant } = getDocumentStatus(doc)
                            const statusLabel = status === 'EXPIRED' ? t('document.expired')
                              : status === 'EXPIRING_SOON' ? t('document.expiringSoon')
                              : status === 'VALID' ? (doc.isVerified ? t('document.verified') : '✓')
                              : '-'
                            return (
                              <Badge key={doc.id} variant={variant} className="text-xs">
                                {statusLabel}
                                {doc.files.length > 0 && ` (${doc.files.length})`}
                              </Badge>
                            )
                          })}

                          {!hasDocs && (
                            <Badge variant="secondary" className="text-xs opacity-50">{t('document.missing')}</Badge>
                          )}

                          {/* Quick add/upload button */}
                          {!hasDocs && (
                            <Button
                              variant="ghost" size="sm" className="h-7 px-2"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedTypeId(docType.id)
                                setShowAddModal(true)
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        {/* Expanded document details */}
                        {hasDocs && expandedDocs.has(docType.id) && docs.map(doc => (
                          <div key={doc.id} className="border-t bg-muted/20 px-4 py-3">
                            {/* Document metadata */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                              {doc.documentNo && (
                                <div>
                                  <span className="text-muted-foreground text-xs">{t('document.documentNo')}</span>
                                  <p className="font-mono text-xs">{doc.documentNo}</p>
                                </div>
                              )}
                              {doc.issuedBy && (
                                <div>
                                  <span className="text-muted-foreground text-xs">{t('document.issuedBy')}</span>
                                  <p className="text-xs">{doc.issuedBy}</p>
                                </div>
                              )}
                              {doc.issueDate && (
                                <div>
                                  <span className="text-muted-foreground text-xs">{t('document.issueDate')}</span>
                                  <p className="text-xs">{doc.issueDate.slice(0, 10)}</p>
                                </div>
                              )}
                              {doc.expiryDate && (
                                <div>
                                  <span className="text-muted-foreground text-xs">{t('document.expiryDate')}</span>
                                  <p className="text-xs font-medium">
                                    {doc.expiryDate.slice(0, 10)}
                                    {(() => {
                                      const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                      if (days < 0) return <span className="text-destructive ml-1">({Math.abs(days)} {t('alert.daysLeft').replace('gün kaldı', 'gün geçti')})</span>
                                      if (days <= 30) return <span className="text-amber-500 ml-1">({days} {t('alert.daysLeft')})</span>
                                      return null
                                    })()}
                                  </p>
                                </div>
                              )}
                              {doc.isVerified && (
                                <div className="flex items-center gap-1 text-green-600">
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  <span className="text-xs">{t('document.verified')}</span>
                                </div>
                              )}
                            </div>

                            {doc.description && (
                              <p className="text-xs text-muted-foreground mb-3">{doc.description}</p>
                            )}

                            {/* Files section */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {locale === 'tr' ? 'Dosyalar' : locale === 'ru' ? 'Файлы' : 'Files'} ({doc.files.length})
                                </span>
                                <Button
                                  variant="outline" size="sm" className="h-7 text-xs"
                                  onClick={() => triggerUpload(doc.id)}
                                  disabled={uploadProgress}
                                >
                                  <Upload className="h-3 w-3 mr-1" />
                                  {uploadProgress && uploadingDocId === doc.id
                                    ? (locale === 'tr' ? 'Yükleniyor...' : locale === 'ru' ? 'Загрузка...' : 'Uploading...')
                                    : t('document.uploadFile')
                                  }
                                </Button>
                              </div>

                              {doc.files.length === 0 ? (
                                <div className="text-center py-4 border border-dashed rounded-md">
                                  <FileWarning className="h-8 w-8 mx-auto text-muted-foreground/30 mb-1" />
                                  <p className="text-xs text-muted-foreground">
                                    {locale === 'tr' ? 'Henüz dosya yüklenmemiş' : locale === 'ru' ? 'Файлы не загружены' : 'No files uploaded yet'}
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {doc.files.map(file => {
                                    const FileIcon = getFileIcon(file.mimeType)
                                    return (
                                      <div key={file.id} className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors group">
                                        <FileIcon className="h-4 w-4 text-blue-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium truncate">{file.originalName}</p>
                                          <p className="text-[10px] text-muted-foreground">
                                            {formatFileSize(file.size)} &middot; v{file.versionNo} &middot; {new Date(file.createdAt).toLocaleDateString()}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Button
                                            variant="ghost" size="sm" className="h-6 w-6 p-0"
                                            onClick={() => window.open(`/api/documents/files/${file.id}`, '_blank')}
                                            title={t('common.view')}
                                          >
                                            <Eye className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive"
                                            onClick={() => handleDeleteFile(file.id)}
                                            title={t('common.delete')}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Add Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
          <div className="bg-card rounded-lg shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t('document.addNew')}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Document type selection */}
              <div>
                <label className="text-sm font-medium">{t('document.documentType')} *</label>
                <select
                  className="mt-1 w-full h-9 rounded-md border border-input bg-card px-3 text-sm"
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                >
                  <option value="">-- {t('document.documentType')} --</option>
                  {CATEGORY_ORDER.map(cat => {
                    const types = typesByCategory[cat] || []
                    if (types.length === 0) return null
                    const catLabel = CATEGORY_LABELS[cat]
                      ? (locale === 'tr' ? CATEGORY_LABELS[cat].tr : locale === 'ru' ? CATEGORY_LABELS[cat].ru : CATEGORY_LABELS[cat].en)
                      : cat
                    return (
                      <optgroup key={cat} label={catLabel}>
                        {types.sort((a, b) => a.sortOrder - b.sortOrder).map(dt => (
                          <option key={dt.id} value={dt.id}>{getLocalizedName(dt, locale)}</option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              </div>

              {/* Document number */}
              <div>
                <label className="text-sm font-medium">{t('document.documentNo')}</label>
                <input
                  type="text" className="mt-1 w-full h-9 rounded-md border border-input bg-card px-3 text-sm"
                  value={newDocForm.documentNo} onChange={(e) => setNewDocForm(f => ({ ...f, documentNo: e.target.value }))}
                />
              </div>

              {/* Issued by */}
              <div>
                <label className="text-sm font-medium">{t('document.issuedBy')}</label>
                <input
                  type="text" className="mt-1 w-full h-9 rounded-md border border-input bg-card px-3 text-sm"
                  value={newDocForm.issuedBy} onChange={(e) => setNewDocForm(f => ({ ...f, issuedBy: e.target.value }))}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">{t('document.issueDate')}</label>
                  <input
                    type="date" className="mt-1 w-full h-9 rounded-md border border-input bg-card px-3 text-sm"
                    value={newDocForm.issueDate} onChange={(e) => setNewDocForm(f => ({ ...f, issueDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('document.expiryDate')}</label>
                  <input
                    type="date" className="mt-1 w-full h-9 rounded-md border border-input bg-card px-3 text-sm"
                    value={newDocForm.expiryDate} onChange={(e) => setNewDocForm(f => ({ ...f, expiryDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium">{t('common.description')}</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm min-h-[60px]"
                  value={newDocForm.description} onChange={(e) => setNewDocForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>{t('common.cancel')}</Button>
                <Button onClick={handleAddDocument} disabled={!selectedTypeId || addSaving}>
                  {addSaving ? (
                    <svg className="h-4 w-4 animate-spin mr-1" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
