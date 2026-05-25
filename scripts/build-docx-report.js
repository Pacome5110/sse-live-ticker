const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const inputMd = path.join(root, 'PROJE-RAPORU.md');
const outputDocx = process.argv[2]
  ? path.resolve(root, process.argv[2])
  : path.join(root, 'PROJE-RAPORU-SABLON.docx');
const buildDir = path.join(root, '.docx-build');
const wordDir = path.join(buildDir, 'word');
const relsDir = path.join(wordDir, '_rels');
const mediaDir = path.join(wordDir, 'media');

const screenshotFiles = [
  ['docs/screenshots/01-dashboard.png', 'Figure A1 - Main dashboard with live SSE ticker rows'],
  ['docs/screenshots/02-auth-modal.png', 'Figure A2 - Login and registration modal'],
  ['docs/screenshots/03-watchlist.png', 'Figure A3 - Personalized watchlist view'],
  ['docs/screenshots/04-alerts-modal.png', 'Figure A4 - Active price alerts modal'],
  ['docs/screenshots/05-chart-modal.png', 'Figure A5 - Candlestick chart modal'],
  ['docs/screenshots/06-mobile.png', 'Figure A6 - Responsive mobile view'],
  ['docs/screenshots/07-empty-error-state.png', 'Figure A7 - Empty/error search state'],
  ['docs/screenshots/08-theme-ocean.png', 'Figure A8 - Ocean theme variant'],
];

function ensureCleanDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeInline(value) {
  return String(value)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/<br\s*\/?>/gi, '\n');
}

function runProps(kind) {
  if (kind === 'bold') return '<w:rPr><w:b/></w:rPr>';
  if (kind === 'code') {
    return '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="19"/><w:shd w:fill="F2F4F7"/></w:rPr>';
  }
  if (kind === 'italic') return '<w:rPr><w:i/></w:rPr>';
  return '';
}

function textRun(text, kind) {
  const parts = String(text).split('\n');
  return parts.map((part, index) => {
    const br = index > 0 ? '<w:br/>' : '';
    return `<w:r>${runProps(kind)}${br}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`;
  }).join('');
}

function inlineRuns(text) {
  const source = normalizeInline(text);
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let xml = '';
  for (const match of source.matchAll(re)) {
    if (match.index > last) xml += textRun(source.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) xml += textRun(token.slice(2, -2), 'bold');
    else xml += textRun(token.slice(1, -1), 'code');
    last = match.index + token.length;
  }
  if (last < source.length) xml += textRun(source.slice(last));
  return xml || textRun('');
}

function paragraph(text, style = 'Normal', opts = {}) {
  const pageBreakBefore = opts.pageBreakBefore ? '<w:pageBreakBefore/>' : '';
  const jc = opts.center ? '<w:jc w:val="center"/>' : '';
  const numPr = opts.numId
    ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${opts.numId}"/></w:numPr>`
    : '';
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${pageBreakBefore}${numPr}${jc}</w:pPr>${inlineRuns(text)}</w:p>`;
}

function pageBreak() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function tableCell(text, width, header) {
  const fill = header ? '<w:shd w:fill="F2F4F7"/>' : '';
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:pStyle w:val="TableText"/></w:pPr>${inlineRuns(text)}</w:p></w:tc>`;
}

function table(rows) {
  if (!rows.length) return '';
  const count = Math.max(...rows.map((row) => row.length));
  const patterns = {
    2: [2200, 7160],
    3: [2200, 3600, 3560],
    4: [1200, 3000, 3200, 1960],
    5: [1000, 2300, 2600, 1700, 1760],
  };
  const widths = patterns[count] || Array.from({ length: count }, () => Math.floor(9360 / count));
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('');
  const body = rows.map((row, rowIndex) => {
    const cells = widths.map((width, index) => tableCell(row[index] || '', width, rowIndex === 0)).join('');
    return `<w:tr>${cells}</w:tr>`;
  }).join('');

  return `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9360" w:type="dxa"/>
        <w:tblInd w:w="120" w:type="dxa"/>
        <w:tblLayout w:type="fixed"/>
        <w:tblCellMar>
          <w:top w:w="80" w:type="dxa"/>
          <w:start w:w="120" w:type="dxa"/>
          <w:bottom w:w="80" w:type="dxa"/>
          <w:end w:w="120" w:type="dxa"/>
        </w:tblCellMar>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:color="D0D7DE"/>
          <w:left w:val="single" w:sz="4" w:color="D0D7DE"/>
          <w:bottom w:val="single" w:sz="4" w:color="D0D7DE"/>
          <w:right w:val="single" w:sz="4" w:color="D0D7DE"/>
          <w:insideH w:val="single" w:sz="4" w:color="D0D7DE"/>
          <w:insideV w:val="single" w:sz="4" w:color="D0D7DE"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>${grid}</w:tblGrid>
      ${body}
    </w:tbl>
    ${paragraph('', 'Normal')}
  `;
}

function parseTable(lines, start) {
  const rows = [];
  let i = start;
  while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
    const cells = lines[i].trim().slice(1, -1).split('|').map((cell) => cell.trim());
    const isSeparator = cells.every((cell) => /^:?-{3,}:?$/.test(cell));
    if (!isSeparator) rows.push(cells);
    i += 1;
  }
  return { rows, next: i };
}

