import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, testConnection } from '../firebase/config';
import {
  applyIncomingConfirmation,
  applyStockAdjustment,
  calculateIncomingTotal,
  canAdjustStock,
  canApproveOrDeliver,
  canDeleteItemPermanently,
  canEditMasterItems,
  canManageUnits,
  canManageUsers,
  createIncomingReversal,
  emailToInviteId,
  generateDocNumber,
  normalizeCodeKey,
  processStockDelivery,
  reviewStockRequest,
  sanitizeId,
  validateAdminSlotAvailability,
  validateItemUniqueness,
} from '../domain/rules';
import type {
  AdjustmentType,
  AdminSlot,
  AuditLog,
  Category,
  DeliveryRecord,
  IncomingLineItem,
  IncomingTransaction,
  InventoryItem,
  NavRoute,
  NotificationItem,
  StockAdjustment,
  StockLedgerEntry,
  StockRequest,
  Supplier,
  SystemConfig,
  Unit,
  UserAccount,
  UserInvite,
  UserRole,
} from '../domain/types';
import { createSandboxSeedData, type InventorySnapshotState } from './sandboxSeed';

function toIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function normalizeDocDates<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  for (const key of ['createdAt', 'updatedAt', 'confirmedAt', 'approvedAt']) {
    if (out[key] !== undefined && out[key] !== null) {
      out[key] = toIso(out[key]);
    }
  }
  return out as T;
}

export type AuthStage =
  | 'LOADING'
  | 'UNAUTHENTICATED'
  | 'EMAIL_UNVERIFIED'
  | 'NEEDS_OWNER_INIT'
  | 'UNAUTHORIZED_NO_INVITE'
  | 'INACTIVE_ACCOUNT'
  | 'READY';

export interface InventoryContextValue {
  isSandbox: boolean;
  authStage: AuthStage;
  firebaseUser: FirebaseUser | null;
  currentUser: UserAccount | null;
  authError: string | null;
  systemConfig: SystemConfig | null;
  adminSlot: AdminSlot | null;
  users: UserAccount[];
  invites: UserInvite[];
  categories: Category[];
  units: Unit[];
  suppliers: Supplier[];
  items: InventoryItem[];
  incoming: IncomingTransaction[];
  requests: StockRequest[];
  deliveries: DeliveryRecord[];
  adjustments: StockAdjustment[];
  ledger: StockLedgerEntry[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  activeRoute: NavRoute;
  setActiveRoute: (route: NavRoute) => void;
  scannerDraftCart: Array<{ itemId: string; qty: number }>;
  addToScannerDraftCart: (itemId: string, qty?: number) => void;
  clearScannerDraftCart: () => void;

  // Auth Actions
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  initializeFirstOwner: (companyName: string, ownerName: string) => Promise<void>;
  logout: () => Promise<void>;

  // Master & User Actions
  saveUserInvite: (input: { name: string; email: string; role: 'ADMIN' | 'PRODUKSI'; department: string; active: boolean }) => Promise<void>;
  updateUserAccountRoleOrStatus: (user: UserAccount, updates: { name: string; role: UserRole; department: string; active: boolean }) => Promise<void>;
  saveCategory: (input: { id?: string; code: string; name: string; description: string; active: boolean }) => Promise<void>;
  saveUnit: (input: { id?: string; code: string; name: string; description: string; active: boolean }) => Promise<void>;
  saveSupplier: (input: { id?: string; code: string; name: string; contactPerson: string; phone: string; email: string; address: string; active: boolean }) => Promise<void>;
  saveItem: (input: {
    id?: string;
    code: string;
    barcode: string;
    name: string;
    categoryId: string;
    specification: string;
    unitId: string;
    initialStock: number;
    minStock: number;
    purchasePrice: number;
    supplierId: string;
    active: boolean;
  }) => Promise<void>;
  importItemsBatch: (rows: Array<{
    code: string;
    barcode: string;
    name: string;
    categoryName: string;
    specification: string;
    unitName: string;
    initialStock: number;
    minStock: number;
    purchasePrice: number;
    supplierName: string;
  }>) => Promise<{ imported: number; skipped: string[] }>;
  deleteItemPermanently: (item: InventoryItem) => Promise<void>;

  // Transaction Actions
  saveIncomingDraft: (input: {
    id?: string;
    date: string;
    supplierId: string;
    items: IncomingLineItem[];
    notes: string;
  }) => Promise<IncomingTransaction>;
  confirmIncomingTransaction: (tx: IncomingTransaction) => Promise<void>;
  reverseIncomingTransaction: (tx: IncomingTransaction, reason: string) => Promise<void>;

  submitStockRequest: (input: {
    department: string;
    notes: string;
    items: Array<{ itemId: string; requestedQty: number }>;
  }) => Promise<void>;
  reviewRequest: (input: {
    request: StockRequest;
    decision: 'APPROVE' | 'REJECT';
    approvedQuantities?: Record<string, number>;
    rejectionReason?: string;
  }) => Promise<void>;
  cancelRequest: (request: StockRequest) => Promise<void>;
  confirmStockDelivery: (input: {
    request: StockRequest;
    deliverQuantities: Record<string, number>;
    notes: string;
  }) => Promise<DeliveryRecord>;

  submitStockAdjustment: (input: {
    item: InventoryItem;
    type: AdjustmentType;
    value: number;
    reason: string;
  }) => Promise<void>;

  markNotificationAsRead: (notif: NotificationItem) => Promise<void>;
  updateSystemSettings: (input: { companyName: string; lowStockAlertEnabled: boolean }) => Promise<void>;
  exportBackupJson: () => string;
  seedStarterMasters: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}

function getAutostartRole(): UserRole | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const val = params.get('autostart')?.toUpperCase();
  if (val === 'OWNER' || val === '1') return 'OWNER';
  if (val === 'ADMIN') return 'ADMIN';
  if (val === 'PRODUKSI') return 'PRODUKSI';
  return null;
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const autostartRole = useMemo(() => getAutostartRole(), []);
  const isSandbox = autostartRole !== null;

  const [authStage, setAuthStage] = useState<AuthStage>(isSandbox ? 'READY' : 'LOADING');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    if (!autostartRole) return null;
    return createSandboxSeedData(autostartRole).currentUser;
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<NavRoute>('dashboard');
  const [scannerDraftCart, setScannerDraftCart] = useState<Array<{ itemId: string; qty: number }>>([]);

  const [sandboxState, setSandboxState] = useState<InventorySnapshotState | null>(() => {
    if (!autostartRole) return null;
    return createSandboxSeedData(autostartRole).state;
  });
  const [usedSandboxKeys] = useState<Set<string>>(() => new Set());

  // Live Firestore State
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [adminSlot, setAdminSlot] = useState<AdminSlot | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [incoming, setIncoming] = useState<IncomingTransaction[]>([]);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [ledger, setLedger] = useState<StockLedgerEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const addToScannerDraftCart = useCallback((itemId: string, qty = 1) => {
    setScannerDraftCart((prev) => {
      const existing = prev.find((p) => p.itemId === itemId);
      if (existing) {
        return prev.map((p) => (p.itemId === itemId ? { ...p, qty: p.qty + qty } : p));
      }
      return [...prev, { itemId, qty }];
    });
  }, []);

  const clearScannerDraftCart = useCallback(() => {
    setScannerDraftCart([]);
  }, []);

