"use client";

import { useRef, useState } from "react";
import { Turnstile } from '@marsidev/react-turnstile';

import { submitApplication } from "@/app/actions/career";
import DropZone from "@/components/ui/DropZone";
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

export default function CareerSection({ content }: { content: CareerContent }) {
  const [position, setPosition] = useState('Initiativbewerbung');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setErrorMessage('Bitte Lebenslauf als PDF, JPG, PNG oder Word-Datei anhängen.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setErrorMessage('Der Anhang darf höchstens 2 MB groß sein.');
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
      setErrorMessage('Bitte bestätige, dass du kein Roboter bist.');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    const data = new FormData(event.currentTarget);
    const attachmentBase64 = file ? await fileToBase64(file).catch(() => null) : undefined;
    if (file && !attachmentBase64) {
      setStatus('error');
      setErrorMessage('Der Anhang konnte nicht gelesen werden.');
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
      setErrorMessage(result.error || 'Bewerbung konnte nicht gesendet werden.');
    }
  };

  return (
    <>
      <section className="max-w-[1200px] mx-auto px-4 text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-black font-display uppercase tracking-headline mb-6">
          {content.headline}
        </h1>
        <p className="text-lg max-w-2xl mx-auto opacity-80">{content.intro}</p>
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
                  Jetzt bewerben
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {(content.closingTitle || content.closingText) && (
        <section className="max-w-[800px] mx-auto mt-24 text-center px-4">
          {content.closingTitle && <h3 className="text-2xl font-subhead mb-4">{content.closingTitle}</h3>}
          {content.closingText && <p className="opacity-70 mb-8">{content.closingText}</p>}
        </section>
      )}

      <section id="bewerbung" className="max-w-[800px] mx-auto mt-16 px-4 scroll-mt-28">
        <form ref={formRef} onSubmit={handleSubmit} className="bg-white border border-border-light rounded-3xl shadow-sm p-6 md:p-10 space-y-5">
          <h2 className="text-3xl font-black font-display">Bewerbung senden</h2>
          <p className="text-sm opacity-60">Wir antworten per E-Mail. Deine Angaben werden nur für die Bewerbung verwendet.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="career-name" className="block text-sm font-bold mb-1">Name *</label>
              <input id="career-name" name="name" required minLength={2} maxLength={100} autoComplete="name" className="w-full border border-border-light rounded-xl p-3 bg-white focus:outline-none focus:border-accent-green" />
            </div>
            <div>
              <label htmlFor="career-email" className="block text-sm font-bold mb-1">E-Mail *</label>
              <input id="career-email" name="email" type="email" required maxLength={254} autoComplete="email" className="w-full border border-border-light rounded-xl p-3 bg-white focus:outline-none focus:border-accent-green" />
            </div>
            <div>
              <label htmlFor="career-phone" className="block text-sm font-bold mb-1">Telefon</label>
              <input id="career-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" className="w-full border border-border-light rounded-xl p-3 bg-white focus:outline-none focus:border-accent-green" />
            </div>
            <div>
              <label htmlFor="career-position" className="block text-sm font-bold mb-1">Stelle</label>
              <select
                id="career-position"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                className="w-full border border-border-light rounded-xl p-3 bg-white focus:outline-none focus:border-accent-green min-h-12"
              >
                {content.positions.map((job) => <option key={job.id} value={job.title}>{job.title}</option>)}
                <option value="Initiativbewerbung">Initiativbewerbung</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="career-message" className="block text-sm font-bold mb-1">Nachricht *</label>
            <textarea id="career-message" name="message" required maxLength={2000} rows={5} className="w-full border border-border-light rounded-xl p-3 bg-white focus:outline-none focus:border-accent-green resize-y" placeholder="Kurz zu dir: Erfahrung, Verfügbarkeit, warum du dabei sein willst." />
          </div>

          <div>
            <label htmlFor="career-file" className="block text-sm font-bold mb-1">Lebenslauf (optional)</label>
            <DropZone
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              label={file ? file.name : "Lebenslauf hierher ziehen oder klicken"}
              hint="PDF, JPG, PNG oder Word, maximal 2 MB"
              onFiles={files => handlePickedFile(files[0] || null)}
            />
            <p className="text-xs opacity-50 mt-1">PDF, JPG, PNG oder Word, maximal 2 MB.</p>
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
            className="w-full bg-accent-green text-white font-bold px-8 py-4 rounded-xl hover:bg-base-dark transition-colors disabled:opacity-40 min-h-12"
          >
            {status === 'submitting' ? 'Wird gesendet…' : 'Bewerbung absenden'}
          </button>

          <div aria-live="polite">
            {status === 'success' && (
              <p className="text-sm font-bold text-accent-green bg-accent-green/10 border border-accent-green/20 rounded-xl p-4">
                Danke! Deine Bewerbung ist angekommen. Wir melden uns per E-Mail.
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