function markdownToXml(md, renderImage) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let buffer = [];
  let inCode = false;
  let code = [];

  function flush() {
    if (buffer.length) {
      blocks.push(paragraph(buffer.join(' ').trim()));
      buffer = [];
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flush();
      if (inCode) {
        blocks.push(paragraph(code.join('\n'), 'Code'));
        code = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
    if (image && typeof renderImage === 'function') {
      flush();
      blocks.push(renderImage(image[2], image[1]));
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      flush();
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      flush();
      const parsed = parseTable(lines, i);
      blocks.push(table(parsed.rows));
      i = parsed.next - 1;
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flush();
      const level = heading[1].length;
      const style = level === 1 ? 'Title' : level === 2 ? 'Heading1' : level === 3 ? 'Heading2' : 'Heading3';
      blocks.push(paragraph(heading[2], style));
      continue;
    }
    const quote = /^>\s*(.+)$/.exec(trimmed);
    if (quote) {
      flush();
      blocks.push(paragraph(quote[1], 'Quote'));
      continue;
    }
    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (ordered) {
      flush();
      blocks.push(paragraph(ordered[1], 'Normal', { numId: 1 }));
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      flush();
      blocks.push(paragraph(bullet[1], 'Normal', { numId: 2 }));
      continue;
    }

    buffer.push(trimmed.replace(/\s{2}$/, ''));
    if (/\s{2}$/.test(line)) flush();
  }
  flush();
  return blocks.join('\n');
}

function pngSize(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) return { width: 1200, height: 800 };
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function imageXml(relId, name, widthPx, heightPx, docPrId) {
  const maxWidth = 6.2 * 914400;
  const maxHeight = 5.8 * 914400;
  let cx = maxWidth;
  let cy = Math.round(cx * heightPx / widthPx);
  if (cy > maxHeight) {
    cy = maxHeight;
    cx = Math.round(cy * widthPx / heightPx);
  }
  return `
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${cx}" cy="${cy}"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="${docPrId}" name="${escapeXml(name)}"/>
            <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
            <a:graphic>
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic>
                  <pic:nvPicPr><pic:cNvPr id="0" name="${escapeXml(name)}"/><pic:cNvPicPr/></pic:nvPicPr>
                  <pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
                  <pic:spPr>
                    <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
  `;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/><w:color w:val="1F2937"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="0" w:after="240"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:b/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="44"/><w:color w:val="0B2545"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:keepNext/><w:outlineLvl w:val="0"/><w:spacing w:before="320" w:after="160"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="2E74B5"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:keepNext/><w:outlineLvl w:val="1"/><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="2E74B5"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:keepNext/><w:outlineLvl w:val="2"/><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1F4D78"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:left="360"/><w:spacing w:before="80" w:after="160"/></w:pPr>
    <w:rPr><w:i/><w:color w:val="555555"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Code">
    <w:name w:val="Code"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="80" w:after="160"/><w:shd w:fill="F6F8FA"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="19"/><w:color w:val="24292F"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TableText">
    <w:name w:val="Table Text"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:after="0" w:line="260" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:sz w:val="18"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Caption">
    <w:name w:val="Caption"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="80" w:after="120"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:i/><w:sz w:val="19"/><w:color w:val="555555"/></w:rPr>
  </w:style>
</w:styles>`;
}

function numberingXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>
      <w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
  <w:abstractNum w:abstractNumId="2">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/>
      <w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>`;
}

function documentXml(body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function coreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>SSE Canli Borsa Ticker</dc:title>
  <dc:creator>PACOME BERINYUY FONDZENYUY</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
</Properties>`;
}

function build() {
  ensureCleanDir(buildDir);
  fs.mkdirSync(relsDir, { recursive: true });
  fs.mkdirSync(mediaDir, { recursive: true });
  fs.mkdirSync(path.join(buildDir, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(buildDir, 'docProps'), { recursive: true });

  const rels = [
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
  ];
  let imageCounter = 0;

  function addImage(relative, caption) {
    const source = path.join(root, relative);
    if (!fs.existsSync(source)) {
      return paragraph(`Missing image: ${relative}`, 'Quote');
    }
    imageCounter += 1;
    const ext = path.extname(source) || '.png';
    const target = `image${imageCounter}${ext}`;
    fs.copyFileSync(source, path.join(mediaDir, target));
    const relId = `rIdImage${imageCounter}`;
    rels.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${target}"/>`);
    const { width, height } = pngSize(source);
    return `${caption ? paragraph(caption, 'Caption') : ''}${imageXml(relId, target, width, height, imageCounter)}`;
  }

  let body = markdownToXml(fs.readFileSync(inputMd, 'utf8'), addImage);

  body += pageBreak();
  body += paragraph('Ek A - Tam Ekran Goruntuleri', 'Heading1');
  screenshotFiles.forEach(([relative, caption]) => {
    body += addImage(relative, caption);
  });

  write(path.join(buildDir, '[Content_Types].xml'), contentTypesXml());
  write(path.join(buildDir, '_rels', '.rels'), rootRelsXml());
  write(path.join(wordDir, 'document.xml'), documentXml(body));
  write(path.join(wordDir, 'styles.xml'), stylesXml());
  write(path.join(wordDir, 'numbering.xml'), numberingXml());
  write(path.join(relsDir, 'document.xml.rels'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
  write(path.join(buildDir, 'docProps', 'core.xml'), coreXml());
  write(path.join(buildDir, 'docProps', 'app.xml'), appXml());

  const tempZip = path.join(root, 'PROJE-RAPORU-SABLON.docx.zip');
  if (fs.existsSync(outputDocx)) fs.rmSync(outputDocx, { force: true });
  if (fs.existsSync(tempZip)) fs.rmSync(tempZip, { force: true });
  const archivePath = path.join(buildDir, '*');
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${tempZip.replace(/'/g, "''")}' -Force`
  ], { stdio: 'inherit' });
  fs.renameSync(tempZip, outputDocx);
  fs.rmSync(buildDir, { recursive: true, force: true });
  console.log(`Wrote ${path.relative(root, outputDocx)}`);
}

build();