  const writeAuditLogFirestore = useCallback(
    async (actor: UserAccount, action: string, entityType: string, entityId: string, description: string) => {
      const logId = sanitizeId(`aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      try {
        await setDoc(doc(db, 'auditLogs', logId), {
          id: logId,
          actorUid: actor.uid,
          actorName: actor.name,
          actorRole: actor.role,
          action,
          entityType,
          entityId,
          description: description.slice(0, 490),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `auditLogs/${logId}`);
      }
    },
    []
  );

  const appendSandboxAudit = useCallback(
    (state: InventorySnapshotState, actor: UserAccount, action: string, entityType: string, entityId: string, description: string): AuditLog[] => {
      return [
        {
          id: sanitizeId(`aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
          actorUid: actor.uid,
          actorName: actor.name,
          actorRole: actor.role,
          action,
          entityType,
          entityId,
          description,
          createdAt: new Date().toISOString(),
        },
        ...state.auditLogs,
      ];
    },
    []
  );

  // Resolve user profile on Firebase Auth change
  const resolveProfile = useCallback(async (fbUser: FirebaseUser) => {
    setAuthError(null);
    if (!fbUser.emailVerified) {
      setAuthStage('EMAIL_UNVERIFIED');
      return;
    }

    try {
      const configSnap = await getDoc(doc(db, 'system', 'config'));
      if (configSnap.exists()) {
        setSystemConfig(normalizeDocDates(configSnap.data() as Record<string, unknown>) as unknown as SystemConfig);
      } else {
        setSystemConfig(null);
      }

      const userSnap = await getDoc(doc(db, 'users', fbUser.uid));
      if (userSnap.exists()) {
        const account = normalizeDocDates(userSnap.data() as Record<string, unknown>) as unknown as UserAccount;
        if (!account.active) {
          setCurrentUser(account);
          setAuthStage('INACTIVE_ACCOUNT');
          return;
        }
        setCurrentUser(account);
        setAuthStage('READY');
        await writeAuditLogFirestore(account, 'LOGIN', 'AUTH', account.uid, `${account.name} (${account.role}) masuk ke sistem.`);
        return;
      }

      // If no user doc yet: check if system uninitialized or bootstrapped owner email
      const email = (fbUser.email ?? '').toLowerCase();
      if (!configSnap.exists() || email === 'garasikosong2205@gmail.com') {
        setAuthStage('NEEDS_OWNER_INIT');
        return;
      }

      // Check Owner-provisioned invite
      const inviteId = emailToInviteId(email);
      const inviteSnap = await getDoc(doc(db, 'userInvites', inviteId));
      if (inviteSnap.exists()) {
        const invite = normalizeDocDates(inviteSnap.data() as Record<string, unknown>) as unknown as UserInvite;
        if (invite.active && invite.email.toLowerCase() === email) {
          await runTransaction(db, async (tx) => {
            if (invite.role === 'ADMIN') {
              const slotRef = doc(db, 'system', 'adminSlot');
              const slotSnap = await tx.get(slotRef);
              if (slotSnap.exists()) {
                const slot = slotSnap.data() as AdminSlot;
                if (slot.occupied && slot.adminEmail && slot.adminEmail.toLowerCase() !== email) {
                  throw new Error('Slot ADMIN sudah digunakan oleh pengguna lain.');
                }
              }
              tx.set(
                slotRef,
                {
                  occupied: true,
                  adminUid: fbUser.uid,
                  adminEmail: email,
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            }
            tx.set(doc(db, 'users', fbUser.uid), {
              uid: fbUser.uid,
              email,
              name: invite.name,
              role: invite.role,
              department: invite.department,
              active: true,
              inviteId: invite.id,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            tx.update(doc(db, 'userInvites', invite.id), {
              claimedUid: fbUser.uid,
              updatedAt: serverTimestamp(),
            });
          });

          const newAccount: UserAccount = {
            uid: fbUser.uid,
            email,
            name: invite.name,
            role: invite.role,
            department: invite.department,
            active: true,
            inviteId: invite.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setCurrentUser(newAccount);
          setAuthStage('READY');
          await writeAuditLogFirestore(newAccount, 'LOGIN', 'AUTH', newAccount.uid, `${newAccount.name} (${newAccount.role}) aktivasi akun dan masuk.`);
          return;
        }
      }

      setAuthStage('UNAUTHORIZED_NO_INVITE');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Gagal memverifikasi profil pengguna.');
      setAuthStage('UNAUTHENTICATED');
    }
  }, [writeAuditLogFirestore]);

  useEffect(() => {
    if (isSandbox) return;
    void testConnection();
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setCurrentUser(null);
        setAuthStage('UNAUTHENTICATED');
        return;
      }
      setAuthStage('LOADING');
      void resolveProfile(fbUser);
    });
    return () => unsub();
  }, [isSandbox, resolveProfile]);

  // Attach Firestore real-time listeners when READY
  useEffect(() => {
    if (isSandbox || authStage !== 'READY' || !currentUser) return;
    const unsubs: Unsubscribe[] = [];

    const listenCollection = <T,>(
      path: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      qOverride?: ReturnType<typeof query>
    ) => {
      const ref = qOverride ?? collection(db, path);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          const rows = snap.docs.map((d) => normalizeDocDates(d.data() as Record<string, unknown>) as unknown as T);
          setter(rows);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, path)
      );
      unsubs.push(unsub);
    };

    listenCollection<Category>('categories', setCategories);
    listenCollection<Unit>('units', setUnits);
    listenCollection<InventoryItem>('items', setItems);

    if (currentUser.role === 'PRODUKSI') {
      listenCollection<StockRequest>(
        'stockRequests',
        setRequests,
        query(collection(db, 'stockRequests'), where('requesterUid', '==', currentUser.uid))
      );
      listenCollection<DeliveryRecord>(
        'deliveries',
        setDeliveries,
        query(collection(db, 'deliveries'), where('requesterUid', '==', currentUser.uid))
      );
      listenCollection<NotificationItem>(
        'notifications',
        setNotifications,
        query(collection(db, 'notifications'), where('targetUid', '==', currentUser.uid))
      );
    } else {
      listenCollection<Supplier>('suppliers', setSuppliers);
      listenCollection<IncomingTransaction>('incomingTransactions', setIncoming);
      listenCollection<StockRequest>('stockRequests', setRequests);
      listenCollection<DeliveryRecord>('deliveries', setDeliveries);
      listenCollection<StockAdjustment>('stockAdjustments', setAdjustments);
      listenCollection<StockLedgerEntry>('stockLedgers', setLedger);
      listenCollection<UserAccount>('users', setUsers);
      listenCollection<UserInvite>('userInvites', setInvites);

      if (currentUser.role === 'ADMIN') {
        listenCollection<NotificationItem>(
          'notifications',
          setNotifications,
          query(collection(db, 'notifications'), where('targetRole', '==', 'ADMIN'))
        );
      } else {
        listenCollection<NotificationItem>('notifications', setNotifications);
        listenCollection<AuditLog>('auditLogs', setAuditLogs);
      }

      unsubs.push(
        onSnapshot(
          doc(db, 'system', 'adminSlot'),
          (snap) => {
            if (snap.exists()) {
              setAdminSlot(normalizeDocDates(snap.data() as Record<string, unknown>) as unknown as AdminSlot);
            } else {
              setAdminSlot({ occupied: false, adminUid: null, adminEmail: null, updatedAt: new Date().toISOString() });
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, 'system/adminSlot')
        )
      );
    }

    unsubs.push(
      onSnapshot(
        doc(db, 'system', 'config'),
        (snap) => {
          if (snap.exists()) {
            setSystemConfig(normalizeDocDates(snap.data() as Record<string, unknown>) as unknown as SystemConfig);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'system/config')
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authStage, currentUser, isSandbox]);

  // Expose active data (either real Firestore or Sandbox)
  const effectiveSystemConfig = isSandbox ? sandboxState?.systemConfig ?? null : systemConfig;
  const effectiveAdminSlot = isSandbox ? sandboxState?.adminSlot ?? null : adminSlot;
  const effectiveUsers = isSandbox ? sandboxState?.users ?? [] : users;
  const effectiveInvites = isSandbox ? sandboxState?.invites ?? [] : invites;
  const effectiveCategories = isSandbox ? sandboxState?.categories ?? [] : categories;
  const effectiveUnits = isSandbox ? sandboxState?.units ?? [] : units;
  const effectiveSuppliers = isSandbox ? sandboxState?.suppliers ?? [] : suppliers;
  const effectiveItems = isSandbox ? sandboxState?.items ?? [] : items;
  const effectiveIncoming = isSandbox ? sandboxState?.incoming ?? [] : incoming;
  const effectiveRequests = isSandbox
    ? currentUser?.role === 'PRODUKSI'
      ? (sandboxState?.requests ?? []).filter((r) => r.requesterUid === currentUser.uid)
      : sandboxState?.requests ?? []
    : requests;
  const effectiveDeliveries = isSandbox
    ? currentUser?.role === 'PRODUKSI'
      ? (sandboxState?.deliveries ?? []).filter((d) => d.requesterUid === currentUser.uid)
      : sandboxState?.deliveries ?? []
    : deliveries;
  const effectiveAdjustments = isSandbox ? sandboxState?.adjustments ?? [] : adjustments;
  const effectiveLedger = isSandbox ? sandboxState?.ledger ?? [] : ledger;
  const effectiveNotifications = isSandbox
    ? (sandboxState?.notifications ?? []).filter((n) => {
        if (!currentUser) return false;
        if (currentUser.role === 'OWNER') return true;
        if (currentUser.role === 'ADMIN') return n.targetRole === 'ADMIN' || n.targetUid === currentUser.uid;
        return n.targetUid === currentUser.uid;
      })
    : notifications;
  const effectiveAuditLogs = isSandbox ? sandboxState?.auditLogs ?? [] : auditLogs;

  // Auth Actions
  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login Google dibatalkan atau gagal.');
    }
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('operation-not-allowed')) {
        setAuthError(
          'Provider Email/Password belum diaktifkan di Firebase Console. Aktifkan di Authentication -> Sign-in method, atau gunakan Masuk dengan Google.'
        );
      } else {
        setAuthError(msg);
      }
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  }, []);

  const initializeFirstOwner = useCallback(async (companyName: string, ownerName: string) => {
    if (!firebaseUser || !firebaseUser.email) throw new Error('Pengguna belum terautentikasi.');
    const email = firebaseUser.email.toLowerCase();
    await runTransaction(db, async (tx) => {
      const configRef = doc(db, 'system', 'config');
      const configSnap = await tx.get(configRef);
      if (!configSnap.exists()) {
        tx.set(configRef, {
          initialized: true,
          ownerUid: firebaseUser.uid,
          ownerEmail: email,
          companyName: companyName.trim(),
          lowStockAlertEnabled: true,
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(db, 'system', 'adminSlot'), {
          occupied: false,
          adminUid: null,
          adminEmail: null,
          updatedAt: serverTimestamp(),
        });
      }
      tx.set(doc(db, 'users', firebaseUser.uid), {
        uid: firebaseUser.uid,
        email,
        name: ownerName.trim() || firebaseUser.displayName || 'Owner Utama',
        role: 'OWNER',
        department: 'Manajemen',
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await resolveProfile(firebaseUser);
  }, [firebaseUser, resolveProfile]);

  const logout = useCallback(async () => {
    if (isSandbox) {
      window.location.href = window.location.pathname;
      return;
    }
    if (currentUser) {
      try {
        await writeAuditLogFirestore(currentUser, 'LOGOUT', 'AUTH', currentUser.uid, `${currentUser.name} (${currentUser.role}) keluar dari sistem.`);
      } catch {
        // Ignore audit failure on logout
      }
    }
    await signOut(auth);
  }, [currentUser, isSandbox, writeAuditLogFirestore]);

  const seedStarterMasters = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'OWNER' || isSandbox) return;
    const batch = writeBatch(db);
    const cats = [
      { id: 'cat_1', code: 'KAT-LGM', name: 'Bahan Baku Logam', description: 'Plat, pipa, dan profil logam' },
      { id: 'cat_2', code: 'KAT-ELK', name: 'Komponen Elektrikal', description: 'Kabel, kontaktor, relay, MCB' },
      { id: 'cat_3', code: 'KAT-KMS', name: 'Kemasan & Konsumabel', description: 'Karton, lakban, APD' },
    ];
    for (const c of cats) {
      batch.set(doc(db, 'categories', c.id), { ...c, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    const unitRows = [
      { id: 'unit_1', code: 'PCS', name: 'Pcs', description: 'Satuan per buah' },
      { id: 'unit_2', code: 'LBR', name: 'Lembar', description: 'Satuan lembaran' },
      { id: 'unit_3', code: 'BOX', name: 'Box', description: 'Satuan kotak' },
    ];
    for (const u of unitRows) {
      batch.set(doc(db, 'units', u.id), { ...u, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    batch.set(doc(db, 'suppliers', 'sup_1'), {
      id: 'sup_1',
      code: 'SUP-01',
      name: 'PT Mitra Industri Utama',
      contactPerson: 'Bagian Penjualan',
      phone: '021-5550100',
      email: 'sales@mitraindustri.co.id',
      address: 'Kawasan Industri Cikarang',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    await writeAuditLogFirestore(currentUser, 'SEED_MASTERS', 'SYSTEM', 'masters', 'Mengisi data awal Kategori, Satuan, dan Supplier.');
  }, [currentUser, isSandbox, writeAuditLogFirestore]);

  // Users & Invites (Max 1 Admin concurrency-safe)
  const saveUserInvite = useCallback(
    async (input: { name: string; email: string; role: 'ADMIN' | 'PRODUKSI'; department: string; active: boolean }) => {
      if (!currentUser || !canManageUsers(currentUser.role)) {
        throw new Error('Hanya OWNER yang dapat mengelola akun pengguna.');
      }
      const email = input.email.trim().toLowerCase();
      if (!email.includes('@')) throw new Error('Format email tidak valid.');

      const check = validateAdminSlotAvailability({
        targetRole: input.role,
        targetEmail: email,
        adminSlot: effectiveAdminSlot,
        existingUsers: effectiveUsers,
        existingInvites: effectiveInvites,
      });
      if (!check.allowed) throw new Error(check.reason);

      const inviteId = emailToInviteId(email);
      const nowIso = new Date().toISOString();

      if (isSandbox) {
        setSandboxState((prev) => {
          if (!prev) return prev;
          const existing = prev.invites.find((i) => i.id === inviteId);
          const nextInvite: UserInvite = {
            id: inviteId,
            email,
            name: input.name.trim(),
            role: input.role,
            department: input.department.trim() || (input.role === 'ADMIN' ? 'Gudang' : 'Produksi'),
            active: input.active,
            claimedUid: existing?.claimedUid ?? null,
            createdByUid: currentUser.uid,
            createdAt: existing?.createdAt ?? nowIso,
            updatedAt: nowIso,
          };
          const nextSlot: AdminSlot =
            input.role === 'ADMIN' && input.active
              ? { occupied: true, adminUid: existing?.claimedUid ?? null, adminEmail: email, updatedAt: nowIso }
              : prev.adminSlot.adminEmail === email
              ? { occupied: false, adminUid: null, adminEmail: null, updatedAt: nowIso }
              : prev.adminSlot;

          return {
            ...prev,
            adminSlot: nextSlot,
            invites: existing
              ? prev.invites.map((i) => (i.id === inviteId ? nextInvite : i))
              : [nextInvite, ...prev.invites],
            auditLogs: appendSandboxAudit(prev, currentUser, 'SAVE_USER_INVITE', 'USER_INVITE', inviteId, `Menyimpan otorisasi ${email} sebagai ${input.role}.`),
          };
        });
        return;
      }

      await runTransaction(db, async (tx) => {
        const inviteRef = doc(db, 'userInvites', inviteId);
        const slotRef = doc(db, 'system', 'adminSlot');
        const [inviteSnap, slotSnap] = await Promise.all([tx.get(inviteRef), tx.get(slotRef)]);
        const currentSlot = slotSnap.exists() ? (slotSnap.data() as AdminSlot) : { occupied: false, adminUid: null, adminEmail: null };

        if (input.role === 'ADMIN' && input.active) {
          if (currentSlot.occupied && currentSlot.adminEmail && currentSlot.adminEmail.toLowerCase() !== email) {
            throw new Error(`Slot ADMIN sudah ditempati oleh ${currentSlot.adminEmail}. Maksimal hanya 1 Admin.`);
          }
          tx.set(
            slotRef,
            {
              occupied: true,
              adminUid: currentSlot.adminUid ?? null,
              adminEmail: email,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else if (currentSlot.occupied && currentSlot.adminEmail?.toLowerCase() === email) {
          tx.set(
            slotRef,
            {
              occupied: false,
              adminUid: null,
              adminEmail: null,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        if (inviteSnap.exists()) {
          tx.update(inviteRef, {
            name: input.name.trim(),
            role: input.role,
            department: input.department.trim() || (input.role === 'ADMIN' ? 'Gudang' : 'Produksi'),
            active: input.active,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.set(inviteRef, {
            id: inviteId,
            email,
            name: input.name.trim(),
            role: input.role,
            department: input.department.trim() || (input.role === 'ADMIN' ? 'Gudang' : 'Produksi'),
            active: input.active,
            claimedUid: null,
            createdByUid: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });

      await writeAuditLogFirestore(currentUser, 'SAVE_USER_INVITE', 'USER_INVITE', inviteId, `Menyimpan otorisasi ${email} sebagai ${input.role}.`);
    },
    [appendSandboxAudit, currentUser, effectiveAdminSlot, effectiveInvites, effectiveUsers, isSandbox, writeAuditLogFirestore]
  );

  const updateUserAccountRoleOrStatus = useCallback(
    async (user: UserAccount, updates: { name: string; role: UserRole; department: string; active: boolean }) => {
      if (!currentUser || !canManageUsers(currentUser.role)) {
        throw new Error('Hanya OWNER yang dapat mengubah akun pengguna.');
      }
      if (user.uid === currentUser.uid && (updates.role !== 'OWNER' || !updates.active)) {
        throw new Error('Owner aktif tidak dapat menurunkan role atau menonaktifkan dirinya sendiri.');
      }
      if (updates.role === 'ADMIN' && updates.active) {
        const check = validateAdminSlotAvailability({
          targetRole: 'ADMIN',
          targetEmail: user.email,
          adminSlot: effectiveAdminSlot,
          existingUsers: effectiveUsers,
          existingInvites: effectiveInvites,
        });
        if (!check.allowed) throw new Error(check.reason);
      }

      const nowIso = new Date().toISOString();
      if (isSandbox) {
        setSandboxState((prev) => {
          if (!prev) return prev;
          let nextSlot = prev.adminSlot;
          if (updates.role === 'ADMIN' && updates.active) {
            nextSlot = { occupied: true, adminUid: user.uid, adminEmail: user.email, updatedAt: nowIso };
          } else if (prev.adminSlot.adminEmail?.toLowerCase() === user.email.toLowerCase()) {
            nextSlot = { occupied: false, adminUid: null, adminEmail: null, updatedAt: nowIso };
          }
          return {
            ...prev,
            adminSlot: nextSlot,
            users: prev.users.map((u) =>
              u.uid === user.uid ? { ...u, ...updates, updatedAt: nowIso } : u
            ),
            auditLogs: appendSandboxAudit(prev, currentUser, 'UPDATE_USER', 'USER', user.uid, `Memperbarui ${user.email}: role=${updates.role}, aktif=${updates.active}.`),
          };
        });
        return;
      }

      await runTransaction(db, async (tx) => {
        const slotRef = doc(db, 'system', 'adminSlot');
        const slotSnap = await tx.get(slotRef);
        const currentSlot = slotSnap.exists() ? (slotSnap.data() as AdminSlot) : { occupied: false, adminUid: null, adminEmail: null };

        if (updates.role === 'ADMIN' && updates.active) {
          if (currentSlot.occupied && currentSlot.adminEmail && currentSlot.adminEmail.toLowerCase() !== user.email.toLowerCase()) {
            throw new Error(`Slot ADMIN sudah ditempati oleh ${currentSlot.adminEmail}.`);
          }
          tx.set(
            slotRef,
            { occupied: true, adminUid: user.uid, adminEmail: user.email.toLowerCase(), updatedAt: serverTimestamp() },
            { merge: true }
          );
        } else if (currentSlot.occupied && currentSlot.adminEmail?.toLowerCase() === user.email.toLowerCase()) {
          tx.set(
            slotRef,
            { occupied: false, adminUid: null, adminEmail: null, updatedAt: serverTimestamp() },
            { merge: true }
          );
        }

        tx.update(doc(db, 'users', user.uid), {
          name: updates.name.trim(),
          role: updates.role,
          department: updates.department.trim(),
          active: updates.active,
          updatedAt: serverTimestamp(),
        });
      });

      await writeAuditLogFirestore(currentUser, 'UPDATE_USER', 'USER', user.uid, `Memperbarui ${user.email}: role=${updates.role}, aktif=${updates.active}.`);
    },
    [appendSandboxAudit, currentUser, effectiveAdminSlot, effectiveInvites, effectiveUsers, isSandbox, writeAuditLogFirestore]
  );

  // Categories, Units, Suppliers
  const saveCategory = useCallback(
    async (input: { id?: string; code: string; name: string; description: string; active: boolean }) => {
      if (!currentUser || !canEditMasterItems(currentUser.role)) throw new Error('Akses ditolak.');
      const id = input.id ?? sanitizeId(`cat_${Date.now()}`);
      const nowIso = new Date().toISOString();
      if (isSandbox) {
        setSandboxState((prev) => {
          if (!prev) return prev;
          const exists = prev.categories.some((c) => c.id === id);
          const nextObj: Category = { ...input, id, createdAt: nowIso, updatedAt: nowIso };
          return {
            ...prev,
            categories: exists ? prev.categories.map((c) => (c.id === id ? { ...c, ...input, updatedAt: nowIso } : c)) : [nextObj, ...prev.categories],
            auditLogs: appendSandboxAudit(prev, currentUser, exists ? 'UPDATE_CATEGORY' : 'CREATE_CATEGORY', 'CATEGORY', id, `Kategori ${input.name}`),
          };
        });
        return;
      }
      if (input.id) {
        await updateDoc(doc(db, 'categories', id), {
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description.trim(),
          active: input.active,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'categories', id), {
          id,
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description.trim(),
          active: input.active,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await writeAuditLogFirestore(currentUser, input.id ? 'UPDATE_CATEGORY' : 'CREATE_CATEGORY', 'CATEGORY', id, `Menyimpan kategori ${input.name}.`);
    },
    [appendSandboxAudit, currentUser, isSandbox, writeAuditLogFirestore]
  );

  const saveUnit = useCallback(
    async (input: { id?: string; code: string; name: string; description: string; active: boolean }) => {
      if (!currentUser || !canManageUnits(currentUser.role)) throw new Error('Hanya OWNER yang dapat mengelola satuan.');
      const id = input.id ?? sanitizeId(`unit_${Date.now()}`);
      const nowIso = new Date().toISOString();
      if (isSandbox) {
        setSandboxState((prev) => {
          if (!prev) return prev;
          const exists = prev.units.some((u) => u.id === id);
          const nextObj: Unit = { ...input, id, createdAt: nowIso, updatedAt: nowIso };
          return {
            ...prev,
            units: exists ? prev.units.map((u) => (u.id === id ? { ...u, ...input, updatedAt: nowIso } : u)) : [nextObj, ...prev.units],
            auditLogs: appendSandboxAudit(prev, currentUser, exists ? 'UPDATE_UNIT' : 'CREATE_UNIT', 'UNIT', id, `Satuan ${input.name}`),
          };
        });
        return;
      }
      if (input.id) {
        await updateDoc(doc(db, 'units', id), {
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description.trim(),
          active: input.active,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'units', id), {
          id,
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description.trim(),
          active: input.active,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await writeAuditLogFirestore(currentUser, input.id ? 'UPDATE_UNIT' : 'CREATE_UNIT', 'UNIT', id, `Menyimpan satuan ${input.name}.`);
    },
    [appendSandboxAudit, currentUser, isSandbox, writeAuditLogFirestore]
  );

  const saveSupplier = useCallback(
    async (input: { id?: string; code: string; name: string; contactPerson: string; phone: string; email: string; address: string; active: boolean }) => {
      if (!currentUser || !canEditMasterItems(currentUser.role)) throw new Error('Akses ditolak.');
      const id = input.id ?? sanitizeId(`sup_${Date.now()}`);
      const nowIso = new Date().toISOString();
      if (isSandbox) {
        setSandboxState((prev) => {
          if (!prev) return prev;
          const exists = prev.suppliers.some((s) => s.id === id);
          const nextObj: Supplier = { ...input, id, createdAt: nowIso, updatedAt: nowIso };
          return {
            ...prev,
            suppliers: exists ? prev.suppliers.map((s) => (s.id === id ? { ...s, ...input, updatedAt: nowIso } : s)) : [nextObj, ...prev.suppliers],
            auditLogs: appendSandboxAudit(prev, currentUser, exists ? 'UPDATE_SUPPLIER' : 'CREATE_SUPPLIER', 'SUPPLIER', id, `Supplier ${input.name}`),
          };
        });
        return;
      }
      if (input.id) {
        await updateDoc(doc(db, 'suppliers', id), {
          code: input.code.trim(),
          name: input.name.trim(),
          contactPerson: input.contactPerson.trim(),
          phone: input.phone.trim(),
          email: input.email.trim(),
          address: input.address.trim(),
          active: input.active,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'suppliers', id), {
          id,
          code: input.code.trim(),
          name: input.name.trim(),
          contactPerson: input.contactPerson.trim(),
          phone: input.phone.trim(),
          email: input.email.trim(),
          address: input.address.trim(),
          active: input.active,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await writeAuditLogFirestore(currentUser, input.id ? 'UPDATE_SUPPLIER' : 'CREATE_SUPPLIER', 'SUPPLIER', id, `Menyimpan supplier ${input.name}.`);
    },
    [appendSandboxAudit, currentUser, isSandbox, writeAuditLogFirestore]
  );

  // Master Item CRUD with Code & Barcode Uniqueness Locks
  const saveItem = useCallback(
    async (input: {
      id?: string;
      code: string;
      barcode: string;
      name: string;
      categoryId: string;
      specification: string;
      unitId: string;
      initialStock: number;
      minStock: number;
      purchasePrice: number;
      supplierId: string;
      active: boolean;
    }) => {
      if (!currentUser || !canEditMasterItems(currentUser.role)) throw new Error('Akses ditolak.');
      const uniqueness = validateItemUniqueness({
        code: input.code,
        barcode: input.barcode,
        editingItemId: input.id,
        existingItems: effectiveItems,
      });
      if (!uniqueness.valid) throw new Error(uniqueness.error);

      const category = effectiveCategories.find((c) => c.id === input.categoryId);
      const unit = effectiveUnits.find((u) => u.id === input.unitId);
      const supplier = effectiveSuppliers.find((s) => s.id === input.supplierId);
      if (!category || !unit || !supplier) throw new Error('Kategori, Satuan, dan Supplier wajib dipilih.');

      const id = input.id ?? sanitizeId(`item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      const nowIso = new Date().toISOString();

      if (isSandbox) {
        setSandboxState((prev) => {
          if (!prev) return prev;
          const existing = prev.items.find((i) => i.id === id);
          const itemObj: InventoryItem = existing
            ? {
                ...existing,
                code: input.code.trim().toUpperCase(),
                barcode: input.barcode.trim().toUpperCase(),
                name: input.name.trim(),
                categoryId: category.id,
                categoryName: category.name,
                specification: input.specification.trim(),
                unitId: unit.id,
                unitName: unit.name,
                minStock: Number(input.minStock),
                purchasePrice: Number(input.purchasePrice),
                supplierId: supplier.id,
                supplierName: supplier.name,
                active: input.active,
                updatedAt: nowIso,
              }
            : {
                id,
                code: input.code.trim().toUpperCase(),
                barcode: input.barcode.trim().toUpperCase(),
                name: input.name.trim(),
                categoryId: category.id,
                categoryName: category.name,
                specification: input.specification.trim(),
                unitId: unit.id,
                unitName: unit.name,
                initialStock: Number(input.initialStock),
                currentStock: Number(input.initialStock),
                minStock: Number(input.minStock),
                purchasePrice: Number(input.purchasePrice),
                supplierId: supplier.id,
                supplierName: supplier.name,
                active: input.active,
                hasTransactions: false,
                createdByUid: currentUser.uid,
                createdAt: nowIso,
                updatedAt: nowIso,
              };
          return {
            ...prev,
            items: existing ? prev.items.map((i) => (i.id === id ? itemObj : i)) : [itemObj, ...prev.items],
            auditLogs: appendSandboxAudit(prev, currentUser, existing ? 'UPDATE_ITEM' : 'CREATE_ITEM', 'ITEM', id, `Barang ${itemObj.code} - ${itemObj.name}`),
          };
        });
        return;
      }

      const normCode = input.code.trim().toUpperCase();
      const normBarcode = input.barcode.trim().toUpperCase();
      const codeLockRef = doc(db, 'itemCodes', normalizeCodeKey(normCode));
      const barcodeLockRef = doc(db, 'itemBarcodes', normalizeCodeKey(normBarcode));

      await runTransaction(db, async (tx) => {
        const itemRef = doc(db, 'items', id);
        const [itemSnap, codeSnap, barcodeSnap] = await Promise.all([
          tx.get(itemRef),
          tx.get(codeLockRef),
          tx.get(barcodeLockRef),
        ]);

        if (codeSnap.exists() && codeSnap.data().itemId !== id) {
          throw new Error(`Kode barang "${normCode}" sudah terdaftar di database.`);
        }
        if (barcodeSnap.exists() && barcodeSnap.data().itemId !== id) {
          throw new Error(`Barcode "${normBarcode}" sudah terdaftar di database.`);
        }

        if (itemSnap.exists()) {
          const prev = itemSnap.data() as InventoryItem;
          if (prev.code !== normCode) {
            tx.delete(doc(db, 'itemCodes', normalizeCodeKey(prev.code)));
          }
          if (prev.barcode !== normBarcode) {
            tx.delete(doc(db, 'itemBarcodes', normalizeCodeKey(prev.barcode)));
          }
          tx.set(codeLockRef, { itemId: id, value: normCode, createdAt: serverTimestamp() });
          tx.set(barcodeLockRef, { itemId: id, value: normBarcode, createdAt: serverTimestamp() });
          tx.update(itemRef, {
            code: normCode,
            barcode: normBarcode,
            name: input.name.trim(),
            categoryId: category.id,
            categoryName: category.name,
            specification: input.specification.trim(),
            unitId: unit.id,
            unitName: unit.name,
            minStock: Number(input.minStock),
            purchasePrice: Number(input.purchasePrice),
            supplierId: supplier.id,
            supplierName: supplier.name,
            active: input.active,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.set(codeLockRef, { itemId: id, value: normCode, createdAt: serverTimestamp() });
          tx.set(barcodeLockRef, { itemId: id, value: normBarcode, createdAt: serverTimestamp() });
          tx.set(itemRef, {
            id,
            code: normCode,
            barcode: normBarcode,
            name: input.name.trim(),
            categoryId: category.id,
            categoryName: category.name,
            specification: input.specification.trim(),
            unitId: unit.id,
            unitName: unit.name,
            initialStock: Number(input.initialStock),
            currentStock: Number(input.initialStock),
            minStock: Number(input.minStock),
            purchasePrice: Number(input.purchasePrice),
            supplierId: supplier.id,
            supplierName: supplier.name,
            active: input.active,
            hasTransactions: false,
            createdByUid: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });

      await writeAuditLogFirestore(currentUser, input.id ? 'UPDATE_ITEM' : 'CREATE_ITEM', 'ITEM', id, `Menyimpan barang ${normCode} (${input.name.trim()}).`);
    },
    [appendSandboxAudit, currentUser, effectiveCategories, effectiveItems, effectiveSuppliers, effectiveUnits, isSandbox, writeAuditLogFirestore]
  );

  const importItemsBatch = useCallback(
    async (
      rows: Array<{
        code: string;
        barcode: string;
        name: string;
        categoryName: string;
        specification: string;
        unitName: string;
        initialStock: number;
        minStock: number;
        purchasePrice: number;
        supplierName: string;
      }>
    ) => {
      if (!currentUser || !canEditMasterItems(currentUser.role)) throw new Error('Akses ditolak.');
      let imported = 0;
      const skipped: string[] = [];

      for (const row of rows) {
        const cat =
          effectiveCategories.find((c) => c.name.toLowerCase() === row.categoryName.toLowerCase()) ??
          effectiveCategories[0];
        const unit =
          effectiveUnits.find((u) => u.name.toLowerCase() === row.unitName.toLowerCase()) ??
          effectiveUnits[0];
        const sup =
          effectiveSuppliers.find((s) => s.name.toLowerCase() === row.supplierName.toLowerCase()) ??
          effectiveSuppliers[0];

        if (!cat || !unit || !sup) {
          skipped.push(`${row.code}: Master Kategori/Satuan/Supplier belum tersedia.`);
          continue;
        }
        try {
          await saveItem({
            code: row.code,
            barcode: row.barcode || `IMS-${row.code}`,
            name: row.name,
            categoryId: cat.id,
            specification: row.specification,
            unitId: unit.id,
            initialStock: Math.max(0, row.initialStock),
            minStock: Math.max(0, row.minStock),
            purchasePrice: Math.max(0, row.purchasePrice),
            supplierId: sup.id,
            active: true,
          });
          imported++;
        } catch (err) {
          skipped.push(`${row.code}: ${err instanceof Error ? err.message : 'Gagal impor'}`);
        }
      }
      return { imported, skipped };
    },
    [currentUser, effectiveCategories, effectiveSuppliers, effectiveUnits, saveItem]
  );

  const deleteItemPermanently = useCallback(
    async (item: InventoryItem) => {
      if (!currentUser || !canDeleteItemPermanently(currentUser.role, item)) {
        throw new Error('Barang yang memiliki riwayat transaksi tidak boleh dihapus permanen (atau role tidak diizinkan).');
      }
      if (isSandbox) {
        setSandboxState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.filter((i) => i.id !== item.id),
            auditLogs: appendSandboxAudit(prev, currentUser, 'DELETE_ITEM', 'ITEM', item.id, `Menghapus permanen barang ${item.code} - ${item.name}`),
          };
        });
        return;
      }
      await runTransaction(db, async (tx) => {
        const itemSnap = await tx.get(doc(db, 'items', item.id));
        if (!itemSnap.exists()) return;
        const latest = itemSnap.data() as InventoryItem;
        if (latest.hasTransactions) {
          throw new Error('Barang yang memiliki riwayat transaksi tidak boleh dihapus permanen.');
        }
        tx.delete(doc(db, 'items', item.id));
        tx.delete(doc(db, 'itemCodes', normalizeCodeKey(latest.code)));
        tx.delete(doc(db, 'itemBarcodes', normalizeCodeKey(latest.barcode)));
      });
      await writeAuditLogFirestore(currentUser, 'DELETE_ITEM', 'ITEM', item.id, `Menghapus permanen barang ${item.code} - ${item.name}.`);
    },
    [appendSandboxAudit, currentUser, isSandbox, writeAuditLogFirestore]
  );

  // Incoming Transactions
  const saveIncomingDraft = useCallback(
    async (input: { id?: string; date: string; supplierId: string; items: IncomingLineItem[]; notes: string }) => {
      if (!currentUser || !canEditMasterItems(currentUser.role)) throw new Error('Akses ditolak.');
      const supplier = effectiveSuppliers.find((s) => s.id === input.supplierId);
      if (!supplier) throw new Error('Supplier wajib dipilih.');
      if (input.items.length === 0) throw new Error('Minimal 1 barang harus ditambahkan.');

      const totalAmount = calculateIncomingTotal(input.items);
      const id = input.id ?? sanitizeId(`in_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      const nowIso = new Date().toISOString();
      const idempotencyKey = sanitizeId(`idem_in_${id}`);

      if (isSandbox) {
        if (!sandboxState) throw new Error('Sandbox state belum siap.');
        const existing = sandboxState.incoming.find((t) => t.id === id);
        if (existing && existing.status !== 'DRAFT') {
          throw new Error('Transaksi yang sudah dikonfirmasi tidak boleh diubah.');
        }
        const saved: IncomingTransaction = {
          id,
          txNumber: existing?.txNumber ?? generateDocNumber('BM'),
          date: input.date,
          supplierId: supplier.id,
          supplierName: supplier.name,
          items: input.items,
          totalAmount,
          notes: input.notes.trim(),
          status: 'DRAFT',
          idempotencyKey,
          createdByUid: existing?.createdByUid ?? currentUser.uid,
          createdByName: existing?.createdByName ?? currentUser.name,
          createdAt: existing?.createdAt ?? nowIso,
          updatedAt: nowIso,
        };
        setSandboxState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            incoming: existing ? prev.incoming.map((t) => (t.id === id ? saved : t)) : [saved, ...prev.incoming],
            auditLogs: appendSandboxAudit(prev, currentUser, existing ? 'UPDATE_INCOMING_DRAFT' : 'CREATE_INCOMING_DRAFT', 'INCOMING', id, `Draft ${saved.txNumber}`),
          };
        });
        return saved;
      }

      const txNumber = input.id
        ? effectiveIncoming.find((t) => t.id === input.id)?.txNumber ?? generateDocNumber('BM')
        : generateDocNumber('BM');

      if (input.id) {
        await updateDoc(doc(db, 'incomingTransactions', id), {
          date: input.date,
          supplierId: supplier.id,
          supplierName: supplier.name,
          items: input.items,
          totalAmount,
          notes: input.notes.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const batch = writeBatch(db);
        batch.set(doc(db, 'idempotencyKeys', idempotencyKey), {
          key: idempotencyKey,
          operation: 'CREATE_INCOMING',
          actorUid: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        batch.set(doc(db, 'incomingTransactions', id), {
          id,
          txNumber,
          date: input.date,
          supplierId: supplier.id,
          supplierName: supplier.name,
          items: input.items,
          totalAmount,
          notes: input.notes.trim(),
          status: 'DRAFT',
          idempotencyKey,
          createdByUid: currentUser.uid,
          createdByName: currentUser.name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      }
      await writeAuditLogFirestore(currentUser, input.id ? 'UPDATE_INCOMING_DRAFT' : 'CREATE_INCOMING_DRAFT', 'INCOMING', id, `Draft barang masuk ${txNumber}.`);

      return {
        id,
        txNumber,
        date: input.date,
        supplierId: supplier.id,
        supplierName: supplier.name,
        items: input.items,
        totalAmount,
        notes: input.notes.trim(),
        status: 'DRAFT' as const,
        idempotencyKey,
        createdByUid: currentUser.uid,
        createdByName: currentUser.name,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    },
    [appendSandboxAudit, currentUser, effectiveIncoming, effectiveSuppliers, isSandbox, writeAuditLogFirestore]
  );

  const confirmIncomingTransaction = useCallback(
    async (txRecord: IncomingTransaction) => {
      if (!currentUser || !canEditMasterItems(currentUser.role)) throw new Error('Akses ditolak.');
      const nowIso = new Date().toISOString();

      if (isSandbox) {
        if (!sandboxState) throw new Error('Sandbox state belum siap.');
        const map = new Map(sandboxState.items.map((i) => [i.id, i]));
        const res = applyIncomingConfirmation({
          tx: txRecord,
          itemsById: map,
          actor: { uid: currentUser.uid, name: currentUser.name },
          usedIdempotencyKeys: usedSandboxKeys,
          nowIso,
        });
        usedSandboxKeys.add(`confirm_${txRecord.id}`);
        setSandboxState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: Array.from(map.values()),
            incoming: prev.incoming.map((t) => (t.id === txRecord.id ? res.updatedTx : t)),
            ledger: [...res.ledgerEntries, ...prev.ledger],
            auditLogs: appendSandboxAudit(prev, currentUser, 'CONFIRM_INCOMING', 'INCOMING', txRecord.id, `Konfirmasi barang masuk ${txRecord.txNumber}`),
          };
        });
        return;
      }

      const confirmKey = sanitizeId(`confirm_${txRecord.id}`);
      await runTransaction(db, async (tx) => {
        const keyRef = doc(db, 'idempotencyKeys', confirmKey);
        const txRef = doc(db, 'incomingTransactions', txRecord.id);
        const [keySnap, txSnap] = await Promise.all([tx.get(keyRef), tx.get(txRef)]);
        if (keySnap.exists()) throw new Error('Konfirmasi ganda dicegah.');
        if (!txSnap.exists()) throw new Error('Transaksi tidak ditemukan.');
        const latestTx = normalizeDocDates(txSnap.data() as Record<string, unknown>) as unknown as IncomingTransaction;

        const itemSnaps = await Promise.all(latestTx.items.map((l) => tx.get(doc(db, 'items', l.itemId))));
        const map = new Map<string, InventoryItem>();
        itemSnaps.forEach((snap) => {
          if (snap.exists()) {
            const it = normalizeDocDates(snap.data() as Record<string, unknown>) as unknown as InventoryItem;
            map.set(it.id, it);
          }
        });

        const res = applyIncomingConfirmation({
          tx: latestTx,
          itemsById: map,
          actor: { uid: currentUser.uid, name: currentUser.name },
          usedIdempotencyKeys: new Set(),
          nowIso,
        });

        tx.set(keyRef, {
          key: confirmKey,
          operation: 'CONFIRM_INCOMING',
          actorUid: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        tx.update(txRef, {
          status: 'CONFIRMED',
          confirmedByUid: currentUser.uid,
          confirmedByName: currentUser.name,
          confirmedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        for (const item of res.updatedItems) {
          tx.update(doc(db, 'items', item.id), {
            currentStock: item.currentStock,
            hasTransactions: true,
            updatedAt: serverTimestamp(),
          });
        }
        for (const led of res.ledgerEntries) {
          tx.set(doc(db, 'stockLedgers', led.id), {
            ...led,
            createdAt: serverTimestamp(),
          });
        }
      });

      await writeAuditLogFirestore(currentUser, 'CONFIRM_INCOMING', 'INCOMING', txRecord.id, `Konfirmasi barang masuk ${txRecord.txNumber}.`);
    },
    [appendSandboxAudit, currentUser, isSandbox, usedSandboxKeys, writeAuditLogFirestore]
  );

  const reverseIncomingTransaction = useCallback(
    async (txRecord: IncomingTransaction, reason: string) => {
      if (!currentUser || !canEditMasterItems(currentUser.role)) throw new Error('Akses ditolak.');
      const nowIso = new Date().toISOString();
      const reversalId = sanitizeId(`rev_${txRecord.id}_${Date.now()}`);
      const reversalTxNumber = `REV-${txRecord.txNumber}`;
      const idempotencyKey = sanitizeId(`idem_rev_${txRecord.id}`);

      if (isSandbox) {
        if (!sandboxState) throw new Error('Sandbox state belum siap.');
        const map = new Map(sandboxState.items.map((i) => [i.id, i]));
        const res = createIncomingReversal({
          originalTx: txRecord,
          itemsById: map,
          actor: { uid: currentUser.uid, name: currentUser.name },
          reason,
          reversalId,
          reversalTxNumber,
          idempotencyKey,
          usedIdempotencyKeys: usedSandboxKeys,
          nowIso,
        });
        usedSandboxKeys.add(idempotencyKey);
        setSandboxState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: Array.from(map.values()),
            incoming: [res.reversalTx, ...prev.incoming.map((t) => (t.id === txRecord.id ? res.markedOriginalTx : t))],
            ledger: [...res.ledgerEntries, ...prev.ledger],
            auditLogs: appendSandboxAudit(prev, currentUser, 'REVERSE_INCOMING', 'INCOMING', reversalId, `Pembalikan ${txRecord.txNumber}: ${reason}`),
          };
        });
        return;
      }

      await runTransaction(db, async (tx) => {
        const keyRef = doc(db, 'idempotencyKeys', idempotencyKey);
        const origRef = doc(db, 'incomingTransactions', txRecord.id);
        const [keySnap, origSnap] = await Promise.all([tx.get(keyRef), tx.get(origRef)]);
        if (keySnap.exists()) throw new Error('Transaksi sudah dibalik sebelumnya.');
        if (!origSnap.exists()) throw new Error('Transaksi asal tidak ditemukan.');
        const latestOrig = normalizeDocDates(origSnap.data() as Record<string, unknown>) as unknown as IncomingTransaction;

        const itemSnaps = await Promise.all(latestOrig.items.map((l) => tx.get(doc(db, 'items', l.itemId))));
        const map = new Map<string, InventoryItem>();
        itemSnaps.forEach((snap) => {
          if (snap.exists()) {
            const it = normalizeDocDates(snap.data() as Record<string, unknown>) as unknown as InventoryItem;
            map.set(it.id, it);
          }
        });

        const res = createIncomingReversal({
          originalTx: latestOrig,
          itemsById: map,
          actor: { uid: currentUser.uid, name: currentUser.name },
          reason,
          reversalId,
          reversalTxNumber,
          idempotencyKey,
          usedIdempotencyKeys: new Set(),
          nowIso,
        });

        tx.set(keyRef, {
          key: idempotencyKey,
          operation: 'REVERSE_INCOMING',
          actorUid: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        tx.update(origRef, { status: 'REVERSED', updatedAt: serverTimestamp() });
        tx.set(doc(db, 'incomingTransactions', reversalId), {
          ...res.reversalTx,
          confirmedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        for (const item of res.updatedItems) {
          tx.update(doc(db, 'items', item.id), {
            currentStock: item.currentStock,
            hasTransactions: true,
            updatedAt: serverTimestamp(),
          });
        }
        for (const led of res.ledgerEntries) {
          tx.set(doc(db, 'stockLedgers', led.id), { ...led, createdAt: serverTimestamp() });
        }
      });

      await writeAuditLogFirestore(currentUser, 'REVERSE_INCOMING', 'INCOMING', reversalId, `Membalik transaksi ${txRecord.txNumber}: ${reason}`);
    },
    [appendSandboxAudit, currentUser, isSandbox, usedSandboxKeys, writeAuditLogFirestore]
  );

  // Stock Requests -> Review -> Deliveries
  const submitStockRequest = useCallback(
    async (input: { department: string; notes: string; items: Array<{ itemId: string; requestedQty: number }> }) => {
      if (!currentUser) throw new Error('Belum terautentikasi.');
      if (input.items.length === 0) throw new Error('Pilih minimal 1 barang.');

      const lines = input.items.map((entry) => {
        const master = effectiveItems.find((i) => i.id === entry.itemId);
        if (!master) throw new Error('Barang tidak ditemukan.');
        if (entry.requestedQty <= 0) throw new Error(`Jumlah untuk ${master.name} harus > 0.`);
        return {
          itemId: master.id,
          itemCode: master.code,
          itemName: master.name,
          unitName: master.unitName,
          requestedQty: Number(entry.requestedQty),
          approvedQty: 0,
          deliveredQty: 0,
        };
      });

      const id = sanitizeId(`req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      const requestNumber = generateDocNumber('REQ');
      const nowIso = new Date().toISOString();

      const newReq: StockRequest = {
        id,
        requestNumber,
        requesterUid: currentUser.uid,
        requesterName: currentUser.name,
        department: input.department.trim() || currentUser.department || 'Produksi',
        notes: input.notes.trim(),
        status: 'MENUNGGU_PERSETUJUAN',
        items: lines,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const notifId = sanitizeId(`notif_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`);
      const notif: NotificationItem = {
        id: notifId,
        targetRole: 'ADMIN',
        type: 'NEW_REQUEST',
        title: `Permintaan Baru ${requestNumber}`,
        message: `${currentUser.name} mengajukan ${lines.length} jenis barang.`,
        linkView: 'requests',
        relatedId: id,
        readBy: [],
        createdAt: nowIso,
      };

      if (isSandbox) {
        setSandboxState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            requests: [newReq, ...prev.requests],
            notifications: [notif, ...prev.notifications],
            auditLogs: appendSandboxAudit(prev, currentUser, 'CREATE_REQUEST', 'REQUEST', id, `Mengajukan permintaan ${requestNumber}`),
          };
        });
        return;
      }

      const batch = writeBatch(db);
      batch.set(doc(db, 'stockRequests', id), {
        ...newReq,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'notifications', notifId), {
        ...notif,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      await writeAuditLogFirestore(currentUser, 'CREATE_REQUEST', 'REQUEST', id, `Mengajukan permintaan ${requestNumber}.`);
    },
    [appendSandboxAudit, currentUser, effectiveItems, isSandbox, writeAuditLogFirestore]
  );

  const reviewRequest = useCallback(
    async (input: {
      request: StockRequest;
      decision: 'APPROVE' | 'REJECT';
      approvedQuantities?: Record<string, number>;
      rejectionReason?: string;
    }) => {
      if (!currentUser || !canApproveOrDeliver(currentUser.role)) throw new Error('Akses ditolak.');
      const nowIso = new Date().toISOString();
      const reviewed = reviewStockRequest({
        request: input.request,
        decision: input.decision,
        approvedQuantities: input.approvedQuantities,
        markReadyImmediately: true,
        rejectionReason: input.rejectionReason,
        actor: { uid: currentUser.uid, name: currentUser.name, role: currentUser.role },
        nowIso,
      });

      const notifId = sanitizeId(`notif_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`);
      const notif: NotificationItem = {
        id: notifId,
        targetRole: 'PRODUKSI',
        targetUid: input.request.requesterUid,
        type: input.decision === 'APPROVE' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
        title:
          input.decision === 'APPROVE'
            ? `Permintaan ${input.request.requestNumber} Disetujui`
            : `Permintaan ${input.request.requestNumber} Ditolak`,
        message:
          input.decision === 'APPROVE'
            ? `Disetujui oleh ${currentUser.name} dan siap diambil di gudang.`
            : `Ditolak: ${input.rejectionReason}`,
        linkView: 'history',
        relatedId: input.request.id,
        readBy: [],
        createdAt: nowIso,
      };

      if (isSandbox) {
        setSandboxState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            requests: prev.requests.map((r) => (r.id === input.request.id ? reviewed : r)),
            notifications: [notif, ...prev.notifications],
            auditLogs: appendSandboxAudit(
              prev,
              currentUser,
              input.decision === 'APPROVE' ? 'APPROVE_REQUEST' : 'REJECT_REQUEST',
              'REQUEST',
              input.request.id,
              `${input.decision === 'APPROVE' ? 'Menyetujui' : 'Menolak'} ${input.request.requestNumber}`
            ),
          };
        });
        return;
      }

      const batch = writeBatch(db);
      batch.update(doc(db, 'stockRequests', input.request.id), {
        status: reviewed.status,
        items: reviewed.items,
        approvedByUid: reviewed.approvedByUid,
        approvedByName: reviewed.approvedByName,
        approvedAt: serverTimestamp(),
        rejectionReason: reviewed.rejectionReason ?? null,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'notifications', notifId), {
        ...notif,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      await writeAuditLogFirestore(
        currentUser,
        input.decision === 'APPROVE' ? 'APPROVE_REQUEST' : 'REJECT_REQUEST',
        'REQUEST',
        input.request.id,
        `${input.decision === 'APPROVE' ? 'Menyetujui' : 'Menolak'} permintaan ${input.request.requestNumber}.`
      );
    },
    [appendSandboxAudit, currentUser, isSandbox, writeAuditLogFirestore]
  );

  const cancelRequest = useCallback(
    async (request: StockRequest) => {
      if (!currentUser) throw new Error('Belum login.');
      if (request.status !== 'MENUNGGU_PERSETUJUAN') {
        throw new Error('Hanya permintaan yang masih menunggu persetujuan yang bisa dibatalkan.');
      }
      if (!canApproveOrDeliver(currentUser.role) && request.requesterUid !== currentUser.uid) {
        throw new Error('Tidak memiliki izin membatalkan permintaan ini.');
      }
      const nowIso = new Date().toISOString();
      if (isSandbox) {
        setSandboxState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            requests: prev.requests.map((r) =>
              r.id === request.id ? { ...r, status: 'DIBATALKAN', updatedAt: nowIso } : r
            ),
            auditLogs: appendSandboxAudit(prev, currentUser, 'CANCEL_REQUEST', 'REQUEST', request.id, `Membatalkan ${request.requestNumber}`),
          };
        });
        return;
      }
      await updateDoc(doc(db, 'stockRequests', request.id), {
        status: 'DIBATALKAN',
        updatedAt: serverTimestamp(),
      });
      await writeAuditLogFirestore(currentUser, 'CANCEL_REQUEST', 'REQUEST', request.id, `Membatalkan ${request.requestNumber}.`);
    },
    [appendSandboxAudit, currentUser, isSandbox, writeAuditLogFirestore]
  );

  const confirmStockDelivery = useCallback(
    async (input: { request: StockRequest; deliverQuantities: Record<string, number>; notes: string }) => {
      if (!currentUser || !canApproveOrDeliver(currentUser.role)) throw new Error('Akses ditolak.');
      const nowIso = new Date().toISOString();
      const deliveryId = sanitizeId(`del_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      const deliveryNumber = generateDocNumber('SJ');
      const stockOutNumber = generateDocNumber('BK');
      const idempotencyKey = sanitizeId(`idem_del_${deliveryId}`);

      if (isSandbox) {
        if (!sandboxState) throw new Error('Sandbox state belum siap.');
        const map = new Map(sandboxState.items.map((i) => [i.id, i]));
        const res = processStockDelivery({
          request: input.request,
          deliverQuantities: input.deliverQuantities,
          itemsById: map,
          actor: { uid: currentUser.uid, name: currentUser.name, role: currentUser.role },
          notes: input.notes,
          deliveryId,
          deliveryNumber,
          stockOutNumber,
          idempotencyKey,
          usedIdempotencyKeys: usedSandboxKeys,
          nowIso,
        });
        usedSandboxKeys.add(idempotencyKey);

        const extraNotifs: NotificationItem[] = [
          {
            id: sanitizeId(`notif_del_${Date.now()}`),
            targetRole: 'PRODUKSI',
            targetUid: input.request.requesterUid,
            type: 'DELIVERY_CONFIRMED',
            title: `Penyerahan ${deliveryNumber} (${res.updatedRequest.status === 'SELESAI' ? 'Selesai' : 'Bertahap'})`,
            message: `${res.deliveryRecord.items.map((l) => `${l.itemName} ${l.deliveredQty} ${l.unitName}`).join(', ')} telah diserahkan.`,
            linkView: 'history',
            relatedId: input.request.id,
            readBy: [],
            createdAt: nowIso,
          },
        ];

        for (const updatedItem of res.updatedItems) {
          if (updatedItem.currentStock <= updatedItem.minStock) {
            extraNotifs.push({
              id: sanitizeId(`notif_low_${updatedItem.id}_${Date.now()}`),
              targetRole: 'OWNER',
              type: 'LOW_STOCK',
              title: updatedItem.currentStock <= 0 ? `Stok Habis: ${updatedItem.name}` : `Stok Minimum: ${updatedItem.name}`,
              message: `Sisa stok saat ini ${updatedItem.currentStock} ${updatedItem.unitName} (Min: ${updatedItem.minStock}).`,
              linkView: 'items',
              relatedId: updatedItem.id,
              readBy: [],
              createdAt: nowIso,
            });
          }
        }

        setSandboxState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: Array.from(map.values()),
            requests: prev.requests.map((r) => (r.id === input.request.id ? res.updatedRequest : r)),
            deliveries: [res.deliveryRecord, ...prev.deliveries],
            ledger: [...res.ledgerEntries, ...prev.ledger],
            notifications: [...extraNotifs, ...prev.notifications],
            auditLogs: appendSandboxAudit(prev, currentUser, 'DELIVER_STOCK', 'DELIVERY', deliveryId, `Penyerahan ${deliveryNumber} (${stockOutNumber}) untuk ${input.request.requestNumber}`),
          };
        });
        return res.deliveryRecord;
      }

      let createdDelivery!: DeliveryRecord;
      await runTransaction(db, async (tx) => {
        const keyRef = doc(db, 'idempotencyKeys', idempotencyKey);
        const reqRef = doc(db, 'stockRequests', input.request.id);
        const [keySnap, reqSnap] = await Promise.all([tx.get(keyRef), tx.get(reqRef)]);
        if (keySnap.exists()) throw new Error('Penyerahan ganda terdeteksi.');
        if (!reqSnap.exists()) throw new Error('Permintaan tidak ditemukan.');

        const latestReq = normalizeDocDates(reqSnap.data() as Record<string, unknown>) as unknown as StockRequest;
        const itemSnaps = await Promise.all(latestReq.items.map((l) => tx.get(doc(db, 'items', l.itemId))));
        const map = new Map<string, InventoryItem>();
        itemSnaps.forEach((snap) => {
          if (snap.exists()) {
            const it = normalizeDocDates(snap.data() as Record<string, unknown>) as unknown as InventoryItem;
            map.set(it.id, it);
          }
        });

        const res = processStockDelivery({
          request: latestReq,
          deliverQuantities: input.deliverQuantities,
          itemsById: map,
          actor: { uid: currentUser.uid, name: currentUser.name, role: currentUser.role },
          notes: input.notes,
          deliveryId,
          deliveryNumber,
          stockOutNumber,
          idempotencyKey,
          usedIdempotencyKeys: new Set(),
          nowIso,
        });
        createdDelivery = res.deliveryRecord;

        tx.set(keyRef, {
          key: idempotencyKey,
          operation: 'DELIVER_STOCK',
          actorUid: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        tx.set(doc(db, 'deliveries', deliveryId), {
          ...res.deliveryRecord,
          createdAt: serverTimestamp(),
        });
        tx.update(reqRef, {
          status: res.updatedRequest.status,
          items: res.updatedRequest.items,
          updatedAt: serverTimestamp(),
        });
        for (const item of res.updatedItems) {
          tx.update(doc(db, 'items', item.id), {
            currentStock: item.currentStock,
            hasTransactions: true,
            updatedAt: serverTimestamp(),
          });
          if (item.currentStock <= item.minStock) {
            const lowId = sanitizeId(`notif_low_${item.id}_${Date.now()}`);
            tx.set(doc(db, 'notifications', lowId), {
              id: lowId,
              targetRole: 'OWNER',
              targetUid: null,
              type: 'LOW_STOCK',
              title: item.currentStock <= 0 ? `Stok Habis: ${item.name}` : `Stok Minimum: ${item.name}`,
              message: `Sisa stok ${item.currentStock} ${item.unitName} (Min: ${item.minStock}).`,
              linkView: 'items',
              relatedId: item.id,
              readBy: [],
              createdAt: serverTimestamp(),
            });
          }
        }
        for (const led of res.ledgerEntries) {
          tx.set(doc(db, 'stockLedgers', led.id), {
            ...led,
            createdAt: serverTimestamp(),
          });
        }
        const prodNotifId = sanitizeId(`notif_del_${Date.now()}`);
        tx.set(doc(db, 'notifications', prodNotifId), {
          id: prodNotifId,
          targetRole: 'PRODUKSI',
          targetUid: latestReq.requesterUid,
          type: 'DELIVERY_CONFIRMED',
          title: `Penyerahan ${deliveryNumber}`,
          message: `Barang untuk ${latestReq.requestNumber} telah diserahkan (${res.updatedRequest.status}).`,
          linkView: 'history',
          relatedId: latestReq.id,
          readBy: [],
          createdAt: serverTimestamp(),
        });
      });

      await writeAuditLogFirestore(
        currentUser,
        'DELIVER_STOCK',
        'DELIVERY',
        deliveryId,
        `Konfirmasi penyerahan ${deliveryNumber} (${stockOutNumber}) untuk ${input.request.requestNumber}.`
      );
      return createdDelivery;
    },
    [appendSandboxAudit, currentUser, isSandbox, usedSandboxKeys, writeAuditLogFirestore]
  );

  // Stock Adjustment (Owner only)
  const submitStockAdjustment = useCallback(
    async (input: { item: InventoryItem; type: AdjustmentType; value: number; reason: string }) => {
      if (!currentUser || !canAdjustStock(currentUser.role)) throw new Error('Hanya OWNER yang dapat menyesuaikan stok.');
      const nowIso = new Date().toISOString();
      const adjustmentId = sanitizeId(`adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      const txNumber = generateDocNumber('ADJ');
      const idempotencyKey = sanitizeId(`idem_adj_${adjustmentId}`);

      if (isSandbox) {
        if (!sandboxState) throw new Error('Sandbox state belum siap.');
        const res = applyStockAdjustment({
          item: input.item,
          type: input.type,
          value: input.value,
          reason: input.reason,
          actor: { uid: currentUser.uid, name: currentUser.name, role: currentUser.role },
          adjustmentId,
          txNumber,
          idempotencyKey,
          usedIdempotencyKeys: usedSandboxKeys,
          nowIso,
        });
        usedSandboxKeys.add(idempotencyKey);
        setSandboxState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((i) => (i.id === input.item.id ? res.updatedItem : i)),
            adjustments: [res.adjustment, ...prev.adjustments],
            ledger: [res.ledgerEntry, ...prev.ledger],
            auditLogs: appendSandboxAudit(prev, currentUser, 'STOCK_ADJUSTMENT', 'ADJUSTMENT', adjustmentId, `Penyesuaian ${input.item.code}: ${res.adjustment.previousStock} -> ${res.adjustment.newStock}`),
          };
        });
        return;
      }

      await runTransaction(db, async (tx) => {
        const keyRef = doc(db, 'idempotencyKeys', idempotencyKey);
        const itemRef = doc(db, 'items', input.item.id);
        const [keySnap, itemSnap] = await Promise.all([tx.get(keyRef), tx.get(itemRef)]);
        if (keySnap.exists()) throw new Error('Penyesuaian ganda terdeteksi.');
        if (!itemSnap.exists()) throw new Error('Barang tidak ditemukan.');
        const latestItem = normalizeDocDates(itemSnap.data() as Record<string, unknown>) as unknown as InventoryItem;

        const res = applyStockAdjustment({
          item: latestItem,
          type: input.type,
          value: input.value,
          reason: input.reason,
          actor: { uid: currentUser.uid, name: currentUser.name, role: currentUser.role },
          adjustmentId,
          txNumber,
          idempotencyKey,
          usedIdempotencyKeys: new Set(),
          nowIso,
        });

        tx.set(keyRef, {
          key: idempotencyKey,
          operation: 'STOCK_ADJUSTMENT',
          actorUid: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        tx.set(doc(db, 'stockAdjustments', adjustmentId), {
          ...res.adjustment,
          createdAt: serverTimestamp(),
        });
        tx.update(itemRef, {
          currentStock: res.updatedItem.currentStock,
          hasTransactions: true,
          updatedAt: serverTimestamp(),
        });
        tx.set(doc(db, 'stockLedgers', res.ledgerEntry.id), {
          ...res.ledgerEntry,
          createdAt: serverTimestamp(),
        });
      });

      await writeAuditLogFirestore(currentUser, 'STOCK_ADJUSTMENT', 'ADJUSTMENT', adjustmentId, `Penyesuaian stok ${input.item.code}: ${input.reason}`);
    },
    [appendSandboxAudit, currentUser, isSandbox, usedSandboxKeys, writeAuditLogFirestore]
  );

  const markNotificationAsRead = useCallback(
    async (notif: NotificationItem) => {
      if (!currentUser || notif.readBy.includes(currentUser.uid)) return;
      const nextRead = [...notif.readBy, currentUser.uid].slice(0, 50);
      if (isSandbox) {
        setSandboxState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            notifications: prev.notifications.map((n) => (n.id === notif.id ? { ...n, readBy: nextRead } : n)),
          };
        });
        return;
      }
      await updateDoc(doc(db, 'notifications', notif.id), { readBy: nextRead });
    },
    [currentUser, isSandbox]
  );

  const updateSystemSettings = useCallback(
    async (input: { companyName: string; lowStockAlertEnabled: boolean }) => {
      if (!currentUser || currentUser.role !== 'OWNER') throw new Error('Hanya OWNER yang dapat mengubah pengaturan sistem.');
      const nowIso = new Date().toISOString();
      if (isSandbox) {
        setSandboxState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            systemConfig: {
              ...prev.systemConfig,
              companyName: input.companyName.trim(),
              lowStockAlertEnabled: input.lowStockAlertEnabled,
              updatedAt: nowIso,
            },
            auditLogs: appendSandboxAudit(prev, currentUser, 'UPDATE_SETTINGS', 'SYSTEM', 'config', `Memperbarui pengaturan perusahaan (${input.companyName})`),
          };
        });
        return;
      }
      await updateDoc(doc(db, 'system', 'config'), {
        companyName: input.companyName.trim(),
        lowStockAlertEnabled: input.lowStockAlertEnabled,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLogFirestore(currentUser, 'UPDATE_SETTINGS', 'SYSTEM', 'config', `Memperbarui pengaturan perusahaan: ${input.companyName}`);
    },
    [appendSandboxAudit, currentUser, isSandbox, writeAuditLogFirestore]
  );

  const exportBackupJson = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      systemConfig: effectiveSystemConfig,
      categories: effectiveCategories,
      units: effectiveUnits,
      suppliers: effectiveSuppliers,
      items: effectiveItems,
      incomingTransactions: effectiveIncoming,
      stockRequests: effectiveRequests,
      deliveries: effectiveDeliveries,
      stockAdjustments: effectiveAdjustments,
      stockLedgers: effectiveLedger,
      auditLogs: effectiveAuditLogs,
    };
    return JSON.stringify(payload, null, 2);
  }, [
    effectiveAdjustments,
    effectiveAuditLogs,
    effectiveCategories,
    effectiveDeliveries,
    effectiveIncoming,
    effectiveItems,
    effectiveLedger,
    effectiveRequests,
    effectiveSuppliers,
    effectiveSystemConfig,
    effectiveUnits,
  ]);

  const value: InventoryContextValue = {
    isSandbox,
    authStage,
    firebaseUser,
    currentUser,
    authError,
    systemConfig: effectiveSystemConfig,
    adminSlot: effectiveAdminSlot,
    users: effectiveUsers,
    invites: effectiveInvites,
    categories: effectiveCategories,
    units: effectiveUnits,
    suppliers: effectiveSuppliers,
    items: effectiveItems,
    incoming: effectiveIncoming,
    requests: effectiveRequests,
    deliveries: effectiveDeliveries,
    adjustments: effectiveAdjustments,
    ledger: effectiveLedger,
    notifications: effectiveNotifications,
    auditLogs: effectiveAuditLogs,
    activeRoute,
    setActiveRoute,
    scannerDraftCart,
    addToScannerDraftCart,
    clearScannerDraftCart,
    loginWithGoogle,
    loginWithEmail,
    resendVerificationEmail,
    initializeFirstOwner,
    logout,
    saveUserInvite,
    updateUserAccountRoleOrStatus,
    saveCategory,
    saveUnit,
    saveSupplier,
    saveItem,
    importItemsBatch,
    deleteItemPermanently,
    saveIncomingDraft,
    confirmIncomingTransaction,
    reverseIncomingTransaction,
    submitStockRequest,
    reviewRequest,
    cancelRequest,
    confirmStockDelivery,
    submitStockAdjustment,
    markNotificationAsRead,
    updateSystemSettings,
    exportBackupJson,
    seedStarterMasters,
  };

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}
