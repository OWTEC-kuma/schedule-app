"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, CalendarDays, LogOut, PencilLine, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ScreenMode = 'list' | 'edit' | 'create' | 'vendors' | 'clients' | 'monthlyDeliveries' | 'clientDeliveries';

type Delivery = {
  id: string;
  date: string;
  note?: string;
  place: string;
};

type Milestone = {
  id: string;
  label: string;
  date: string;
  note?: string;
  vendor: string;
};

type ChildItem = {
  id: string;
  name: string;
  milestones: Milestone[];
};

type Project = {
  id: string;
  projectName: string;
  clientName: string;
  deliveries: Delivery[];
  children: ChildItem[];
  version: number;
  lockedBy?: string | null;
  lockExpiresAt?: string | null;
};

type VendorEntry = {
  id: string;
  name: string;
  address: string;
  phone: string;
};

type ClientEntry = {
  id: string;
  name: string;
  address: string;
  phone: string;
};

type VendorDialogState = {
  isOpen: boolean;
  mode: 'create' | 'edit';
  draft: VendorEntry;
  targetId: string | null;
  autoSelectAfterSave: {
    childId: string;
    milestoneId: string;
  } | null;
};

type ClientDialogState = {
  isOpen: boolean;
  mode: 'create' | 'edit';
  draft: ClientEntry;
  targetId: string | null;
  autoSelectAfterSave: boolean;
};

type ApiProjectRow = {
  id: string;
  project_name: string;
  client_name?: string | null;
  deliveries: Delivery[];
  children: ChildItem[];
  version: number;
  locked_by: string | null;
  lock_expires_at: string | null;
};

const DAY_COLUMN_WIDTH = 40;
const NAME_COLUMN_WIDTH = 200;
const HEADER_MONTH_HEIGHT = 28;
const HEADER_DAY_HEIGHT = 52;
const NEW_VENDOR_VALUE = '__new_vendor__';
const DELIVERY_STACK_OFFSET = 11;
const BASE_PROJECT_ROW_HEIGHT = 50;

const EDITOR_NAME_STORAGE_KEY = 'owtec-editor-name';

const initialVendors: VendorEntry[] = [
  { id: 'v1', name: 'A印刷', address: '', phone: '' },
  { id: 'v2', name: 'B加工', address: '', phone: '' },
  { id: 'v3', name: 'C商事', address: '', phone: '' },
  { id: 'v4', name: '台紙商会', address: '', phone: '' },
  { id: 'v5', name: '自社', address: '', phone: '' },
];

const initialClients: ClientEntry[] = [
  { id: 'c1', name: 'A商事', address: '', phone: '' },
  { id: 'c2', name: 'B食品', address: '', phone: '' },
  { id: 'c3', name: 'C流通', address: '', phone: '' },
];

