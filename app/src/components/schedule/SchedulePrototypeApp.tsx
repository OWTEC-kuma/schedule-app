"use client";

import React, { useMemo, useRef, useState } from "react";

const STEP_TEMPLATES = [
  { code: "nyuko", stepName: "入稿", required: true },
  { code: "insatsu", stepName: "印刷", required: false },
  { code: "yokomochi_1", stepName: "横持ち", required: false },
  { code: "surface", stepName: "表面加工", required: false },
  { code: "yokomochi_2", stepName: "横持ち", required: false },
  { code: "goushi", stepName: "合紙", required: false },
  { code: "yokomochi_3", stepName: "横持ち", required: false },
  { code: "nuki", stepName: "抜き", required: false },
  { code: "yokomochi_4", stepName: "横持ち", required: false },
  { code: "set_genba", stepName: "セット現場", required: true },
] as const;

const DAY_COLUMN_WIDTH = 28;
const DELIVERY_MARKER_WIDTH = 7;
const NEW_MASTER_VALUE = "__new_master__";

type MasterItem = {
  id: number;
  name: string;
  address: string;
};

type Company = MasterItem;
type Supplier = MasterItem;

type StepRow = {
  id: number;
  stepCode: string;
  stepName: string;
  memo: string;
  companyId: number | null;
  date: string;
  time: string;
  enabled: boolean;
  required: boolean;
  sortOrder: number;
};

type ProcessGroup = {
  id: number;
  title: string;
  sortOrder: number;
  steps: StepRow[];
};

type DeliveryRow = {
  id: number;
  deliveryDate: string;
  deliveryTime: string;
  deliveryPlace: string;
  deliveryQuantity: string;
  sortOrder: number;
};

type MaterialRow = {
  id: number;
  supplierId: number | null;
  itemName: string;
  quantity: string;
  destinationCompanyId: number | null;
  arrivalDate: string;
  arrivalTime: string;
  sortOrder: number;
};

type Task = {
  id: number;
  projectName: string;
  processGroups: ProcessGroup[];
  deliveries: DeliveryRow[];
  materials: MaterialRow[];
};

type MasterDraft = {
  name: string;
  address: string;
};

type CompanyModalState =
  | { mode: "none" }
  | { mode: "manage_list" }
  | { mode: "manage_create" }
  | { mode: "manage_edit"; companyId: number }
  | { mode: "from_step"; groupId: number; stepIndex: number };

