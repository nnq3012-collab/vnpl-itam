import { Libre_Barcode_39 } from "next/font/google";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PrintButton from "./print-button";

const barcodeFont = Libre_Barcode_39({ weight: "400", subsets: ["latin"] });

// Code 39 only encodes A-Z, 0-9, and a handful of symbols (- . $ / + % space),
// wrapped in "*" start/stop characters. Asset IDs are uppercased for the
// barcode glyph itself; the human-readable text below keeps the original casing.
function toCode39(assetId: string): string {
  const cleaned = assetId.toUpperCase().replace(/[^A-Z0-9\-. $/+%]/g, "");
  return `*${cleaned}*`;
}

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const assetIds = !params.assetId ? [] : Array.isArray(params.assetId) ? params.assetId : [params.assetId];

  const devices = await prisma.device.findMany({
    where: { assetId: { in: assetIds } },
    include: { deviceType: true },
    orderBy: { assetId: "asc" },
  });

  // Pair devices two-per-row to match the 70mm x 25mm physical label sheet
  // (two 35mm-wide labels per print pass).
  const rows: (typeof devices)[number][][] = [];
  for (let i = 0; i < devices.length; i += 2) {
    rows.push(devices.slice(i, i + 2));
  }

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: 70mm 25mm; margin: 0; }
          body { margin: 0; }
        }
        .label-row {
          display: flex;
          width: 70mm;
          height: 25mm;
          page-break-after: always;
        }
        .label {
          width: 35mm;
          height: 25mm;
          box-sizing: border-box;
          padding: 1mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px dashed #ccc;
        }
        .label-barcode {
          font-size: 26px;
          line-height: 1;
          white-space: nowrap;
          transform: scaleX(0.75);
          transform-origin: center;
        }
        .label-assetid {
          font-size: 11px;
          font-weight: 600;
          font-family: monospace;
          margin-top: 1mm;
        }
        .label-type {
          font-size: 8px;
          color: #555;
          margin-top: 0.5mm;
        }
        @media print {
          .label { border: none; }
        }
      `}</style>

      <div className="no-print max-w-2xl mx-auto p-6 space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">Print Asset Labels</h1>
        <p className="text-sm text-slate-600">
          {devices.length} device(s) selected. Each label is 35mm wide x 25mm tall, two labels per print pass
          (70mm x 25mm), matching a Bixolon thermal label printer configured with that custom paper size in Windows.
        </p>
        <p className="text-sm text-slate-600">
          The barcode uses an embedded Code 39 web font — no font installation is needed on the printing PC (this is
          an improvement over the original Excel-based process, which required a locally installed barcode font).
          Use your browser&apos;s Print dialog (Ctrl+P) and select the label printer.
        </p>
        {devices.length === 0 && (
          <p className="text-sm text-red-600">No matching devices were found for the selected Asset IDs.</p>
        )}
        <PrintButton />
      </div>

      <div>
        {rows.map((row, i) => (
          <div className="label-row" key={i}>
            {row.map((d) => (
              <div className="label" key={d.id}>
                <div className={`label-barcode ${barcodeFont.className}`}>{toCode39(d.assetId)}</div>
                <div className="label-assetid">{d.assetId}</div>
                <div className="label-type">{d.deviceType.name}</div>
              </div>
            ))}
            {row.length === 1 && <div className="label" />}
          </div>
        ))}
      </div>
    </div>
  );
}