function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function createLockToken() {
  return `lock-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeVendorName(value: string) {
  return value.trim();
}

function cloneVendors(list: VendorEntry[]) {
  return list.map((vendor) => ({ ...vendor }));
}

function sanitizeVendors(list: VendorEntry[]) {
  const result: VendorEntry[] = [];
  const usedNames = new Set<string>();
  list.forEach((vendor) => {
    const name = normalizeVendorName(vendor.name);
    if (!name || usedNames.has(name)) return;
    usedNames.add(name);
    result.push({
      id: vendor.id || uid('vendor'),
      name,
      address: vendor.address.trim(),
      phone: vendor.phone.trim(),
    });
  });
  return result;
}

function addVendorIfNeeded(list: VendorEntry[], rawName: string) {
  const name = normalizeVendorName(rawName);
  if (!name) return { vendors: list, added: '' };
  const existing = list.find((vendor) => normalizeVendorName(vendor.name) === name);
  if (existing) return { vendors: list, added: existing.name };
  return {
    vendors: [...list, { id: uid('vendor'), name, address: '', phone: '' }],
    added: name,
  };
}

function createDelivery(date = '', place = '', note = ''): Delivery {
  return { id: uid('delivery'), date, note, place };
}

function createMilestone(label = '', date = '', vendor = '', note = ''): Milestone {
  return { id: uid('ms'), label, date, note, vendor };
}

function createChild(): ChildItem {
  return {
    id: uid('child'),
    name: '',
    milestones: [createMilestone('', '', '')],
  };
}

function buildNewProject(): Project {
  return {
    id: uid('project'),
    projectName: '',
    clientName: '',
    deliveries: [createDelivery('', '')],
    children: [createChild()],
    version: 1,
    lockedBy: null,
    lockExpiresAt: null,
  };
}

function createEmptyVendorEntry(): VendorEntry {
  return { id: uid('vendor'), name: '', address: '', phone: '' };
}

function createEmptyClientEntry(): ClientEntry {
  return { id: uid('client'), name: '', address: '', phone: '' };
}

function cloneClients(list: ClientEntry[]) {
  return list.map((client) => ({ ...client }));
}

function sanitizeClients(list: ClientEntry[]) {
  const result: ClientEntry[] = [];
  const usedNames = new Set<string>();
  list.forEach((client) => {
    const name = normalizeVendorName(client.name);
    if (!name || usedNames.has(name)) return;
    usedNames.add(name);
    result.push({
      id: client.id || uid('client'),
      name,
      address: client.address.trim(),
      phone: client.phone.trim(),
    });
  });
  return result;
}

function addClientIfNeeded(list: ClientEntry[], rawName: string) {
  const name = normalizeVendorName(rawName);
  if (!name) return { clients: list, added: '' };
  const existing = list.find((client) => normalizeVendorName(client.name) === name);
  if (existing) return { clients: list, added: existing.name };
  return {
    clients: [...list, { id: uid('client'), name, address: '', phone: '' }],
    added: name,
  };
}

function formatMonthLabel(value: Date) {
  return `${value.getMonth() + 1}月`;
}

function formatDayOnly(value: Date) {
  return `${value.getDate()}`;
}

function formatWeekday(value: Date) {
  return ['日', '月', '火', '水', '木', '金', '土'][value.getDay()];
}

function formatTooltipDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isWeekend(value: Date) {
  return value.getDay() === 0 || value.getDay() === 6;
}

function nthMonday(year: number, monthIndex: number, nth: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const firstMondayOffset = (8 - firstDay.getDay()) % 7;
  return 1 + firstMondayOffset + (nth - 1) * 7;
}

function vernalEquinoxDay(year: number) {
  if (year <= 1979) return Math.floor(20.8357 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4));
  if (year <= 2099) return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return Math.floor(21.851 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnEquinoxDay(year: number) {
  if (year <= 1979) return Math.floor(23.2588 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4));
  if (year <= 2099) return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return Math.floor(24.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function getBaseJapaneseHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (month === 1 && day === 1) return '元日';
  if (month === 1 && year >= 2000 && day === nthMonday(year, 0, 2)) return '成人の日';
  if (month === 1 && year >= 1948 && year <= 1999 && day === 15) return '成人の日';
  if (month === 2 && day === 11 && year >= 1967) return '建国記念の日';
  if (month === 2 && day === 23 && year >= 2020) return '天皇誕生日';
  if (month === 3 && day === vernalEquinoxDay(year)) return '春分の日';
  if (month === 4 && day === 29) {
    if (year >= 2007) return '昭和の日';
    if (year >= 1989) return 'みどりの日';
    return '天皇誕生日';
  }
  if (month === 5 && day === 3) return '憲法記念日';
  if (month === 5 && day === 4 && year >= 2007) return 'みどりの日';
  if (month === 5 && day === 5) return 'こどもの日';
  if (month === 7) {
    if (year >= 2003 && day === nthMonday(year, 6, 3)) return '海の日';
    if (year >= 1996 && year <= 2002 && day === 20) return '海の日';
  }
  if (month === 8 && day === 11 && year >= 2016) return '山の日';
  if (month === 9) {
    if (year >= 2003 && day === nthMonday(year, 8, 3)) return '敬老の日';
    if (year >= 1966 && year <= 2002 && day === 15) return '敬老の日';
    if (day === autumnEquinoxDay(year)) return '秋分の日';
  }
  if (month === 10) {
    if (year >= 2020 && day === nthMonday(year, 9, 2)) return 'スポーツの日';
    if (year >= 2000 && year <= 2019 && day === nthMonday(year, 9, 2)) return '体育の日';
    if (year >= 1966 && year <= 1999 && day === 10) return '体育の日';
  }
  if (month === 11 && day === 3) return '文化の日';
  if (month === 11 && day === 23) return '勤労感謝の日';
  if (month === 12 && day === 23 && year >= 1989 && year <= 2018) return '天皇誕生日';
  return null;
}

function getJapaneseHolidayName(date: Date): string | null {
  const baseHoliday = getBaseJapaneseHolidayName(date);
  if (baseHoliday) return baseHoliday;
  const year = date.getFullYear();

  if (year >= 1988 && date.getDay() !== 0) {
    const prev = addDays(date, -1);
    const next = addDays(date, 1);
    if (getBaseJapaneseHolidayName(prev) && getBaseJapaneseHolidayName(next)) return '国民の休日';
  }

  if (year >= 1973) {
    if (year >= 2007) {
      let cursor = addDays(date, -1);
      while (getBaseJapaneseHolidayName(cursor)) {
        if (cursor.getDay() === 0) return '振替休日';
        cursor = addDays(cursor, -1);
      }
    } else {
      const prev = addDays(date, -1);
      if (prev.getDay() === 0 && getBaseJapaneseHolidayName(prev)) return '振替休日';
    }
  }

  return null;
}

function getCalendarColumnBackground(day: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(day);
  target.setHours(0, 0, 0, 0);
  if (today.getTime() === target.getTime()) return 'rgba(16, 185, 129, 0.12)';
  if (getJapaneseHolidayName(day)) return 'rgba(239, 68, 68, 0.07)';
  if (isWeekend(day)) return 'rgba(15, 23, 42, 0.035)';
  return 'transparent';
}

function getWeekdayTextClass(day: Date) {
  if (getJapaneseHolidayName(day)) return 'text-rose-500';
  return 'text-slate-400';
}

function getDayNumberTextClass(day: Date) {
  if (getJapaneseHolidayName(day)) return 'text-rose-600';
  return 'text-slate-600';
}

function getEarliestDeliveryTime(project: Project) {
  const validDates = project.deliveries.map((delivery) => delivery.date).filter(Boolean).map((value) => new Date(value).getTime());
  return validDates.length > 0 ? Math.min(...validDates) : Number.MAX_SAFE_INTEGER;
}

function sortProjects(projects: Project[]) {
  return [...projects].sort((a, b) => getEarliestDeliveryTime(a) - getEarliestDeliveryTime(b));
}

function buildTimelineDays(projects: Project[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allDates = projects
    .flatMap((project) => [
      ...project.deliveries.map((delivery) => delivery.date),
      ...project.children.flatMap((child) => child.milestones.map((milestone) => milestone.date)),
    ])
    .filter(Boolean);

  if (allDates.length === 0) {
    const base = addDays(today, -5);
    return Array.from({ length: 35 }, (_, index) => addDays(base, index));
  }

  const times = allDates.map((value) => new Date(value).getTime());
  const min = new Date(Math.min(...times));
  const max = new Date(Math.max(...times));
  min.setDate(min.getDate() - 3);
  max.setDate(max.getDate() + 3);

  const targetMin = addDays(today, -5);
  if (today < min) {
    min.setTime(targetMin.getTime());
  }
  if (today > max) {
    max.setTime(addDays(today, 3).getTime());
  }

  const days: Date[] = [];
  const cursor = new Date(min);
  while (cursor <= max) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function buildMonthSegments(timelineDays: Date[]) {
  const segments: Array<{ key: string; label: string; span: number }> = [];
  timelineDays.forEach((day) => {
    const key = `${day.getFullYear()}-${day.getMonth()}`;
    const last = segments[segments.length - 1];
    if (!last || last.key !== key) {
      segments.push({ key, label: formatMonthLabel(day), span: 1 });
    } else {
      last.span += 1;
    }
  });
  return segments;
}

function formatMonthOptionLabel(monthValue: string) {
  const [year, month] = monthValue.split('-');
  return `${year}年${Number(month)}月`;
}

function getAvailableDeliveryMonths(projects: Project[]) {
  return Array.from(
    new Set(
      projects
        .flatMap((project) => project.deliveries.map((delivery) => delivery.date))
        .filter(Boolean)
        .map((date) => date.slice(0, 7))
    )
  ).sort();
}

function getMonthlyDeliveryRows(projects: Project[], monthValue: string) {
  return projects
    .flatMap((project) =>
      project.deliveries
        .filter((delivery) => delivery.date.startsWith(monthValue))
        .map((delivery) => ({
          id: `${project.id}-${delivery.id}`,
          projectName: project.projectName || '名称未入力',
          deliveryDate: delivery.date,
        }))
    )
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
}

function getColumnIndex(value: string, timelineDays: Date[]) {
  if (!value) return -1;
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return timelineDays.findIndex((day) => {
    const current = new Date(day);
    current.setHours(0, 0, 0, 0);
    return current.getTime() === target.getTime();
  });
}

function getStackedDeliveries(deliveries: Delivery[]) {
  const counts = new Map<string, number>();
  return deliveries
    .filter((delivery) => delivery.date)
    .map((delivery) => {
      const stackIndex = counts.get(delivery.date) ?? 0;
      counts.set(delivery.date, stackIndex + 1);
      return {
        ...delivery,
        stackIndex,
      };
    });
}

function getMaxDeliveryStack(deliveries: Delivery[]) {
  const counts = new Map<string, number>();
  deliveries.filter((delivery) => delivery.date).forEach((delivery) => {
    counts.set(delivery.date, (counts.get(delivery.date) ?? 0) + 1);
  });
  return Math.max(1, ...counts.values());
}

function mapApiProject(row: ApiProjectRow): Project {
  return {
    id: row.id,
    projectName: row.project_name,
    clientName: String(row.client_name ?? ''),
    deliveries: Array.isArray(row.deliveries) ? row.deliveries : [],
    children: Array.isArray(row.children) ? row.children : [],
    version: typeof row.version === 'number' ? row.version : 1,
    lockedBy: row.locked_by,
    lockExpiresAt: row.lock_expires_at,
  };
}

function runSelfChecks() {
  console.assert(initialVendors.some((vendor) => vendor.name === 'A印刷'), 'initial vendors should contain sample');
  console.assert(addVendorIfNeeded(initialVendors, 'D製作').vendors.some((vendor) => vendor.name === 'D製作'), 'should add vendor');
  console.assert(addVendorIfNeeded(initialVendors, ' A印刷 ').vendors.length === initialVendors.length, 'should dedupe vendor');
  console.assert(formatWeekday(new Date(2026, 2, 22)) === '日', 'weekday should be Japanese');
  console.assert(isWeekend(new Date(2026, 2, 22)) === true, 'Sunday should be weekend');
  console.assert(getJapaneseHolidayName(new Date(2026, 0, 1)) === '元日', 'Jan 1 should be holiday');
  console.assert(getJapaneseHolidayName(new Date(2026, 1, 11)) === '建国記念の日', 'Feb 11 should be holiday');
  console.assert(getJapaneseHolidayName(new Date(2026, 4, 6)) === '振替休日', 'May 6 should be substitute holiday');
}

runSelfChecks();

async function fetchVendorsFromApi(): Promise<VendorEntry[]> {
  const response = await fetch('/api/vendors', { cache: 'no-store' });

  if (!response.ok) {
    throw new Error('Failed to load vendors');
  }

  const data = await response.json();

  return Array.isArray(data.vendors)
    ? data.vendors.map((row: any) => ({
        id: String(row.id ?? ''),
        name: String(row.name ?? ''),
        address: String(row.address ?? ''),
        phone: String(row.phone ?? ''),
      }))
    : [];
}

async function persistVendorsToApi(nextVendors: VendorEntry[]) {
  const response = await fetch('/api/vendors', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendors: nextVendors }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save vendors');
  }
}

async function fetchClientsFromApi(): Promise<ClientEntry[]> {
  const response = await fetch('/api/clients', { cache: 'no-store' });

  if (!response.ok) {
    throw new Error('Failed to load clients');
  }

  const data = await response.json();

  return Array.isArray(data.clients)
    ? data.clients.map((row: any) => ({
        id: String(row.id ?? ''),
        name: String(row.name ?? ''),
        address: String(row.address ?? ''),
        phone: String(row.phone ?? ''),
      }))
    : [];
}

async function persistClientsToApi(nextClients: ClientEntry[]) {
  const response = await fetch('/api/clients', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clients: nextClients }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save clients');
  }
}

function VendorEntryDialog({
  title,
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  title: string;
  draft: VendorEntry;
  onChange: (next: VendorEntry) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl" onKeyDown={(e) => { if (e.key === 'Enter' && e.target instanceof HTMLElement && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); onSave(); } }}>
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          </div>
          <div className="space-y-3 px-4 py-4">
            <div className="space-y-2">
              <Label>業者名</Label>
              <Input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} className="rounded-xl" placeholder="業者名" />
            </div>
            <div className="space-y-2">
              <Label>住所</Label>
              <Input value={draft.address} onChange={(e) => onChange({ ...draft, address: e.target.value })} className="rounded-xl" placeholder="住所（任意）" />
            </div>
            <div className="space-y-2">
              <Label>電話</Label>
              <Input value={draft.phone} onChange={(e) => onChange({ ...draft, phone: e.target.value })} className="rounded-xl" placeholder="電話番号（任意）" />
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="rounded-xl px-4 py-2 text-sm" onClick={onCancel}>キャンセル</Button>
            <Button type="button" className="rounded-xl px-4 py-2 text-sm" onClick={onSave}>保存</Button>
          </div>
      </div>
    </div>
  );
}

function ClientEntryDialog({
  title,
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  title: string;
  draft: ClientEntry;
  onChange: (next: ClientEntry) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl" onKeyDown={(e) => { if (e.key === 'Enter' && e.target instanceof HTMLElement && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); onSave(); } }}>
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          </div>
          <div className="space-y-3 px-4 py-4">
            <div className="space-y-2">
              <Label>クライアント名</Label>
              <Input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} className="rounded-xl" placeholder="クライアント名" />
            </div>
            <div className="space-y-2">
              <Label>住所</Label>
              <Input value={draft.address} onChange={(e) => onChange({ ...draft, address: e.target.value })} className="rounded-xl" placeholder="住所（任意）" />
            </div>
            <div className="space-y-2">
              <Label>電話</Label>
              <Input value={draft.phone} onChange={(e) => onChange({ ...draft, phone: e.target.value })} className="rounded-xl" placeholder="電話番号（任意）" />
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="rounded-xl px-4 py-2 text-sm" onClick={onCancel}>キャンセル</Button>
            <Button type="button" className="rounded-xl px-4 py-2 text-sm" onClick={onSave}>保存</Button>
          </div>
      </div>
    </div>
  );
}

function BackConfirmDialog({
  isOpen,
  onCancel,
  onDiscard,
  onSaveAndBack,
}: {
  isOpen: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSaveAndBack: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onKeyDown={(e) => { if (e.key === 'Enter' && e.target instanceof HTMLElement && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); onSaveAndBack(); } }}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-bold text-slate-900">トップへ戻る確認</h2>
        </div>
        <div className="px-4 py-4 text-sm text-slate-600">
          <p>変更があります。どうしますか？</p>
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={onCancel}>キャンセル</Button>
          <Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={onDiscard}>保存しないで戻る</Button>
          <Button type="button" className="rounded-xl px-3 py-2 text-sm" onClick={onSaveAndBack}>保存して戻る</Button>
        </div>
      </div>
    </div>
  );
}

function TimelineGrid({
  timelineWidth,
  height,
  timelineDays,
  children,
}: {
  timelineWidth: number;
  height: number;
  timelineDays: Date[];
  children?: React.ReactNode;
}) {
  return (
    <div className="relative" style={{ width: `${timelineWidth}px`, height: `${height}px` }}>
      <div className="absolute inset-0">
        {timelineDays.map((day, index) => {
          const backgroundColor = getCalendarColumnBackground(day);
          if (backgroundColor === 'transparent') return null;
          return <div key={`${day.toISOString()}-bg`} className="absolute top-0 h-full" style={{ left: `${index * DAY_COLUMN_WIDTH}px`, width: `${DAY_COLUMN_WIDTH}px`, backgroundColor }} />;
        })}
      </div>
      <div className="absolute inset-0" style={{ backgroundImage: `repeating-linear-gradient(to right, rgba(148,163,184,0.22) 0, rgba(148,163,184,0.22) 1px, transparent 1px, transparent ${DAY_COLUMN_WIDTH}px)` }} />
      {children}
    </div>
  );
}

function TimelineMarker({
  label,
  date,
  timelineDays,
  tooltip,
  emphasize = false,
  stackIndex = 0,
  stackOffset = 0,
}: {
  label: string;
  date: string;
  timelineDays: Date[];
  tooltip?: string;
  emphasize?: boolean;
  stackIndex?: number;
  stackOffset?: number;
}) {
  const index = getColumnIndex(date, timelineDays);
  if (index < 0) return null;
  return (
    <div className="absolute z-10 -translate-y-1/2" style={{ left: `calc(${index} * ${DAY_COLUMN_WIDTH}px + 5px)`, top: `calc(50% + ${stackIndex * stackOffset}px)` }} title={label || tooltip || ''}>
      <div
        className={emphasize ? 'rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700 shadow-sm' : 'rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700 shadow-sm'}
        style={{
          width: `${DAY_COLUMN_WIDTH}px`,
          boxSizing: 'border-box',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          wordBreak: 'break-all',
          whiteSpace: 'normal',
        }}
      >
        {label || '項目'}
      </div>
    </div>
  );
}

function ChildRow({ child, timelineDays, timelineWidth }: { child: ChildItem; timelineDays: Date[]; timelineWidth: number }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `${NAME_COLUMN_WIDTH}px ${timelineWidth + 8}px` }}>
      <div className="sticky left-0 z-20 flex min-h-[46px] items-center gap-1.5 border-r border-slate-100 bg-white px-3 pl-5 text-[13px] text-slate-700 shadow-[4px_0_6px_-6px_rgba(15,23,42,0.35)]">
        <span className="text-slate-400">∟</span>
        <span className="font-medium">{child.name || '名称未入力'}</span>
      </div>
      <div className="relative min-h-[46px] overflow-hidden px-2">
        <TimelineGrid timelineWidth={timelineWidth} height={46} timelineDays={timelineDays}>
          {child.milestones.map((milestone) => <TimelineMarker key={milestone.id} label={milestone.label} date={milestone.date} timelineDays={timelineDays} tooltip={milestone.vendor || '企業名未設定'} />)}
        </TimelineGrid>
      </div>
    </div>
  );
}

function ProjectRow({ project, timelineDays, timelineWidth, onOpen }: { project: Project; timelineDays: Date[]; timelineWidth: number; onOpen: () => void }) {
  const stackedDeliveries = useMemo(() => getStackedDeliveries(project.deliveries), [project.deliveries]);
  const maxDeliveryStack = useMemo(() => getMaxDeliveryStack(project.deliveries), [project.deliveries]);
  const projectRowHeight = BASE_PROJECT_ROW_HEIGHT + Math.max(0, maxDeliveryStack - 1) * DELIVERY_STACK_OFFSET;

  return (
    <div className="border-b border-slate-200 last:border-b-0" data-project-id={project.id}>
      <div className="grid" style={{ gridTemplateColumns: `${NAME_COLUMN_WIDTH}px ${timelineWidth + 8}px` }}>
        <button onClick={onOpen} className="sticky left-0 z-20 flex items-center border-r border-slate-200 bg-white px-3 text-left text-[14px] font-bold text-slate-900 transition hover:bg-slate-50 shadow-[4px_0_6px_-6px_rgba(15,23,42,0.35)]" style={{ minHeight: `${projectRowHeight}px` }}>
          {project.projectName || '名称未入力'}
        </button>
        <div className="relative overflow-hidden px-2" style={{ minHeight: `${projectRowHeight}px` }}>
          <TimelineGrid timelineWidth={timelineWidth} height={projectRowHeight} timelineDays={timelineDays}>
            {stackedDeliveries.map((delivery) => <TimelineMarker key={delivery.id} label="納品" date={delivery.date} timelineDays={timelineDays} tooltip={delivery.place || '納品場所未設定'} emphasize stackIndex={delivery.stackIndex} stackOffset={DELIVERY_STACK_OFFSET} />)}
          </TimelineGrid>
        </div>
      </div>
      {project.children.map((child) => <ChildRow key={child.id} child={child} timelineDays={timelineDays} timelineWidth={timelineWidth} />)}
    </div>
  );
}

function TopCalendarHeader({ timelineDays, timelineWidth }: { timelineDays: Date[]; timelineWidth: number }) {
  const monthSegments = useMemo(() => buildMonthSegments(timelineDays), [timelineDays]);
  return (
    <div className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="grid border-b border-slate-200 bg-white" style={{ gridTemplateColumns: `${NAME_COLUMN_WIDTH}px ${timelineWidth + 8}px` }}>
        <div className="sticky left-0 z-30 flex items-center border-r border-slate-200 bg-slate-100/95 px-3 text-xs font-bold text-slate-700" style={{ height: `${HEADER_MONTH_HEIGHT}px` }}>プロジェクト名</div>
        <div className="overflow-hidden bg-white px-2">
          <div className="flex items-center" style={{ width: `${timelineWidth}px`, height: `${HEADER_MONTH_HEIGHT}px` }}>
            {monthSegments.map((segment) => (
              <div key={segment.key} className="flex items-center border-r border-slate-200 bg-slate-100/70 px-2 text-[10px] font-bold text-slate-700" style={{ width: `${segment.span * DAY_COLUMN_WIDTH}px`, height: `${HEADER_MONTH_HEIGHT}px` }}>
                {segment.label}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid border-b border-slate-200 bg-white" style={{ gridTemplateColumns: `${NAME_COLUMN_WIDTH}px ${timelineWidth + 8}px` }}>
        <div className="sticky left-0 z-30 flex items-center border-r border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600" style={{ height: `${HEADER_DAY_HEIGHT}px` }}>日付</div>
        <div className="overflow-hidden bg-white px-2">
          <TimelineGrid timelineWidth={timelineWidth} height={HEADER_DAY_HEIGHT} timelineDays={timelineDays}>
            <div className="flex items-center" style={{ width: `${timelineWidth}px`, height: `${HEADER_DAY_HEIGHT}px` }}>
              {timelineDays.map((day, index) => {
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div key={`${day.toISOString()}-${index}`} className={`flex shrink-0 flex-col items-center justify-center text-center ${isToday ? 'bg-emerald-50' : ''}`} style={{ width: `${DAY_COLUMN_WIDTH}px`, height: `${HEADER_DAY_HEIGHT}px` }}>
                    <div className={`text-[10px] font-semibold leading-none ${getDayNumberTextClass(day)}`}>{formatDayOnly(day)}</div>
                    <div className={`mt-1 text-[9px] leading-none ${getWeekdayTextClass(day)}`}>{formatWeekday(day)}</div>
                  </div>
                );
              })}
            </div>
          </TimelineGrid>
        </div>
      </div>
    </div>
  );
}

function VendorManager({
  vendors,
  initialSnapshot,
  onChange,
  onBack,
  onSave,
}: {
  vendors: VendorEntry[];
  initialSnapshot: string;
  onChange: (next: VendorEntry[]) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const [dialog, setDialog] = useState<VendorDialogState>({
    isOpen: false,
    mode: 'create',
    draft: createEmptyVendorEntry(),
    targetId: null,
    autoSelectAfterSave: null,
  });
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);
  const isDirty = JSON.stringify(vendors) !== initialSnapshot;

  const closeDialog = () => {
    setDialog({ isOpen: false, mode: 'create', draft: createEmptyVendorEntry(), targetId: null, autoSelectAfterSave: null });
  };

  const saveDialog = () => {
    const name = normalizeVendorName(dialog.draft.name);
    if (!name) {
      window.alert('業者名を入力してください。');
      return;
    }
    if (dialog.mode === 'create') {
      onChange([...vendors, { ...dialog.draft, id: dialog.draft.id || uid('vendor'), name, address: dialog.draft.address.trim(), phone: dialog.draft.phone.trim() }]);
    } else {
      onChange(vendors.map((vendor) => vendor.id === dialog.targetId ? { ...vendor, name, address: dialog.draft.address.trim(), phone: dialog.draft.phone.trim() } : vendor));
    }
    closeDialog();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="min-h-screen bg-slate-50 p-3 md:p-4">
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => (isDirty ? setBackConfirmOpen(true) : onBack())} className="rounded-xl border-slate-200 px-3 py-2 text-sm"><ArrowLeft className="mr-2 h-4 w-4" />トップへ戻る</Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">業者リスト</h1>
              <p className="text-sm text-slate-500">追加・編集は1件ずつ開く画面で行います。</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setDialog({ isOpen: true, mode: 'create', draft: createEmptyVendorEntry(), targetId: null, autoSelectAfterSave: null })} className="rounded-xl border-slate-200 px-4 py-2 text-sm"><Plus className="mr-2 h-4 w-4" />業者を追加</Button>
            <Button type="submit" className="rounded-xl px-4 py-2 text-sm"><Save className="mr-2 h-4 w-4" />保存</Button>
          </div>
        </div>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="space-y-2.5 pt-6 pb-4 px-4">
            {vendors.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">登録されている業者はありません。</div>
            ) : vendors.map((vendor) => (
              <div key={vendor.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[220px_1fr_200px_auto_auto]">
                <div className="text-sm font-semibold text-slate-800">{vendor.name}</div>
                <div className="text-sm text-slate-500">{vendor.address || '住所未登録'}</div>
                <div className="text-sm text-slate-500">{vendor.phone || '電話未登録'}</div>
                <Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={() => setDialog({ isOpen: true, mode: 'edit', draft: { ...vendor }, targetId: vendor.id, autoSelectAfterSave: null })}>編集</Button>
                <Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={() => onChange(vendors.filter((item) => item.id !== vendor.id))}><Trash2 className="mr-2 h-4 w-4" />削除</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <BackConfirmDialog isOpen={backConfirmOpen} onCancel={() => setBackConfirmOpen(false)} onDiscard={() => { setBackConfirmOpen(false); onBack(); }} onSaveAndBack={() => { setBackConfirmOpen(false); onSave(); }} />
      {dialog.isOpen ? <VendorEntryDialog title={dialog.mode === 'create' ? '業者を追加' : '業者を編集'} draft={dialog.draft} onChange={(next) => setDialog((current) => ({ ...current, draft: next }))} onSave={saveDialog} onCancel={closeDialog} /> : null}
    </form>
  );
}

function ClientManager({
  clients,
  initialSnapshot,
  onChange,
  onBack,
  onSave,
}: {
  clients: ClientEntry[];
  initialSnapshot: string;
  onChange: (next: ClientEntry[]) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const [dialog, setDialog] = useState<ClientDialogState>({
    isOpen: false,
    mode: 'create',
    draft: createEmptyClientEntry(),
    targetId: null,
    autoSelectAfterSave: false,
  });
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);
  const isDirty = JSON.stringify(clients) !== initialSnapshot;

  const closeDialog = () => {
    setDialog({ isOpen: false, mode: 'create', draft: createEmptyClientEntry(), targetId: null, autoSelectAfterSave: false });
  };

  const saveDialog = () => {
    const name = normalizeVendorName(dialog.draft.name);
    if (!name) {
      window.alert('クライアント名を入力してください。');
      return;
    }
    if (dialog.mode === 'create') {
      onChange([...clients, { ...dialog.draft, id: dialog.draft.id || uid('client'), name, address: dialog.draft.address.trim(), phone: dialog.draft.phone.trim() }]);
    } else {
      onChange(clients.map((client) => client.id === dialog.targetId ? { ...client, name, address: dialog.draft.address.trim(), phone: dialog.draft.phone.trim() } : client));
    }
    closeDialog();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="min-h-screen bg-slate-50 p-3 md:p-4">
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => (isDirty ? setBackConfirmOpen(true) : onBack())} className="rounded-xl border-slate-200 px-3 py-2 text-sm"><ArrowLeft className="mr-2 h-4 w-4" />トップへ戻る</Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">クライアントリスト</h1>
              <p className="text-sm text-slate-500">追加・編集は1件ずつ開く画面で行います。</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setDialog({ isOpen: true, mode: 'create', draft: createEmptyClientEntry(), targetId: null, autoSelectAfterSave: false })} className="rounded-xl border-slate-200 px-4 py-2 text-sm"><Plus className="mr-2 h-4 w-4" />クライアントを追加</Button>
            <Button type="submit" className="rounded-xl px-4 py-2 text-sm"><Save className="mr-2 h-4 w-4" />保存</Button>
          </div>
        </div>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="space-y-2.5 pt-6 pb-4 px-4">
            {clients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">登録されているクライアントはありません。</div>
            ) : clients.map((client) => (
              <div key={client.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[220px_1fr_200px_auto_auto]">
                <div className="text-sm font-semibold text-slate-800">{client.name}</div>
                <div className="text-sm text-slate-500">{client.address || '住所未登録'}</div>
                <div className="text-sm text-slate-500">{client.phone || '電話未登録'}</div>
                <Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={() => setDialog({ isOpen: true, mode: 'edit', draft: { ...client }, targetId: client.id, autoSelectAfterSave: false })}>編集</Button>
                <Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={() => onChange(clients.filter((item) => item.id !== client.id))}><Trash2 className="mr-2 h-4 w-4" />削除</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <BackConfirmDialog isOpen={backConfirmOpen} onCancel={() => setBackConfirmOpen(false)} onDiscard={() => { setBackConfirmOpen(false); onBack(); }} onSaveAndBack={() => { setBackConfirmOpen(false); onSave(); }} />
      {dialog.isOpen ? <ClientEntryDialog title={dialog.mode === 'create' ? 'クライアントを追加' : 'クライアントを編集'} draft={dialog.draft} onChange={(next) => setDialog((current) => ({ ...current, draft: next }))} onSave={saveDialog} onCancel={closeDialog} /> : null}
    </form>
  );
}

function MonthlyDeliveryListPage({ projects, onBack }: { projects: Project[]; onBack: () => void }) {
  const availableMonths = useMemo(() => getAvailableDeliveryMonths(projects), [projects]);
  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] ?? '');
  const rows = useMemo(() => getMonthlyDeliveryRows(projects, selectedMonth), [projects, selectedMonth]);

  useEffect(() => {
    if (!selectedMonth && availableMonths[0]) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onBack} className="rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" />
              トップへ戻る
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">月別納品リスト</h1>
              <p className="text-sm text-slate-500">選んだ月に納品されたプロジェクトを表示します。</p>
            </div>
          </div>
        </div>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2 md:w-[260px]">
              <Label htmlFor="delivery-month">月を選択</Label>
              <select
                id="delivery-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                {availableMonths.length === 0 ? <option value="">納品月なし</option> : null}
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {formatMonthOptionLabel(month)}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            {selectedMonth === '' || rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                該当する納品データはありません。
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[160px_1fr] bg-slate-100 text-sm font-semibold text-slate-700">
                  <div className="border-r border-slate-200 px-4 py-3">納品日</div>
                  <div className="px-4 py-3">プロジェクト</div>
                </div>
                {rows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[160px_1fr] border-t border-slate-200 bg-white text-sm text-slate-700">
                    <div className="border-r border-slate-200 px-4 py-3">{row.deliveryDate}</div>
                    <div className="px-4 py-3">{row.projectName}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getProjectsByClient(projects: Project[]) {
  const groups = new Map<string, Project[]>();
  const order: string[] = [];

  projects.forEach((project) => {
    const clientName = project.clientName?.trim() || 'クライアント未設定';
    if (!groups.has(clientName)) {
      groups.set(clientName, []);
      order.push(clientName);
    }
    groups.get(clientName)!.push(project);
  });

  return order.map((clientName) => ({
    clientName,
    projects: groups.get(clientName) ?? [],
  }));
}

function ClientDeliveryListPage({
  projects,
  onBack,
  onOpen,
}: {
  projects: Project[];
  onBack: () => void;
  onOpen: (project: Project) => void;
}) {
  const groups = useMemo(() => getProjectsByClient(projects), [projects]);

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onBack} className="rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" />
              トップへ戻る
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">クライアント別リスト</h1>
              <p className="text-sm text-slate-500">クライアントごとにプロジェクトをまとめて表示します。</p>
            </div>
          </div>
        </div>

        {groups.length === 0 ? (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-4 text-sm text-slate-500">
              プロジェクトがありません。
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.clientName} className="rounded-2xl border-0 shadow-sm">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-sm text-slate-500">クライアント</div>
                    <div className="text-lg font-semibold text-slate-900">{group.clientName}</div>
                  </div>
                  <div className="text-sm text-slate-500">プロジェクト数: {group.projects.length}</div>
                </div>

                {group.projects.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">このクライアントに紐づくプロジェクトはありません。</div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="grid grid-cols-[1fr_auto] bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                      <div>プロジェクト</div>
                      <div>操作</div>
                    </div>
                    {group.projects.map((project) => (
                      <div key={project.id} className="grid grid-cols-[1fr_auto] border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        <div>{project.projectName || '名称未入力'}</div>
                        <div>
                          <Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={() => onOpen(project)}>
                            編集
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function ProjectEditor({
  mode,
  draft,
  vendors,
  clients,
  initialProjectSnapshot,
  initialVendorSnapshot,
  initialClientSnapshot,
  onChange,
  onVendorsChange,
  onClientsChange,
  onBack,
  onSave,
  onSaveAndBack,
  onDelete,
}: {
  mode: ScreenMode;
  draft: Project;
  vendors: VendorEntry[];
  clients: ClientEntry[];
  initialProjectSnapshot: string;
  initialVendorSnapshot: string;
  initialClientSnapshot: string;
  onChange: (next: Project) => void;
  onVendorsChange: (next: VendorEntry[]) => void;
  onClientsChange: (next: ClientEntry[]) => void;
  onBack: () => void;
  onSave: () => void;
  onSaveAndBack: () => void;
  onDelete: () => void;
}) {
  const [openVendorPickerId, setOpenVendorPickerId] = useState<string | null>(null);
  const [openClientPicker, setOpenClientPicker] = useState(false);
  const [vendorDialog, setVendorDialog] = useState<VendorDialogState>({
    isOpen: false,
    mode: 'create',
    draft: createEmptyVendorEntry(),
    targetId: null,
    autoSelectAfterSave: null,
  });
  const [clientDialog, setClientDialog] = useState<ClientDialogState>({
    isOpen: false,
    mode: 'create',
    draft: createEmptyClientEntry(),
    targetId: null,
    autoSelectAfterSave: false,
  });
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);
  const isDirty = JSON.stringify(draft) !== initialProjectSnapshot || JSON.stringify(vendors) !== initialVendorSnapshot || JSON.stringify(clients) !== initialClientSnapshot;
  const vendorOptions = sanitizeVendors(vendors);
  const clientOptions = sanitizeClients(clients);

  const updateChild = (childId: string, updater: (child: ChildItem) => ChildItem) => {
    onChange({ ...draft, children: draft.children.map((child) => (child.id === childId ? updater(child) : child)) });
  };

  const saveVendorDialog = () => {
    const name = normalizeVendorName(vendorDialog.draft.name);
    if (!name) {
      window.alert('業者名を入力してください。');
      return;
    }
    const result = addVendorIfNeeded(vendors, name);
    const mergedVendors = result.vendors.map((vendor) => vendor.name === result.added ? { ...vendor, address: vendorDialog.draft.address.trim(), phone: vendorDialog.draft.phone.trim() } : vendor);
    onVendorsChange(mergedVendors);
    if (vendorDialog.autoSelectAfterSave) {
      const target = vendorDialog.autoSelectAfterSave;
      updateChild(target.childId, (current) => ({ ...current, milestones: current.milestones.map((item) => item.id === target.milestoneId ? { ...item, vendor: result.added } : item) }));
    }
    setVendorDialog({ isOpen: false, mode: 'create', draft: createEmptyVendorEntry(), targetId: null, autoSelectAfterSave: null });
  };

  const saveClientDialog = () => {
    const name = normalizeVendorName(clientDialog.draft.name);
    if (!name) {
      window.alert('クライアント名を入力してください。');
      return;
    }
    const result = addClientIfNeeded(clients, name);
    const mergedClients = result.clients.map((client) =>
      client.name === result.added
        ? { ...client, address: clientDialog.draft.address.trim(), phone: clientDialog.draft.phone.trim() }
        : client
    );
    onClientsChange(mergedClients);
    if (clientDialog.autoSelectAfterSave && result.added) {
      onChange({ ...draft, clientName: result.added });
    }
    setClientDialog({ isOpen: false, mode: 'create', draft: createEmptyClientEntry(), targetId: null, autoSelectAfterSave: false });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="min-h-screen bg-slate-50 p-3 md:p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => (isDirty ? setBackConfirmOpen(true) : onBack())} className="rounded-xl px-3 py-2 text-sm"><ArrowLeft className="mr-2 h-4 w-4" />トップへ戻る</Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">OWTECスケジュール</h1>
              <p className="text-sm text-slate-500">{mode === 'create' ? 'プロジェクト追加' : 'プロジェクト編集'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'edit' ? (
              <Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" />このプロジェクトを削除</Button>
            ) : null}
            <Button type="submit" className="rounded-xl px-3 py-2 text-sm"><Save className="mr-2 h-4 w-4" />保存</Button>
          </div>
        </div>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg">プロジェクト名</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-[2fr_1.2fr]">
              <div className="space-y-2">
                <Label htmlFor="projectName">プロジェクト名</Label>
                <Input id="projectName" value={draft.projectName} onChange={(e) => onChange({ ...draft, projectName: e.target.value })} placeholder="例：春POP什器" className="rounded-xl" />
              </div>
              <div className="relative space-y-2">
                <Label>クライアント名</Label>
                <button type="button" onClick={() => setOpenClientPicker((current) => !current)} className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 outline-none hover:bg-slate-50">
                  <span className={draft.clientName ? 'text-slate-700' : 'text-slate-400'}>{draft.clientName || '選択してください'}</span>
                  <span className="text-slate-400">▾</span>
                </button>
                {openClientPicker ? (
                  <div className="absolute left-0 top-[72px] z-30 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <button type="button" onClick={() => { setOpenClientPicker(false); setClientDialog({ isOpen: true, mode: 'create', draft: createEmptyClientEntry(), targetId: null, autoSelectAfterSave: true }); }} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">新規クライアント</button>
                    <button type="button" onClick={() => { setOpenClientPicker(false); onChange({ ...draft, clientName: '' }); }} className="block w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">未決定</button>
                    {clientOptions.map((client) => (
                      <button key={client.id} type="button" onClick={() => { setOpenClientPicker(false); onChange({ ...draft, clientName: client.name }); }} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">{client.name}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-lg">納品</CardTitle>
              <Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={() => onChange({ ...draft, deliveries: [...draft.deliveries, createDelivery('', '')] })}><Plus className="mr-2 h-4 w-4" />納品行を追加</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {draft.deliveries.map((delivery) => (
              <div key={delivery.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[180px_1fr_1fr_auto]">
                <div className="space-y-2"><Label>納品日</Label><Input type="date" value={delivery.date} onChange={(e) => onChange({ ...draft, deliveries: draft.deliveries.map((item) => item.id === delivery.id ? { ...item, date: e.target.value } : item) })} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>補足</Label><Input value={delivery.note || ''} onChange={(e) => onChange({ ...draft, deliveries: draft.deliveries.map((item) => item.id === delivery.id ? { ...item, note: e.target.value } : item) })} placeholder="補足" className="rounded-xl" /></div>
                <div className="space-y-2"><Label>納品場所</Label><Input value={delivery.place} onChange={(e) => onChange({ ...draft, deliveries: draft.deliveries.map((item) => item.id === delivery.id ? { ...item, place: e.target.value } : item) })} placeholder="例：東京倉庫" className="rounded-xl" /></div>
                <div className="flex items-end"><Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={() => onChange({ ...draft, deliveries: draft.deliveries.length > 1 ? draft.deliveries.filter((item) => item.id !== delivery.id) : [createDelivery('', '')] })}><Trash2 className="mr-2 h-4 w-4" />削除</Button></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-lg">工程・部材など</CardTitle>
              <Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={() => onChange({ ...draft, children: [...draft.children, createChild()] })}><Plus className="mr-2 h-4 w-4" />工程・部材を追加</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {draft.children.map((child) => (
              <div key={child.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1"><Input value={child.name} onChange={(e) => updateChild(child.id, (current) => ({ ...current, name: e.target.value }))} className="w-full rounded-xl md:w-[260px]" placeholder="例：印刷 / 部材A" /></div>
                  <div className="flex flex-col gap-2">
                    <Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={() => onChange({ ...draft, children: draft.children.filter((item) => item.id !== child.id) })}><Trash2 className="mr-2 h-4 w-4" />この工程・部材を削除</Button>
                    <Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={() => updateChild(child.id, (current) => ({ ...current, milestones: [...current.milestones, createMilestone('', '', '')] }))}><Plus className="mr-2 h-4 w-4" />項目の追加</Button>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {child.milestones.map((milestone) => (
                    <div key={milestone.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 md:grid-cols-[160px_140px_1fr_1fr_auto]">
                      <div className="space-y-2"><Label>表示ラベル</Label><Input value={milestone.label} onChange={(e) => updateChild(child.id, (current) => ({ ...current, milestones: current.milestones.map((item) => item.id === milestone.id ? { ...item, label: e.target.value } : item) }))} className="rounded-xl" placeholder="例：印刷 / 引き取り / 入庫" /></div>
                      <div className="space-y-2"><Label>日付</Label><Input type="date" value={milestone.date} onChange={(e) => updateChild(child.id, (current) => ({ ...current, milestones: current.milestones.map((item) => item.id === milestone.id ? { ...item, date: e.target.value } : item) }))} className="rounded-xl" /></div>
                      <div className="space-y-2"><Label>補足</Label><Input value={milestone.note || ''} onChange={(e) => updateChild(child.id, (current) => ({ ...current, milestones: current.milestones.map((item) => item.id === milestone.id ? { ...item, note: e.target.value } : item) }))} className="rounded-xl" placeholder="補足" /></div>
                      <div className="relative space-y-2">
                        <Label>業者</Label>
                        <button type="button" onClick={() => setOpenVendorPickerId((current) => (current === milestone.id ? null : milestone.id))} className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 outline-none hover:bg-slate-50">
                          <span className={milestone.vendor ? 'text-slate-700' : 'text-slate-400'}>{milestone.vendor || '選択してください'}</span>
                          <span className="text-slate-400">▾</span>
                        </button>
                        {openVendorPickerId === milestone.id ? (
                          <div className="absolute left-0 top-[72px] z-30 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                            <button type="button" onClick={() => { setOpenVendorPickerId(null); setVendorDialog({ isOpen: true, mode: 'create', draft: createEmptyVendorEntry(), targetId: null, autoSelectAfterSave: { childId: child.id, milestoneId: milestone.id } }); }} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">新規業者</button>
                            <button type="button" onClick={() => { setOpenVendorPickerId(null); updateChild(child.id, (current) => ({ ...current, milestones: current.milestones.map((item) => item.id === milestone.id ? { ...item, vendor: '未決定' } : item) })); }} className="block w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">未決定</button>
                            {vendorOptions.map((vendor) => <button key={vendor.id} type="button" onClick={() => { setOpenVendorPickerId(null); updateChild(child.id, (current) => ({ ...current, milestones: current.milestones.map((item) => item.id === milestone.id ? { ...item, vendor: vendor.name } : item) })); }} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">{vendor.name}</button>)}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-end"><Button type="button" variant="outline" className="rounded-xl px-3 py-2 text-sm" onClick={() => updateChild(child.id, (current) => ({ ...current, milestones: current.milestones.filter((item) => item.id !== milestone.id) }))}><Trash2 className="mr-2 h-4 w-4" />削除</Button></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg">補足メモ</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-500"><div className="rounded-xl border border-dashed border-slate-300 p-4">ここは今後、会社名や発注先、注意事項などの入力欄を追加できる予備エリアです。</div></CardContent>
        </Card>
      </div>
     <BackConfirmDialog
  isOpen={backConfirmOpen}
  onCancel={() => setBackConfirmOpen(false)}
  onDiscard={() => {
    setBackConfirmOpen(false);
    onBack();
  }}
  onSaveAndBack={() => {
    setBackConfirmOpen(false);
    void onSaveAndBack();
  }}
/>

{vendorDialog.isOpen ? (
  <VendorEntryDialog
    title="業者を追加"
    draft={vendorDialog.draft}
    onChange={(next) =>
      setVendorDialog((current) => ({ ...current, draft: next }))
    }
    onSave={() => void saveVendorDialog()}
    onCancel={() =>
      setVendorDialog({
        isOpen: false,
        mode: 'create',
        draft: createEmptyVendorEntry(),
        targetId: null,
        autoSelectAfterSave: null,
      })
    }
  />
) : null}
      {clientDialog.isOpen ? (
        <ClientEntryDialog
          title="クライアントを追加"
          draft={clientDialog.draft}
          onChange={(next) => setClientDialog((current) => ({ ...current, draft: next }))}
          onSave={() => void saveClientDialog()}
          onCancel={() =>
            setClientDialog({
              isOpen: false,
              mode: 'create',
              draft: createEmptyClientEntry(),
              targetId: null,
              autoSelectAfterSave: false,
            })
          }
        />
      ) : null}
    </form>
  );
}

export default function OwtecScheduleTopPreview() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [vendors, setVendors] = useState<VendorEntry[]>(initialVendors);
  const [vendorDraft, setVendorDraft] = useState<VendorEntry[]>(cloneVendors(initialVendors));
  const [clients, setClients] = useState<ClientEntry[]>(initialClients);
  const [clientDraft, setClientDraft] = useState<ClientEntry[]>(cloneClients(initialClients));
  const [screenMode, setScreenMode] = useState<ScreenMode>('list');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Project>(buildNewProject());
  const [projectInitialSnapshot, setProjectInitialSnapshot] = useState<string>(JSON.stringify(buildNewProject()));
  const [vendorInitialSnapshot, setVendorInitialSnapshot] = useState<string>(JSON.stringify(initialVendors));
  const [clientInitialSnapshot, setClientInitialSnapshot] = useState<string>(JSON.stringify(initialClients));
  const [lockToken, setLockToken] = useState<string | null>(null);
  const [editorName, setEditorName] = useState('');
  const [loading, setLoading] = useState(true);

  const sortedProjects = useMemo(() => sortProjects(projects), [projects]);
  const timelineDays = useMemo(() => buildTimelineDays(sortedProjects), [sortedProjects]);

  const handleLogout = useCallback(async () => {
    setLogoutLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      router.push('/login');
    }
  }, [router]);
  const timelineWidth = useMemo(() => timelineDays.length * DAY_COLUMN_WIDTH, [timelineDays]);
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (screenMode !== 'list' || !calendarScrollRef.current) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let targetIndex = timelineDays.findIndex(
      (day) => day.getFullYear() === today.getFullYear() && day.getMonth() === today.getMonth() && day.getDate() === today.getDate()
    );
    if (targetIndex === -1) {
      targetIndex = timelineDays.findIndex((day) => day >= today);
      if (targetIndex === -1) {
        targetIndex = timelineDays.length - 1;
      }
    }

    const leftIndex = Math.max(0, targetIndex - 5);
    calendarScrollRef.current.scrollLeft = NAME_COLUMN_WIDTH + leftIndex * DAY_COLUMN_WIDTH;

    const nextProject = sortedProjects.find((project) => getEarliestDeliveryTime(project) >= today.getTime());
    if (nextProject) {
      window.requestAnimationFrame(() => {
        if (!calendarScrollRef.current) return;
        const rowEl = calendarScrollRef.current.querySelector(`[data-project-id="${nextProject.id}"]`) as HTMLElement | null;
        if (!rowEl) return;
        const headerHeight = HEADER_MONTH_HEIGHT + HEADER_DAY_HEIGHT + 8;
        const extraOffset = 32;
        const containerRect = calendarScrollRef.current.getBoundingClientRect();
        const rowRect = rowEl.getBoundingClientRect();
        const targetScrollTop = calendarScrollRef.current.scrollTop + (rowRect.top - containerRect.top) - headerHeight - extraOffset;
        calendarScrollRef.current.scrollTop = Math.max(0, targetScrollTop);
      });
    }
  }, [screenMode, sortedProjects, timelineDays]);

  useEffect(() => {
  let mounted = true;

  async function boot() {
    try {
      const [projectsResponse, vendorsResponse, clientsResponse] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }),
        fetch('/api/vendors', { cache: 'no-store' }),
        fetch('/api/clients', { cache: 'no-store' }),
      ]);

      if (!projectsResponse.ok) {
        throw new Error('Failed to load projects');
      }
      if (!vendorsResponse.ok) {
        throw new Error('Failed to load vendors');
      }
      if (!clientsResponse.ok) {
        throw new Error('Failed to load clients');
      }

      const projectsData = await projectsResponse.json();
      const vendorsData = await vendorsResponse.json();
      const clientsData = await clientsResponse.json();

      if (!mounted) return;

      const nextProjects: Project[] = Array.isArray(projectsData.projects)
        ? projectsData.projects.map((row: any) => ({
            id: String(row.id ?? ''),
            projectName: String(row.project_name ?? ''),
            deliveries: Array.isArray(row.deliveries) ? row.deliveries : [],
            children: Array.isArray(row.children) ? row.children : [],
          }))
        : [];

      const nextVendors: VendorEntry[] = Array.isArray(vendorsData.vendors)
        ? vendorsData.vendors.map((row: any) => ({
            id: String(row.id ?? ''),
            name: String(row.name ?? ''),
            address: String(row.address ?? ''),
            phone: String(row.phone ?? ''),
          }))
        : [];

      const nextClients: ClientEntry[] = Array.isArray(clientsData.clients)
        ? clientsData.clients.map((row: any) => ({
            id: String(row.id ?? ''),
            name: String(row.name ?? ''),
            address: String(row.address ?? ''),
            phone: String(row.phone ?? ''),
          }))
        : [];

      setProjects(nextProjects);
      setVendors(nextVendors);
      setVendorDraft(cloneVendors(nextVendors));
      setClients(nextClients);
      setClientDraft(cloneClients(nextClients));

      if (nextProjects.length > 0) {
        setSelectedProjectId(nextProjects[0].id);
        setDraft(deepClone(nextProjects[0]));
        setProjectInitialSnapshot(JSON.stringify(nextProjects[0]));
      }

      setVendorInitialSnapshot(JSON.stringify(nextVendors));
      setClientInitialSnapshot(JSON.stringify(nextClients));
    } catch (error) {
      console.error(error);
    } finally {
      if (mounted) {
        setIsBootLoading(false);
      }
    }
  }

  boot();

  return () => {
    mounted = false;
  };
}, []);

  const loadProjects = useCallback(async () => {
    const response = await fetch('/api/projects', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('プロジェクト一覧の読み込みに失敗しました。');
    }
    const data = await response.json();
    const nextProjects = Array.isArray(data.projects) ? data.projects.map((row: ApiProjectRow) => mapApiProject(row)) : [];
    setProjects(sortProjects(nextProjects));
  }, []);

  useEffect(() => {
    const savedEditorName = window.localStorage.getItem(EDITOR_NAME_STORAGE_KEY);
    if (savedEditorName) {
      setEditorName(savedEditorName);
    }

    const run = async () => {
      try {
        await loadProjects();
      } catch (error) {
        console.error(error);
        window.alert('プロジェクト一覧の読み込みに失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [loadProjects]);

  useEffect(() => {
    if (screenMode !== 'edit' || !selectedProjectId || !lockToken) return;

    const timer = window.setInterval(async () => {
      try {
        await fetch(`/api/projects/${selectedProjectId}/lock/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lockToken }),
        });
      } catch (error) {
        console.error(error);
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [screenMode, selectedProjectId, lockToken]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!selectedProjectId || !lockToken) return;
      navigator.sendBeacon(
        `/api/projects/${selectedProjectId}/lock/release`,
        new Blob([JSON.stringify({ lockToken })], { type: 'application/json' })
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedProjectId, lockToken]);

  const ensureEditorName = useCallback(() => {
    const current = editorName || window.localStorage.getItem(EDITOR_NAME_STORAGE_KEY) || '';
    if (current) {
      if (!editorName) setEditorName(current);
      return current;
    }
    const entered = window.prompt('編集者名を入力してください。', '')?.trim() ?? '';
    if (!entered) {
      window.alert('編集者名が必要です。');
      return '';
    }
    window.localStorage.setItem(EDITOR_NAME_STORAGE_KEY, entered);
    setEditorName(entered);
    return entered;
  }, [editorName]);

  const acquireLock = useCallback(async (projectId: string, editor: string, nextLockToken: string) => {
    const response = await fetch(`/api/projects/${projectId}/lock/acquire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editorName: editor, lockToken: nextLockToken }),
    });

    if (response.ok) {
      return { ok: true as const };
    }

    const data = await response.json().catch(() => null);
    const lockedBy = data?.lock?.locked_by ?? '他のユーザー';
    const expiresAt = data?.lock?.lock_expires_at ? new Date(data.lock.lock_expires_at).toLocaleString() : '';
    window.alert(`このプロジェクトは現在 ${lockedBy} が編集中です。${expiresAt ? `\n解除予定: ${expiresAt}` : ''}`);
    return { ok: false as const };
  }, []);

  const releaseCurrentLock = useCallback(async () => {
    if (!selectedProjectId || !lockToken) return;
    try {
      await fetch(`/api/projects/${selectedProjectId}/lock/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockToken }),
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLockToken(null);
    }
  }, [selectedProjectId, lockToken]);

  const openEdit = useCallback(async (project: Project) => {
    const editor = ensureEditorName();
    if (!editor) return;

    const nextLockToken = createLockToken();
    const acquired = await acquireLock(project.id, editor, nextLockToken);
    if (!acquired.ok) return;

    try {
      const response = await fetch(`/api/projects/${project.id}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('プロジェクト取得失敗');
      }
      const data = await response.json();
      const nextDraft = mapApiProject(data.project as ApiProjectRow);
      const nextVendorDraft = cloneVendors(vendors);
      const nextClientDraft = cloneClients(clients);

      setSelectedProjectId(project.id);
      setDraft(nextDraft);
      setVendorDraft(nextVendorDraft);
      setClientDraft(nextClientDraft);
      setProjectInitialSnapshot(JSON.stringify(nextDraft));
      setVendorInitialSnapshot(JSON.stringify(nextVendorDraft));
      setClientInitialSnapshot(JSON.stringify(nextClientDraft));
      setLockToken(nextLockToken);
      setScreenMode('edit');
    } catch (error) {
      console.error(error);
      await fetch(`/api/projects/${project.id}/lock/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockToken: nextLockToken }),
      }).catch(() => {});
      window.alert('プロジェクトの読み込みに失敗しました。');
    }
  }, [acquireLock, ensureEditorName, vendors]);

  const openCreate = useCallback(() => {
    const nextDraft = buildNewProject();
    const nextVendorDraft = cloneVendors(vendors);
    const nextClientDraft = cloneClients(clients);
    setSelectedProjectId(null);
    setDraft(nextDraft);
    setVendorDraft(nextVendorDraft);
    setClientDraft(nextClientDraft);
    setProjectInitialSnapshot(JSON.stringify(nextDraft));
    setVendorInitialSnapshot(JSON.stringify(nextVendorDraft));
    setClientInitialSnapshot(JSON.stringify(nextClientDraft));
    setLockToken(null);
    setScreenMode('create');
  }, [vendors, clients]);

  const openVendorManager = useCallback(() => {
    const nextVendorDraft = cloneVendors(vendors);
    setVendorDraft(nextVendorDraft);
    setVendorInitialSnapshot(JSON.stringify(nextVendorDraft));
    setScreenMode('vendors');
  }, [vendors]);

  const openClientManager = useCallback(() => {
    const nextClientDraft = cloneClients(clients);
    setClientDraft(nextClientDraft);
    setClientInitialSnapshot(JSON.stringify(nextClientDraft));
    setScreenMode('clients');
  }, [clients]);

  const discardVendorDraftAndReturn = useCallback(() => {
    const restored = JSON.parse(vendorInitialSnapshot) as VendorEntry[];
    setVendorDraft(cloneVendors(restored));
    setScreenMode('list');
  }, [vendorInitialSnapshot]);

  const discardClientDraftAndReturn = useCallback(() => {
    const restored = JSON.parse(clientInitialSnapshot) as ClientEntry[];
    setClientDraft(cloneClients(restored));
    setScreenMode('list');
  }, [clientInitialSnapshot]);

  const saveVendorDraft = async (returnToList = true) => {
    const nextVendors = sanitizeVendors(vendorDraft);
    await persistVendorsToApi(nextVendors);
    setVendors(nextVendors);
    setVendorDraft(cloneVendors(nextVendors));
    setVendorInitialSnapshot(JSON.stringify(nextVendors));
    if (returnToList) setScreenMode('list');
  };

  const saveClientDraft = async (returnToList = true) => {
    const nextClients = sanitizeClients(clientDraft);
    await persistClientsToApi(nextClients);
    setClients(nextClients);
    setClientDraft(cloneClients(nextClients));
    setClientInitialSnapshot(JSON.stringify(nextClients));
    if (returnToList) setScreenMode('list');
  };

  const saveDraft = async (returnToList = false) => {
    const nextVendors = sanitizeVendors(vendorDraft);
    await persistVendorsToApi(nextVendors);
    setVendors(nextVendors);
    setVendorDraft(cloneVendors(nextVendors));
    setVendorInitialSnapshot(JSON.stringify(nextVendors));
    const nextClients = sanitizeClients(clientDraft);
    await persistClientsToApi(nextClients);
    setClients(nextClients);
    setClientDraft(cloneClients(nextClients));
    setClientInitialSnapshot(JSON.stringify(nextClients));

    if (screenMode === 'create') {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draft.id,
          projectName: draft.projectName || '名称未入力',
          clientName: draft.clientName || '',
          deliveries: draft.deliveries,
          children: draft.children,
        }),
      });

      if (!response.ok) {
        window.alert('新規プロジェクトの保存に失敗しました。');
        return;
      }

      const data = await response.json();
      const created = mapApiProject(data.project as ApiProjectRow);
      await loadProjects();

      if (returnToList) {
        setSelectedProjectId(created.id);
        setProjectInitialSnapshot(JSON.stringify(created));
        setScreenMode('list');
        return;
      }

      const editor = ensureEditorName();
      if (!editor) return;

      const nextLockToken = createLockToken();
      const acquired = await acquireLock(created.id, editor, nextLockToken);
      if (!acquired.ok) {
        setScreenMode('list');
        return;
      }

      setSelectedProjectId(created.id);
      setDraft(created);
      setProjectInitialSnapshot(JSON.stringify(created));
      setLockToken(nextLockToken);
      setScreenMode('edit');
      return;
    }

    if (!selectedProjectId || !lockToken) {
      window.alert('ロック情報がありません。再度開き直してください。');
      return;
    }

    const response = await fetch(`/api/projects/${selectedProjectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: draft.projectName || '名称未入力',
        clientName: draft.clientName || '',
        deliveries: draft.deliveries,
        children: draft.children,
        version: draft.version,
        lockToken,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      window.alert(data?.error || '保存に失敗しました。');
      return;
    }

    const data = await response.json();
    const saved = mapApiProject(data.project as ApiProjectRow);
    setDraft(saved);
    setProjectInitialSnapshot(JSON.stringify(saved));
    await loadProjects();

    if (returnToList) {
      await releaseCurrentLock();
      setScreenMode('list');
    }
  };

  const deleteProject = useCallback(async () => {
    if (!selectedProjectId || !lockToken) return;
    const shouldDelete = window.confirm('このプロジェクトを削除しますか？');
    if (!shouldDelete) return;

    const response = await fetch(`/api/projects/${selectedProjectId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lockToken }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      window.alert(data?.error || '削除に失敗しました。');
      return;
    }

    setLockToken(null);
    setSelectedProjectId(null);
    await loadProjects();
    setScreenMode('list');
  }, [loadProjects, lockToken, selectedProjectId]);

  const backFromEditor = useCallback(async () => {
    await releaseCurrentLock();
    setScreenMode('list');
  }, [releaseCurrentLock]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          読み込み中...
        </div>
      </div>
    );
  }