type SupplierModalState =
  | { mode: "none" }
  | { mode: "manage_list" }
  | { mode: "manage_create" }
  | { mode: "manage_edit"; supplierId: number }
  | { mode: "from_material"; materialIndex: number };

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromISO(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function createId(): number {
  return Date.now() + Math.floor(Math.random() * 100000);
}

function getTodayISO(): string {
  return toISO(new Date());
}

function formatLabel(value: string): string {
  if (!value) return "-";
  const d = fromISO(value);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getMasterName(options: MasterItem[], id: number | null): string {
  if (id == null) return "";
  return options.find((option) => option.id === id)?.name ?? "";
}

function hasMasterId(options: MasterItem[], id: number | null): boolean {
  if (id == null) return false;
  return options.some((option) => option.id === id);
}

function createStep(index: number, overrides: Partial<StepRow> = {}): StepRow {
  const template = STEP_TEMPLATES[index];
  return {
    id: createId(),
    stepCode: template.code,
    stepName: template.stepName,
    memo: "",
    companyId: null,
    date: template.required ? getTodayISO() : "",
    time: "",
    enabled: template.required,
    required: template.required,
    sortOrder: index,
    ...overrides,
  };
}

function createEmptySteps(): StepRow[] {
  return STEP_TEMPLATES.map((_, index) => createStep(index));
}

function createEmptyProcessGroup(label = "", sortOrder = 0): ProcessGroup {
  return {
    id: createId(),
    title: label,
    sortOrder,
    steps: createEmptySteps(),
  };
}

function createEmptyDelivery(sortOrder = 0): DeliveryRow {
  return {
    id: createId(),
    deliveryDate: getTodayISO(),
    deliveryTime: "",
    deliveryPlace: "",
    deliveryQuantity: "",
    sortOrder,
  };
}

function createEmptyMaterial(sortOrder = 0): MaterialRow {
  return {
    id: createId(),
    supplierId: null,
    itemName: "",
    quantity: "",
    destinationCompanyId: null,
    arrivalDate: "",
    arrivalTime: "",
    sortOrder,
  };
}

function createEmptyMasterDraft(): MasterDraft {
  return { name: "", address: "" };
}

function getAllEnabledStepDates(task: Task): string[] {
  return task.processGroups
    .flatMap((group) => group.steps)
    .filter((step) => step.enabled && step.date)
    .map((step) => step.date)
    .sort();
}

function getStartDate(task: Task): string {
  const validDates = getAllEnabledStepDates(task);
  return validDates[0] || "";
}

function getEndDate(task: Task): string {
  const validDates = task.deliveries.map((delivery) => delivery.deliveryDate).filter(Boolean).sort();
  return validDates[validDates.length - 1] || "";
}

function getHorizon(tasks: Task[]): string[] {
  const allDates = tasks.flatMap((task) => [getStartDate(task), getEndDate(task)]).filter(Boolean);
  const baseStart = allDates.length ? allDates.slice().sort()[0] : getTodayISO();
  const baseEnd = allDates.length ? allDates.slice().sort()[allDates.length - 1] : toISO(addDays(new Date(), 60));
  const startDate = addDays(fromISO(baseStart), -2);
  const endDate = addDays(fromISO(baseEnd), 7);
  const dates: string[] = [];
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(toISO(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function isCompanyInUse(tasks: Task[], companyId: number): boolean {
  return tasks.some(
    (task) =>
      task.processGroups.some((group) => group.steps.some((step) => step.companyId === companyId)) ||
      task.materials.some((material) => material.destinationCompanyId === companyId),
  );
}

function isSupplierInUse(tasks: Task[], supplierId: number): boolean {
  return tasks.some((task) => task.materials.some((material) => material.supplierId === supplierId));
}

const initialCompanies: Company[] = [
  { id: 1, name: "自社", address: "" },
  { id: 2, name: "印刷会社A", address: "" },
  { id: 3, name: "加工会社B", address: "" },
  { id: 4, name: "加工会社C", address: "" },
  { id: 5, name: "抜き会社D", address: "" },
  { id: 6, name: "印刷会社E", address: "" },
  { id: 7, name: "運送会社", address: "" },
];

const initialSuppliers: Supplier[] = [
  { id: 101, name: "A紙業企画", address: "" },
  { id: 102, name: "B資材", address: "" },
];

const initialTasks: Task[] = [
  {
    id: 1001,
    projectName: "プロジェクトA",
    processGroups: [
      {
        id: 2001,
        title: "本体",
        sortOrder: 0,
        steps: [
          createStep(0, { id: 3001, memo: "初回データ", companyId: 1, date: "2026-04-01" }),
          createStep(1, { id: 3002, memo: "4C", companyId: 2, date: "2026-04-05", enabled: true }),
          createStep(2, { id: 3003, memo: "加工先へ", companyId: 7, date: "2026-04-06", enabled: true }),
          createStep(3, { id: 3004, memo: "PP貼り", companyId: 3, date: "2026-04-12", enabled: true }),
          createStep(4, { id: 3005, memo: "合紙先へ", companyId: 7, date: "2026-04-13", enabled: true }),
          createStep(5, { id: 3006, memo: "5mm合紙", companyId: 4, date: "2026-04-20", enabled: true }),
          createStep(6, { id: 3007, memo: "抜き先へ", companyId: 7, date: "2026-04-21", enabled: true }),
          createStep(7, { id: 3008, memo: "木型使用", companyId: 5, date: "2026-04-28", enabled: true }),
          createStep(8, { id: 3009, memo: "セット現場へ", companyId: 7, date: "2026-04-29", enabled: true }),
          createStep(9, { id: 3010, memo: "最終セット", companyId: 1, date: "2026-05-15" }),
        ],
      },
      {
        id: 2002,
        title: "別パーツ",
        sortOrder: 1,
        steps: [
          createStep(0, { id: 3011, memo: "パーツ用", companyId: 1, date: "2026-04-03" }),
          createStep(1, { id: 3012, memo: "1C", companyId: 2, date: "2026-04-07", enabled: true }),
          createStep(2, { id: 3013 }),
          createStep(3, { id: 3014 }),
          createStep(4, { id: 3015 }),
          createStep(5, { id: 3016 }),
          createStep(6, { id: 3017 }),
          createStep(7, { id: 3018, memo: "パーツ抜き", companyId: 5, date: "2026-04-24", enabled: true }),
          createStep(8, { id: 3019 }),
          createStep(9, { id: 3020, memo: "本体と合流", companyId: 1, date: "2026-05-12" }),
        ],
      },
    ],
    deliveries: [
      { id: 4001, deliveryDate: "2026-05-18", deliveryTime: "10:00", deliveryPlace: "東京物流センター", deliveryQuantity: "300", sortOrder: 0 },
      { id: 4002, deliveryDate: "2026-05-20", deliveryTime: "", deliveryPlace: "大阪倉庫", deliveryQuantity: "200", sortOrder: 1 },
    ],
    materials: [
      {
        id: 5001,
        supplierId: 101,
        itemName: "サンカード200g",
        quantity: "300",
        destinationCompanyId: 3,
        arrivalDate: "2026-04-10",
        arrivalTime: "",
        sortOrder: 0,
      },
    ],
  },
  {
    id: 1002,
    projectName: "プロジェクトB",
    processGroups: [
      {
        id: 2003,
        title: "本体",
        sortOrder: 0,
        steps: [
          createStep(0, { id: 3021, memo: "修正版", companyId: 1, date: "2026-04-08" }),
          createStep(1, { id: 3022, memo: "特色あり", companyId: 6, date: "2026-04-14", enabled: true }),
          createStep(2, { id: 3023, date: "2026-04-15", enabled: true }),
          createStep(3, { id: 3024 }),
          createStep(4, { id: 3025 }),
          createStep(5, { id: 3026 }),
          createStep(6, { id: 3027 }),
          createStep(7, { id: 3028, date: "2026-05-01", enabled: true }),
          createStep(8, { id: 3029, date: "2026-05-02", enabled: true }),
          createStep(9, { id: 3030, companyId: 1, date: "2026-05-07" }),
        ],
      },
    ],
    deliveries: [
      { id: 4003, deliveryDate: "2026-05-10", deliveryTime: "13:00", deliveryPlace: "大阪倉庫", deliveryQuantity: "300", sortOrder: 0 },
    ],
    materials: [],
  },
];

function runInvariantChecks() {
  console.assert(STEP_TEMPLATES.length === 10, "工程テンプレート数が想定と異なります");
  console.assert(createEmptySteps().every((step) => typeof step.time === "string"), "工程の time 初期値が不足しています");
  console.assert(createEmptyDelivery().deliveryDate.length === 10, "納品日の初期値が不正です");
  console.assert(createEmptyMaterial().arrivalTime === "", "部材時間の初期値が不正です");
  console.assert(getEndDate(initialTasks[0]) === "2026-05-20", "最終納品日の計算が不正です");
  console.assert(initialTasks[0].materials[0].destinationCompanyId === 3, "部材の納入先ID参照が不正です");
}

runInvariantChecks();

function HeaderCell({ iso }: { iso: string }) {
  const d = fromISO(iso);
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  return (
    <div
      className={`flex h-9 items-center justify-center border-l px-0.5 text-[9px] ${
        isWeekend ? "bg-slate-50 text-slate-500" : "bg-white text-slate-700"
      }`}
      style={{ minWidth: `${DAY_COLUMN_WIDTH}px`, width: `${DAY_COLUMN_WIDTH}px` }}
    >
      {`${d.getMonth() + 1}/${d.getDate()}`}
    </div>
  );
}

function MasterModal({
  draft,
  setDraft,
  onClose,
  onSave,
  title,
  nameLabel,
}: {
  draft: MasterDraft;
  setDraft: React.Dispatch<React.SetStateAction<MasterDraft>>;
  onClose: () => void;
  onSave: () => void;
  title: string;
  nameLabel: string;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/35 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
            閉じる
          </button>
        </div>
        <div className="mt-6 space-y-4">
          <label className="block">
            <div className="mb-2 text-sm font-medium text-slate-700">{nameLabel}</div>
            <input
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-400"
              placeholder={`${nameLabel}を入力`}
            />
          </label>
          <label className="block">
            <div className="mb-2 text-sm font-medium text-slate-700">住所</div>
            <input
              value={draft.address}
              onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-400"
              placeholder="住所は任意"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onSave} className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-700">
            登録
          </button>
        </div>
      </div>
    </div>
  );
}

function MasterListModal({
  title,
  nameLabel,
  items,
  onClose,
  onAddNew,
  onEdit,
  onDelete,
}: {
  title: string;
  nameLabel: string;
  items: MasterItem[];
  onClose: () => void;
  onAddNew: () => void;
  onEdit: (item: MasterItem) => void;
  onDelete: (item: MasterItem) => void;
}) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/35 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <div className="flex gap-3">
            <button type="button" onClick={onAddNew} className="rounded-2xl border border-sky-300 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
              新規登録
            </button>
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
              閉じる
            </button>
          </div>
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-[1.1fr_1.7fr_180px] bg-slate-50 text-sm font-medium text-slate-700">
            <div className="border-b border-r px-4 py-3">{nameLabel}</div>
            <div className="border-b border-r px-4 py-3">住所</div>
            <div className="border-b px-4 py-3">操作</div>
          </div>
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1.1fr_1.7fr_180px] text-sm">
              <div className="border-b border-r px-4 py-3 text-slate-800">{item.name}</div>
              <div className="border-b border-r px-4 py-3 text-slate-600">{item.address || "-"}</div>
              <div className="border-b px-3 py-2">
                <div className="flex gap-2">
                  <button type="button" onClick={() => onEdit(item)} className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                    編集
                  </button>
                  <button type="button" onClick={() => onDelete(item)} className="flex-1 rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50">
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaskBar({ task, dates, onOpen }: { task: Task; dates: string[]; onOpen: (task: Task) => void }) {
  const startDate = getStartDate(task);
  const endDate = getEndDate(task);
  const startIndex = dates.indexOf(startDate);
  const endIndex = dates.indexOf(endDate);
  const left = startIndex >= 0 ? startIndex * DAY_COLUMN_WIDTH : 0;
  const width = startIndex >= 0 && endIndex >= startIndex ? (endIndex - startIndex) * DAY_COLUMN_WIDTH + DELIVERY_MARKER_WIDTH : 0;
  const deliveryIndexes = task.deliveries.map((delivery) => dates.indexOf(delivery.deliveryDate)).filter((index) => index >= 0);

  return (
    <div className="relative h-14 min-w-max border-t bg-white">
      <div className="absolute inset-0 flex">
        {dates.map((iso) => {
          const d = fromISO(iso);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return <div key={iso} className={`h-full border-l ${isWeekend ? "bg-slate-50/80" : "bg-white"}`} style={{ minWidth: `${DAY_COLUMN_WIDTH}px`, width: `${DAY_COLUMN_WIDTH}px` }} />;
        })}
      </div>
      {width > 0 && (
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="absolute top-1/2 h-6 -translate-y-1/2 rounded-full bg-sky-300/90 shadow-sm transition hover:scale-[1.01] hover:bg-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400"
          style={{ left: `${left + 1}px`, width: `${Math.max(width, DELIVERY_MARKER_WIDTH)}px` }}
          title={`${task.projectName} を編集`}
        >
          {deliveryIndexes.map((index) => (
            <span key={`${task.id}-${index}`} className="absolute top-0 h-full bg-sky-600/90" style={{ left: `${Math.max((index - startIndex) * DAY_COLUMN_WIDTH, 0)}px`, width: `${DELIVERY_MARKER_WIDTH}px` }} />
          ))}
          <span className="sr-only">{task.projectName}</span>
        </button>
      )}
    </div>
  );
}

function TaskForm({
  draft,
  initialDraft,
  companies,
  suppliers,
  onOpenCompanyRegisterFromStep,
  onOpenSupplierRegisterFromMaterial,
  onChange,
  onSave,
  onDelete,
  onCancel,
  isNew,
}: {
  draft: Task;
  initialDraft: Task;
  companies: Company[];
  suppliers: Supplier[];
  onOpenCompanyRegisterFromStep: (groupId: number, stepIndex: number) => void;
  onOpenSupplierRegisterFromMaterial: (materialIndex: number) => void;
  onChange: (next: Task) => void;
  onSave: (taskToSave: Task) => void;
  onDelete: () => void;
  onCancel: () => void;
  isNew: boolean;
}) {
  const computedStart = useMemo(() => getStartDate(draft), [draft]);
  const computedEnd = useMemo(() => getEndDate(draft), [draft]);
  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initialDraft), [draft, initialDraft]);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const updateStep = (groupId: number, stepIndex: number, key: keyof StepRow, value: string | boolean | number | null) => {
    const nextGroups = draft.processGroups.map((group) => {
      if (group.id !== groupId) return group;
      const nextSteps = group.steps.map((step, i) => {
        if (i !== stepIndex) return step;
        const nextStep = { ...step, [key]: value } as StepRow;
        if (key === "enabled" && value === false) {
          nextStep.memo = "";
          nextStep.companyId = null;
          nextStep.date = "";
          nextStep.time = "";
        }
        if (key === "enabled" && value === true && !nextStep.date) {
          nextStep.date = getTodayISO();
        }
        return nextStep;
      });
      return { ...group, steps: nextSteps };
    });
    onChange({ ...draft, processGroups: nextGroups });
  };

  const updateProcessGroupTitle = (groupId: number, value: string) => {
    onChange({ ...draft, processGroups: draft.processGroups.map((group) => (group.id === groupId ? { ...group, title: value } : group)) });
  };

  const addProcessGroup = () => {
    onChange({ ...draft, processGroups: [...draft.processGroups, createEmptyProcessGroup(`区分${draft.processGroups.length + 1}`, draft.processGroups.length)] });
  };

  const removeProcessGroup = (groupId: number) => {
    onChange({ ...draft, processGroups: draft.processGroups.filter((group) => group.id !== groupId) });
  };

  const updateDelivery = (index: number, key: keyof DeliveryRow, value: string) => {
    onChange({ ...draft, deliveries: draft.deliveries.map((row, i) => (i === index ? { ...row, [key]: value } : row)) });
  };

  const addDeliveryRow = () => {
    onChange({ ...draft, deliveries: [...draft.deliveries, createEmptyDelivery(draft.deliveries.length)] });
  };

  const removeDeliveryRow = (index: number) => {
    onChange({ ...draft, deliveries: draft.deliveries.filter((_, i) => i !== index) });
  };

  const updateMaterial = (index: number, key: keyof MaterialRow, value: string | number | null) => {
    onChange({ ...draft, materials: draft.materials.map((row, i) => (i === index ? { ...row, [key]: value } : row)) });
  };

  const addMaterialRow = () => {
    onChange({ ...draft, materials: [...draft.materials, createEmptyMaterial(draft.materials.length)] });
  };

  const removeMaterialRow = (index: number) => {
    onChange({ ...draft, materials: draft.materials.filter((_, i) => i !== index) });
  };

  const handleStepCompanyChange = (groupId: number, stepIndex: number, value: string) => {
    if (value === NEW_MASTER_VALUE) {
      onOpenCompanyRegisterFromStep(groupId, stepIndex);
      return;
    }
    updateStep(groupId, stepIndex, "companyId", value ? Number(value) : null);
  };

  const handleMaterialSupplierChange = (index: number, value: string) => {
    if (value === NEW_MASTER_VALUE) {
      onOpenSupplierRegisterFromMaterial(index);
      return;
    }
    updateMaterial(index, "supplierId", value ? Number(value) : null);
  };

  const handleCloseClick = () => {
    if (!isDirty) {
      onCancel();
      return;
    }
    setShowCloseConfirm(true);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(draft); }} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl rounded-3xl bg-white shadow-xl">
        <div className="border-b px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{isNew ? "タスク追加" : "タスク編集"}</h1>
              <p className="mt-1 text-sm text-slate-500">内部データはID参照型、画面表示は従来どおりです。</p>
            </div>
            <button type="button" onClick={handleCloseClick} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
              一覧へ戻る
            </button>
          </div>
        </div>

        <div className="grid gap-4 border-b px-6 py-5 md:grid-cols-2">
          <label className="block md:col-span-2">
            <div className="mb-2 text-sm font-medium text-slate-700">プロジェクト名</div>
            <input value={draft.projectName} onChange={(e) => onChange({ ...draft, projectName: e.target.value })} className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-400" placeholder="プロジェクト名を入力" />
          </label>
        </div>

        <div className="border-b px-6 py-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">納品</h2>
            <button type="button" onClick={addDeliveryRow} className="rounded-2xl border border-sky-300 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">+追加</button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[180px_140px_1.4fr_140px_100px] bg-slate-50 text-sm font-medium text-slate-700">
                <div className="border-b border-r px-4 py-3">納品日</div>
                <div className="border-b border-r px-4 py-3">指定時間</div>
                <div className="border-b border-r px-4 py-3">納品場所</div>
                <div className="border-b border-r px-4 py-3">納品数</div>
                <div className="border-b px-4 py-3">削除</div>
              </div>
              {draft.deliveries.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">納品情報が未登録です。</div>
              ) : (
                draft.deliveries.map((row, index) => (
                  <div key={row.id} className="grid grid-cols-[180px_140px_1.4fr_140px_100px] text-sm">
                    <div className="border-b border-r px-3 py-2"><input type="date" value={row.deliveryDate} onChange={(e) => updateDelivery(index, "deliveryDate", e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400" /></div>
                    <div className="border-b border-r px-3 py-2"><div className="flex items-center gap-2"><input type="time" value={row.deliveryTime} onChange={(e) => updateDelivery(index, "deliveryTime", e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400" /><span className="shrink-0 text-sm text-slate-600">迄</span></div></div>
                    <div className="border-b border-r px-3 py-2"><input value={row.deliveryPlace} onChange={(e) => updateDelivery(index, "deliveryPlace", e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400" placeholder="納品場所" /></div>
                    <div className="border-b border-r px-3 py-2"><input value={row.deliveryQuantity} onChange={(e) => updateDelivery(index, "deliveryQuantity", e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400" placeholder="納品数" /></div>
                    <div className="border-b px-3 py-2"><button type="button" onClick={() => removeDeliveryRow(index)} className="w-full rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50">削除</button></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
              開始日（自動）: <span className="font-medium text-slate-800">{formatLabel(computedStart)}</span>
              <span className="mx-2 text-slate-300">|</span>
              最終納品日: <span className="font-medium text-slate-800">{formatLabel(computedEnd)}</span>
            </div>
            <button type="button" onClick={addProcessGroup} className="rounded-2xl border border-sky-300 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">+印刷+加工追加</button>
          </div>
          <div className="space-y-6">
            {draft.processGroups.map((group, groupIndex) => (
              <div key={group.id} className="rounded-3xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                  <div className="flex flex-1 flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-slate-900">印刷+加工</h2>
                    <input value={group.title} onChange={(e) => updateProcessGroupTitle(group.id, e.target.value)} className="min-w-[220px] flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm outline-none transition focus:border-sky-400" placeholder={`区分名 ${groupIndex + 1}`} />
                  </div>
                  {draft.processGroups.length > 1 && <button type="button" onClick={() => removeProcessGroup(group.id)} className="rounded-2xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50">この印刷+加工を削除</button>}
                </div>
                <div className="overflow-x-auto rounded-b-3xl">
                  <div className="min-w-[1240px]">
                    <div className="grid grid-cols-[100px_160px_1.6fr_1.2fr_180px_160px] bg-slate-50 text-sm font-medium text-slate-700">
                      <div className="border-b border-r px-4 py-3">使用</div>
                      <div className="border-b border-r px-4 py-3">工程名</div>
                      <div className="border-b border-r px-4 py-3">メモ</div>
                      <div className="border-b border-r px-4 py-3">会社名</div>
                      <div className="border-b border-r px-4 py-3">日付</div>
                      <div className="border-b px-4 py-3">指定時間</div>
                    </div>
                    {group.steps.map((step, stepIndex) => {
                      const companyKnown = hasMasterId(companies, step.companyId);
                      return (
                        <div key={step.id} className="grid grid-cols-[100px_160px_1.6fr_1.2fr_180px_160px] text-sm">
                          <div className="flex items-center border-b border-r px-4 py-3">
                            {step.required ? (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">必須</span>
                            ) : (
                              <label className="flex items-center gap-2 text-slate-700">
                                <input type="checkbox" checked={step.enabled} onChange={(e) => updateStep(group.id, stepIndex, "enabled", e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                                <span>使う</span>
                              </label>
                            )}
                          </div>
                          <div className={`border-b border-r px-4 py-3 font-medium ${step.enabled ? "bg-slate-50/60 text-slate-800" : "bg-slate-50/30 text-slate-400"}`}>{step.stepName}</div>
                          <div className="border-b border-r px-3 py-2"><input value={step.memo} disabled={!step.enabled} onChange={(e) => updateStep(group.id, stepIndex, "memo", e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-sky-400" placeholder="メモ" /></div>
                          <div className="border-b border-r px-3 py-2">
                            <select value={step.companyId?.toString() ?? ""} disabled={!step.enabled} onChange={(e) => handleStepCompanyChange(group.id, stepIndex, e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-sky-400">
                              <option value="">選択してください</option>
                              <option value={NEW_MASTER_VALUE}>新規登録</option>
                              {!companyKnown && step.companyId != null && <option value={step.companyId.toString()}>{getMasterName(companies, step.companyId)}</option>}
                              {companies.map((company) => (
                                <option key={company.id} value={company.id.toString()}>{company.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="border-b border-r px-3 py-2"><input type="date" value={step.date} disabled={!step.enabled} onChange={(e) => updateStep(group.id, stepIndex, "date", e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-sky-400" /></div>
                          <div className="border-b px-3 py-2"><div className="flex items-center gap-2"><input type="time" value={step.time} disabled={!step.enabled} onChange={(e) => updateStep(group.id, stepIndex, "time", e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-sky-400" /><span className="shrink-0 text-sm text-slate-600">迄</span></div></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t px-6 py-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">部材</h2>
            <button type="button" onClick={addMaterialRow} className="rounded-2xl border border-sky-300 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">+追加</button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <div className="min-w-[1200px]">
              <div className="grid grid-cols-[1.2fr_1.4fr_120px_1.2fr_180px_160px_100px] bg-slate-50 text-sm font-medium text-slate-700">
                <div className="border-b border-r px-4 py-3">発注先</div>
                <div className="border-b border-r px-4 py-3">品名</div>
                <div className="border-b border-r px-4 py-3">数</div>
                <div className="border-b border-r px-4 py-3">納入先</div>
                <div className="border-b border-r px-4 py-3">入荷日</div>
                <div className="border-b border-r px-4 py-3">指定時間</div>
                <div className="border-b px-4 py-3">削除</div>
              </div>
              {draft.materials.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">部材が未登録です。必要なら「+追加」で行を増やしてください。</div>
              ) : (
                draft.materials.map((row, index) => {
                  const supplierKnown = hasMasterId(suppliers, row.supplierId);
                  const destinationKnown = hasMasterId(companies, row.destinationCompanyId);
                  return (
                    <div key={row.id} className="grid grid-cols-[1.2fr_1.4fr_120px_1.2fr_180px_160px_100px] text-sm">
                      <div className="border-b border-r px-3 py-2">
                        <select value={row.supplierId?.toString() ?? ""} onChange={(e) => handleMaterialSupplierChange(index, e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-sky-400">
                          <option value="">選択してください</option>
                          <option value={NEW_MASTER_VALUE}>新規登録</option>
                          {!supplierKnown && row.supplierId != null && <option value={row.supplierId.toString()}>{getMasterName(suppliers, row.supplierId)}</option>}
                          {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id.toString()}>{supplier.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="border-b border-r px-3 py-2"><input value={row.itemName} onChange={(e) => updateMaterial(index, "itemName", e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400" placeholder="品名" /></div>
                      <div className="border-b border-r px-3 py-2"><input value={row.quantity} onChange={(e) => updateMaterial(index, "quantity", e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400" placeholder="数" /></div>
                      <div className="border-b border-r px-3 py-2">
                        <select value={row.destinationCompanyId?.toString() ?? ""} onChange={(e) => updateMaterial(index, "destinationCompanyId", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-sky-400">
                          <option value="">選択してください</option>
                          {!destinationKnown && row.destinationCompanyId != null && <option value={row.destinationCompanyId.toString()}>{getMasterName(companies, row.destinationCompanyId)}</option>}
                          {companies.map((company) => (
                            <option key={company.id} value={company.id.toString()}>{company.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="border-b border-r px-3 py-2"><input type="date" value={row.arrivalDate} onChange={(e) => updateMaterial(index, "arrivalDate", e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400" /></div>
                      <div className="border-b border-r px-3 py-2"><div className="flex items-center gap-2"><input type="time" value={row.arrivalTime} onChange={(e) => updateMaterial(index, "arrivalTime", e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-400" /><span className="shrink-0 text-sm text-slate-600">迄</span></div></div>
                      <div className="border-b px-3 py-2"><button type="button" onClick={() => removeMaterialRow(index)} className="w-full rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50">削除</button></div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-5">
          {showCloseConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
              <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                <h3 className="text-lg font-semibold text-slate-900">変更があります</h3>
                <p className="mt-2 text-sm text-slate-600">保存して閉じるか、保存しないで閉じるか選んでください。</p>
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => setShowCloseConfirm(false)} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">編集を続ける</button>
                  <button type="button" onClick={() => { setShowCloseConfirm(false); onCancel(); }} className="rounded-2xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50">保存しないで閉じる</button>
                  <button type="button" onClick={() => { setShowCloseConfirm(false); onSave(draft); }} className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700">保存して閉じる</button>
                </div>
              </div>
            </div>
          )}
          <div className="text-sm text-slate-500">保存後、トップ画面の帯に反映されます。</div>
          <div className="flex gap-3">
            {!isNew && <button type="button" onClick={onDelete} className="rounded-2xl border border-rose-300 px-5 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50">削除</button>}
            <button type="submit" className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700">保存</button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default function SchedulePrototypeApp() {
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [originalEditingTask, setOriginalEditingTask] = useState<Task | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [companyModalState, setCompanyModalState] = useState<CompanyModalState>({ mode: "none" });
  const [supplierModalState, setSupplierModalState] = useState<SupplierModalState>({ mode: "none" });
  const [masterDraft, setMasterDraft] = useState<MasterDraft>(createEmptyMasterDraft());

  const dates = useMemo(() => getHorizon(tasks), [tasks]);

  const scrollTimeline = (direction: "left" | "right") => {
    const container = timelineScrollRef.current;
    if (!container) return;
    const amount = Math.max(container.clientWidth * 0.7, 240);
    container.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  const openNewTask = () => {
    const newTask: Task = {
      id: createId(),
      projectName: "",
      processGroups: [createEmptyProcessGroup("本体", 0)],
      deliveries: [createEmptyDelivery(0)],
      materials: [],
    };
    setIsNew(true);
    setOriginalEditingTask(structuredClone(newTask));
    setEditingTask(newTask);
  };

  const openEditTask = (task: Task) => {
    setIsNew(false);
    setOriginalEditingTask(structuredClone(task));
    setEditingTask(structuredClone(task));
  };

  const closeEditor = () => {
    setEditingTask(null);
    setOriginalEditingTask(null);
    setIsNew(false);
  };

  const handleSave = (taskToSave: Task) => {
    if (!taskToSave.projectName.trim()) {
      alert("プロジェクト名を入力してください。");
      return;
    }
    if (!getStartDate(taskToSave)) {
      alert("有効な工程に少なくとも1つの日付を入力してください。");
      return;
    }
    if (!getEndDate(taskToSave)) {
      alert("納品情報に少なくとも1つの日付を入力してください。");
      return;
    }
    setTasks((prev) => {
      const exists = prev.some((item) => item.id === taskToSave.id);
      return exists ? prev.map((item) => (item.id === taskToSave.id ? taskToSave : item)) : [...prev, taskToSave];
    });
    closeEditor();
  };

  const handleDelete = () => {
    if (!editingTask) return;
    setTasks((prev) => prev.filter((item) => item.id !== editingTask.id));
    closeEditor();
  };

  const openCompanyList = () => {
    setMasterDraft(createEmptyMasterDraft());
    setCompanyModalState({ mode: "manage_list" });
  };

  const openCompanyRegisterFromManage = () => {
    setMasterDraft(createEmptyMasterDraft());
    setCompanyModalState({ mode: "manage_create" });
  };

  const openCompanyEditFromManage = (company: Company) => {
    setMasterDraft({ name: company.name, address: company.address });
    setCompanyModalState({ mode: "manage_edit", companyId: company.id });
  };

  const deleteCompanyFromManage = (company: Company) => {
    if (isCompanyInUse(tasks, company.id)) {
      alert("この会社は案件で使用中のため削除できません。");
      return;
    }
    if (!window.confirm(`「${company.name}」を削除しますか？`)) return;
    setCompanies((prev) => prev.filter((item) => item.id !== company.id));
  };

  const openCompanyRegisterFromStep = (groupId: number, stepIndex: number) => {
    setMasterDraft(createEmptyMasterDraft());
    setCompanyModalState({ mode: "from_step", groupId, stepIndex });
  };

  const closeCompanyModal = () => {
    setMasterDraft(createEmptyMasterDraft());
    setCompanyModalState({ mode: "none" });
  };

  const saveCompany = () => {
    const name = masterDraft.name.trim();
    const address = masterDraft.address.trim();
    if (!name) {
      alert("会社名を入力してください。");
      return;
    }

    if (companyModalState.mode === "manage_edit") {
      const duplicate = companies.find((company) => company.name === name && company.id !== companyModalState.companyId);
      if (duplicate) {
        alert("同じ会社名がすでに登録されています。");
        return;
      }
      setCompanies((prev) => prev.map((company) => (company.id === companyModalState.companyId ? { ...company, name, address } : company)));
      closeCompanyModal();
      return;
    }

    const existing = companies.find((company) => company.name === name);
    const savedCompany = existing ?? { id: createId(), name, address };
    if (!existing) {
      setCompanies((prev) => [...prev, savedCompany]);
    }

    if (companyModalState.mode === "from_step") {
      const { groupId, stepIndex } = companyModalState;
      setEditingTask((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          processGroups: prev.processGroups.map((group) => {
            if (group.id !== groupId) return group;
            return {
              ...group,
              steps: group.steps.map((step, index) => (index === stepIndex ? { ...step, companyId: savedCompany.id } : step)),
            };
          }),
        };
      });
    }

    closeCompanyModal();
  };

  const openSupplierList = () => {
    setMasterDraft(createEmptyMasterDraft());
    setSupplierModalState({ mode: "manage_list" });
  };

  const openSupplierRegisterFromManage = () => {
    setMasterDraft(createEmptyMasterDraft());
    setSupplierModalState({ mode: "manage_create" });
  };

  const openSupplierEditFromManage = (supplier: Supplier) => {
    setMasterDraft({ name: supplier.name, address: supplier.address });
    setSupplierModalState({ mode: "manage_edit", supplierId: supplier.id });
  };

  const deleteSupplierFromManage = (supplier: Supplier) => {
    if (isSupplierInUse(tasks, supplier.id)) {
      alert("この発注先は案件で使用中のため削除できません。");
      return;
    }
    if (!window.confirm(`「${supplier.name}」を削除しますか？`)) return;
    setSuppliers((prev) => prev.filter((item) => item.id !== supplier.id));
  };

  const openSupplierRegisterFromMaterial = (materialIndex: number) => {
    setMasterDraft(createEmptyMasterDraft());
    setSupplierModalState({ mode: "from_material", materialIndex });
  };

  const closeSupplierModal = () => {
    setMasterDraft(createEmptyMasterDraft());
    setSupplierModalState({ mode: "none" });
  };

  const saveSupplier = () => {
    const name = masterDraft.name.trim();
    const address = masterDraft.address.trim();
    if (!name) {
      alert("発注先名を入力してください。");
      return;
    }

    if (supplierModalState.mode === "manage_edit") {
      const duplicate = suppliers.find((supplier) => supplier.name === name && supplier.id !== supplierModalState.supplierId);
      if (duplicate) {
        alert("同じ発注先名がすでに登録されています。");
        return;
      }
      setSuppliers((prev) => prev.map((supplier) => (supplier.id === supplierModalState.supplierId ? { ...supplier, name, address } : supplier)));
      closeSupplierModal();
      return;
    }

    const existing = suppliers.find((supplier) => supplier.name === name);
    const savedSupplier = existing ?? { id: createId(), name, address };
    if (!existing) {
      setSuppliers((prev) => [...prev, savedSupplier]);
    }

    if (supplierModalState.mode === "from_material") {
      const { materialIndex } = supplierModalState;
      setEditingTask((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          materials: prev.materials.map((material, index) => (index === materialIndex ? { ...material, supplierId: savedSupplier.id } : material)),
        };
      });
    }

    closeSupplierModal();
  };

  return (
    <>
      {companyModalState.mode === "manage_list" && (
        <MasterListModal title="会社一覧" nameLabel="会社名" items={companies} onClose={closeCompanyModal} onAddNew={openCompanyRegisterFromManage} onEdit={openCompanyEditFromManage} onDelete={deleteCompanyFromManage} />
      )}
      {(companyModalState.mode === "manage_create" || companyModalState.mode === "manage_edit" || companyModalState.mode === "from_step") && (
        <MasterModal draft={masterDraft} setDraft={setMasterDraft} onClose={closeCompanyModal} onSave={saveCompany} title="会社登録" nameLabel="会社名" />
      )}

      {supplierModalState.mode === "manage_list" && (
        <MasterListModal title="発注先一覧" nameLabel="発注先名" items={suppliers} onClose={closeSupplierModal} onAddNew={openSupplierRegisterFromManage} onEdit={openSupplierEditFromManage} onDelete={deleteSupplierFromManage} />
      )}
      {(supplierModalState.mode === "manage_create" || supplierModalState.mode === "manage_edit" || supplierModalState.mode === "from_material") && (
        <MasterModal draft={masterDraft} setDraft={setMasterDraft} onClose={closeSupplierModal} onSave={saveSupplier} title="発注先登録" nameLabel="発注先名" />
      )}

      {editingTask ? (
        <TaskForm
          draft={editingTask}
          initialDraft={originalEditingTask ?? editingTask}
          companies={companies}
          suppliers={suppliers}
          onOpenCompanyRegisterFromStep={openCompanyRegisterFromStep}
          onOpenSupplierRegisterFromMaterial={openSupplierRegisterFromMaterial}
          onChange={setEditingTask}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={closeEditor}
          isNew={isNew}
        />
      ) : (
        <div className="min-h-screen bg-slate-100 p-6">
          <div className="mx-auto max-w-[1500px] rounded-3xl bg-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-5">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">スケジュール管理</h1>
                <p className="mt-1 text-sm text-slate-500">将来DB化しやすいよう、内部はID参照で保持しています。</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => scrollTimeline("left")} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">←</button>
                <button type="button" onClick={() => scrollTimeline("right")} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">→</button>
                <button type="button" onClick={openCompanyList} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">会社一覧登録</button>
                <button type="button" onClick={openSupplierList} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">発注先一覧登録</button>
                <button type="button" onClick={openNewTask} className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700">タスク追加</button>
              </div>
            </div>
            <div ref={timelineScrollRef} className="overflow-x-scroll overflow-y-auto rounded-b-3xl pb-3 [scrollbar-gutter:stable]">
              <div className="grid min-w-max grid-cols-[180px_1fr]">
                <div className="sticky left-0 z-20 bg-white">
                  <div className="flex h-9 items-center border-b px-3 text-xs font-semibold text-slate-700">タスク名</div>
                  {tasks.map((task) => (
                    <div key={task.id} className="flex h-14 items-center border-b px-3 text-xs font-medium text-slate-800">{task.projectName}</div>
                  ))}
                </div>
                <div>
                  <div className="sticky top-0 z-10 flex bg-white">
                    {dates.map((iso) => (
                      <HeaderCell key={iso} iso={iso} />
                    ))}
                  </div>
                  {tasks.map((task) => (
                    <TaskBar key={task.id} task={task} dates={dates} onOpen={openEditTask} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}