import type { Match } from '../../../../../../../packages/mahjong-core/ledger';
import { localizedDate } from '../../../core/i18n/date-format';
import type { Language } from '../../../core/i18n/messages';
import type { FinalStanding } from '../../../../../../../packages/mahjong-core/final-results';
import type { PlayerStatistics, ScorePoint } from './match-statistics';
export const playerColors = ['#176947', '#245fb3', '#a45116', '#913d78'];
export const statisticFields: {
  key: keyof PlayerStatistics;
  label: string;
  format: 'percent' | 'points' | 'count' | 'decimal';
}[] = [
  { key: 'winRate', label: 'Win rate', format: 'percent' },
  { key: 'dealInRate', label: 'Deal-in rate', format: 'percent' },
  { key: 'averageWin', label: 'Average win score', format: 'points' },
  { key: 'averageDealIn', label: 'Average deal-in score', format: 'points' },
  { key: 'averageTsumo', label: 'Average Tsumo score', format: 'points' },
  { key: 'averageRon', label: 'Average Ron score', format: 'points' },
  { key: 'tsumoCount', label: 'Tsumo count', format: 'count' },
  { key: 'ronCount', label: 'Ron count', format: 'count' },
  { key: 'riichiRate', label: 'Riichi rate', format: 'percent' },
  { key: 'openRate', label: 'Open hand rate', format: 'percent' },
  { key: 'tenpaiRate', label: 'Tenpai rate', format: 'percent' },
  { key: 'averageStreak', label: 'Average winning streak', format: 'decimal' },
];
export function statisticText(
  value: string | number | null,
  format: string,
  locale: string,
): string {
  if (value === null) return '\u2014';
  return new Intl.NumberFormat(
    locale,
    format === 'percent'
      ? { style: 'percent', maximumFractionDigits: 1 }
      : { maximumFractionDigits: format === 'decimal' ? 2 : 0 },
  ).format(Number(value));
}
export async function statisticsImage(
  match: Match,
  rows: FinalStanding[],
  players: PlayerStatistics[],
  points: ScorePoint[],
  t: (key: string) => string,
  locale: Language,
  selected = '',
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1150;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image export is unavailable.');
  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, 1600, 1150);
  ctx.fillStyle = '#173e31';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(match.name, 48, 55, 1500);
  ctx.font = '20px sans-serif';
  ctx.fillText(
    t('Final results') +
      ' \u00b7 ' +
      match.playerCount +
      'P \u00b7 ' +
      localizedDate(match.updatedAt, locale, 'date'),
    48,
    90,
  );
  const columns = match.players
    .filter((player) => !selected || player.id === selected)
    .sort(
      (a, b) =>
        rows.find((row) => row.id === a.id)!.rank - rows.find((row) => row.id === b.id)!.rank,
    )
    .map((player, index) => ({
      player,
      x: 500 + index * 270,
      color: playerColors[match.players.findIndex((person) => person.id === player.id)],
    }));
  for (const column of columns) {
    const rank = rows.find((row) => row.id === column.player.id)!;
    ctx.fillStyle = column.color;
    ctx.font = 'bold 23px sans-serif';
    ctx.fillText('#' + rank.rank + ' ' + column.player.name, column.x, 140, 250);
    ctx.font = '20px sans-serif';
    ctx.fillText(
      rank.points.toLocaleString(locale) + ' \u00b7 ' + rank.finalScore.toLocaleString(locale),
      column.x,
      173,
      250,
    );
  }
  statisticFields.forEach((field, index) => {
    const y = 215 + index * 34;
    ctx.fillStyle = index % 2 ? '#fffdf7' : '#edf2e8';
    ctx.fillRect(40, y - 24, 1520, 34);
    ctx.fillStyle = '#243d34';
    ctx.font = '19px sans-serif';
    ctx.fillText(t(field.label), 56, y, 420);
    for (const column of columns) {
      const stat = players.find((player) => player.id === column.player.id)!;
      ctx.fillText(statisticText(stat[field.key], field.format, locale), column.x, y, 250);
    }
  });
  const values = points.flatMap((point) => Object.values(point.balances));
  const min = Math.min(...values) - 1000,
    max = Math.max(...values) + 1000;
  const x = (i: number) => 110 + (i / Math.max(1, points.length - 1)) * 1390;
  const y = (value: number) => 940 - ((value - min) / (max - min)) * 260;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(t('Score history'), 48, 660);
  ctx.strokeStyle = '#bcc7bb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(110, 680);
  ctx.lineTo(110, 940);
  ctx.lineTo(1500, 940);
  ctx.stroke();
  ctx.font = '16px sans-serif';
  ctx.fillText(Math.round(max).toLocaleString(locale), 45, 690, 60);
  ctx.fillText(Math.round(min).toLocaleString(locale), 45, 940, 60);
  for (const column of columns) {
    ctx.strokeStyle = column.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(x(index), y(point.balances[column.player.id]));
      else ctx.lineTo(x(index), y(point.balances[column.player.id]));
    });
    ctx.stroke();
    ctx.fillStyle = column.color;
    points.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(x(index), y(point.balances[column.player.id]), 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.fillStyle = '#435548';
  ctx.font = '16px sans-serif';
  ctx.fillText(t('Start'), 110, 970);
  ctx.fillText(t('End'), 1450, 970);
  ctx.fillText(
    t(
      'Rates use recorded hands. Tenpai rate uses recorded exhaustive draws. Missing data is shown as —.',
    ),
    48,
    1020,
    1500,
  );
  ctx.fillText(
    t(
      'Win scores include Honba and awarded Riichi sticks. Winning streaks count consecutive won hands.',
    ),
    48,
    1050,
    1500,
  );
  ctx.fillText('Riichi / table', 48, 1100);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image export is unavailable.'))),
      'image/png',
    ),
  );
}
