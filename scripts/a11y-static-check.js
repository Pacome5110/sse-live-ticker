const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'public', 'auth.html'),
];

const failures = [];

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function findAll(re, text) {
  return [...text.matchAll(re)];
}

for (const file of files) {
  const html = read(file);
  const labelFors = new Set(findAll(/<label\b[^>]*\bfor=["']([^"']+)["']/gi, html).map((match) => match[1]));
  const ids = findAll(/\bid=["']([^"']+)["']/gi, html).map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

  if (!/<html\b[^>]*\blang=["'][a-z-]+["']/i.test(html)) {
    failures.push(`${file}: html element is missing lang`);
  }

  [...new Set(duplicateIds)].forEach((id) => {
    failures.push(`${file}: duplicate id "${id}"`);
  });

  findAll(/<(input|select|textarea)\b([^>]*)>/gi, html).forEach((match) => {
    const attrs = match[2];
    const id = attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
    const type = attrs.match(/\btype=["']([^"']+)["']/i)?.[1] || match[1].toLowerCase();
    const hasAriaLabel = /\baria-label=["'][^"']+["']/i.test(attrs);

    if (type === 'hidden') return;
    if (!id && !hasAriaLabel) {
      failures.push(`${file}: form control is missing id or aria-label: ${match[0]}`);
      return;
    }
    if (id && !labelFors.has(id) && !hasAriaLabel) {
      failures.push(`${file}: form control #${id} has no associated label or aria-label`);
    }
  });

  findAll(/<img\b([^>]*)>/gi, html).forEach((match) => {
    if (!/\balt=["'][^"']*["']/i.test(match[1])) {
      failures.push(`${file}: image missing alt text`);
    }
  });

  findAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, html).forEach((match) => {
    const attrs = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    const hasLabel = /\baria-label=["'][^"']+["']/i.test(attrs) || /\btitle=["'][^"']+["']/i.test(attrs);
    if (!text && !hasLabel) {
      failures.push(`${file}: button has no visible text, title, or aria-label`);
    }
  });
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Static accessibility checks passed.');
