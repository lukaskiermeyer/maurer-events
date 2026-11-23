"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useDialog } from "@/components/ui/Dialog";
import DropZone from "@/components/ui/DropZone";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { updateEvent } from "@/app/actions/events";
import { translateTextsNow } from "@/app/actions/translations";
import LocalizedFields, { type Lang, type LocValues } from "@/components/admin/LocalizedFields";
import { uploadImage } from "@/lib/client-image-upload";
import { assignTableToReservation, updateReservationStatus, createManualReservation } from "@/app/actions/reservations";
import { assignPlanTable } from "@/app/actions/plans";
import { findTable, planTables, tableLabel } from "@/lib/plan-types";
import EventPlanPanel from "./EventPlanPanel";
import type { EventRecord, ReservationRow, TableRecord, GalleryImage, WaitlistEntry, EventSettings, TentDimensions, PackagePreset, EventDocument, PlanPresetRecord } from '@/types/domain';
import type { ScannerGrant } from '@/components/admin/ScannerAccessPanel';


import { removeGalleryImage, addGalleryImage, getOrCreateEventAlbum } from "@/app/actions/gallery";
import { notifyWaitlistEntry, removeWaitlistEntry } from "@/app/actions/waitlist";
import { findCustomersNearEvent, saveEventInviteTemplate, sendEventInvitations, sendInviteTestMail } from "@/app/actions/eventInvitations";
import { DEFAULT_INVITE_BODY, DEFAULT_INVITE_SUBJECT, INVITE_PLACEHOLDERS, renderInviteMail } from "@/lib/invite-template";
import { updateEventSettings } from "@/app/actions/eventSettings";
import { deletePackagePreset, getPackagePresets, savePackagePreset, saveTaxStatus } from "@/app/actions/settings";
import ScannerAccessPanel from '@/components/admin/ScannerAccessPanel';
import EventDocumentsPanel from '@/components/admin/EventDocumentsPanel';
import { ADMIN_TRANSITIONS } from '@/lib/reservation-policy';
import { resolveReservationMode } from '@/lib/reservation-mode';
import { formatEuroCents, packageTax, type TaxStatus } from '@/lib/pricing';
import type { CustomerRecord } from '@/types/domain';

type DashboardTab = "overview" | "reservations" | "tables" | "documents" | "settings" | "waitlist" | "team" | "gallery" | "invitations";
const statusNames: Record<string, string> = { pending: 'Ausstehend', paid: 'Bezahlt', confirmed: 'Bestätigt', checked_in: 'Eingecheckt', cancelled: 'Storniert', expired: 'Abgelaufen', refunded: 'Erstattet', payment_pending: 'Zahlung wird verarbeitet', payment_review: 'Zahlung prüfen', disputed: 'Zahlung angefochten', requested: 'Anfrage offen', declined: 'Abgelehnt' };
const statusOptions = (status: string) => [status, ...(ADMIN_TRANSITIONS[status] || [])].filter(next => next !== 'checked_in' || next === status);
function taxSummaryPrefix(status: TaxStatus) {
  return status === 'small_business' ? 'Ohne USt. (§ 19 UStG):' : 'Steuer:';
}

// Online-Buchung ist noch nicht aktiviert; die zugehörigen Einstellungen bleiben
// ausgeblendet, bis der Flow scharf geschaltet wird. Werte bleiben beim Speichern erhalten.
const ONLINE_BOOKING_SETTINGS_VISIBLE = false;

interface EventDetailProps {
  event: EventRecord;
  initialReservations: ReservationRow[];
  initialTables: TableRecord[];
  tentSettings: TentDimensions;
  initialGallery?: GalleryImage[];
  initialWaitlist?: WaitlistEntry[];
  initialEventSettings?: EventSettings;
  initialPackagePresets?: PackagePreset[];
  taxStatus?: TaxStatus;
  initialDocuments?: EventDocument[];
  scannerGrants?: ScannerGrant[];
  customers?: CustomerRecord[];
  stripeEnabled?: boolean;
  planPreset?: PlanPresetRecord | null;
  planPresets?: PlanPresetRecord[];
}

