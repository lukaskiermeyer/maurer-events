import type { ReservationRow, TableRecord, TentDimensions } from "@/types/domain";

const PLAN_WIDTH = 400;
const PLAN_HEIGHT = 230;

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function PlanSvg({
  tables,
  reservations,
  tent,
  mode,
}: {
  tables: TableRecord[];
  reservations: ReservationRow[];
  tent: TentDimensions;
  mode: "internal" | "public";
}) {
  const cellSizeM = tent.cellSizeM && tent.cellSizeM > 0 ? tent.cellSizeM : 1.2;
  const maxX = tables.reduce((max, table) => Math.max(max, table.positionX), 0);
  const maxY = tables.reduce((max, table) => Math.max(max, table.positionY), 0);
  const widthCells = Math.max(1, tent.width, maxX + 1);
  const heightCells = Math.max(1, tent.height, maxY + 1);
  const cell = Math.min(PLAN_WIDTH / widthCells, PLAN_HEIGHT / heightCells);
  const offsetX = (PLAN_WIDTH - widthCells * cell) / 2;
  const offsetY = (PLAN_HEIGHT - heightCells * cell) / 2;
  const numberSize = Math.min(4.2, Math.max(2.2, cell * 0.15));
  const smallSize = Math.min(3, Math.max(1.7, cell * 0.1));

  const byTable = new Map<string, ReservationRow[]>();
  for (const row of reservations) {
    const tableId = row.reservation.tableId;
    if (!tableId) continue;
    const list = byTable.get(tableId) || [];
    list.push(row);
    byTable.set(tableId, list);
  }

  return (
    <svg
      className="plan-svg w-full h-auto"
      viewBox={`0 0 ${PLAN_WIDTH} ${PLAN_HEIGHT}`}
      role="img"
      aria-label="Tischplan"
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      <rect x={offsetX} y={offsetY} width={widthCells * cell} height={heightCells * cell} fill="#F9F7F3" stroke="#D8D2C7" strokeWidth={0.5} />
      {Array.from({ length: heightCells + 1 }, (_, i) => (
        <line key={`h-${i}`} x1={offsetX} x2={offsetX + widthCells * cell} y1={offsetY + i * cell} y2={offsetY + i * cell} stroke="#E8E3D9" strokeWidth={0.2} />
      ))}
      {Array.from({ length: widthCells + 1 }, (_, i) => (
        <line key={`v-${i}`} x1={offsetX + i * cell} x2={offsetX + i * cell} y1={offsetY} y2={offsetY + heightCells * cell} stroke="#E8E3D9" strokeWidth={0.2} />
      ))}

      {tent.features?.map((feature, index) => {
        const fill = feature.kind === 'stage' ? '#1F5732' : feature.kind === 'bar' ? '#CB7913' : feature.kind === 'blocked' ? '#9CA3AF' : '#E8E3D9';
        const color = feature.kind === 'entrance' ? '#0A0A0A' : '#FFFFFF';
        return (
          <g key={`${feature.kind}-${index}`}>
            <rect
              x={offsetX + feature.x * cell}
              y={offsetY + feature.y * cell}
              width={feature.w * cell}
              height={feature.h * cell}
              rx={cell * 0.08}
              fill={fill}
              opacity={feature.kind === 'entrance' ? 0.18 : 0.9}
              stroke={feature.kind === 'entrance' ? '#0A0A0A' : 'none'}
              strokeWidth={0.5}
            />
            <text
              x={offsetX + (feature.x + feature.w / 2) * cell}
              y={offsetY + (feature.y + feature.h / 2) * cell}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={smallSize}
              fontWeight="700"
              fill={color}
              fontFamily="Helvetica, Arial, sans-serif"
            >
              {feature.label || (feature.kind === 'stage' ? 'Bühne' : feature.kind === 'bar' ? 'Theke' : feature.kind === 'entrance' ? 'Eingang' : 'Gesperrt')}
            </text>
          </g>
        );
      })}

      {tables.map(table => {
        const rows = byTable.get(table.id) || [];
        const reservation = rows[0]?.reservation;
        const blocked = table.isBlocked;
        const vip = table.isVip;
        const fill = blocked ? "#9CA3AF" : vip ? "#CB7913" : reservation ? "#1F5732" : "#FFFFFF";
        const text = blocked || vip || reservation ? "#FFFFFF" : "#0A0A0A";
        const tableW = cell * 0.78;
        const tableH = cell * 0.64;
        const x = offsetX + table.positionX * cell + (cell - tableW) / 2;
        const y = offsetY + table.positionY * cell + (cell - tableH) / 2;
        const cx = x + tableW / 2;
        const cy = y + tableH / 2;
        const displayNumber = table.displayNumber || table.name;
        const section = table.section || "Zelt";
        const rowLabel = table.rowLabel || String(table.positionY + 1);
        const guest = reservation ? (mode === "internal" ? truncate(reservation.guestName, 18) : "reserviert") : "";
        const detail = reservation ? `${reservation.guestCount} Pers.${reservation.selectedTime ? ` · ${reservation.selectedTime}` : ""}` : "";
        const group = reservation?.groupLabel && mode === "internal" ? truncate(reservation.groupLabel, 20) : "";
        return (
          <g key={table.id} transform={table.rotation ? `rotate(${table.rotation} ${cx} ${cy})` : undefined}>
            {table.shape === "round" ? (
              <ellipse cx={cx} cy={cy} rx={tableW / 2} ry={tableH / 2} fill={fill} stroke="#1F5732" strokeWidth={0.7} />
            ) : (
              <rect x={x} y={y} width={tableW} height={tableH} rx={cell * 0.06} fill={fill} stroke="#1F5732" strokeWidth={0.7} />
            )}
            <text x={cx} y={cy - cell * 0.1} textAnchor="middle" dominantBaseline="middle" fontSize={numberSize} fontWeight="800" fill={text} fontFamily="Helvetica, Arial, sans-serif">
              {displayNumber}
            </text>
            <text x={cx} y={cy + cell * 0.08} textAnchor="middle" dominantBaseline="middle" fontSize={smallSize} fill={text} opacity={0.85} fontFamily="Helvetica, Arial, sans-serif">
              {section} · R{rowLabel}
            </text>
            {reservation && (
              <>
                <text x={cx} y={cy + cell * 0.22} textAnchor="middle" dominantBaseline="middle" fontSize={smallSize} fontWeight="700" fill={text} fontFamily="Helvetica, Arial, sans-serif">
                  {guest}
                </text>
                <text x={cx} y={cy + cell * 0.33} textAnchor="middle" dominantBaseline="middle" fontSize={smallSize * 0.92} fill={text} opacity={0.85} fontFamily="Helvetica, Arial, sans-serif">
                  {group || detail}
                </text>
                {group && (
                  <text x={cx} y={cy + cell * 0.42} textAnchor="middle" dominantBaseline="middle" fontSize={smallSize * 0.92} fill={text} opacity={0.85} fontFamily="Helvetica, Arial, sans-serif">
                    {detail}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}

      <g transform={`translate(${offsetX + 4} ${offsetY + heightCells * cell - 7})`}>
        <line x1={0} y1={0} x2={5 / cellSizeM * cell} y2={0} stroke="#0A0A0A" strokeWidth={0.6} />
        <line x1={0} y1={-1.5} x2={0} y2={1.5} stroke="#0A0A0A" strokeWidth={0.6} />
        <line x1={5 / cellSizeM * cell} y1={-1.5} x2={5 / cellSizeM * cell} y2={1.5} stroke="#0A0A0A" strokeWidth={0.6} />
        <text x={5 / cellSizeM * cell / 2} y={-2.5} textAnchor="middle" fontSize={2.4} fill="#0A0A0A" fontFamily="Helvetica, Arial, sans-serif">5 m</text>
      </g>
    </svg>
  );
}