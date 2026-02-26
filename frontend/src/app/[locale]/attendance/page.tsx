'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { HelpTooltip } from '@/components/ui/help-tooltip'
import { useTranslations } from '@/hooks/use-translations'
import { useLocaleStore } from '@/store/locale-store'
import { useAuthStore } from '@/store/auth-store'
import apiClient from '@/lib/api-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Clock,
  Save,
  Send,
  CheckCircle,
  Lock,
  Edit3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface AttendanceRecord {
  id?: string
  employeeId: string
  date: string
  totalHours: number
  overtimeHours: number
  nightHours: number
  attendanceType: string
  notes?: string
}

interface EmployeeRow {
  id: string
  employeeNo: string
  firstName: string
  lastName: string
}

interface PeriodInfo {
  id: string
  period: string
  worksiteId: string | null
  status: string
}

const ATTENDANCE_TYPES = [
  { value: 'NORMAL', label: 'N', color: 'bg-green-100 text-green-800' },
  { value: 'OVERTIME', label: 'OT', color: 'bg-blue-100 text-blue-800' },
  { value: 'NIGHT_SHIFT', label: 'NS', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'HOLIDAY', label: 'H', color: 'bg-red-100 text-red-800' },
  { value: 'HALF_DAY', label: 'HD', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'ABSENT', label: 'A', color: 'bg-red-200 text-red-900' },
  { value: 'ON_LEAVE', label: 'L', color: 'bg-purple-100 text-purple-800' },
  { value: 'REST_DAY', label: 'R', color: 'bg-gray-100 text-gray-600' },
]

