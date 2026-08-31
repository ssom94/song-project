export interface StudyExportRow {
	word: string;
	reading: string;
	meaningKo: string;
}

const encoder = new TextEncoder();

function xmlEscape(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function columnName(index: number): string {
	let value = index + 1;
	let result = '';
	while (value > 0) {
		const remainder = (value - 1) % 26;
		result = String.fromCharCode(65 + remainder) + result;
		value = Math.floor((value - 1) / 26);
	}
	return result;
}

function inlineCell(column: number, row: number, value: string, style = 0): string {
	const ref = `${columnName(column)}${row}`;
	const escaped = xmlEscape(value);
	const preserve = /^\s|\s$|\n/.test(value) ? ' xml:space="preserve"' : '';
	return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t${preserve}>${escaped}</t></is></c>`;
}

function worksheetXml(rows: StudyExportRow[]): string {
	const headers = ['일본어', '빈칸(히라가나)', '빈칸(한국어)', '히라가나', '한국어'];
	const header = headers.map((value, index) => inlineCell(index, 1, value, 1)).join('');
	const body = rows.map((row, index) => {
		const number = index + 2;
		const values = [row.word, '', '', row.reading, row.meaningKo];
		return `<row r="${number}">${values.map((value, column) => inlineCell(column, number, value)).join('')}</row>`;
	}).join('');
	const lastRow = Math.max(1, rows.length + 1);
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="3" width="20" customWidth="1"/><col min="4" max="4" width="24" customWidth="1"/><col min="5" max="5" width="34" customWidth="1"/></cols>
<sheetData><row r="1">${header}</row>${body}</sheetData>
<autoFilter ref="A1:E${lastRow}"/>
</worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="단어시험" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><name val="Aptos"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFECEFF7"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

let crcTable: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
	if (crcTable) return crcTable;
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n += 1) {
		let c = n;
		for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
		table[n] = c >>> 0;
	}
	crcTable = table;
	return table;
}

function crc32(bytes: Uint8Array): number {
	const table = getCrcTable();
	let crc = 0xffffffff;
	for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
	return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value: number): Uint8Array {
	return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function concat(parts: Uint8Array[]): Uint8Array {
	const size = parts.reduce((sum, part) => sum + part.length, 0);
	const output = new Uint8Array(size);
	let offset = 0;
	for (const part of parts) {
		output.set(part, offset);
		offset += part.length;
	}
	return output;
}

interface ZipEntry {
	name: string;
	data: Uint8Array;
}

function zipStore(entries: ZipEntry[]): Uint8Array {
	const localParts: Uint8Array[] = [];
	const centralParts: Uint8Array[] = [];
	let offset = 0;
	for (const entry of entries) {
		const name = encoder.encode(entry.name);
		const data = entry.data;
		const crc = crc32(data);
		const local = concat([
			u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
			u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
		]);
		localParts.push(local);
		const central = concat([
			u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
			u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
			u16(0), u16(0), u32(0), u32(offset), name,
		]);
		centralParts.push(central);
		offset += local.length;
	}
	const locals = concat(localParts);
	const central = concat(centralParts);
	const end = concat([
		u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
		u32(central.length), u32(locals.length), u16(0),
	]);
	return concat([locals, central, end]);
}

export function createStudyXlsx(rows: StudyExportRow[]): Uint8Array {
	const entries: ZipEntry[] = [
		{ name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES) },
		{ name: '_rels/.rels', data: encoder.encode(ROOT_RELS) },
		{ name: 'xl/workbook.xml', data: encoder.encode(WORKBOOK) },
		{ name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(WORKBOOK_RELS) },
		{ name: 'xl/styles.xml', data: encoder.encode(STYLES) },
		{ name: 'xl/worksheets/sheet1.xml', data: encoder.encode(worksheetXml(rows)) },
	];
	return zipStore(entries);
}
