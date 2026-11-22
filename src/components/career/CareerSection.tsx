"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Turnstile } from '@marsidev/react-turnstile';
import { useLocale } from "next-intl";

import { submitApplication } from "@/app/actions/career";
import DropZone from "@/components/ui/DropZone";
import { ui } from "@/lib/localize";
import type { CareerContent } from "@/types/domain";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

type Status = "idle" | "submitting" | "success" | "error";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}

export default function CareerSection({ content, children }: { content: CareerContent; children?: React.ReactNode }) {
  const locale = useLocale();
  const [position, setPosition] = useState('Initiativbewerbung');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const copy = {
    apply_now: ui(locale, { de: "Jetzt bewerben", en: "Apply now", bar: "Jetz bewerm" }),
    form_title: ui(locale, { de: "Bewerbung senden", en: "Send application", bar: "Bewerbung oschicka" }),
    form_intro: ui(locale, { de: "Wir antworten per E-Mail. Deine Angaben werden nur für die Bewerbung verwendet.", en: "We reply by email. Your details are only used for the application.", bar: "Mia antwortn per E-Mail. Dei Angabe werdn nur fia de Bewerbung vawendt." }),
    label_name: ui(locale, { de: "Name *", en: "Name *", bar: "Nam *" }),
    label_email: ui(locale, { de: "E-Mail *", en: "Email *", bar: "E-Mail *" }),
    label_phone: ui(locale, { de: "Telefon", en: "Phone", bar: "Telefon" }),
    label_position: ui(locale, { de: "Stelle", en: "Position", bar: "Stoi" }),
    option_initiative: ui(locale, { de: "Initiativbewerbung", en: "Speculative application", bar: "Initiativbewerbung" }),
    label_message: ui(locale, { de: "Nachricht *", en: "Message *", bar: "Nochricht *" }),
    placeholder_message: ui(locale, { de: "Kurz zu dir: Erfahrung, Verfügbarkeit, warum du dabei sein willst.", en: "A bit about you: experience, availability, why you want to join.", bar: "Kurz zu dir: Erfahrung, Verfügbarkeit, warum du dabei sei willst." }),
    label_cv: ui(locale, { de: "Lebenslauf (optional)", en: "CV (optional)", bar: "Lebenslauf (optional)" }),
    dropzone_label: ui(locale, { de: "Lebenslauf hierher ziehen oder klicken", en: "Drag your CV here or click", bar: "Lebenslauf doher ziagn oda klickn" }),
    dropzone_hint: ui(locale, { de: "PDF, JPG, PNG oder Word, maximal 2 MB", en: "PDF, JPG, PNG or Word, max 2 MB", bar: "PDF, JPG, PNG oda Word, maximal 2 MB" }),
    file_hint: ui(locale, { de: "PDF, JPG, PNG oder Word, maximal 2 MB.", en: "PDF, JPG, PNG or Word, max 2 MB.", bar: "PDF, JPG, PNG oda Word, maximal 2 MB." }),
    submitting: ui(locale, { de: "Wird gesendet…", en: "Sending…", bar: "Wird gschickt…" }),
    submit: ui(locale, { de: "Bewerbung absenden", en: "Send application", bar: "Bewerbung oschicka" }),
    success: ui(locale, { de: "Danke! Deine Bewerbung ist angekommen. Wir melden uns per E-Mail.", en: "Thank you! Your application has arrived. We will get back to you by email.", bar: "Danke! Dei Bewerbung is okemma. Mia mejdn uns per E-Mail." }),
    err_file_type: ui(locale, { de: "Bitte Lebenslauf als PDF, JPG, PNG oder Word-Datei anhängen.", en: "Please attach your CV as a PDF, JPG, PNG or Word file.", bar: "Bitt Lebenslauf ois PDF, JPG, PNG oda Word-Datei ohänga." }),
    err_file_size: ui(locale, { de: "Der Anhang darf höchstens 2 MB groß sein.", en: "The attachment may be at most 2 MB.", bar: "Da Ohang deaf höchstens 2 MB groß sei." }),
    err_robot: ui(locale, { de: "Bitte bestätige, dass du kein Roboter bist.", en: "Please confirm that you are not a robot.", bar: "Bitt bestätige, dass du koa Roboter bist." }),
    err_read: ui(locale, { de: "Der Anhang konnte nicht gelesen werden.", en: "The attachment could not be read.", bar: "Da Ohang hod ned gleesn werdn kinna." }),
    err_send: ui(locale, { de: "Bewerbung konnte nicht gesendet werden.", en: "The application could not be sent.", bar: "Bewerbung hod ned gschickt werdn kinna." }),
    outfit_alt: ui(locale, { de: "Arbeitsoutfit von Maurer Events: schwarze Cap, schwarzes T-Shirt mit Logo und grüne Schürze", en: "Maurer Events work outfit: black cap, black T-shirt with logo and green apron", bar: "Arbeitsoutfit vo Maurer Events: schwarze Kappn, schwarzes T-Shirt mit Logo und grüne Schürzn" }),
  };

  const selectPosition = (title: string) => {
    setPosition(title);
    setStatus('idle');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePickedFile = (selected: File | null) => {
    setErrorMessage('');
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setErrorMessage(copy.err_file_type);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setErrorMessage(copy.err_file_size);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(selected);
  };


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!turnstileToken) {
      setStatus('error');
      setErrorMessage(copy.err_robot);
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    const data = new FormData(event.currentTarget);
    const attachmentBase64 = file ? await fileToBase64(file).catch(() => null) : undefined;
    if (file && !attachmentBase64) {
      setStatus('error');
      setErrorMessage(copy.err_read);
      return;
    }

    const result = await submitApplication({
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      phone: String(data.get('phone') ?? ''),
      position,
      message: String(data.get('message') ?? ''),
      attachmentName: file?.name,
      attachmentType: file?.type,
      attachmentBase64,
      turnstileToken,
    });

    setTurnstileToken('');
    setCaptchaVersion(value => value + 1);

    if (result.success) {
      setStatus('success');
      formRef.current?.reset();
      setFile(null);
      setPosition('Initiativbewerbung');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      setStatus('error');
      setErrorMessage(result.error || copy.err_send);
    }
  };

  return (
    <>
      <section className="max-w-[1200px] mx-auto px-4 text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-black font-display uppercase tracking-headline mb-6">
          {content.headline}
        </h1>
        <p className="text-lg max-w-2xl mx-auto opacity-80">{content.intro}</p>

        <div className="mt-12 grid lg:grid-cols-2 gap-10 items-center text-left">
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border border-border-light bg-white">
            {children}
          </div>

        </div>
      </section>

      {content.positions.length > 0 && (
        <section className="max-w-[1000px] mx-auto px-4 space-y-8">
          {content.positions.map((job) => (
            <div key={job.id} className="bg-white p-8 md:p-12 rounded-3xl border border-border-light shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>

              <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    {job.badge && <span className="bg-accent-green text-white text-[10px] font-black uppercase px-2 py-1 rounded">{job.badge}</span>}
                    {job.employment && <span className="opacity-50 text-xs font-bold uppercase">{job.employment}</span>}
                  </div>
                  <h2 className="text-3xl font-black font-display mb-3 break-words">{job.title}</h2>
                  <p className="opacity-80 max-w-xl">{job.description}</p>

                  {job.benefits.length > 0 && (
                    <ul className="mt-4 space-y-2 text-sm opacity-80 font-bold">
                      {job.benefits.map((benefit) => (
                        <li key={benefit} className="flex items-start gap-2">
                          <span aria-hidden="true">✓</span>
                          <span className="min-w-0">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => selectPosition(job.title)}
                  className="w-full md:w-auto shrink-0 text-center bg-base-dark text-white font-bold px-8 py-4 rounded-xl hover:bg-accent-green transition-colors min-h-12"
                >
                  {copy.apply_now}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {(content.closingTitle || content.closingText) && (
        <section className="max-w-[800px] mx-auto mt-24 px-4">
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
            <div className="shrink-0 w-24 sm:w-28 bg-white border border-border-light rounded-2xl shadow-sm p-2">
              <Image
                src="/archive/Kleidung.svg"
                alt={copy.outfit_alt}
                width={1030}
                height={1536}
                sizes="112px"
                className="w-full h-auto"
              />
            </div>
            <div className="text-center sm:text-left">
              {content.closingTitle && <h3 className="text-2xl font-subhead mb-4">{content.closingTitle}</h3>}
              {content.closingText && <p className="opacity-70 mb-8">{content.closingText}</p>}
            </div>
          </div>
        </section>
      )}

      <section id="bewerbung" className="max-w-[800px] mx-auto mt-16 px-4 scroll-mt-28">
        <form ref={formRef} onSubmit={handleSubmit} className="bg-white border border-border-light rounded-3xl shadow-sm p-6 md:p-10 space-y-5">
          <h2 className="text-3xl font-black font-display">{copy.form_title}</h2>
          <p className="text-sm opacity-60">{copy.form_intro}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="career-name" className="block text-sm font-bold mb-1">{copy.label_name}</label>
              <input id="career-name" name="name" required minLength={2} maxLength={100} autoComplete="name" className="w-full border border-border-light rounded-xl p-3 bg-white focus:outline-none focus:border-accent-green" />
            </div>
            <div>
              <label htmlFor="career-email" className="block text-sm font-bold mb-1">{copy.label_email}</label>
              <input id="career-email" name="email" type="email" required maxLength={254} autoComplete="email" className="w-full border border-border-light rounded-xl p-3 bg-white focus:outline-none focus:border-accent-green" />
            </div>
            <div>
              <label htmlFor="career-phone" className="block text-sm font-bold mb-1">{copy.label_phone}</label>
              <input id="career-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" className="w-full border border-border-light rounded-xl p-3 bg-white focus:outline-none focus:border-accent-green" />
            </div>
            <div>
              <label htmlFor="career-position" className="block text-sm font-bold mb-1">{copy.label_position}</label>
              <select
                id="career-position"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                className="w-full border border-border-light rounded-xl p-3 bg-white focus:outline-none focus:border-accent-green min-h-12"
              >
                {content.positions.map((job) => <option key={job.id} value={job.title}>{job.title}</option>)}
                <option value="Initiativbewerbung">{copy.option_initiative}</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="career-message" className="block text-sm font-bold mb-1">{copy.label_message}</label>
            <textarea id="career-message" name="message" required maxLength={2000} rows={5} className="w-full border border-border-light rounded-xl p-3 bg-white focus:outline-none focus:border-accent-green resize-y" placeholder={copy.placeholder_message} />
          </div>

          <div>
            <label htmlFor="career-file" className="block text-sm font-bold mb-1">{copy.label_cv}</label>
            <DropZone
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              label={file ? file.name : copy.dropzone_label}
              hint={copy.dropzone_hint}
              onFiles={files => handlePickedFile(files[0] || null)}
            />
            <p className="text-xs opacity-50 mt-1">{copy.file_hint}</p>
          </div>

          <Turnstile
            key={captchaVersion}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
            onSuccess={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken('')}
            onError={() => setTurnstileToken('')}
            options={{ theme: 'light', action: 'application' }}
          />

          <button
            type="submit"
            disabled={status === 'submitting' || !turnstileToken}
            className="w-full bg-accent-green text-white font-bold px-8 py-4 rounded-xl hover:bg-accent-green/80 transition-colors disabled:opacity-40 min-h-12"
          >
            {status === 'submitting' ? copy.submitting : copy.submit}
          </button>

          <div aria-live="polite">
            {status === 'success' && (
              <p className="text-sm font-bold text-accent-green bg-accent-green/10 border border-accent-green/20 rounded-xl p-4">
                {copy.success}
              </p>
            )}
            {status === 'error' && errorMessage && (
              <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">{errorMessage}</p>
            )}
          </div>
        </form>
      </section>
    </>
  );
}