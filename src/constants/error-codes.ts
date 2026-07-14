import type { ErrorSeverity } from "../types.js";

const errorCodes = {
  "0000": {
    severity: "INFO",
    message: "Testnachricht",
  },
  "0001": {
    severity: "INFO",
    message: "Statusnachricht",
  },
  "0002": {
    severity: "ALARM",
    message: "Hardwareproblem (COM-Link zum Carrier fehlerhaft)",
  },
  "0003": {
    severity: "REMINDER",
    message: "Alles Gute zum Geburtstag!",
  },
  "0005": {
    severity: "REMINDER",
    message: "Systemnachricht",
  },
  "0008": {
    severity: "WARNING",
    message: "CPU-Temperatur hoch (> 83°C)",
  },
  "0009": {
    severity: "ALARM",
    message: "CPU-Temperatur zu hoch (> 95°C)",
  },
  "0010": {
    severity: "REMINDER",
    message: "Update steht zur Installation bereit. Keine Aktion erforderlich.",
  },
  "0011": {
    severity: "REMINDER",
    message: "Update steht zur Installation bereit. Installation erforderlich.",
  },
  "0012": {
    severity: "REMINDER",
    message: "Update steht zur Installation bereit. Installation erforderlich.",
  },
  "0020": {
    severity: "ALARM",
    message: "Filterdrucküberwachung (Druck zu niedrig)",
  },
  "0021": {
    severity: "ALARM",
    message: "Filterdrucküberwachung (Druck zu hoch)",
  },
  "0022": {
    severity: "WARNING",
    message: "Messwasserüberwachung (Anströmung fehlt)",
  },
  "0023": {
    severity: "WARNING",
    message: "Messwasserüberwachung (Anströmung zu hoch)",
  },
  "0024": {
    severity: "ALARM",
    message: "Zirkulationsüberwachung (Zirkulation fehlt)",
  },
  "0025": {
    severity: "ALARM",
    message: "Zirkulationsüberwachung (Zirkulation zu hoch)",
  },
  "0026": {
    severity: "ALARM",
    message: "Filterpumpen-Frostschutz nicht verfügbar - Sensorfehler",
  },
  "0027": {
    severity: "ALARM",
    message: "Absorber-Frostschutz nicht verfügbar - Sensorfehler",
  },
  "0030": {
    severity: "WARNING",
    message: "Wärmetauscher Temperatur zu hoch",
  },
  "0031": {
    severity: "ALARM",
    message: "Wärmetauscher ÜberTemperatur-Schutz nicht verfügbar - Sensorfehler",
  },
  "0040": {
    severity: "WARNING",
    message: "Rückspülung wurde ausgelassen",
  },
  "0041": {
    severity: "INFO",
    message: "Nachspeisung fehlgeschlagen",
  },
  "0042": {
    severity: "INFO",
    message: "Nachspeisung fehlgeschlagen",
  },
  "0045": {
    severity: "ALARM",
    message: "OmniTronic gibt keine Positionsrückmeldung (Rückspülen)",
  },
  "0046": {
    severity: "ALARM",
    message: "OmniTronic gibt keine Positionsrückmeldung (Nachspülen)",
  },
  "0047": {
    severity: "ALARM",
    message: "Fehler bei Positionierung des Omni-Antriebs (Timeout)",
  },
  "0049": {
    severity: "ALARM",
    message: "OmniTronic-Fehler: Rückmeldekontakt z1/z2 nicht geschlossen",
  },
  "0050": {
    severity: "ALARM",
    message: "Fehler bei Wassernachspeisung / Schwimmerschalter",
  },
  "0051": {
    severity: "ALARM",
    message: "Fehler bei Wassernachspeisung / Schwimmerschalter",
  },
  "0052": {
    severity: "ALARM",
    message: "Fehler bei Wassernachspeisung / Schwimmerschalter",
  },
  "0053": {
    severity: "ALARM",
    message: "Fehler bei Wassernachspeisung / Magnetventil öffnet nicht",
  },
  "0054": {
    severity: "ALARM",
    message: "Fehler bei Wassernachspeisung / Magnetventil schließt nicht",
  },
  "0060": {
    severity: "ALARM",
    message: "Überlaufbehältersteuerung: Fehler bei Wassernachspeisung",
  },
  "0061": {
    severity: "WARNING",
    message: "Überlaufbehältersteuerung: Trockenlaufschutz ausgelöst",
  },
  "0062": {
    severity: "WARNING",
    message: "Überlaufbehälter: Pegelmessung fehlerhaft",
  },
  "0071": {
    severity: "INFO",
    message: "Temperatursteuerung, Schaltprogramm 1 ausgelöst",
  },
  "0072": {
    severity: "INFO",
    message: "Temperatursteuerung, Schaltprogramm 2 ausgelöst",
  },
  "0073": {
    severity: "INFO",
    message: "Temperatursteuerung, Schaltprogramm 3 ausgelöst",
  },
  "0074": {
    severity: "INFO",
    message: "Temperatursteuerung, Schaltprogramm 4 ausgelöst",
  },
  "0075": {
    severity: "INFO",
    message: "Temperatursteuerung, Schaltprogramm 5 ausgelöst",
  },
  "0076": {
    severity: "INFO",
    message: "Temperatursteuerung, Schaltprogramm 6 ausgelöst",
  },
  "0077": {
    severity: "INFO",
    message: "Temperatursteuerung, Schaltprogramm 7 ausgelöst",
  },
  "0078": {
    severity: "INFO",
    message: "Temperatursteuerung, Schaltprogramm 8 ausgelöst",
  },
  "0081": {
    severity: "INFO",
    message: "Analogregeln, Schaltprogramm 1 ausgelöst",
  },
  "0082": {
    severity: "INFO",
    message: "Analogregeln, Schaltprogramm 2 ausgelöst",
  },
  "0083": {
    severity: "INFO",
    message: "Analogregeln, Schaltprogramm 3 ausgelöst",
  },
  "0084": {
    severity: "INFO",
    message: "Analogregeln, Schaltprogramm 4 ausgelöst",
  },
  "0085": {
    severity: "INFO",
    message: "Analogregeln, Schaltprogramm 5 ausgelöst",
  },
  "0086": {
    severity: "INFO",
    message: "Analogregeln, Schaltprogramm 6 ausgelöst",
  },
  "0087": {
    severity: "INFO",
    message: "Analogregeln, Schaltprogramm 7 ausgelöst",
  },
  "0088": {
    severity: "INFO",
    message: "Analogregeln, Schaltprogramm 8 ausgelöst",
  },
  "0091": {
    severity: "INFO",
    message: "Schaltregeln: Schaltprogramm 1 ausgelöst",
  },
  "0092": {
    severity: "INFO",
    message: "Schaltregeln: Schaltprogramm 2 ausgelöst",
  },
  "0093": {
    severity: "INFO",
    message: "Schaltregeln: Schaltprogramm 3 ausgelöst",
  },
  "0094": {
    severity: "INFO",
    message: "Schaltregeln: Schaltprogramm 4 ausgelöst",
  },
  "0095": {
    severity: "INFO",
    message: "Schaltregeln: Schaltprogramm 5 ausgelöst",
  },
  "0096": {
    severity: "INFO",
    message: "Schaltregeln: Schaltprogramm 6 ausgelöst",
  },
  "0097": {
    severity: "INFO",
    message: "Schaltregeln: Schaltprogramm 7 ausgelöst",
  },
  "0098": {
    severity: "INFO",
    message: "Schaltregeln: Schaltprogramm 8 ausgelöst",
  },
  "0101": {
    severity: "WARNING",
    message: "Temperatursensor 1: Fehler bei Messwerterfassung",
  },
  "0102": {
    severity: "WARNING",
    message: "Temperatursensor 2: Fehler bei Messwerterfassung",
  },
  "0103": {
    severity: "WARNING",
    message: "Temperatursensor 3: Fehler bei Messwerterfassung",
  },
  "0104": {
    severity: "WARNING",
    message: "Temperatursensor 4: Fehler bei Messwerterfassung",
  },
  "0105": {
    severity: "WARNING",
    message: "Temperatursensor 5: Fehler bei Messwerterfassung",
  },
  "0106": {
    severity: "WARNING",
    message: "Temperatursensor 6: Fehler bei Messwerterfassung",
  },
  "0107": {
    severity: "WARNING",
    message: "Temperatursensor 7: Fehler bei Messwerterfassung",
  },
  "0108": {
    severity: "WARNING",
    message: "Temperatursensor 8: Fehler bei Messwerterfassung",
  },
  "0109": {
    severity: "WARNING",
    message: "Temperatursensor 9: Fehler bei Messwerterfassung",
  },
  "0110": {
    severity: "WARNING",
    message: "Temperatursensor 10: Fehler bei Messwerterfassung",
  },
  "0111": {
    severity: "WARNING",
    message: "Temperatursensor 11: Fehler bei Messwerterfassung",
  },
  "0112": {
    severity: "WARNING",
    message: "Temperatursensor 12: Fehler bei Messwerterfassung",
  },
  "0120": {
    severity: "WARNING",
    message: "Chlor-Dosierung: Redox Grenzwert erreicht",
  },
  "0121": {
    severity: "WARNING",
    message: "Chlor-Dosierung: Chlor Grenzwert erreicht",
  },
  "0122": {
    severity: "WARNING",
    message: "Chlor-Dosierung: max. Tagesdosierleistung erreicht",
  },
  "0123": {
    severity: "WARNING",
    message: "Chlor-Kanister Restinhalt niedrig",
  },
  "0124": {
    severity: "WARNING",
    message: "Chlor-Kanister leer",
  },
  "0125": {
    severity: "WARNING",
    message: "Leermeldekontakt: Chlor-Kanister",
  },
  "0130": {
    severity: "WARNING",
    message: "Elektrolyse: Redox Grenzwert erreicht",
  },
  "0131": {
    severity: "WARNING",
    message: "Elektrolyse: Chlor Grenzwert erreicht",
  },
  "0132": {
    severity: "WARNING",
    message: "Elektrolyse: maximale Tagesproduktion erreicht",
  },
  "0133": {
    severity: "WARNING",
    message: "Elektrolyse: Restlaufzeitwarnung für Zelle",
  },
  "0134": {
    severity: "WARNING",
    message: "Elektrolyse: maximale Gesamt-Betriebszeit erreicht",
  },
  "0135": {
    severity: "WARNING",
    message: "Elektrolyse: Durchflussschalter ausgelöst",
  },
  "0142": {
    severity: "WARNING",
    message: "H2O2-Dosierung: max. Tagesdosierleistung erreicht",
  },
  "0143": {
    severity: "WARNING",
    message: "H2O2-Dosierung: Kanister Restinhalt niedrig",
  },
  "0144": {
    severity: "WARNING",
    message: "H2O2-Dosierung: Kanister leer",
  },
  "0145": {
    severity: "WARNING",
    message: "Leermeldekontakt: H2O2-Kanister",
  },
  "0150": {
    severity: "WARNING",
    message: "pH-minus Dosierung: pH Grenzwert erreicht",
  },
  "0152": {
    severity: "WARNING",
    message: "pH-minus Dosierung: max. Tagesdosierleistung erreicht",
  },
  "0153": {
    severity: "WARNING",
    message: "pH-minus Dosierung: Kanister Restinhalt niedrig",
  },
  "0154": {
    severity: "WARNING",
    message: "pH-minus Dosierung: Kanister leer",
  },
  "0155": {
    severity: "WARNING",
    message: "Leermeldekontakt: pH-minus Kanister",
  },
  "0160": {
    severity: "WARNING",
    message: "pH-plus Dosierung: pH Grenzwert erreicht",
  },
  "0162": {
    severity: "WARNING",
    message: "pH-plus Dosierung: max. Tagesdosierleistung erreicht",
  },
  "0163": {
    severity: "WARNING",
    message: "pH-plus Dosierung: Kanister Restinhalt niedrig",
  },
  "0164": {
    severity: "WARNING",
    message: "pH-plus Dosierung: Kanister leer",
  },
  "0165": {
    severity: "WARNING",
    message: "Leermeldekontakt: pH-plus Kanister",
  },
  "0172": {
    severity: "WARNING",
    message: "Flockmittel: max. Tagesdosierleistung erreicht",
  },
  "0173": {
    severity: "WARNING",
    message: "Flockmittel: Kanister Restinhalt niedrig",
  },
  "0174": {
    severity: "WARNING",
    message: "Flockmittel: Kanister leer",
  },
  "0175": {
    severity: "WARNING",
    message: "Leermeldekontakt: Flockmittel Kanister",
  },
  "0180": {
    severity: "REMINDER",
    message: "Erinnerung: pH-Elektrode kalibrieren",
  },
  "0181": {
    severity: "REMINDER",
    message: "Erinnerung: Redox-Elektrode kalibrieren",
  },
  "0182": {
    severity: "REMINDER",
    message: "Erinnerung: Chlor-Elektrode kalibrieren",
  },
  "0200": {
    severity: "WARNING",
    message: "Dosiermodul: nicht mehr verbunden (abgesteckt)",
  },
  "0201": {
    severity: "WARNING",
    message: "Dosiermodul: Kommunikation verloren",
  },
  "0203": {
    severity: "WARNING",
    message: "Relais-Erweiterung 1: nicht mehr verbunden (abgesteckt)",
  },
  "0204": {
    severity: "WARNING",
    message: "Relais-Erweiterung 1: Kommunikation verloren",
  },
  "0206": {
    severity: "WARNING",
    message: "Relais-Erweiterung 2: nicht mehr verbunden (abgesteckt)",
  },
  "0207": {
    severity: "WARNING",
    message: "Relais-Erweiterung 2: Kommunikation verloren",
  },
  "0208": {
    severity: "ALARM",
    message: "Zweites Dosiermodul erkannt. Wird ignoriert.",
  },
  "0209": {
    severity: "ALARM",
    message: "Falsch codierte Relais Erweiterung erkannt.",
  },
  "0210": {
    severity: "ALARM",
    message: "Falsch codierte Relais-Erweiterung erkannt (Duplikat).",
  },
} as const satisfies Readonly<Record<string, { severity: ErrorSeverity; message: string }>>;

export const ERROR_CODES: Readonly<Record<string, { severity: ErrorSeverity; message: string }>> =
  errorCodes;
