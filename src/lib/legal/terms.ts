export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  list?: string[];
}

export interface LegalDocument {
  slug: string;
  title: string;
  description: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

// Rechtliche Prüfung abgeschlossen: Hinweis und noindex sind entfernt.
export const LEGAL_REVIEW_PENDING = false;

export const COMPANY = {
  brand: 'Maurer Events',
  owner: 'Florian Maurer',
  street: 'Schwaiger Str. 6',
  city: '85126 Müchsmünster',
  email: 'servus@maurer-events.com',
  country: 'Deutschland',
};

export const STORNO = {
  freeUntilDays: 7,
  refundDays: 14,
  partialRefundPercent: 50,
  partialRefundUntilHours: 48,
};

const stand = 'Stand: 31. Oktober 2026';

export const agb: LegalDocument = {
  slug: 'agb',
  title: 'Allgemeine Geschäftsbedingungen',
  description: 'Buchungs- und Vertragsbedingungen für Tischreservierungen und Verzehrpakete bei Maurer Events.',
  updated: stand,
  intro: 'Diese Bedingungen gelten für alle über diese Website gebuchten Tischreservierungen und Verzehrpakete für Veranstaltungen von Maurer Events.',
  sections: [
    {
      id: 'geltungsbereich',
      title: '1. Geltungsbereich',
      paragraphs: [
        'Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen Maurer Events und den Gästen über die Reservierung von Tischen und den Erwerb von Verzehrpaketen für Veranstaltungen.',
        'Abweichende oder ergänzende Bedingungen des Gastes werden nicht Vertragsbestandteil, auch wenn wir ihnen nicht ausdrücklich widersprechen.',
      ],
    },
    {
      id: 'vertragspartner',
      title: '2. Vertragspartner',
      paragraphs: [
        `Vertragspartner ist ${COMPANY.owner}, ${COMPANY.brand}, ${COMPANY.street}, ${COMPANY.city}, ${COMPANY.country}, erreichbar unter ${COMPANY.email}.`,
        'Vertragspartner des Gastes für die Zahlungsabwicklung ist ausschließlich Maurer Events. Der Zahlungsdienstleister tritt lediglich als technischer Dienstleister auf und wird nicht Vertragspartner.',
      ],
    },
    {
      id: 'vertragsschluss',
      title: '3. Vertragsschluss',
      paragraphs: [
        'Die Darstellung der Veranstaltungen und Pakete auf der Website stellt kein rechtlich bindendes Angebot dar, sondern eine Aufforderung zur Buchung.',
        'Mit dem Absenden der Buchung und dem Abschluss des Zahlungsvorgangs gibt der Gast ein verbindliches Angebot ab. Der Vertrag kommt mit der Bestätigung der Reservierung durch Maurer Events zustande, spätestens mit dem Zugang der Buchungsbestätigung per E-Mail.',
        'Kommt der Vertrag nicht zustande – etwa weil die Zahlung fehlschlägt, der Tisch zwischenzeitlich vergeben ist oder die Buchung den Verfügbarkeitsregeln widerspricht – werden bereits geleistete Zahlungen vollständig erstattet. Weitergehende Ansprüche bestehen in diesem Fall nicht.',
        'Der Vertragsschluss steht unter dem Vorbehalt der Verfügbarkeit des gewählten Tisches zum Zeitpunkt der Zahlungsbestätigung.',
      ],
    },
    {
      id: 'leistung',
      title: '4. Leistungsgegenstand',
      paragraphs: [
        'Gegenstand der Buchung ist die Reservierung eines Tisches für eine bestimmte Veranstaltung an einem bestimmten Tag sowie eines Zeitfensters und eines Verzehrpakets. Der genaue Leistungsumfang ergibt sich aus der Buchungsbestätigung.',
        'Ein Verzehrpaket beschreibt den Umfang der vorab gezahlten Leistung je Person. Die im Paket genannten Speisen und Getränke sind eine Beschreibung, keine abschließende Zusage über eine bestimmte Marke oder Mengeneinheit, soweit in der Paketbeschreibung nichts anderes angegeben ist.',
        'Für Tische, die als VIP-Tisch gekennzeichnet sind, fällt ein gesonderter Aufpreis an. Dieser wird vor Abschluss der Buchung gesondert ausgewiesen.',
        'Sofern für eine Veranstaltung die Vorgabe besteht, die gesamte Tischkapazität zu buchen, ist eine Buchung nur mit der vollständigen Personenzahl des Tisches möglich.',
      ],
    },
    {
      id: 'preise',
      title: '5. Preise und Gebühren',
      paragraphs: [
        'Alle auf der Website angegebenen Preise sind Endpreise und verstehen sich in Euro einschließlich der gesetzlichen Umsatzsteuer.',
        'Zusätzlich zum Paketpreis und einem etwaigen VIP-Aufpreis kann eine Service- und Buchungsgebühr anfallen. Diese wird vor Abschluss der Buchung im Buchungsformular gesondert ausgewiesen und ist Bestandteil des Gesamtpreises.',
        'Der Gesamtpreis wird vor der Weiterleitung an den Zahlungsdienstleister vollständig angezeigt. Maßgeblich ist der in der Buchungsbestätigung ausgewiesene Betrag.',
      ],
    },
    {
      id: 'zahlung',
      title: '6. Zahlung',
      paragraphs: [
        'Die Zahlung erfolgt über den Zahlungsdienstleister Stripe. Welche Zahlungsarten zur Verfügung stehen, richtet sich nach dem Angebot des Zahlungsdienstleisters zum Zeitpunkt der Buchung.',
        'Die Zahlung ist mit Abschluss der Buchung fällig. Ohne vollständige Zahlung kommt keine Reservierung zustande.',
        'Bei Zahlungsarten mit verzögerter Gutschrift (etwa bestimmte Lastschriftverfahren) gilt die Reservierung erst mit der tatsächlichen Zahlungsbestätigung als gesichert. Bis dahin bleibt der Tisch für andere Gäste buchbar.',
      ],
    },
    {
      id: 'tisch',
      title: '7. Tischreservierung und Tischzuweisung',
      paragraphs: [
        'Bei Veranstaltungen mit Tischwahl wird der im Buchungsvorgang ausgewählte Tisch reserviert. Bei Veranstaltungen ohne Tischwahl erfolgt die Sitzplatzvergabe durch das Personal vor Ort; ein Anspruch auf einen bestimmten Platz besteht in diesem Fall nicht.',
        'Maurer Events behält sich vor, aus organisatorischen Gründen einen anderen, gleichwertigen Tisch zuzuweisen. Ein Anspruch auf eine Minderung besteht in diesem Fall nicht, sofern die Ersatzlösung gleichwertig ist.',
        'Die reservierte Personenzahl darf ohne vorherige Zustimmung nicht überschritten werden. Maßgeblich ist die in der Buchungsbestätigung genannte Personenzahl.',
      ],
    },
    {
      id: 'verzehrguthaben',
      title: '8. Verzehrguthaben',
      paragraphs: [
        'Der Paketpreis wird als Verzehrguthaben für die gebuchte Veranstaltung gewährt. Das Guthaben kann während der Veranstaltung für Speisen und Getränke eingelöst werden.',
        'Das Verzehrguthaben ist an die gebuchte Veranstaltung und den gebuchten Tag gebunden und verfällt mit deren Ende, soweit es nicht eingelöst wurde. Eine Barauszahlung nicht verbrauchten Guthabens ist ausgeschlossen.',
        'Wird die Veranstaltung von Maurer Events abgesagt oder verschoben und ist ein Ersatztermin für den Gast nicht zumutbar, wird das nicht eingelöste Guthaben erstattet.',
      ],
    },
    {
      id: 'ticket',
      title: '9. Ticket und Einlass',
      paragraphs: [
        'Nach erfolgreicher Zahlung erhält der Gast ein Ticket mit QR-Code per E-Mail. Das Ticket berechtigt zum einmaligen Einlass für die gebuchte Veranstaltung.',
        'Der QR-Code wird beim Einlass einmalig entwertet. Nach der ersten Entwertung ist das Ticket nicht mehr gültig, unabhängig davon, wer es vorlegt. Der Gast ist für die sichere Aufbewahrung und die nicht unbefugte Weitergabe des Tickets verantwortlich.',
        'Kann ein Gast das Ticket beim Einlass nicht vorlegen, entscheidet das Personal nach Prüfung der Buchung im System. Ein Anspruch auf Einlass ohne nachvollziehbare Zuordnung besteht nicht.',
        'Der Zutritt kann verweigert werden, wenn die Hausordnung nicht eingehalten wird, die zulässige Personenzahl überschritten wird oder Gefahr für andere Gäste besteht.',
      ],
    },
    {
      id: 'storno',
      title: '10. Stornierung durch den Gast',
      paragraphs: [
        'Stornierungen sind ausschließlich über die in den Stornobedingungen genannten Wege möglich. Die Einzelheiten ergeben sich aus den Stornobedingungen, die Bestandteil dieser AGB sind.',
        `Eine kostenfreie Stornierung ist bis ${STORNO.freeUntilDays} Tage vor der gebuchten Veranstaltung möglich. Danach gelten die in den Stornobedingungen genannten Regelungen.`,
      ],
    },
    {
      id: 'absage',
      title: '11. Absage oder Änderung durch Maurer Events',
      paragraphs: [
        'Maurer Events kann eine Veranstaltung aus wichtigem Grund absagen, verlegen oder in ihrem Ablauf ändern, insbesondere bei behördlichen Auflagen, Sicherheitsbedenken, Ausfall wesentlicher Leistungsträger oder höherer Gewalt.',
        'Wird eine Veranstaltung abgesagt und findet kein Ersatztermin statt, werden bereits geleistete Zahlungen einschließlich der Buchungsgebühr vollständig erstattet. Weitergehende Ansprüche, insbesondere auf Ersatz von Reise- oder Übernachtungskosten, bestehen nur im gesetzlich zwingenden Umfang.',
        'Wird eine Veranstaltung verlegt, kann der Gast die Buchung innerhalb von sieben Tagen nach Bekanntgabe kostenfrei stornieren, wenn der neue Termin für ihn nicht zumutbar ist.',
      ],
    },
    {
      id: 'nichterscheinen',
      title: '12. Nichterscheinen',
      paragraphs: [
        'Erscheint der Gast nicht und storniert er nicht fristgerecht, bleibt die Zahlungspflicht bestehen.',
        'Maurer Events behält sich vor, in diesem Fall eine angemessene pauschale Entschädigung für entstandene Aufwendungen zu berechnen. Dem Gast bleibt ausdrücklich der Nachweis vorbehalten, dass ein Schaden in dieser Höhe nicht entstanden oder wesentlich niedriger ist.',
        'Der Tisch kann nach Ablauf einer angemessenen Wartezeit anderweitig vergeben werden. Ein Anspruch auf Rückzahlung entsteht dadurch nicht.',
      ],
    },
    {
      id: 'widerruf',
      title: '13. Widerrufsrecht',
      paragraphs: [
        'Verbrauchern steht bei Fernabsatzverträgen grundsätzlich ein vierzehntägiges Widerrufsrecht zu.',
        'Für Verträge über die Erbringung von Dienstleistungen im Bereich der Freizeitgestaltung, die für die Erbringung einen spezifischen Termin oder Zeitraum vorsehen, besteht gemäß § 312g Abs. 2 Nr. 9 BGB kein Widerrufsrecht. Die hier angebotenen Tischreservierungen sind an eine bestimmte Veranstaltung, einen bestimmten Tag und ein bestimmtes Zeitfenster gebunden und fallen daher unter diese Ausnahme.',
        'Einzelheiten und die Voraussetzungen im Einzelfall ergeben sich aus der gesonderten Seite zum Widerrufsrecht.',
      ],
    },
    {
      id: 'hausordnung',
      title: '14. Hausordnung und Zutrittsverweigerung',
      paragraphs: [
        'Es gilt die Hausordnung des jeweiligen Veranstaltungsorts. Anweisungen des Personals und der Sicherheitskräfte sind zu befolgen.',
        'Maurer Events kann Gästen den Zutritt verweigern oder sie der Veranstaltung verweisen, wenn sie die Hausordnung verletzen, andere Gäste gefährden oder erheblich stören, oder wenn begründeter Verdacht auf Missbrauch eines Tickets besteht. Ein Anspruch auf Rückzahlung besteht in diesem Fall nicht.',
      ],
    },
    {
      id: 'haftung',
      title: '15. Haftung',
      paragraphs: [
        'Maurer Events haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei der Verletzung von Leben, Körper oder Gesundheit sowie nach den Vorschriften des Produkthaftungsgesetzes.',
        'Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen.',
        'Für die Garderobe und für mitgebrachte Gegenstände wird keine Haftung übernommen, soweit nicht zwingende gesetzliche Vorschriften entgegenstehen.',
      ],
    },
    {
      id: 'datenschutz',
      title: '16. Datenschutz',
      paragraphs: [
        'Die Verarbeitung personenbezogener Daten im Rahmen der Buchung und der Veranstaltung ist in der Datenschutzerklärung beschrieben. Diese ist Bestandteil dieser AGB.',
      ],
    },
    {
      id: 'streitbeilegung',
      title: '17. Streitbeilegung',
      paragraphs: [
        'Maurer Events ist nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
        'Der Gast kann sich bei Beschwerden jederzeit an die oben genannte Kontaktadresse wenden. Wir bemühen uns um eine einvernehmliche Lösung.',
      ],
    },
    {
      id: 'schluss',
      title: '18. Schlussbestimmungen',
      paragraphs: [
        'Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Zwingende Verbraucherschutzvorschriften des Aufenthaltsstaats des Gastes bleiben unberührt.',
        'Ist der Gast Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand der Sitz von Maurer Events. Für Verbraucher gelten die gesetzlichen Gerichtsstände.',
        'Sollte eine Bestimmung dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. An die Stelle der unwirksamen Bestimmung tritt die gesetzliche Regelung.',
        'Änderungen dieser AGB gelten für bereits geschlossene Verträge nicht. Für den Gast ist die zum Zeitpunkt der Buchung gültige Fassung maßgeblich.',
      ],
    },
  ],
};

export const stornobedingungen: LegalDocument = {
  slug: 'stornobedingungen',
  title: 'Stornobedingungen',
  description: 'Wie du eine Tischreservierung bei Maurer Events stornierst, welche Fristen gelten und wie eine Rückzahlung abläuft.',
  updated: stand,
  intro: 'Diese Stornobedingungen sind Bestandteil der AGB und beschreiben, was gilt, wenn du eine Buchung nicht wahrnehmen kannst oder wenn wir eine Veranstaltung absagen.',
  sections: [
    {
      id: 'so-stornierst-du',
      title: '1. So stornierst du',
      paragraphs: [
        `Eine Stornierung ist nur per E-Mail an ${COMPANY.email} möglich. Bitte gib dabei den Namen der Buchung, die Veranstaltung und den Veranstaltungstag an. Die Angaben aus deiner Buchungsbestätigung reichen dafür aus.`,
        'Maßgeblich ist der Zeitpunkt, zu dem die E-Mail bei uns eingeht. Du erhältst eine Bestätigung der Stornierung. Ohne diese Bestätigung ist die Stornierung nicht wirksam.',
        'Eine Stornierung über den Zahlungsdienstleister, per Social-Media-Nachricht oder mündlich am Veranstaltungstag ist nicht möglich.',
      ],
    },
    {
      id: 'fristen',
      title: '2. Fristen und Erstattung',
      paragraphs: [
        `Bis ${STORNO.freeUntilDays} Tage vor der gebuchten Veranstaltung kannst du kostenfrei stornieren. Wir erstatten dir in diesem Fall den gesamten gezahlten Betrag einschließlich der Service- und Buchungsgebühr.`,
        `Bei einer Stornierung zwischen ${STORNO.freeUntilDays} Tagen und ${STORNO.partialRefundUntilHours} Stunden vor der Veranstaltung erstatten wir ${STORNO.partialRefundPercent} % des Paketpreises. Die Service- und Buchungsgebühr wird in diesem Fall nicht erstattet.`,
        `Bei einer Stornierung weniger als ${STORNO.partialRefundUntilHours} Stunden vor der Veranstaltung sowie bei Nichterscheinen ist eine Erstattung ausgeschlossen.`,
        'Die Fristen beziehen sich auf den Beginn des gebuchten Zeitfensters, nicht auf den Veranstaltungsbeginn.',
      ],
    },
    {
      id: 'rueckzahlung',
      title: '3. Rückzahlung',
      paragraphs: [
        `Rückzahlungen erfolgen innerhalb von ${STORNO.refundDays} Tagen nach Bestätigung der Stornierung über das ursprünglich verwendete Zahlungsmittel. Eine Barauszahlung oder Auszahlung auf ein anderes Konto ist nicht möglich.`,
        'Die Gutschrift kann je nach Zahlungsart einige Werktage dauern. Der Zeitpunkt der Wertstellung liegt außerhalb unseres Einflussbereichs.',
        'Ist die ursprüngliche Zahlung länger als 180 Tage her, kann eine Rückzahlung über den Zahlungsdienstleister technisch ausgeschlossen sein. In diesem Fall stimmen wir individuell mit dir ab.',
      ],
    },
    {
      id: 'umbuchung',
      title: '4. Umbuchung und Namenswechsel',
      paragraphs: [
        'Eine Umbuchung auf einen anderen Veranstaltungstag ist bis zum Beginn der kostenfreien Stornofrist einmalig kostenfrei möglich, sofern am Zieltermin freie Plätze vorhanden sind.',
        'Die Übertragung einer Buchung auf eine andere Person ist jederzeit möglich. Teile uns dafür vor der Veranstaltung den Namen der neuen Person mit. Das ursprüngliche Ticket verliert damit seine Gültigkeit.',
      ],
    },
    {
      id: 'absage-veranstalter',
      title: '5. Absage durch Maurer Events',
      paragraphs: [
        'Sagen wir eine Veranstaltung ab und gibt es keinen Ersatztermin, erstatten wir den vollständigen Betrag einschließlich der Service- und Buchungsgebühr.',
        'Wird eine Veranstaltung verlegt, informieren wir dich unverzüglich per E-Mail. Ist der neue Termin für dich nicht zumutbar, kannst du innerhalb von sieben Tagen nach Bekanntgabe kostenfrei stornieren.',
        'Weitergehende Ansprüche, insbesondere der Ersatz von Reise- oder Übernachtungskosten, bestehen nur im gesetzlich zwingenden Umfang.',
      ],
    },
    {
      id: 'wetter',
      title: '6. Witterung',
      paragraphs: [
        'Die Veranstaltungen finden in einem Festzelt statt. Regen oder Kälte führen daher grundsätzlich nicht zu einer Absage und begründen kein Stornorecht.',
        'Etwas anderes gilt nur, wenn die Durchführung aus Sicherheitsgründen behördlich oder durch uns untersagt wird. In diesem Fall gilt Abschnitt 5.',
      ],
    },
    {
      id: 'nichterscheinen',
      title: '7. Nichterscheinen und verspätete Ankunft',
      paragraphs: [
        'Erscheinst du nicht, bleibt die Zahlungspflicht bestehen. Eine Erstattung erfolgt nicht.',
        'Bei verspäteter Ankunft bleibt dein Tisch bis zum Ende des gebuchten Zeitfensters reserviert. Danach können wir ihn anderweitig vergeben. Ein Anspruch auf Rückzahlung entsteht dadurch nicht.',
      ],
    },
    {
      id: 'streit',
      title: '8. Unterschiedliche Angaben',
      paragraphs: [
        'Sollten diese Stornobedingungen und die AGB voneinander abweichen, gelten für Stornierungen die Regelungen dieser Seite.',
        'Zwingende gesetzliche Verbraucherrechte bleiben in jedem Fall unberührt.',
      ],
    },
  ],
};

export const widerruf: LegalDocument = {
  slug: 'widerruf',
  title: 'Widerrufsrecht',
  description: 'Information zum Widerrufsrecht bei Tischreservierungen für terminierte Veranstaltungen.',
  updated: stand,
  intro: 'Diese Seite erläutert, ob und wann dir bei einer Buchung ein Widerrufsrecht zusteht.',
  sections: [
    {
      id: 'grundsatz',
      title: '1. Grundsatz',
      paragraphs: [
        'Bei Verträgen, die ausschließlich über Fernkommunikationsmittel geschlossen werden, steht Verbrauchern grundsätzlich ein vierzehntägiges Widerrufsrecht zu.',
        'Das Widerrufsrecht besteht nicht in allen Fällen. Für bestimmte Vertragsarten sieht das Gesetz Ausnahmen vor.',
      ],
    },
    {
      id: 'ausnahme',
      title: '2. Ausnahme für terminierte Freizeitveranstaltungen',
      paragraphs: [
        'Nach § 312g Abs. 2 Nr. 9 BGB besteht kein Widerrufsrecht für Verträge über die Erbringung von Dienstleistungen im Bereich der Freizeitgestaltung, wenn der Vertrag für die Erbringung einen spezifischen Termin oder Zeitraum vorsieht.',
        'Die über diese Website buchbaren Tischreservierungen sind an eine konkrete Veranstaltung, einen konkreten Veranstaltungstag und ein konkretes Zeitfenster gebunden. Die Leistung kann nicht zu einem anderen Zeitpunkt erbracht werden.',
        'Wir gehen daher davon aus, dass für diese Buchungen kein Widerrufsrecht besteht. Ein Widerruf ist in diesem Fall nicht möglich; es gelten die Stornobedingungen.',
      ],
    },
    {
      id: 'verzehrguthaben',
      title: '3. Verzehrguthaben',
      paragraphs: [
        'Das im Paketpreis enthaltene Verzehrguthaben ist untrennbar mit der terminierten Reservierung verbunden und nicht gesondert übertragbar.',
        'Sollte im Einzelfall ein Widerrufsrecht bestehen, wende dich an die unten genannte Kontaktadresse. Wir prüfen den Einzelfall und erstatten gegebenenfalls den gezahlten Betrag.',
      ],
    },
    {
      id: 'unternehmen',
      title: '4. Buchungen von Unternehmen',
      paragraphs: [
        'Das Widerrufsrecht steht nur Verbrauchern zu. Buchungen, die im Rahmen einer gewerblichen oder selbständigen beruflichen Tätigkeit erfolgen, können nicht widerrufen werden.',
      ],
    },
    {
      id: 'kontakt',
      title: '5. Kontakt',
      paragraphs: [
        `Für Fragen zum Widerruf oder zur Stornierung erreichst du uns unter ${COMPANY.email}. Bitte nenne dabei die Angaben aus deiner Buchungsbestätigung.`,
      ],
    },
  ],
};

export const legalDocuments = { agb, stornobedingungen, widerruf };