export default function AttendancePage() {
  const { t, locale } = useTranslations()
  const queryClient = useQueryClient()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [worksiteId, setWorksiteId] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [editedCells, setEditedCells] = useState<Record<string, AttendanceRecord>>({})
  const [editingCell, setEditingCell] = useState<string | null>(null)

  const period = `${year}-${String(month).padStart(2, '0')}`

  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Fetch worksites
  const { data: worksitesData } = useQuery({
    queryKey: ['worksites-list'],
    queryFn: async () => {
      const res = await apiClient.get('/worksites?limit=200&status=ACTIVE')
      return res.data
    },
  })

  // Fetch attendance period
  const { data: periodData } = useQuery({
    queryKey: ['attendance-period', period, worksiteId],
    queryFn: async () => {
      const params = new URLSearchParams({ period })
      if (worksiteId) params.set('worksiteId', worksiteId)
      const res = await apiClient.get(`/attendance/periods?${params}`)
      return res.data?.data?.[0] as PeriodInfo | undefined
    },
    enabled: !!worksiteId,
  })

  // Fetch employees at worksite
  const { data: employeesData } = useQuery({
    queryKey: ['attendance-employees', worksiteId],
    queryFn: async () => {
      const params = new URLSearchParams({ worksiteId, limit: '200', status: 'ACTIVE' })
      const res = await apiClient.get(`/employees?${params}`)
      return res.data
    },
    enabled: !!worksiteId,
  })

  // Fetch attendance records
  const { data: recordsData, isLoading: recordsLoading } = useQuery({
    queryKey: ['attendance-records', period, worksiteId],
    queryFn: async () => {
      const params = new URLSearchParams({
        period,
        limit: '10000',
      })
      if (worksiteId) params.set('worksiteId', worksiteId)
      const res = await apiClient.get(`/attendance?${params}`)
      return res.data
    },
    enabled: !!worksiteId,
  })

  // Build lookup: employeeId-date -> record
  const recordLookup = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {}
    const records = recordsData?.data || []
    records.forEach((r: any) => {
      const dateStr = r.date?.slice(0, 10)
      const day = dateStr ? parseInt(dateStr.split('-')[2]) : 0
      const key = `${r.employeeId}-${day}`
      map[key] = {
        id: r.id,
        employeeId: r.employeeId,
        date: dateStr,
        totalHours: parseFloat(r.totalHours) || 0,
        overtimeHours: parseFloat(r.overtimeHours) || 0,
        nightHours: parseFloat(r.nightHours) || 0,
        attendanceType: r.attendanceType || 'NORMAL',
        notes: r.notes,
      }
    })
    return map
  }, [recordsData])

  const saveMutation = useMutation({
    mutationFn: async (records: AttendanceRecord[]) => {
      await apiClient.post('/attendance', records)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-records', period, worksiteId] })
      setEditedCells({})
      setBulkMode(false)
    },
  })

  const submitMutation = useMutation({
    mutationFn: () =>
      apiClient.put('/attendance/periods', { id: periodData?.id, status: 'SUBMITTED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-period', period, worksiteId] })
    },
  })

  const approveMutation = useMutation({
    mutationFn: () =>
      apiClient.put('/attendance/periods', { id: periodData?.id, status: 'APPROVED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-period', period, worksiteId] })
    },
  })

  const employees: EmployeeRow[] = employeesData?.data || []
  const worksites = worksitesData?.data || []
  const periodStatus = periodData?.status || 'OPEN'
  const isLocked = periodStatus === 'APPROVED' || periodStatus === 'LOCKED'

  const getCell = (empId: string, day: number): AttendanceRecord => {
    const key = `${empId}-${day}`
    if (editedCells[key]) return editedCells[key]
    if (recordLookup[key]) return recordLookup[key]
    return {
      employeeId: empId,
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      totalHours: 0,
      overtimeHours: 0,
      nightHours: 0,
      attendanceType: 'REST_DAY',
    }
  }

  const updateCell = (empId: string, day: number, field: string, value: string | number) => {
    const key = `${empId}-${day}`
    const current = getCell(empId, day)
    setEditedCells((prev) => ({
      ...prev,
      [key]: { ...current, [field]: value },
    }))
  }

  const handleSave = () => {
    const records = Object.values(editedCells)
    if (records.length > 0) {
      saveMutation.mutate(records)
    }
  }

  const getTypeInfo = (type: string) =>
    ATTENDANCE_TYPES.find((t) => t.value === type) || ATTENDANCE_TYPES[0]

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  const getDayOfWeek = (day: number) => {
    const d = new Date(year, month - 1, day)
    return d.getDay()
  }

  const totalHoursForEmployee = (empId: string) => {
    let total = 0
    days.forEach((day) => {
      const cell = getCell(empId, day)
      total += cell.totalHours
    })
    return total
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('attendance.title')}</h1>
            <HelpTooltip helpKey="attendance" />
          </div>
          <div className="flex items-center gap-2">
            {!isLocked && Object.keys(editedCells).length > 0 && (
              <Button onClick={handleSave} loading={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {t('common.save')} ({Object.keys(editedCells).length})
              </Button>
            )}
            {!isLocked && (
              <Button
                variant={bulkMode ? 'default' : 'outline'}
                onClick={() => setBulkMode(!bulkMode)}
              >
                <Edit3 className="h-4 w-4 mr-1" />
                {t('attendance.bulkEntry')}
              </Button>
            )}
          </div>
        </div>

        {/* Selectors */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Period Selector */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="font-mono text-lg font-semibold min-w-[120px] text-center">
                  {period}
                </div>
                <Button variant="outline" size="icon" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Worksite Selector */}
              <div>
                <select
                  className="h-9 rounded-md border border-input bg-card px-3 text-sm min-w-[200px]"
                  value={worksiteId}
                  onChange={(e) => setWorksiteId(e.target.value)}
                >
                  <option value="">-- {t('employment.worksite')} --</option>
                  {worksites.map((ws: any) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.code} - {ws.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period Status */}
              {worksiteId && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      periodStatus === 'APPROVED'
                        ? 'success'
                        : periodStatus === 'SUBMITTED'
                        ? 'default'
                        : 'warning'
                    }
                  >
                    {periodStatus}
                  </Badge>
                </div>
              )}

              {/* Action Buttons */}
              <div className="ml-auto flex items-center gap-2">
                {periodStatus === 'OPEN' && worksiteId && (
                  <Button
                    variant="outline"
                    onClick={() => submitMutation.mutate()}
                    loading={submitMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {t('attendance.submit')}
                  </Button>
                )}
                {periodStatus === 'SUBMITTED' && worksiteId && (
                  <Button
                    variant="success"
                    onClick={() => approveMutation.mutate()}
                    loading={approveMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {t('common.approve')}
                  </Button>
                )}
                {isLocked && (
                  <Badge variant="secondary">
                    <Lock className="h-3 w-3 mr-1" />
                    Locked
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Legend */}
        <div className="flex flex-wrap gap-2">
          {ATTENDANCE_TYPES.map((type) => (
            <span key={type.value} className={`px-2 py-0.5 rounded text-xs font-medium ${type.color}`}>
              {type.label} = {type.value.replace('_', ' ')}
            </span>
          ))}
        </div>

        {/* Attendance Grid */}
        {worksiteId ? (
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              {recordsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : employees.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('common.noData')}</p>
              ) : (
                <table className="text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-card z-10 p-2 text-left font-medium border-b min-w-[180px]">
                        {t('employee.title')}
                      </th>
                      {days.map((day) => {
                        const dow = getDayOfWeek(day)
                        const isWeekend = dow === 0 || dow === 6
                        return (
                          <th
                            key={day}
                            className={`p-1 text-center font-medium border-b min-w-[36px] ${
                              isWeekend ? 'bg-red-50 dark:bg-red-950/20' : ''
                            }`}
                          >
                            {day}
                          </th>
                        )
                      })}
                      <th className="p-2 text-center font-medium border-b min-w-[60px]">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b hover:bg-muted/50">
                        <td className="sticky left-0 bg-card z-10 p-2 font-medium whitespace-nowrap">
                          <div>{emp.firstName} {emp.lastName}</div>
                          <div className="text-muted-foreground font-mono">{emp.employeeNo}</div>
                        </td>
                        {days.map((day) => {
                          const cell = getCell(emp.id, day)
                          const typeInfo = getTypeInfo(cell.attendanceType)
                          const cellKey = `${emp.id}-${day}`
                          const dow = getDayOfWeek(day)
                          const isWeekend = dow === 0 || dow === 6
                          const isEditing = editingCell === cellKey

                          if (bulkMode && !isLocked) {
                            return (
                              <td key={day} className={`p-0.5 ${isWeekend ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                                <select
                                  className="w-full h-7 text-[10px] border rounded bg-card px-0.5"
                                  value={cell.attendanceType}
                                  onChange={(e) => {
                                    const type = e.target.value
                                    const hours = type === 'NORMAL' ? 8 : type === 'HALF_DAY' ? 4 : type === 'REST_DAY' || type === 'ABSENT' || type === 'ON_LEAVE' ? 0 : 8
                                    updateCell(emp.id, day, 'attendanceType', type)
                                    updateCell(emp.id, day, 'totalHours', hours)
                                  }}
                                >
                                  {ATTENDANCE_TYPES.map((at) => (
                                    <option key={at.value} value={at.value}>
                                      {at.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            )
                          }

                          return (
                            <td
                              key={day}
                              className={`p-0.5 text-center cursor-pointer ${isWeekend ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                              onClick={() => {
                                if (!isLocked) setEditingCell(isEditing ? null : cellKey)
                              }}
                            >
                              {isEditing && !isLocked ? (
                                <input
                                  type="number"
                                  className="w-full h-6 text-[10px] text-center border rounded bg-card"
                                  value={cell.totalHours}
                                  onChange={(e) =>
                                    updateCell(emp.id, day, 'totalHours', parseFloat(e.target.value) || 0)
                                  }
                                  onBlur={() => setEditingCell(null)}
                                  autoFocus
                                  min="0"
                                  max="24"
                                  step="0.5"
                                />
                              ) : (
                                <span
                                  className={`inline-block w-7 h-6 leading-6 rounded text-[10px] font-medium ${typeInfo.color}`}
                                >
                                  {cell.totalHours > 0 ? cell.totalHours : typeInfo.label}
                                </span>
                              )}
                            </td>
                          )
                        })}
                        <td className="p-2 text-center font-bold">
                          {totalHoursForEmployee(emp.id)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <p className="text-center text-muted-foreground py-8">
                Select a worksite to view attendance
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