if (isBootLoading) {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        データを読み込み中です...
      </div>
    </div>
  );
}


  if (screenMode === 'clients') {
    return (
      <ClientManager
        clients={clientDraft}
        initialSnapshot={clientInitialSnapshot}
        onChange={setClientDraft}
        onBack={discardClientDraftAndReturn}
        onSave={() => void saveClientDraft(true)}
      />
    );
  }

  if (screenMode === 'vendors') {
    return (
      <VendorManager
        vendors={vendorDraft}
        initialSnapshot={vendorInitialSnapshot}
        onChange={setVendorDraft}
        onBack={discardVendorDraftAndReturn}
        onSave={() => void saveVendorDraft(true)}
      />
    );
  }

  if (screenMode === 'monthlyDeliveries') {
    return (
      <MonthlyDeliveryListPage
        projects={sortedProjects}
        onBack={() => setScreenMode('list')}
      />
    );
  }

  if (screenMode === 'clientDeliveries') {
    return (
      <ClientDeliveryListPage
        projects={sortedProjects}
        onBack={() => setScreenMode('list')}
        onOpen={(project) => void openEdit(project)}
      />
    );
  }

  if (screenMode === 'edit' || screenMode === 'create') {
    return (
      <ProjectEditor
        mode={screenMode}
        draft={draft}
        vendors={vendorDraft}
        clients={clientDraft}
        initialProjectSnapshot={projectInitialSnapshot}
        initialVendorSnapshot={vendorInitialSnapshot}
        initialClientSnapshot={clientInitialSnapshot}
        onChange={setDraft}
        onVendorsChange={setVendorDraft}
        onClientsChange={setClientDraft}
        onBack={backFromEditor}
        onSave={() => void saveDraft(false)}
        onSaveAndBack={() => void saveDraft(true)}
        onDelete={() => void deleteProject()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-4">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">OWTECスケジュール</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              親は納品、子は工程や部材。横カレンダー上には日付ではなくラベルを表示します。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm md:flex">
              <CalendarDays className="h-4 w-4" />
              親の最も早い納品日が若い順で自動並び替え
            </div>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value === 'monthlyDeliveries') {
                  setScreenMode('monthlyDeliveries');
                }
                if (e.target.value === 'clientDeliveries') {
                  setScreenMode('clientDeliveries');
                }
                e.target.value = '';
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="">表示メニュー</option>
              <option value="monthlyDeliveries">月別納品リスト</option>
              <option value="clientDeliveries">クライアント別リスト</option>
            </select>
            <Button type="button" variant="outline" className="rounded-xl px-4" onClick={openClientManager}>
              <Building2 className="mr-2 h-4 w-4" />
              クライアントリスト
            </Button>
            <Button type="button" variant="outline" className="rounded-xl px-4" onClick={openVendorManager}>
              <Building2 className="mr-2 h-4 w-4" />
              業者リスト
            </Button>
            <Button type="button" variant="outline" className="rounded-xl px-4" onClick={handleLogout} disabled={logoutLoading}>
              <LogOut className="mr-2 h-4 w-4" />
              ログアウト
            </Button>
            <Button onClick={openCreate} className="rounded-xl px-4">
              <Plus className="mr-2 h-4 w-4" />
              プロジェクト追加
            </Button>
          </div>
        </motion.div>

        <Card className="rounded-[20px] border-0 shadow-sm">
          <CardContent className="p-0">
            <div
              ref={calendarScrollRef}
              className="h-[520px] overflow-auto rounded-[20px] border border-slate-200 bg-white"
              style={{ scrollbarGutter: 'stable both-edges' }}
            >
              <div style={{ minWidth: `${NAME_COLUMN_WIDTH + timelineWidth + 8}px`, minHeight: '100%' }}>
                <TopCalendarHeader timelineDays={timelineDays} timelineWidth={timelineWidth} />
                <div>
                  {sortedProjects.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      timelineDays={timelineDays}
                      timelineWidth={timelineWidth}
                      onOpen={() => void openEdit(project)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