export default function EventDetailDashboard({ event, initialReservations, initialTables, initialGallery = [], initialWaitlist = [], initialEventSettings, initialPackagePresets = [], taxStatus: initialTaxStatus = 'standard', initialDocuments = [], scannerGrants = [], stripeEnabled = false, planPreset = null, planPresets = [] }: EventDetailProps) {
  const toast = useToast();
  const dialog = useDialog();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(initialTaxStatus);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const requestCount = initialReservations.filter(row => row.reservation.status === 'requested').length;

  // Customer invitation state
  const [inviteRadius, setInviteRadius] = useState(50);
  const [inviteManualLocation, setInviteManualLocation] = useState("");
  const [inviteUseMap, setInviteUseMap] = useState<boolean>(!!event.mapUrl || !!event.location);
  const [inviteMarketingOnly, setInviteMarketingOnly] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResults, setInviteResults] = useState<Array<{ customer: CustomerRecord; distanceKm: number }>>([]);
  const [inviteCenter, setInviteCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [inviteSelected, setInviteSelected] = useState<string[]>([]);
  const [inviteTplOpen, setInviteTplOpen] = useState(false);
  const [inviteTplBusy, setInviteTplBusy] = useState(false);
  const [inviteSubject, setInviteSubject] = useState(event.inviteSubject ?? DEFAULT_INVITE_SUBJECT);
  const [inviteBody, setInviteBody] = useState(event.inviteBody ?? DEFAULT_INVITE_BODY);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [formData, setFormData] = useState({
    title: event.title,
    date: new Date(event.date).toISOString().split('T')[0],
    endDate: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : "",
    reservableDates: event.reservableDates || ([] as string[]),
    location: event.location,
    zip: event.zip || "",
    description: event.description,
    imageUrl: event.imageUrl || "",
    mapUrl: event.mapUrl || "",
    link: event.link,
    reservable: event.reservable,
    allowTableSelection: event.allowTableSelection ?? true,
    reservationMode: resolveReservationMode(event),
    reservationEmail: event.reservationEmail,
    reservationNote: event.reservationNote || "",
    maxCapacity: event.maxCapacity || 0,
    walkInReserve: event.walkInReserve || 0,
    isPublished: event.isPublished ?? true,
    titleEn: event.titleEn || "",
    titleBar: event.titleBar || "",
    locationEn: event.locationEn || "",
    locationBar: event.locationBar || "",
    descriptionEn: event.descriptionEn || "",
    descriptionBar: event.descriptionBar || ""
  });

  const [file, setFile] = useState<File | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  const [settingsData, setSettingsData] = useState({
    requireFullTable: initialEventSettings?.requireFullTable ?? true,
    timeSlots: initialEventSettings?.timeSlots ?? ['17:00', '18:00', '19:00'],
    packages: initialEventSettings?.packages ?? [
      { id: 'brotzeit', name: 'Brotzeit-Paket', price: 25, description: '1 Maß & 1 halbes Hendl', popular: false },
      { id: 'vollgas', name: 'Vollgas-Paket', price: 50, description: '2 Maß, 1 Hauptgericht & 1 Schnaps', popular: true }
    ],
    cancellationDays: initialEventSettings?.cancellationDays ?? 7,
    maxBookingsPerEmail: initialEventSettings?.maxBookingsPerEmail ?? 2,
    customServiceFee: initialEventSettings?.customServiceFee ?? false,
    serviceFeePercent: initialEventSettings?.serviceFeePercent ?? 1.5,
    serviceFeeFixedCents: initialEventSettings?.serviceFeeFixedCents ?? 25,
    bookingWindowStartDays: initialEventSettings?.bookingWindowStartDays ?? 90,
    bookingWindowEndHours: initialEventSettings?.bookingWindowEndHours ?? 2,
    autoSendTicket: initialEventSettings?.autoSendTicket ?? true,
    slipNote: initialEventSettings?.slipNote ?? 'Dieser Tisch muss ab 15 Minuten vor der Reservierung freigehalten werden.',
    slipFreeAfterMinutes: initialEventSettings?.slipFreeAfterMinutes ?? 15,
  });

  const [presets, setPresets] = useState<PackagePreset[]>(initialPackagePresets);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [presetName, setPresetName] = useState("");
  const [isPresetBusy, setIsPresetBusy] = useState(false);

  const applyPreset = () => {
    const preset = presets.find(p => p.name === selectedPreset);
    if (!preset) return;
    // Kopie, damit spätere Änderungen am Event die Vorlage nicht verändern.
    setSettingsData(p => ({ ...p, packages: preset.packages.map(pkg => ({ ...pkg })) }));
  };

  const persistPreset = async () => {
    setIsPresetBusy(true);
    try {
      await savePackagePreset(presetName, settingsData.packages);
      setPresets(await getPackagePresets());
      setSelectedPreset(presetName.trim());
      setPresetName("");
      toast.showToast("Vorlage gespeichert.", "success");
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : "Vorlage konnte nicht gespeichert werden.", "error");
    } finally {
      setIsPresetBusy(false);
    }
  };

  const removePreset = async () => {
    if (!selectedPreset || !await dialog.confirm({ title: "Vorlage löschen", message: `Vorlage "${selectedPreset}" löschen?`, danger: true, confirmLabel: "Löschen" })) return;
    setIsPresetBusy(true);
    try {
      await deletePackagePreset(selectedPreset);
      setPresets(await getPackagePresets());
      setSelectedPreset("");
    } catch (error) {
      toast.showToast(error instanceof Error ? error.message : "Vorlage konnte nicht gelöscht werden.", "error");
    } finally {
      setIsPresetBusy(false);
    }
  };

  const handleSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await updateEventSettings(event.id, settingsData);
      await saveTaxStatus(taxStatus);
      toast.showToast("Einstellungen erfolgreich gespeichert!", "success");
    } catch (error) {
      console.error(error);
      toast.showToast(error instanceof Error ? error.message : "Fehler beim Speichern der Einstellungen", "error");
    } finally {
      setIsUpdating(false);
    }
  };
  const [galleryUrl, setGalleryUrl] = useState("");

  const availableDays = useMemo(() => {
    if (!formData.date) return [];
    const startD = new Date(formData.date);
    const endD = formData.endDate ? new Date(formData.endDate) : new Date(formData.date);
    if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return [];

    const days = [];
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d).toISOString().split('T')[0]);
    }
    return days;
  }, [formData.date, formData.endDate]);

  const toggleReservableDate = (dateStr: string) => {
    setFormData(prev => {
      const dates = prev.reservableDates.includes(dateStr)
        ? prev.reservableDates.filter((d:string) => d !== dateStr)
        : [...prev.reservableDates, dateStr];
      return { ...prev, reservableDates: dates };
    });
  };

  const updatePackage = (index: number, patch: Partial<EventSettings['packages'][number]>) => {
    setSettingsData(prev => ({
      ...prev,
      packages: prev.packages.map((pkg, i) => i === index ? { ...pkg, ...patch } : pkg),
    }));
  };

  const [selectedDate, setSelectedDate] = useState<string>(event.reservableDates?.[0] || new Date(event.date).toISOString().slice(0, 10));

  // Search & Filter State for Reservations
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all"); // 'all', 'pending', 'paid', 'cancelled'
  const [filterTable, setFilterTable] = useState<string>("all"); // 'all', 'assigned', 'unassigned'

  // Manual Reservation State
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualRes, setManualRes] = useState({ name: "", email: "", guests: 4 });
  const manualAttempt = useRef<{ payload: string; key: string } | null>(null);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) {
      toast.showToast("Bitte wähle zuerst einen Tag aus!", "warning");
      return;
    }
    setIsUpdating(true);
    try {
      await createManualReservation({
        eventId: event.id,
        guestName: manualRes.name,
        email: manualRes.email,
        guestCount: manualRes.guests,
        reservationDate: selectedDate,
        idempotencyKey: (manualAttempt.current?.payload === JSON.stringify({ ...manualRes, selectedDate })
          ? manualAttempt.current : (manualAttempt.current = { payload: JSON.stringify({ ...manualRes, selectedDate }), key: crypto.randomUUID() })).key,
      });
      setManualRes({ name: "", email: "", guests: 4 });
      setShowManualForm(false);
      router.refresh();
    } catch (error) {
      console.error("Fehler beim Erstellen der manuellen Reservierung:", error);
      toast.showToast(error instanceof Error ? error.message : 'Reservierung konnte nicht erstellt werden.', "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const removeImage = () => {
    setFile(null);
    setFormData({ ...formData, imageUrl: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEventUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      let finalImageUrl = formData.imageUrl;
      if (file) {
        const uploadData = new FormData();
        uploadData.append("file", file);
        const uploadRes = await uploadImage(uploadData);
        if (uploadRes.success) {
          finalImageUrl = uploadRes.url;
        } else {
          toast.showToast("Bildupload fehlgeschlagen. Prüfe die Dateigröße (max. 10 MB) und das Format (JPG, PNG, WebP).", "error");
          setIsUpdating(false);
          return;
        }
      }

      await updateEvent(event.id, {
        ...formData,
        reservationMode: formData.reservationMode as 'none' | 'email' | 'online',
        reservable: formData.reservationMode === 'online',
        reservationEmail: formData.reservationEmail,
        reservationNote: formData.reservationNote || null,
        imageUrl: finalImageUrl,
        zip: formData.zip || undefined,
        date: new Date(formData.date),
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        reservableDates: formData.reservableDates,
        allowTableSelection: formData.allowTableSelection,
        maxCapacity: formData.maxCapacity,
        walkInReserve: formData.walkInReserve
      });
      toast.showToast("Event erfolgreich aktualisiert!", "success");
    } catch {
      toast.showToast("Fehler beim Aktualisieren.", "error");
    }
    setIsUpdating(false);
  };

  const eventLocValues: LocValues = {
    title: { de: formData.title, en: formData.titleEn, bar: formData.titleBar },
    location: { de: formData.location, en: formData.locationEn, bar: formData.locationBar },
    description: { de: formData.description, en: formData.descriptionEn, bar: formData.descriptionBar },
  };
  const handleEventLocChange = (key: string, lang: Lang, value: string) => {
    const suffix = lang === "de" ? "" : lang === "en" ? "En" : "Bar";
    setFormData(prev => ({ ...prev, [`${key}${suffix}`]: value }));
  };
  const handleTranslate = async () => {
    setIsTranslating(true);
    try {
      const t = await translateTextsNow({ title: formData.title, location: formData.location, description: formData.description });
      setFormData(prev => ({
        ...prev,
        titleEn: t.en.title ?? prev.titleEn, titleBar: t.bar.title ?? prev.titleBar,
        locationEn: t.en.location ?? prev.locationEn, locationBar: t.bar.location ?? prev.locationBar,
        descriptionEn: t.en.description ?? prev.descriptionEn, descriptionBar: t.bar.description ?? prev.descriptionBar,
      }));
      toast.showToast("KI-Übersetzungen eingetragen – bitte prüfen und speichern.", "success");
    } catch {
      toast.showToast("Übersetzung fehlgeschlagen. Prüfe den NIM_API_KEY.", "error");
    }
    setIsTranslating(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    setIsUpdating(true);
    const res = await updateReservationStatus(id, status);
    if (res && !res.success && res.error) {
      toast.showToast(res.error, "error");
    }
    if (res?.warning) toast.showToast(res.warning, "warning");
    setIsUpdating(false);
  };

  const handleBulkStatusChange = async (status: string) => {
    if (selectedBulkIds.length === 0) return;
    if (!await dialog.confirm({ title: "Status Massenänderung", message: `Sicher, dass du ${selectedBulkIds.length} Reservierungen auf "${status}" setzen willst?`, confirmLabel: "Übernehmen" })) return;
    setIsUpdating(true);
    const results = await Promise.all(selectedBulkIds.map(id => updateReservationStatus(id, status)));
    const errors = results.filter(r => r && !r.success && r.error).map(r => r.error);
    if (errors.length > 0) {
      toast.showToast(`Einige Updates sind fehlgeschlagen:\n${errors.join('\n')}`, "error");
    }
    setSelectedBulkIds([]);
    setIsUpdating(false);
  };

  const handleTableAssign = async (id: string, tableId: string) => {
    setIsUpdating(true);
    try {
      const result = planPreset
        ? await assignPlanTable(id, tableId === "none" ? null : tableId)
        : await assignTableToReservation(id, tableId === "none" ? null : tableId);
      if (result.warning) toast.showToast(result.warning, "warning");
      router.refresh();
    } catch (error) { toast.showToast(error instanceof Error ? error.message : 'Tischzuweisung fehlgeschlagen.', "error"); }
    finally { setIsUpdating(false); }
  };

  const assignedTableId = (r: ReservationRow["reservation"]) => r.planTableId ?? r.tableId;
  const tableDisplayName = (r: ReservationRow["reservation"]) => {
    if (planPreset && r.planTableId) {
      const t = findTable(planPreset.layout, r.planTableId);
      return t ? tableLabel(planPreset.layout, t) : "Unbekannter Tisch";
    }
    return initialTables.find(t => t.id === r.tableId)?.name ?? "Kein Tisch";
  };
  const tableOptionList = planPreset
    ? planTables(planPreset.layout).map(t => ({ id: t.id, label: `${tableLabel(planPreset.layout, t)} · ${t.capacity} Plätze`, capacity: t.capacity }))
    : initialTables.map(t => ({ id: t.id, label: `${t.name} · ${t.capacity} Plätze`, capacity: t.capacity }));

  const handleGalleryUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (galleryFiles.length === 0 && !galleryUrl) return;

    setIsUpdating(true);
    try {
      // Bilder hängen am Album dieses Festes; Album wird bei Bedarf angelegt.
      const album = await getOrCreateEventAlbum(event.id);
      if (galleryFiles.length > 0) {
        // Upload multiple files in parallel
        await Promise.all(
          galleryFiles.map(async (file) => {
            const uploadData = new FormData();
            uploadData.append("file", file);
            const res = await uploadImage(uploadData);
            if (res.success) {
              await addGalleryImage(album.id, res.url);
            }
          })
        );
      } else if (galleryUrl) {
        // Fallback for single external URL
        await addGalleryImage(album.id, galleryUrl);
      }

      setGalleryFiles([]);
      setGalleryUrl("");
      router.refresh();
    } catch {
      toast.showToast("Bildupload fehlgeschlagen. Prüfe die Dateigröße (max. 10 MB) und das Format (JPG, PNG, WebP).", "error");
    }
    setIsUpdating(false);
  };

  const downloadCSV = () => {
    // We export all currently filtered reservations
    const rows = initialReservations.filter((row) => {
      const rDate = new Date(row.reservation.reservationDate).toISOString().split('T')[0];
      if (selectedDate && rDate !== selectedDate) return false;
      const matchesSearch = row.reservation.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            row.reservation.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === "all" || row.reservation.status === filterStatus;
      const matchesTable = filterTable === "all" ||
                           (filterTable === "assigned" && assignedTableId(row.reservation)) ||
                           (filterTable === "unassigned" && !assignedTableId(row.reservation));
      return matchesSearch && matchesStatus && matchesTable;
    });

    const csvContent = [
      ["Name", "Email", "Personen", "Tisch", "Status", "Betrag (€)", "Datum"],
      ...rows.map((r) => {
        return [
          `"${r.reservation.guestName}"`,
          `"${r.reservation.email}"`,
          r.reservation.guestCount,
          `"${tableDisplayName(r.reservation)}"`,
          `"${r.reservation.status}"`,
          (r.reservation.amountTotal / 100).toFixed(2),
          `"${new Date(r.reservation.reservationDate).toLocaleDateString('de-DE')}"`
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reservierungen_${event.title}_${selectedDate || 'Alle'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFindInviteCustomers = async () => {
    setInviteLoading(true);
    setInviteError("");
    setInviteMessage("");
    try {
      const res = await findCustomersNearEvent({
        eventId: event.id,
        radiusKm: inviteRadius,
        manualLocation: inviteUseMap ? null : inviteManualLocation,
        marketingOnly: inviteMarketingOnly,
      });
      if (!res.success) {
        setInviteError(res.error || "Fehler bei der Suche.");
        setInviteResults([]);
        return;
      }
      setInviteCenter(res.center || null);
      setInviteResults(res.customers || []);
      setInviteSelected((res.customers || []).map((c: { customer: { id: string } }) => c.customer.id));      setInviteMessage(`${(res.customers || []).length} Kunden im Umkreis von ${res.radiusKm} km gefunden.`);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Fehler bei der Suche.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSendInviteEmails = async () => {
    if (inviteSelected.length === 0) return;
    if (!await dialog.confirm({ title: "Einladungen senden", message: `${inviteSelected.length} Kunden per E-Mail einladen?`, confirmLabel: "Einladen" })) return;
    setInviteSending(true);
    setInviteError("");
    try {
      const res = await sendEventInvitations({ eventId: event.id, customerIds: inviteSelected });
      setInviteMessage(`Eingeladen: ${res.sent ?? 0}, fehlgeschlagen: ${res.failed ?? 0}${res.errors?.length ? " (" + res.errors.join(", ") + ")" : ""}.`);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Fehler beim Versenden.");
    } finally {
      setInviteSending(false);
    }
  };

  const handleSaveInviteTemplate = async () => {
    setInviteTplBusy(true);
    try {
      const res = await saveEventInviteTemplate({ eventId: event.id, subject: inviteSubject, body: inviteBody });
      if (!res.success) toast.showToast(res.error ?? "Speichern fehlgeschlagen.", "warning");
      else { toast.showToast("Einladungs-Mail gespeichert.", "success"); router.refresh(); }
    } catch (e) {
      toast.showToast(e instanceof Error ? e.message : "Speichern fehlgeschlagen.", "error");
    } finally { setInviteTplBusy(false); }
  };

  const handleInviteTestMail = async () => {
    setInviteTplBusy(true);
    try {
      const res = await sendInviteTestMail(event.id);
      if (res.success) toast.showToast(`Testmail an ${res.to} gesendet – bitte Gmail-Tab prüfen.`, "success");
      else toast.showToast(res.error ?? "Testmail fehlgeschlagen.", "error");
    } catch (e) {
      toast.showToast(e instanceof Error ? e.message : "Testmail fehlgeschlagen.", "error");
    } finally { setInviteTplBusy(false); }
  };

  const invitePreview = renderInviteMail(inviteSubject, inviteBody, {
    name: "Max Mustermann",
    event: event.title,
    datum: event.date ? new Date(event.date).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) : "",
    ort: event.location || "",
    link: `${process.env.NEXT_PUBLIC_BASE_URL || ""}/termine/${event.id}`,
  });

  const busyCount = initialReservations.filter(r => ['paid','confirmed','checked_in'].includes(r.reservation.status) && r.reservation.tableId).length;  const unassignedCount = initialReservations.filter(r => ['paid','confirmed','checked_in'].includes(r.reservation.status) && !r.reservation.tableId).length;
  const guestsTotal = initialReservations.filter(r => ['paid','confirmed','checked_in'].includes(r.reservation.status)).reduce((sum, r) => sum + r.reservation.guestCount, 0);
  const revenueCents = initialReservations.filter(r => ['paid','confirmed','checked_in'].includes(r.reservation.status)).reduce((sum, r) => sum + r.reservation.amountTotal, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border-light overflow-hidden mt-8">
      {/* Tabs */}
      <div className="flex flex-wrap border-b border-border-light bg-base-light/60">
        {([
          { key: 'overview', label: 'Übersicht' },
          ...(event.type === 'event' ? [
            { key: 'reservations', label: `Gäste & Anfragen${requestCount ? ` (${requestCount} offen)` : ''}` },
            { key: 'tables', label: 'Tisch & Zelt' },
            { key: 'slips', label: 'Tischzettel', href: `/admin/events/${event.id}/zettel` },
            { key: 'documents', label: `Dokumente (${initialDocuments.length})` },
            { key: 'waitlist', label: `Warteliste (${initialWaitlist.length})` },
            { key: 'invitations', label: 'Kunden einladen' },
            { key: 'team', label: 'Einlass' },          ] as const : [
            { key: 'gallery', label: `📸 Galerie (${initialGallery.length})` },
          ] as const),
          { key: 'settings', label: 'Event & Buchung' },
          ...(event.type === 'event' ? [
            { key: 'personal', label: 'Personal', href: `/admin/events/${event.id}/personal` },
          ] as const : []),
        ] as const).map((tab) => (
          'href' in tab && tab.href ? (
            <a
              key={tab.key}
              href={tab.href}
              className="px-4 sm:px-5 py-3.5 min-h-12 inline-flex items-center font-bold font-sans text-sm transition-colors text-base-dark hover:bg-canvas-light"
            >
              {tab.label} ↗
            </a>
          ) : (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as DashboardTab)}
              aria-pressed={activeTab === tab.key}
              className={`px-4 sm:px-5 py-3.5 min-h-12 font-bold font-sans text-sm transition-colors ${activeTab === tab.key ? "bg-accent-green text-white" : "text-base-dark hover:bg-canvas-light"}`}
            >
              {tab.label}
            </button>
          )
        ))}
      </div>

      <div className="p-4 sm:p-6 lg:p-10 min-w-0">
        {activeTab === 'team' && <ScannerAccessPanel eventId={event.id} eventDate={event.endDate || event.date} grants={scannerGrants} />}
        {activeTab === 'documents' && <EventDocumentsPanel eventId={event.id} initialDocuments={initialDocuments} />}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className="bg-canvas-light border border-border-light rounded-2xl p-5">
                <div className="text-xs uppercase tracking-widest font-bold opacity-50 mb-2">Gäste (bestätigt)</div>
                <div className="text-3xl font-display font-black">{guestsTotal}</div>
                <div className="text-xs font-bold opacity-50 mt-1">Personen bei {busyCount} Reservierungen</div>
              </div>
              <div className="bg-canvas-light border border-border-light rounded-2xl p-5">
                <div className="text-xs uppercase tracking-widest font-bold opacity-50 mb-2">Umsatz</div>
                <div className="text-3xl font-display font-black text-accent-green">{(revenueCents / 100).toFixed(2)} €</div>
              </div>
              <div className="bg-canvas-light border border-border-light rounded-2xl p-5">
                <div className="text-xs uppercase tracking-widest font-bold opacity-50 mb-2">Offene Anfragen</div>
                <div className={`text-3xl font-display font-black ${requestCount > 0 ? 'text-amber-600' : ''}`}>{requestCount}</div>
              </div>
              <div className="bg-canvas-light border border-border-light rounded-2xl p-5">
                <div className="text-xs uppercase tracking-widest font-bold opacity-50 mb-2">Tische belegt</div>
                <div className="text-3xl font-display font-black">{busyCount}<span className="text-lg opacity-50"> / {initialTables.length}</span></div>
                {unassignedCount > 0 && <div className="text-xs font-bold text-amber-700 mt-1">{unassignedCount} noch ohne Tisch</div>}
              </div>
            </div>

            <section className="bg-canvas-light border border-border-light rounded-2xl p-5">
              <h2 className="font-display font-bold text-lg mb-4">🗺️ Nächste Schritte</h2>
              <ul className="space-y-3">
                {[
                  { done: requestCount === 0, label: requestCount === 0 ? 'Alle Anfragen bearbeitet' : `${requestCount} Anfrage(n) prüfen`, tab: 'reservations' as const },
                  { done: unassignedCount === 0, label: unassignedCount === 0 ? 'Alle Gäste haben einen Tisch' : `${unassignedCount} Gäste noch einem Tisch zuweisen`, tab: 'tables' as const },
                  { done: scannerGrants.length > 0, label: scannerGrants.length > 0 ? `Einlass-Team freigegeben (${scannerGrants.length})` : 'Einlass-Team freigeben', tab: 'team' as const },
                ].map((step, index) => (
                  <li key={index}>
                    <button type="button" onClick={() => setActiveTab(step.tab)} className="w-full flex items-center gap-3 text-left bg-white border border-border-light rounded-xl px-4 py-3 hover:border-accent-green transition-colors">
                      <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${step.done ? 'bg-accent-green text-white' : 'bg-amber-400 text-white'}`}>{step.done ? '✓' : '!'}</span>
                      <span className="font-bold text-sm">{step.label}</span>
                      <span aria-hidden className="ml-auto text-accent-green font-black">→</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Tisch & Zelt öffnen', tab: 'tables' as const },
                { label: 'Gäste verwalten', tab: 'reservations' as const },
                { label: 'Einlass starten', href: `/admin/events/${event.id}/scanner` },
                { label: 'Zettel drucken', href: `/admin/events/${event.id}/zettel` },
              ].map((action) => (
                action.href
                  ? <a key={action.label} href={action.href} className="bg-accent-green text-white font-bold text-center py-3 rounded-xl hover:bg-accent-green/90 transition-colors">{action.label}</a>
                  : <button key={action.label} type="button" onClick={() => setActiveTab(action.tab)} className="bg-accent-green text-white font-bold py-3 rounded-xl hover:bg-accent-green/90 transition-colors">{action.label}</button>
              ))}
            </section>
          </div>
        )}

        {/* SETTINGS TAB: Event & Buchung */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-display font-bold mb-6">Event Details anpassen</h2>
            <form onSubmit={handleEventUpdate} className="space-y-4 font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="block text-sm font-bold mb-1 opacity-70">Start-Datum</label>
                  <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-bold mb-1 opacity-70">End-Datum (Optional)</label>
                  <input type="date" min={formData.date} value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 opacity-70">PLZ *</label>
                <input required type="text" inputMode="numeric" pattern="[0-9]*" maxLength={5} value={formData.zip} onChange={e => setFormData({...formData, zip: e.target.value})} className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green" placeholder="z.B. 93149" />
              </div>
              <LocalizedFields
                fields={[
                  { key: "title", label: "Titel" },
                  { key: "location", label: "Ort" },
                  { key: "description", label: "Beschreibung", markdown: true },
                ]}
                values={eventLocValues}
                onChange={handleEventLocChange}
                onTranslate={handleTranslate}
                translating={isTranslating}
              />
              <div className="space-y-2">
                <label className="block text-sm font-bold mb-1 opacity-70">Neues Bild hochladen (Optional)</label>
                <div
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingImage(true); }}
                  onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingImage(false); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingImage(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped && dropped.type.startsWith("image/")) setFile(dropped);
                  }}
                  className={`relative w-full border-2 border-dashed rounded-lg p-4 text-center transition-colors ${isDraggingImage ? "border-accent-green bg-accent-green/10" : "border-border-light bg-base-light"}`}
                >
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <p className="text-sm font-bold text-base-dark/60 pointer-events-none">
                    {isDraggingImage ? "Bild hier ablegen…" : "Bild hierher ziehen oder klicken zum Auswählen"}
                  </p>
                </div>
              {(file || formData.imageUrl) && (
                <div className="mt-2">
                  <p className="text-xs font-bold text-base-dark/60 mb-1">{file ? "Vorschau (wird beim Speichern hochgeladen):" : "Aktuelles Bild:"}</p>
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={file ? URL.createObjectURL(file) : formData.imageUrl} alt="Vorschau" className="max-h-40 rounded-lg border border-border-light" />
                    <button
                      type="button"
                      onClick={removeImage}
                      aria-label="Bild entfernen"
                      title="Bild entfernen"
                      className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              </div>

              <div>
                <label className="block text-sm font-bold mb-1 opacity-70">Maps-Link (optional)</label>
                <input
                  type="url"
                  value={formData.mapUrl}
                  onChange={e => setFormData({ ...formData, mapUrl: e.target.value })}
                  className="w-full border border-border-light rounded-lg p-3 bg-base-light focus:outline-none focus:border-accent-green"
                  placeholder="https://maps.google.com/... oder Google Maps Link"
                />
                <p className="text-xs opacity-50 mt-1">Link zu Google Maps (Standort des Events).</p>
              </div>

              <div className="flex items-center gap-3 bg-base-light p-3 rounded-lg border border-border-light">
                <input
                  type="checkbox"
                  id="isPublishedEdit"
                  checked={formData.isPublished}
                  onChange={e => setFormData({ ...formData, isPublished: e.target.checked })}
                  className="w-5 h-5 accent-accent-green"
                />
                <label htmlFor="isPublishedEdit" className="text-sm font-bold cursor-pointer">Event ist live (auf der Website sichtbar)</label>
              </div>

              {event.type === 'event' && (
                <>
                  <div className="space-y-2 bg-base-light p-3 rounded-lg border border-border-light mt-4">
                    <label htmlFor="resEdit" className="block text-sm font-bold">Reservierungsmodus</label>
                    <select
                      id="resEdit"
                      value={formData.reservationMode}
                      onChange={e => {
                        const mode = e.target.value as 'none' | 'email' | 'online';
                        setFormData({
                          ...formData,
                          reservationMode: mode,
                          reservable: mode === 'online',
                          reservableDates: mode === 'none' ? [] : formData.reservableDates
                        });
                      }}
                      className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green"
                    >
                      <option value="none">Keine Reservierung</option>
                      <option value="email">Reservierung per E-Mail</option>
                      {(event.reservationMode === 'online' || event.reservable) && (
                        <option value="online">Online-Reservierung (bestehend)</option>
                      )}
                    </select>
                  </div>

                  {formData.reservationMode === 'email' && (
                    <div className="bg-accent-green/10 border border-accent-green p-4 rounded-lg mt-2 space-y-3">
                      <div>
                        <label className="block text-sm font-bold mb-1 opacity-70">Reservierungs-E-Mail</label>
                        <input
                          type="email"
                          required
                          value={formData.reservationEmail}
                          onChange={e => setFormData({ ...formData, reservationEmail: e.target.value })}
                          className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-1 opacity-70">Hinweis für Gäste (optional)</label>
                        <textarea
                          value={formData.reservationNote}
                          onChange={e => setFormData({ ...formData, reservationNote: e.target.value })}
                          className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green min-h-[80px]"
                          placeholder="z.B. Reservierungen nur für Vereine ab 20 Personen."
                        />
                      </div>
                    </div>
                  )}

                  {formData.reservable && (
                    <div className="bg-accent-green/10 border border-accent-green p-4 rounded-lg mt-2 space-y-4">
                      <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-border-light mb-4">
                        <input
                          type="checkbox"
                          id="tableSelEdit"
                          className="w-5 h-5 accent-accent-green"
                          checked={formData.allowTableSelection}
                          onChange={e => setFormData({...formData, allowTableSelection: e.target.checked})}
                        />
                        <label htmlFor="tableSelEdit" className="text-sm font-bold cursor-pointer">Zelt-Layout & Tischauswahl aktivieren?</label>
                      </div>

                      <div>
                        <label className="block text-sm font-bold mb-1 opacity-70">Welche Tage sind reservierbar?</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {availableDays.length === 0 ? (
                            <span className="text-xs opacity-50">Bitte wähle zuerst ein Datum.</span>
                          ) : (
                            availableDays.map(day => (
                              <label key={day} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-border-light text-sm cursor-pointer hover:border-accent-green">
                                <input
                                  type="checkbox"
                                  checked={formData.reservableDates.includes(day)}
                                  onChange={() => toggleReservableDate(day)}
                                  className="accent-accent-green"
                                />
                                {new Date(day).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-sm font-bold mb-1 opacity-70">Laufkundschaft-Puffer (Pers.)</label>
                      <input type="number" min="0" value={formData.walkInReserve} onChange={e => setFormData({...formData, walkInReserve: Number(e.target.value)})} className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green" />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-sm font-bold mb-1 opacity-70">Max. Kapazität (0=unlimitiert)</label>
                      <input type="number" min="0" value={formData.maxCapacity} onChange={e => setFormData({...formData, maxCapacity: Number(e.target.value)})} className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <button disabled={isUpdating} type="submit" className="w-full bg-accent-green text-white font-bold uppercase tracking-widest py-3 rounded-lg mt-6 disabled:opacity-50 hover:bg-base-dark transition-colors">
                {isUpdating ? "Speichert..." : "Änderungen speichern"}
              </button>
            </form>
          </div>
        )}

        {/* RESERVATIONS TAB */}
        {activeTab === "reservations" && (
          <div className="space-y-6">

            {/* Day Selector */}
            {event.reservableDates && event.reservableDates.length > 0 && (
              <div className="flex overflow-x-auto gap-2 pb-2">
                {event.reservableDates.map((day: string) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(day)}
                    className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${selectedDate === day ? 'bg-accent-green text-white' : 'bg-canvas-light border border-border-light hover:border-accent-green'}`}
                  >
                    {new Date(day).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-canvas-light p-4 rounded-xl border border-border-light">
              <div className="flex-1 w-full">
                <input
                  type="text"
                  placeholder="Suchen nach Name oder Email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-2 rounded border border-border-light text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto [&>select]:min-w-0 [&>select]:min-h-11">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="p-2 rounded border border-border-light text-sm bg-white"
                >
                  <option value="all">Alle Status</option>
                  <option value="requested">Anfrage offen</option>
                  <option value="declined">Abgelehnt</option>
                  <option value="pending">Ausstehend</option>
                  <option value="paid">Bezahlt</option>
                  <option value="confirmed">Bestätigt</option>
                  <option value="checked_in">Eingecheckt</option>
                  <option value="cancelled">Storniert</option>
                </select>
                <select
                  value={filterTable}
                  onChange={(e) => setFilterTable(e.target.value)}
                  className="p-2 rounded border border-border-light text-sm bg-white"
                >
                  <option value="all">Alle Tische</option>
                  <option value="unassigned">Ohne Tisch (Neu)</option>
                  <option value="assigned">Mit Tisch</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
              <h3 className="text-xl font-subhead">Gästeliste ({initialReservations.length})</h3>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/events/${event.id}/scanner`}
                  className="bg-accent-green text-white text-sm px-4 py-2 rounded-lg hover:bg-base-dark transition-colors font-bold flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="8" y1="12" x2="16" y2="12"></line><line x1="12" y1="8" x2="12" y2="16"></line></svg>
                  Scanner (Einlass)
                </Link>
                <Link
                  href={`/admin/events/${event.id}/print`}
                  target="_blank"
                  className="bg-white border border-border-light text-base-dark text-sm px-4 py-2 rounded-lg hover:border-accent-green transition-colors font-bold flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                  Liste Drucken (PDF)
                </Link>
                <button
                  onClick={downloadCSV}
                  className="bg-white border border-border-light text-base-dark text-sm px-4 py-2 rounded-lg hover:border-accent-green transition-colors font-bold flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  CSV Export
                </button>
                <button
                  onClick={() => setShowManualForm(!showManualForm)}
                  className="bg-base-dark text-white text-sm px-4 py-2 rounded-lg hover:bg-accent-green transition-colors font-bold"
                >
                  + Manuelle Reservierung
                </button>
              </div>
            </div>

            {/* Bulk Actions Floating Bar */}
            {selectedBulkIds.length > 0 && (
              <div className="bg-base-dark text-white p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 animate-fade-in shadow-xl">
                <span className="font-bold">{selectedBulkIds.length} ausgewählt</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleBulkStatusChange("paid")} className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg text-sm font-bold transition-colors">Als Bezahlt</button>
                  <button onClick={() => handleBulkStatusChange("confirmed")} className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold transition-colors">Als Bestätigt</button>
                  <button onClick={() => handleBulkStatusChange("cancelled")} className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-bold transition-colors">Stornieren</button>
                  <button onClick={() => setSelectedBulkIds([])} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-bold transition-colors">Abbrechen</button>
                </div>
              </div>
            )}

            {showManualForm && (
              <div className="bg-canvas-light border border-border-light p-6 rounded-xl mb-6 animate-fade-in">
                <h4 className="font-bold mb-4">Gast manuell eintragen (für {selectedDate ? new Date(selectedDate).toLocaleDateString('de-DE') : 'ausgewählten Tag'})</h4>
                <form onSubmit={handleManualSubmit} className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold uppercase opacity-70 mb-1">Name</label>
                    <input required type="text" value={manualRes.name} onChange={e=>setManualRes({...manualRes, name: e.target.value})} className="w-full p-2 border border-border-light rounded-lg text-sm bg-white" placeholder="Max Mustermann" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold uppercase opacity-70 mb-1">Email (Optional)</label>
                    <input required type="email" value={manualRes.email} onChange={e=>setManualRes({...manualRes, email: e.target.value})} className="w-full p-2 border border-border-light rounded-lg text-sm bg-white" placeholder="max@beispiel.de" />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-bold uppercase opacity-70 mb-1">Personen</label>
                    <input required type="number" min="1" value={manualRes.guests} onChange={e=>setManualRes({...manualRes, guests: Number(e.target.value)})} className="w-full p-2 border border-border-light rounded-lg text-sm bg-white" />
                  </div>
                  <button type="submit" disabled={isUpdating} className="bg-accent-green text-white font-bold py-2 px-6 rounded-lg text-sm hover:bg-base-dark transition-colors">
                    Speichern
                  </button>
                </form>
              </div>
            )}

            <div>
              {initialReservations.length === 0 ? (
                <p className="text-center opacity-50 py-10 bg-canvas-light rounded-xl">Noch keine Reservierungen vorhanden.</p>
              ) : (
                <>
                <div className="space-y-3 md:hidden">
                  {initialReservations.filter((row) => {
                    const reservation = row.reservation;
                    return (!selectedDate || new Date(reservation.reservationDate).toISOString().slice(0, 10) === selectedDate) &&
                      (reservation.guestName.toLowerCase().includes(searchQuery.toLowerCase()) || reservation.email.toLowerCase().includes(searchQuery.toLowerCase())) &&
                      (filterStatus === 'all' || reservation.status === filterStatus) &&
                      (filterTable === 'all' || (filterTable === 'assigned' ? !!assignedTableId(reservation) : !assignedTableId(reservation)));
                  }).map((row) => {
                    const reservation = row.reservation;
                    return <article key={reservation.id} className="rounded-2xl border border-border-light p-4 bg-canvas-light/40">
                      <div className="flex items-start gap-3"><input aria-label={`Buchung von ${reservation.guestName} auswählen`} type="checkbox" className="h-5 w-5 mt-1 shrink-0 accent-accent-green" checked={selectedBulkIds.includes(reservation.id)} onChange={e => setSelectedBulkIds(ids => e.target.checked ? [...ids, reservation.id] : ids.filter(id => id !== reservation.id))} />
                        <div className="min-w-0"><h4 className="font-black break-words">{reservation.guestName}</h4><p className="text-sm text-base-dark/60 break-all">{reservation.email}</p></div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm font-bold mt-3"><span>{reservation.guestCount} {reservation.guestCount === 1 ? 'Person' : 'Personen'}</span><span>· {reservation.selectedTime || 'Keine Uhrzeit'}</span><span>· {(reservation.amountTotal / 100).toFixed(2)} €</span></div>
                      <div className="grid gap-3 mt-4">
                        <div><label htmlFor={`status-${reservation.id}`} className="block text-xs font-bold mb-1">Status</label><select id={`status-${reservation.id}`} value={reservation.status} onChange={e => handleStatusChange(reservation.id, e.target.value)} disabled={isUpdating} className="w-full min-h-12 border border-border-light rounded-lg bg-white px-3 text-sm">
                          {statusOptions(reservation.status).map(status => <option key={status} value={status}>{statusNames[status] || status}</option>)}
                        </select></div>
                        <div><label htmlFor={`table-${reservation.id}`} className="block text-xs font-bold mb-1">Tisch</label><select id={`table-${reservation.id}`} value={assignedTableId(reservation) || 'none'} onChange={e => handleTableAssign(reservation.id, e.target.value)} disabled={isUpdating || !['paid', 'confirmed'].includes(reservation.status)} className="w-full min-h-12 border border-border-light rounded-lg bg-white px-3 text-sm disabled:opacity-60"><option value="none">Kein Tisch</option>{tableOptionList.map((table) => <option key={table.id} value={table.id}>{table.label}</option>)}</select></div>
                      </div>
                    </article>;
                  })}
                </div>
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-left font-sans text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border-light">
                        <th className="py-3 w-10">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-accent-green"
                            onChange={(e) => {
                              if (e.target.checked) {
                                // Select all filtered
                                const filtered = initialReservations.filter((row) => {
                                  const rDate = new Date(row.reservation.reservationDate).toISOString().split('T')[0];
                                  if (selectedDate && rDate !== selectedDate) return false;
                                  const matchesSearch = row.reservation.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                        row.reservation.email.toLowerCase().includes(searchQuery.toLowerCase());
                                  const matchesStatus = filterStatus === "all" || row.reservation.status === filterStatus;
                                  const matchesTable = filterTable === "all" ||
                                                       (filterTable === "assigned" && assignedTableId(row.reservation)) ||
                                                       (filterTable === "unassigned" && !assignedTableId(row.reservation));
                                  return matchesSearch && matchesStatus && matchesTable;
                                });
                                setSelectedBulkIds(filtered.map((r) => r.reservation.id));
                              } else {
                                setSelectedBulkIds([]);
                              }
                            }}
                          />
                        </th>
                        <th className="py-3 font-bold opacity-70">Gast</th>
                        <th className="py-3 font-bold opacity-70">Details</th>
                        <th className="py-3 font-bold opacity-70">Status</th>
                        <th className="py-3 font-bold opacity-70">Tisch zuweisen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialReservations
                        .filter((row) => {
                          // Match date
                          const rDate = new Date(row.reservation.reservationDate).toISOString().split('T')[0];
                          if (selectedDate && rDate !== selectedDate) return false;

                          const matchesSearch = row.reservation.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                row.reservation.email.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchesStatus = filterStatus === "all" || row.reservation.status === filterStatus;
                          const matchesTable = filterTable === "all" ||
                                               (filterTable === "assigned" && assignedTableId(row.reservation)) ||
                                               (filterTable === "unassigned" && !assignedTableId(row.reservation));
                          return matchesSearch && matchesStatus && matchesTable;
                        })
                        .map((row) => {
                        // Generate color circle for assigned guest

                        const assignedTable = initialTables.find((t) => t.id === row.reservation.tableId);

                        return (
                        <tr key={row.reservation.id} className="border-b border-border-light/50 hover:bg-canvas-light/50 transition-colors">
                          <td className="py-4">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-accent-green"
                              checked={selectedBulkIds.includes(row.reservation.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBulkIds([...selectedBulkIds, row.reservation.id]);
                                } else {
                                  setSelectedBulkIds(selectedBulkIds.filter(id => id !== row.reservation.id));
                                }
                              }}
                            />
                          </td>
                          <td className="py-4">
                            <div className="font-bold flex items-center">
                              {row.reservation.guestName}
                              {!row.reservation.tableId ? (
                                <span className="ml-2 bg-red-100 text-red-800 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">Neu</span>
                              ) : (
                                <span className="ml-2 bg-accent-green/20 text-base-dark border border-accent-green/30 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">
                                  {assignedTable?.name || "Tisch zugewiesen"}
                                </span>
                              )}
                            </div>
                            <div className="text-xs opacity-70 ml-5">{row.reservation.email}</div>
                          </td>
                          <td className="py-4">
                            <span className="bg-canvas-light px-2 py-1 rounded font-bold">{row.reservation.guestCount} Pers.</span>
                            <div className="text-xs opacity-70 mt-1">{(row.reservation.amountTotal / 100).toFixed(2)}€</div>
                          </td>
                          <td className="py-4">
                            <select
                              value={row.reservation.status}
                              onChange={(e) => handleStatusChange(row.reservation.id, e.target.value)}
                              disabled={isUpdating}
                              className={`border rounded p-1 text-xs font-bold ${row.reservation.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border-blue-200' : row.reservation.status === 'paid' ? 'bg-green-100 text-green-800 border-green-200' : row.reservation.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}`}
                            >
                              {statusOptions(row.reservation.status).map(status => <option key={status} value={status}>{statusNames[status] || status}</option>)}
                            </select>
                          </td>
                          <td className="py-4">
                            <select
                              value={assignedTableId(row.reservation) || "none"}
                              onChange={(e) => handleTableAssign(row.reservation.id, e.target.value)}
                              disabled={isUpdating || !['paid', 'confirmed'].includes(row.reservation.status)}
                              className="border border-border-light rounded p-2 text-sm bg-white"
                            >
                              <option value="none">-- Kein Tisch --</option>
                              {tableOptionList.map((t) => {
                                // Check if this table is taken ON THIS SPECIFIC DATE
                                const isTaken = initialReservations.some((r) => {
                                  const rDate = new Date(r.reservation.reservationDate).toISOString().split('T')[0];
                                  return rDate === selectedDate && assignedTableId(r.reservation) === t.id && r.reservation.id !== row.reservation.id;
                                });
                                return (
                                  <option key={t.id} value={t.id}>
                                    {t.label} {isTaken ? '⚠️' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TABLES TAB */}
        {activeTab === "tables" && (
          <EventPlanPanel event={event} reservations={initialReservations} preset={planPreset} presets={planPresets} />
        )}

        {/* INVITATIONS TAB */}
        {activeTab === "invitations" && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="font-subhead text-2xl">Kunden per E-Mail einladen</h3>
              <p className="text-sm opacity-70 mt-1">
                Finde Kunden im Umkreis des Event-Standorts und lade sie per E-Mail zum neuen Fest ein.
              </p>
            </div>

            <div className="bg-white border border-border-light rounded-2xl p-5 space-y-4">
              <button type="button" onClick={() => setInviteTplOpen(v => !v)} aria-expanded={inviteTplOpen} className="flex w-full items-center justify-between gap-3 text-left">
                <span className="font-subhead text-lg">Einladungs-Mail bearbeiten</span>
                <span className="text-xs font-bold opacity-60">{inviteTplOpen ? "▲" : "▼"}</span>
              </button>
              {inviteTplOpen && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1 opacity-70">Betreff</label>
                    <input value={inviteSubject} onChange={e => setInviteSubject(e.target.value)} maxLength={200} className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1 opacity-70">Text</label>
                    <textarea value={inviteBody} onChange={e => setInviteBody(e.target.value)} rows={10} maxLength={5000} className="w-full border border-border-light rounded-lg p-3 bg-white font-sans text-sm focus:outline-none focus:border-accent-green" />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {INVITE_PLACEHOLDERS.map(p => (
                        <button key={p} type="button" onClick={() => setInviteBody(b => `${b}${b.endsWith("\n") || b === "" ? "" : "\n"}${p}`)} className="px-2 py-1 rounded-full bg-canvas-light border border-border-light text-xs font-bold hover:border-accent-green">{p}</button>
                      ))}
                    </div>
                    <p className="text-xs opacity-60 mt-2">Platzhalter werden pro Kunde ersetzt. Die Mail wird als schlichter Text mit einem Link versendet (ohne Banner/Button) – das hält sie aus dem Gmail-Werbungs-Tab heraus.</p>
                  </div>
                  <div className="rounded-xl bg-canvas-light border border-border-light p-4">
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Vorschau</p>
                    <p className="text-sm font-bold mb-2">{invitePreview.subject}</p>
                    <pre className="whitespace-pre-wrap font-sans text-sm opacity-80">{invitePreview.text}</pre>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleSaveInviteTemplate} disabled={inviteTplBusy} className="min-h-11 px-5 rounded-xl bg-accent-green text-white font-bold disabled:opacity-50">Mail-Text speichern</button>
                    <button type="button" onClick={() => { setInviteSubject(DEFAULT_INVITE_SUBJECT); setInviteBody(DEFAULT_INVITE_BODY); }} disabled={inviteTplBusy} className="min-h-11 px-5 rounded-xl border border-border-light font-bold disabled:opacity-50">Standard laden</button>
                    <button type="button" onClick={handleInviteTestMail} disabled={inviteTplBusy} className="min-h-11 px-5 rounded-xl border border-border-light font-bold disabled:opacity-50">Testmail an mich senden</button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-canvas-light border border-border-light rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inviteUseMap}
                    onChange={(e) => setInviteUseMap(e.target.checked)}
                    className="w-5 h-5 accent-accent-green"
                    disabled={!event.mapUrl && !event.location}
                  />
                  Maps-Standort verwenden (gespeichert)
                </label>
                {!event.mapUrl && !event.location && (
                  <span className="text-xs text-amber-700">Kein Standort gespeichert – bitte manuell eingeben.</span>
                )}
              </div>

              {!inviteUseMap && (
                <div>
                  <label className="block text-xs font-bold uppercase mb-1 opacity-70">Manueller Standort</label>
                  <input
                    type="text"
                    value={inviteManualLocation}
                    onChange={(e) => setInviteManualLocation(e.target.value)}
                    placeholder="z. B. Pfaffenhofen an der Ilm oder Adresse"
                    className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1 opacity-70">Radius (km)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={inviteRadius}
                    onChange={(e) => setInviteRadius(Number(e.target.value))}
                    className="w-full border border-border-light rounded-lg p-3 bg-white focus:outline-none focus:border-accent-green"
                  />
                </div>
                <label className="flex items-end gap-2 text-sm font-bold cursor-pointer pb-3">
                  <input
                    type="checkbox"
                    checked={inviteMarketingOnly}
                    onChange={(e) => setInviteMarketingOnly(e.target.checked)}
                    className="w-5 h-5 accent-accent-green"
                  />
                  Nur Kunden mit Marketing-Einwilligung
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleFindInviteCustomers}
                    disabled={inviteLoading || (!inviteUseMap && !inviteManualLocation.trim())}
                    className="w-full bg-accent-green text-white font-bold py-3 rounded-lg hover:bg-base-dark transition-colors disabled:opacity-50"
                  >
                    {inviteLoading ? "Suche…" : "Kunden suchen"}
                  </button>
                </div>
              </div>

              {inviteCenter && (
                <p className="text-xs opacity-60">
                  Zentrum: {inviteCenter.lat.toFixed(4)}, {inviteCenter.lng.toFixed(4)}
                </p>
              )}
              {inviteError && <p className="text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{inviteError}</p>}
              {inviteMessage && <p className="text-sm font-bold bg-accent-green/10 text-accent-green rounded-xl p-3">{inviteMessage}</p>}
            </div>

            {inviteResults.length > 0 && (
              <div className="bg-white border border-border-light rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border-light">
                  <span className="font-bold">{inviteResults.length} Kunden gefunden</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInviteSelected(inviteResults.map((r) => r.customer.id))}
                      className="text-sm font-bold text-accent-green hover:underline"
                    >
                      Alle auswählen
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteSelected([])}
                      className="text-sm font-bold text-base-dark/60 hover:underline"
                    >
                      Keine
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-canvas-light text-left">
                      <tr>
                        <th className="px-4 py-3 font-bold w-10"></th>
                        <th className="px-4 py-3 font-bold">Name</th>
                        <th className="px-4 py-3 font-bold">E-Mail</th>
                        <th className="px-4 py-3 font-bold">Ort</th>
                        <th className="px-4 py-3 font-bold">Entfernung</th>
                        <th className="px-4 py-3 font-bold">Marketing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inviteResults.map((r) => (
                        <tr key={r.customer.id} className="border-t border-border-light">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-accent-green"
                              checked={inviteSelected.includes(r.customer.id)}
                              onChange={(e) =>
                                setInviteSelected((ids) =>
                                  e.target.checked ? [...ids, r.customer.id] : ids.filter((id) => id !== r.customer.id)
                                )
                              }
                            />
                          </td>
                          <td className="px-4 py-3 font-bold">{r.customer.displayName}</td>
                          <td className="px-4 py-3 text-base-dark/70">{r.customer.email || "—"}</td>
                          <td className="px-4 py-3 text-base-dark/70">{[r.customer.zip, r.customer.city].filter(Boolean).join(" ") || "—"}</td>
                          <td className="px-4 py-3">{r.distanceKm} km</td>
                          <td className="px-4 py-3">{r.customer.marketingConsent ? "Ja" : "Nein"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-border-light flex justify-end">
                  <button
                    type="button"
                    onClick={handleSendInviteEmails}
                    disabled={inviteSending || inviteSelected.length === 0}
                    className="bg-accent-green text-white font-bold px-6 py-3 rounded-xl hover:bg-base-dark transition-colors disabled:opacity-50"
                  >
                    {inviteSending ? "Sende…" : `${inviteSelected.length} Kunden einladen`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GALLERY TAB */}
        {activeTab === "gallery" && (
          <div className="space-y-8 animate-fade-in">
            <h3 className="font-subhead text-2xl">Bildergalerie (Rückblick)</h3>

            <div className="bg-canvas-light border border-border-light p-6 rounded-2xl">
              <h4 className="font-bold mb-4">Neues Bild hinzufügen</h4>
              <form onSubmit={handleGalleryUpload} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold uppercase opacity-70 mb-1">Lokale Datei(en)</label>
                  <DropZone multiple accept="image/*" disabled={galleryUrl.length > 0} label={galleryFiles.length ? `${galleryFiles.length} Datei(en) ausgewählt` : "Bilder hierher ziehen oder klicken"} onFiles={files => setGalleryFiles(files)} />
                </div>
                <div className="font-bold opacity-50 py-2">ODER</div>
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold uppercase opacity-70 mb-1">Bild-URL (extern)</label>
                  <input type="url" value={galleryUrl} onChange={e => setGalleryUrl(e.target.value)} placeholder="https://..." className="w-full bg-white p-2 rounded-lg border border-border-light text-sm" disabled={galleryFiles.length > 0} />
                </div>
                <button type="submit" disabled={isUpdating || (galleryFiles.length === 0 && !galleryUrl)} className="bg-accent-green text-white font-bold px-6 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-base-dark transition-colors">
                  Hochladen
                </button>
              </form>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
              {initialGallery.length === 0 ? (
                <p className="col-span-full text-center opacity-50 py-10 bg-white rounded-xl border border-border-light shadow-sm">Keine Bilder in der Galerie.</p>
              ) : (
                initialGallery.map((img) => (
                  <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-border-light group shadow-sm bg-base-light">
                    <Image src={img.imageUrl} alt="Gallery image" fill sizes="(max-width: 768px) 50vw, 20vw" className="object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    {/* Current Cover Indicator */}
                    {event.imageUrl === img.imageUrl && (
                      <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md z-10" title="Aktuelles Cover-Bild">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                    )}

                    {/* Set Cover Button */}
                    {event.imageUrl !== img.imageUrl && (
                      <button
                        onClick={async () => {
                          if (await dialog.confirm({ title: "Cover festlegen", message: "Dieses Bild als Cover für das Event festlegen?", confirmLabel: "Als Cover" })) {
                            setIsUpdating(true);
                            await updateEvent(event.id, { imageUrl: img.imageUrl });
                            setIsUpdating(false);
                            toast.showToast("Cover erfolgreich geändert!", "success");
                          }
                        }}
                        className="admin-image-action absolute bottom-2 left-2 right-2 bg-white/90 text-base-dark min-h-11 py-2 rounded-lg transition-opacity font-bold text-xs shadow-sm hover:bg-accent-green hover:text-white"
                        title="Als Cover festlegen"
                      >
                        Als Cover
                      </button>
                    )}

                    {/* Delete Button */}
                    <button
                      onClick={async () => {
                        if (await dialog.confirm({ title: "Bild löschen", message: "Bild wirklich löschen?", danger: true, confirmLabel: "Löschen" })) {
                          setIsUpdating(true);
                          await removeGalleryImage(img.id);
                          setIsUpdating(false);
                        }
                      }}
                      className="admin-image-action absolute top-2 right-2 bg-red-500 text-white w-11 h-11 rounded-full transition-opacity flex items-center justify-center font-bold shadow-md hover:bg-red-600 z-10"
                      title="Bild löschen"
                      aria-label="Bild löschen"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* WAITLIST TAB */}
        {activeTab === "waitlist" && (
          <div className="space-y-8 animate-fade-in">
            <h3 className="font-subhead text-2xl">Warteliste</h3>
            <p className="text-sm opacity-70">Hier siehst du alle Gäste, die auf einen freien Tisch warten. Du kannst sie benachrichtigen, wenn etwas frei wird.</p>

            <div className="admin-waitlist bg-canvas-light rounded-2xl border border-border-light overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white border-b border-border-light text-sm font-bold uppercase tracking-wider opacity-70">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Personen</th>
                      <th className="p-4">Eingetragen am</th>
                      <th className="p-4">Status / Aktion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light font-sans text-sm font-medium">
                    {initialWaitlist.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center opacity-50">Keine Einträge auf der Warteliste.</td>
                      </tr>
                    ) : (
                      initialWaitlist.map((entry) => (
                        <tr key={entry.id} className="hover:bg-white transition-colors">
                          <td className="p-4">{entry.name}</td>
                          <td className="p-4"><a href={`mailto:${entry.email}`} className="text-accent-green underline">{entry.email}</a></td>
                          <td className="p-4"><span className="md:hidden font-bold">Personen: </span>{entry.guestCount}</td>
                          <td className="p-4"><span className="md:hidden font-bold">Eingetragen: </span>{new Date(entry.createdAt).toLocaleString('de-DE')}</td>
                          <td className="p-4 flex gap-2">
                            {entry.notifiedAt ? (
                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold border border-blue-200">
                                Benachrichtigt am {new Date(entry.notifiedAt).toLocaleDateString('de-DE')}
                              </span>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (await dialog.confirm({ title: "Wartelisten-Eintrag benachrichtigen", message: `Möchtest du ${entry.name} benachrichtigen, dass ein Tisch frei ist? (Sendet E-Mail)`, confirmLabel: "Benachrichtigen" })) {
                                    setIsUpdating(true);
                                    try {
                                      const result = await notifyWaitlistEntry(entry.id);
                                      if (!result.success) toast.showToast(result.error || 'Benachrichtigung fehlgeschlagen.', "error");
                                    } catch { toast.showToast('Benachrichtigung fehlgeschlagen. Bitte erneut versuchen.', "error"); }
                                    finally { setIsUpdating(false); }
                                  }
                                }}
                                disabled={isUpdating}
                                className="bg-accent-green text-white text-xs px-3 py-1 rounded font-bold hover:bg-base-dark transition-colors disabled:opacity-50"
                              >
                                Benachrichtigen
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                if (await dialog.confirm({ title: "Warteliste löschen", message: "Eintrag aus der Warteliste löschen?", danger: true, confirmLabel: "Löschen" })) {
                                  setIsUpdating(true);
                                  try { await removeWaitlistEntry(entry.id, event.id); }
                                  catch { toast.showToast('Löschen fehlgeschlagen. Bitte erneut versuchen.', "error"); }
                                  finally { setIsUpdating(false); }
                                }
                              }}
                              disabled={isUpdating}
                              aria-label={`${entry.name} aus Warteliste löschen`}
                              className="bg-red-100 text-red-600 min-w-11 min-h-11 text-xs px-2 py-1 rounded font-bold hover:bg-red-200 transition-colors disabled:opacity-50"
                              title="Löschen"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Einstellungen Tab */}
        {activeTab === "settings" && (
          <div className="sm:p-2 lg:p-8">
            <h2 className="text-2xl font-display font-black text-base-dark mb-6">Event-Einstellungen</h2>
            <form onSubmit={handleSettingsUpdate} className="space-y-12">

              {ONLINE_BOOKING_SETTINGS_VISIBLE && (<>
              {/* A) Tisch-Belegung */}
              <section>
                <h3 className="text-xl font-bold mb-4 border-b border-border-light pb-2">Tisch-Belegung</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsData.requireFullTable}
                    onChange={(e) => setSettingsData(p => ({ ...p, requireFullTable: e.target.checked }))}
                    className="w-5 h-5 text-accent-green rounded"
                  />
                  <span className="font-bold">Gäste müssen gesamte Tisch-Kapazität buchen</span>
                </label>
                <p className="text-sm text-base-dark/60 mt-1 ml-8">Wenn deaktiviert, können Gäste auch weniger Personen als die Kapazität buchen.</p>
              </section>

              {/* B) Zeitslots */}
              <section>
                <h3 className="text-xl font-bold mb-4 border-b border-border-light pb-2">Zeitslots</h3>
                <div className="flex flex-wrap gap-3 mb-3">
                  {settingsData.timeSlots.map((slot, i) => (
                    <div key={i} className="flex items-center gap-2 bg-canvas-light px-3 py-2 rounded-xl border border-border-light">
                      <span className="font-bold">{slot}</span>
                      <button type="button" onClick={() => setSettingsData(p => ({ ...p, timeSlots: p.timeSlots.filter((_, idx) => idx !== i) }))} className="text-red-500 font-bold hover:text-red-700">×</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 max-w-xs">
                  <input type="time" id="newTimeSlot" className="bg-canvas-light border border-border-light rounded-xl p-2 flex-1 min-w-0 min-h-12" />
                  <button type="button" onClick={() => {
                    const val = (document.getElementById('newTimeSlot') as HTMLInputElement).value;
                    if (val && !settingsData.timeSlots.includes(val)) setSettingsData(p => ({ ...p, timeSlots: [...p.timeSlots, val].sort() }));
                  }} className="bg-base-dark text-white px-4 rounded-xl font-bold hover:bg-accent-green">+</button>
                </div>
              </section>
              </>)}

              {/* C) Steuerstatus */}
              <section>
                <h3 className="text-xl font-bold mb-4 border-b border-border-light pb-2">Steuerstatus</h3>
                <div className="max-w-xl space-y-3">
                  <select
                    value={taxStatus}
                    onChange={e => setTaxStatus(e.target.value as TaxStatus)}
                    className="w-full bg-canvas-light border border-border-light rounded-xl p-3 font-bold min-h-11"
                  >
                    <option value="standard">Regelbesteuert (MwSt. ausweisen)</option>
                    <option value="small_business">Kleinunternehmer nach § 19 UStG</option>
                  </select>
                  <p className="text-xs text-base-dark/60">
                    Gilt global für alle Events. Bei Kleinunternehmerstatus werden keine MwSt.-Beträge ausgewiesen.
                  </p>
                </div>
              </section>

              {ONLINE_BOOKING_SETTINGS_VISIBLE && (<>
              {/* D) Pakete */}
              <section>
                <h3 className="text-xl font-bold mb-4 border-b border-border-light pb-2">Konsumations-Pakete</h3>
                <p className="text-sm text-base-dark/60 mb-4">Paketpreis pro Person oder pro Tisch. Die steuerliche Einordnung wird pro Paket hinterlegt; sie gilt nur für den Online-Reservierungsflow.</p>

                <div className="mb-6 rounded-xl border border-border-light bg-white p-4">
                  <label htmlFor="preset-select" className="block text-xs font-bold uppercase mb-2 opacity-70">Vorlage</label>
                  <div className="flex flex-wrap gap-2">
                    <select
                      id="preset-select"
                      value={selectedPreset}
                      onChange={(e) => setSelectedPreset(e.target.value)}
                      className="flex-1 min-w-[180px] bg-canvas-light border border-border-light rounded-lg p-2 font-bold min-h-11"
                    >
                      <option value="">– Vorlage wählen –</option>
                      {presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                    <button type="button" disabled={!selectedPreset || isPresetBusy} onClick={applyPreset} className="px-4 bg-accent-green text-white rounded-lg font-bold min-h-11 disabled:opacity-40">Anwenden</button>
                    <button type="button" disabled={!selectedPreset || isPresetBusy} onClick={removePreset} className="px-4 border border-border-light rounded-lg font-bold min-h-11 disabled:opacity-40 hover:border-red-400 hover:text-red-600">Löschen</button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border-light">
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Aktuelle Pakete als Vorlage speichern, z. B. Standard Volksfest"
                      maxLength={60}
                      className="flex-1 min-w-[180px] bg-canvas-light border border-border-light rounded-lg p-2 min-h-11"
                    />
                    <button type="button" disabled={!presetName.trim() || isPresetBusy} onClick={persistPreset} className="px-4 bg-base-dark text-white rounded-lg font-bold min-h-11 disabled:opacity-40">Speichern</button>
                  </div>
                  <p className="text-xs text-base-dark/50 mt-3">Vorlagen gelten für alle Events. Nach dem Anwenden bleiben die Pakete für dieses Event frei änderbar.</p>
                </div>

                <div className="space-y-4 mb-4">
                  {settingsData.packages.map((pkg, i) => {
                    const tax = packageTax(pkg, taxStatus);
                    const isVoucher = pkg.type === 'voucher_bundle';
                    return (
                      <div key={pkg.id} className="bg-canvas-light p-4 rounded-xl border border-border-light relative">
                        <button type="button" onClick={() => setSettingsData(p => ({ ...p, packages: p.packages.filter((_, idx) => idx !== i) }))} className="absolute top-4 right-4 text-red-500 font-bold text-xl hover:text-red-700">×</button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 pr-6 [&>div]:min-w-0">
                          <div className="lg:col-span-2"><label className="text-xs font-bold uppercase">Name</label><input type="text" value={pkg.name} onChange={(e) => updatePackage(i, { name: e.target.value })} className="w-full bg-white border border-border-light rounded p-2" /></div>
                          <div><label className="text-xs font-bold uppercase">Preis (€)</label><input type="number" min="0" step="0.01" value={pkg.price} onChange={(e) => updatePackage(i, { price: parseFloat(e.target.value) || 0 })} className="w-full bg-white border border-border-light rounded p-2" /></div>
                          <div>
                            <label className="text-xs font-bold uppercase">Einheit</label>
                            <select value={pkg.unit ?? 'per_person'} disabled={isVoucher} onChange={(e) => updatePackage(i, { unit: e.target.value as 'per_person' | 'per_table' })} className="w-full bg-white border border-border-light rounded p-2 disabled:opacity-60">
                              <option value="per_person">pro Person</option>
                              <option value="per_table">pro Tisch</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase">Typ</label>
                            <select
                              value={pkg.type ?? 'food_package'}
                              onChange={(e) => {
                                const type = e.target.value as 'food_package' | 'voucher_bundle' | 'other';
                                updatePackage(i, type === 'voucher_bundle'
                                  ? { type, unit: 'per_table', voucherCount: pkg.voucherCount ?? 10, voucherValueCents: pkg.voucherValueCents ?? 1200 }
                                  : { type });
                              }}
                              className="w-full bg-white border border-border-light rounded p-2"
                            >
                              <option value="food_package">Speisen-Paket</option>
                              <option value="voucher_bundle">Gutscheinpaket</option>
                              <option value="other">Sonstiges</option>
                            </select>
                          </div>
                          <div className="flex items-end pb-2">
                            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold">
                              <input type="checkbox" checked={pkg.priceIncludesVat !== false} onChange={(e) => updatePackage(i, { priceIncludesVat: e.target.checked })} className="w-5 h-5 accent-accent-green" />
                              Preis inkl. MwSt.
                            </label>
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase">MwSt.-Satz</label>
                            <select
                              value={pkg.vatRate ?? ''}
                              onChange={(e) => updatePackage(i, { vatRate: e.target.value === '' ? undefined : Number(e.target.value) as 0 | 7 | 19 })}
                              className="w-full bg-white border border-border-light rounded p-2"
                            >
                              <option value="">– wählen –</option>
                              <option value="0">0 %</option>
                              <option value="7">7 %</option>
                              <option value="19">19 %</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase">Steuerhinweis</label>
                            <input type="text" maxLength={100} value={pkg.vatNote ?? ''} onChange={(e) => updatePackage(i, { vatNote: e.target.value })} placeholder="z.B. Getränke" className="w-full bg-white border border-border-light rounded p-2" />
                          </div>
                        </div>
                        <div className="mb-3"><label className="text-xs font-bold uppercase">Beschreibung</label><input type="text" value={pkg.description} onChange={(e) => updatePackage(i, { description: e.target.value })} className="w-full bg-white border border-border-light rounded p-2" /></div>

                        {isVoucher && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 p-3 bg-white/70 border border-border-light rounded-lg">
                            <div><label className="text-xs font-bold uppercase">Gutscheine</label><input type="number" min="1" value={pkg.voucherCount ?? 10} onChange={(e) => updatePackage(i, { voucherCount: parseInt(e.target.value) || 1 })} className="w-full bg-white border border-border-light rounded p-2" /></div>
                            <div><label className="text-xs font-bold uppercase">Wert je Gutschein (€)</label><input type="number" min="0.01" step="0.01" value={pkg.voucherValueCents ? pkg.voucherValueCents / 100 : ''} onChange={(e) => updatePackage(i, { voucherValueCents: Math.round((parseFloat(e.target.value) || 0) * 100) })} className="w-full bg-white border border-border-light rounded p-2" /></div>
                            <div className="sm:col-span-1 flex items-end pb-2 text-sm font-bold text-base-dark/70">
                              Gesamtwert: {formatEuroCents((pkg.voucherCount ?? 0) * (pkg.voucherValueCents ?? 0))}
                            </div>
                            <div className="sm:col-span-3"><label className="text-xs font-bold uppercase">Gutscheinbedingungen</label><textarea value={pkg.voucherTerms ?? ''} onChange={(e) => updatePackage(i, { voucherTerms: e.target.value })} maxLength={2000} className="w-full bg-white border border-border-light rounded p-2 min-h-[70px]" placeholder="Nur am Eventtag im Zelt einlösbar, keine Barauszahlung." /></div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4 mb-3">
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={pkg.popular} onChange={(e) => updatePackage(i, { popular: e.target.checked })} className="text-accent-green rounded" /> <span className="text-sm font-bold">Als &quot;Beliebt&quot; markieren</span></label>
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={pkg.active !== false} onChange={(e) => updatePackage(i, { active: e.target.checked })} className="text-accent-green rounded" /> <span className="text-sm font-bold">Aktiv</span></label>
                        </div>

                        {tax ? (
                          <p className="text-xs font-bold text-base-dark/60 bg-white/70 border border-border-light rounded-lg p-2">
                            {taxSummaryPrefix(taxStatus)} {formatEuroCents(tax.grossCents)} brutto · {formatEuroCents(tax.netCents)} netto · {formatEuroCents(tax.vatCents)} MwSt. ({tax.vatRate} %)
                            {pkg.unit === 'per_table' ? ' · Abrechnung pro Tisch' : ''}
                          </p>
                        ) : (
                          <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">Bitte MwSt.-Satz wählen, damit Netto/Brutto berechnet werden können.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setSettingsData(p => ({ ...p, packages: [...p.packages, { id: 'pkg_' + Date.now(), name: 'Neues Paket', price: 0, description: '', popular: false, unit: 'per_person', type: 'food_package', priceIncludesVat: true, vatRate: 19, vatNote: '', active: true }] }))} className="bg-base-dark text-white px-6 py-2 rounded-xl font-bold hover:bg-accent-green transition-colors">+ Paket hinzufügen</button>
              </section>

              {/* E) Storno-Bedingungen */}
              <section>
                <h3 className="text-xl font-bold mb-4 border-b border-border-light pb-2">Storno-Bedingungen</h3>
                <div className="max-w-sm flex flex-wrap items-center gap-3">
                  <span>Kostenlose Stornierung bis</span>
                  <input type="number" min="0" value={settingsData.cancellationDays} onChange={(e) => setSettingsData(p => ({ ...p, cancellationDays: parseInt(e.target.value) }))} className="w-20 bg-canvas-light border border-border-light rounded-xl p-2 text-center font-bold" />
                  <span>Tage vor Event</span>
                </div>
              </section>
              </>)}

              {/* F) Reservierungszettel */}
              <section>
                <h3 className="text-xl font-bold mb-4 border-b border-border-light pb-2">Reservierungszettel</h3>
                <div className="max-w-xl space-y-3">
                  <div>
                    <label className="block text-sm font-bold mb-1">Hinweis auf dem Zettel</label>
                    <textarea
                      value={settingsData.slipNote}
                      onChange={(e) => setSettingsData(p => ({ ...p, slipNote: e.target.value }))}
                      maxLength={500}
                      className="w-full bg-canvas-light border border-border-light rounded-xl p-3 min-h-[80px]"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span>Tisch freihalten ab</span>
                    <input type="number" min="0" max="720" value={settingsData.slipFreeAfterMinutes} onChange={(e) => setSettingsData(p => ({ ...p, slipFreeAfterMinutes: parseInt(e.target.value) }))} className="w-20 bg-canvas-light border border-border-light rounded-xl p-2 text-center font-bold" />
                    <span>Minuten vor Reservierung</span>
                  </div>
                </div>
              </section>

              {ONLINE_BOOKING_SETTINGS_VISIBLE && (<>
              {/* G) Limitierungen */}
              <section>
                <h3 className="text-xl font-bold mb-4 border-b border-border-light pb-2">Limitierungen</h3>
                <div className="max-w-sm flex items-center justify-between">
                  <span>Maximale Buchungen pro E-Mail</span>
                  <input type="number" min="1" value={settingsData.maxBookingsPerEmail} onChange={(e) => setSettingsData(p => ({ ...p, maxBookingsPerEmail: parseInt(e.target.value) }))} className="w-20 bg-canvas-light border border-border-light rounded-xl p-2 text-center font-bold" />
                </div>
              </section>

              {/* H) Service-Fee */}
              <section className={!stripeEnabled ? "opacity-50 pointer-events-none" : ""}>
                <h3 className="text-xl font-bold mb-4 border-b border-border-light pb-2">Service-Gebühr (Stripe){!stripeEnabled && <span className="ml-2 text-xs font-normal text-base-dark/50">(Stripe nicht konfiguriert)</span>}</h3>
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input type="checkbox" checked={settingsData.customServiceFee} onChange={(e) => setSettingsData(p => ({ ...p, customServiceFee: e.target.checked }))} className="w-5 h-5 text-accent-green rounded" />
                  <span className="font-bold">Benutzerdefinierte Service-Gebühr für dieses Event verwenden</span>
                </label>
                {settingsData.customServiceFee && (
                  <div className="flex gap-4 max-w-sm">
                    <div>
                      <label className="text-xs font-bold uppercase block mb-1">Prozent (%)</label>
                      <input type="number" step="0.1" value={settingsData.serviceFeePercent} onChange={(e) => setSettingsData(p => ({ ...p, serviceFeePercent: parseFloat(e.target.value) }))} className="w-full bg-canvas-light border border-border-light rounded-xl p-2 font-bold" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase block mb-1">Fixbetrag (Cents)</label>
                      <input type="number" value={settingsData.serviceFeeFixedCents} onChange={(e) => setSettingsData(p => ({ ...p, serviceFeeFixedCents: parseInt(e.target.value) }))} className="w-full bg-canvas-light border border-border-light rounded-xl p-2 font-bold" />
                    </div>
                  </div>
                )}
              </section>

              {/* I) Buchungszeitraum */}
              <section>
                <h3 className="text-xl font-bold mb-4 border-b border-border-light pb-2">Buchungszeitraum</h3>
                <div className="space-y-3 max-w-sm">
                  <div className="flex items-center justify-between">
                    <span>Buchbar ab X Tage vor Event</span>
                    <input type="number" min="0" value={settingsData.bookingWindowStartDays} onChange={(e) => setSettingsData(p => ({ ...p, bookingWindowStartDays: parseInt(e.target.value) }))} className="w-20 bg-canvas-light border border-border-light rounded-xl p-2 text-center font-bold" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Buchbar bis X Stunden vor Event</span>
                    <input type="number" min="0" value={settingsData.bookingWindowEndHours} onChange={(e) => setSettingsData(p => ({ ...p, bookingWindowEndHours: parseInt(e.target.value) }))} className="w-20 bg-canvas-light border border-border-light rounded-xl p-2 text-center font-bold" />
                  </div>
                </div>
              </section>

              {/* J) Ticket-Versand */}
              <section>
                <h3 className="text-xl font-bold mb-4 border-b border-border-light pb-2">Ticket-Versand</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settingsData.autoSendTicket} onChange={(e) => setSettingsData(p => ({ ...p, autoSendTicket: e.target.checked }))} className="w-5 h-5 text-accent-green rounded" />
                  <span className="font-bold">Ticket automatisch nach erfolgreicher Zahlung senden</span>
                </label>
              </section>
              </>)}

              <div className="pt-8 border-t border-border-light flex justify-end">
                <button type="submit" disabled={isUpdating} className="w-full sm:w-auto bg-accent-green text-white px-4 sm:px-10 py-4 rounded-xl font-black text-base sm:text-lg hover:bg-base-dark transition-colors shadow-lg disabled:opacity-50">
                  {isUpdating ? "Speichern..." : "Einstellungen speichern"}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
