/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

/**
 * Lectura de opening_hours de OpenStreetMap, solo del subconjunto habitual
 * ("Mo-Fr 09:00-14:00,17:00-20:00; Sa 10:00-14:00; Su off", "24/7").
 * Si aparece cualquier cosa rara devuelve null y la ficha ensena el texto
 * original sin decir si esta abierto: mejor callar que mentir.
 */

const DAY_INDEX: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

const UNSUPPORTED = /(ph|sh|easter|sunrise|sunset|dawn|dusk|week|\[|\||jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;

interface Interval {
  from: number; // minutos desde medianoche
  to: number;
}

function parseDays(spec: string): number[] | null {
  const days = new Set<number>();
  for (const chunk of spec.split(',')) {
    const range = chunk.trim().toLowerCase();
    if (!range) continue;
    const match = /^([a-z]{2})(?:-([a-z]{2}))?$/.exec(range);
    if (!match) return null;
    const start = DAY_INDEX[match[1]];
    if (start === undefined) return null;
    if (!match[2]) {
      days.add(start);
      continue;
    }
    const end = DAY_INDEX[match[2]];
    if (end === undefined) return null;
    for (let i = 0; i < 7; i++) {
      const day = (start + i) % 7;
      days.add(day);
      if (day === end) break;
    }
  }
  return days.size ? [...days] : null;
}

function parseTimes(spec: string): Interval[] | null {
  const intervals: Interval[] = [];
  for (const chunk of spec.split(',')) {
    const match = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(chunk.trim());
    if (!match) return null;
    const from = Number(match[1]) * 60 + Number(match[2]);
    const to = Number(match[3]) * 60 + Number(match[4]);
    intervals.push({ from, to });
  }
  return intervals.length ? intervals : null;
}

export function isOpenNow(value: string, now = new Date()): boolean | null {
  const text = value.trim();
  if (!text) return null;
  if (UNSUPPORTED.test(text)) return null;
  if (/^24\/7$/i.test(text)) return true;

  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const yesterday = (day + 6) % 7;

  let matchedToday = false;
  let openNow = false;

  for (const rule of text.split(';')) {
    const trimmed = rule.trim();
    if (!trimmed) continue;

    const closed = /\b(off|closed)\b/i.test(trimmed);
    const daySpec = /^([A-Za-z]{2}(?:-[A-Za-z]{2})?(?:\s*,\s*[A-Za-z]{2}(?:-[A-Za-z]{2})?)*)\s+/.exec(
      trimmed,
    );
    const rest = daySpec ? trimmed.slice(daySpec[0].length).trim() : trimmed;
    const days = daySpec ? parseDays(daySpec[1]) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) return null;

    if (closed) {
      if (days.includes(day)) {
        matchedToday = true;
        openNow = false;
      }
      continue;
    }

    const intervals = parseTimes(rest);
    if (!intervals) return null;

    for (const interval of intervals) {
      const overnight = interval.to <= interval.from;
      if (days.includes(day)) {
        matchedToday = true;
        if (overnight ? minutes >= interval.from : minutes >= interval.from && minutes < interval.to) {
          openNow = true;
        }
      }
      // Un horario que cruza medianoche sigue abierto en la madrugada siguiente.
      if (overnight && days.includes(yesterday) && minutes < interval.to) {
        matchedToday = true;
        openNow = true;
      }
    }
  }

  return matchedToday || openNow ? openNow : false;
}

/** Reescribe el horario en algo legible en español. */
export function formatOpeningHours(value: string): string {
  if (/^24\/7$/i.test(value.trim())) return 'Abierto 24 horas, todos los días';
  const NAMES: Record<string, string> = {
    Mo: 'lun',
    Tu: 'mar',
    We: 'mié',
    Th: 'jue',
    Fr: 'vie',
    Sa: 'sáb',
    Su: 'dom',
  };
  return value
    .split(';')
    .map((rule) =>
      rule
        .trim()
        .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (day) => NAMES[day] ?? day)
        .replace(/\boff\b|\bclosed\b/gi, 'cerrado'),
    )
    .filter(Boolean)
    .join(' · ');
}
