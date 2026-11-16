export interface SedeCroceOro {
  id: string;
  nome: string;
  sezione: string;
  indirizzoCompleto: string;
  comune: string;
  servizi: string[];
  telefono?: string;
  note?: string;
  coordinate: {
    lat: number;
    lng: number;
  };
  googleMapsUrl?: string;
}

export const SEDI_CROCE_ORO: SedeCroceOro[] = [
  {
    id: 'sede-croce-oro-massa',
    nome: 'Sede Croce Oro Massa (Sede Legale & Territoriale)',
    sezione: 'Massa (Ronchi)',
    indirizzoCompleto: 'Via Como, 12 Località Ronchi, 54100 Marina di Massa MS',
    comune: 'Massa',
    servizi: ['Protezione Civile', 'Tutela Ambientale', 'Sede Legale & Territoriale'],
    telefono: '0585 625410',
    note: 'Sede Legale e Territoriale di Massa (dietro il Parco della Comasca a Ronchi)',
    coordinate: {
      lat: 43.99419,
      lng: 10.12367
    },
    googleMapsUrl: 'https://www.google.com/maps?q=43.99419,10.12367'
  },
  {
    id: 'sede-croce-oro-massa-jare',
    nome: 'Sede Operativa Croce Oro Massa (Le Jare)',
    sezione: 'Massa (Le Jare)',
    indirizzoCompleto: 'Via Delle Jare, 9, 54100 Massa MS',
    comune: 'Massa',
    servizi: ['Protezione Civile', 'Autoparco Emergenze', 'Sede Operativa'],
    telefono: '0585 625410',
    note: 'Sede operativa e autoparco in Via Delle Jare, 9 a Massa (Le Jare / Turano)',
    coordinate: {
      lat: 44.01700,
      lng: 10.15121
    },
    googleMapsUrl: 'https://www.google.com/maps?q=44.01700,10.15121'
  },
  {
    id: 'sede-croce-oro-carrara',
    nome: 'Sezione Territoriale Carrara (Fossone / Monteverde)',
    sezione: 'Carrara (Fossone / Monteverde)',
    indirizzoCompleto: 'Strada Comunale di Monteverde, 49 Località Fossone, 54033 Carrara MS',
    comune: 'Carrara',
    servizi: ['Ambulanza Veterinaria', 'Protezione Civile', 'Soccorso H24'],
    telefono: '0585 625410',
    note: 'Sezione territoriale di Carrara a Fossone / Monteverde (RSD Monteverde Anffas)',
    coordinate: {
      lat: 44.066716,
      lng: 10.049207
    },
    googleMapsUrl: 'https://maps.app.goo.gl/xKTYENNFmQSJkMiv9'
  },
  {
    id: 'sede-croce-oro-pietrasanta',
    nome: 'Sede Croce Oro Pietrasanta (Sezione Territoriale)',
    sezione: 'Pietrasanta',
    indirizzoCompleto: 'Piazza Villeparisis, 14 Località Marina di Pietrasanta, 55045 Pietrasanta LU',
    comune: 'Pietrasanta',
    servizi: ['Ambulanza Veterinaria', 'Protezione Civile', 'Presidio Versilia'],
    telefono: '0585 625410',
    note: 'Sezione territoriale di Marina di Pietrasanta (accanto alla Misericordia)',
    coordinate: {
      lat: 43.92771,
      lng: 10.20194
    },
    googleMapsUrl: 'https://www.google.com/maps?q=43.92771,10.20194'
  },
  {
    id: 'sede-croce-oro-lunigiana',
    nome: 'Sede Croce Oro Lunigiana (Sezione Territoriale)',
    sezione: 'Lunigiana',
    indirizzoCompleto: 'Piazza Cavour / Piazza della Vittoria, 54011 Aulla MS',
    comune: 'Lunigiana',
    servizi: ['Ambulanza Veterinaria', 'Protezione Civile'],
    telefono: '0585 625410',
    note: 'Sezione territoriale Lunigiana (Aulla)',
    coordinate: {
      lat: 44.21455,
      lng: 9.96779
    },
    googleMapsUrl: 'https://www.google.com/maps?q=44.21455,9.96779'
  }
];
