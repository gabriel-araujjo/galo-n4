#!/bin/node
const fs = require('fs');
const child_process = require("child_process");

const mainPdf = "main.pdf";

const labels = JSON.parse(child_process.execSync(
    `qpdf --json --json-key=pagelabels ${mainPdf} | jq .pagelabels`));

function label(i) {
  i--;
  let chosen;
  for (let l of labels) {
    if (l.index <= i)
      chosen = l;
    else
      break;
  }

  return (i - chosen.index) + chosen.label['/St'];
}

const outline_src = child_process.execSync(`mutool show ${mainPdf} outline`)
                        .toString()
                        .split('\n');

const outline = [];
const parts = [];
{
  let part;
  for (let l of outline_src) {
    if (l.startsWith('|')) {
      l = l.split('#')[1].split(',')[0];
      l = label(Number(l))
      outline.push(l);
      parts.push(part);
      continue;
    }
    if (l.startsWith('-')) {
      part = l.match(/"[IVX]+ +([^"]+)"/);
      part = part[1].trim();
    }
  }
}

const frontmatter = [
  "editorial",
  "balanco-editorial",
];

const articles = fs.readdirSync('articles').sort();

const backmatter = [ "ficha-tecnica" ];

child_process.execSync('mkdir -p pdf');

let offset = 0;

for (let i = 0; i < frontmatter.length; ++i) {
  const section = frontmatter[offset + i];
  const page = outline[offset + i];
  const endPage = outline[offset + 1] - 1;

  generate_tmp_tex(section, page);
  generate_pdf(section);
  const yaml = generate_frontmatter_page(section, page, endPage);

  const spaced = section.replace(/-/g, ' ');
  const dest_dir =
      `/home/gabriel/Projects/revistagalo/content/edições/edição 003/00.${
          i + 1} ${spaced}`;
  child_process.execSync(`mkdir -p "${dest_dir}"`);
  child_process.execSync(
      `cp "pdf/${section}.pdf" "${dest_dir}/galo-ed3-${page}-${endPage}.pdf"`);
  fs.writeFileSync(`${dest_dir}/index.md`, yaml);

  clear_tmp();
}

offset += frontmatter.length;

for (let i = 0; i < articles.length; ++i) {
  const article = articles[i];
  const page = outline[offset + i];
  const endPage = outline[offset + i + 1] - 1;
  const section = `articles/${article}/main`;
  const part = parts[offset + i];

  generate_tmp_tex(section, page);
  generate_pdf(article);
  const yaml = generate_article_page(part, section, page, endPage);

  const spaced = article.replace(/-/g, ' ');
  const dest_dir =
      `/home/gabriel/Projects/revistagalo/content/edições/edição 003/${spaced}`;
  child_process.execSync(`mkdir -p "${dest_dir}"`);
  child_process.execSync(
      `cp "pdf/${article}.pdf" "${dest_dir}/galo-ed3-${page}-${endPage}.pdf"`);
  fs.writeFileSync(`${dest_dir}/index.md`, yaml);

  clear_tmp();
}

// offset += articles.length;

// for (let i = 0; i < backmatter.length; ++i) {
//   const section = backmatter[i];
//   const page = outline[offset + i];

//   generate_tmp_tex(section, page);
//   generate_pdf(section);
//   clear_tmp();
// }

function generate_tmp_tex(section, page) {
  section = section.replace(/\//g, '\\/');
  child_process.execSync(`sed 's/%\\\\include{${section}}/\\\\include{${
      section}}/g' single.tex > tmp.tex`);
  child_process.execSync(`sed -i 's/thepage/${page}/g' tmp.tex`);
}

function generate_pdf(dest) {
  child_process.execSync(
      'pdflatex -synctex=1 -interaction=nonstopmode -file-line-error tmp');
  child_process.execSync('biber tmp');
  child_process.execSync(
      'pdflatex -synctex=1 -interaction=nonstopmode -file-line-error tmp');
  child_process.execSync(
      'pdflatex -synctex=1 -interaction=nonstopmode -file-line-error tmp');
  child_process.execSync(
      'gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dNOPAUSE -dQUIET -dBATCH -dPrinted=false -sOutputFile=tmp-compressed.pdf tmp.pdf')
  child_process.execSync(`mv tmp-compressed.pdf pdf/${dest}.pdf`);
}

function clear_tmp() { child_process.execSync('rm tmp.*'); }

function* filter_section(iter, s) {
  let sectionRegex = new RegExp(`${s}:\\d+: `, 'g');
  let found = false;
  for (let l of iter) {
    if (l.startsWith(s)) {
      found = true;
      yield l.replace(sectionRegex, '');
    } else if (found)
      return;
  }
}

function grab_title(iter) {
  let line;
  let done;
  while ({value : line, done} = iter.next(), !done) {
    let title = line.trim();
    if (title.length !== 0) {
      const m = title.match(/\[([^\]]+)\]/);
      if (m)
        title = m[1];
      return title;
    }
  }
}

function grab_subtitle(iter) {
  let line;
  let done;
  while ({value : line, done} = iter.next(), !done) {
    let subtitle = line.trim();
    if (subtitle.length !== 0) {
      return subtitle[0].toLowerCase() + subtitle.substr(1);
    }
  }
}

function grab_author(iter, line) {
  const author = line.trim().split(/ +/);
  let done;
  while ({value : line, done} = iter.next(), !done) {
    if (line.trim().length === 0)
      break;
  }

  if (author.length) {
    const family = author.pop();
    const given = author.join(' ');
    return {family, given};
  }
}

function grab_abstract(iter) {
  let abstract = [];
  let line;
  let done;
  while ({value : line, done} = iter.next(), !done) {
    line = line.trim();

    if (line.length === 0) {
      if (!abstract.length)
        continue;
      return abstract.join(' ');
    }

    abstract.push(line);
  }
}

function grab_keywords(iter) {
  let line;
  let done;
  while ({value : line, done} = iter.next(), !done) {
    line = line.trim();

    if (line.length !== 0) {
      return line;
    }
  }
}

function grab_non_empty(iter) {
  let line;
  let done;
  while ({value : line, done} = iter.next(), !done) {
    line = line.trim();

    if (line.length !== 0)
      return line;
  }
}

function generate_article_page(part, section, startPage, endPage) {
  const txt = child_process.execSync(`detex -1 tmp`).toString().split('\n');

  const iter = filter_section(txt, section);

  const title = grab_title(iter);
  const subtitle = grab_subtitle(iter);

  const authors = [];

  for (;;) {
    const line = grab_non_empty(iter);

    switch (line) {
    case "Como referenciar?":
      iter.next();
      break;
    default:
      authors.push(grab_author(iter, line));
      continue;
    }
    break;
  }

  const abstract = grab_abstract(iter);
  const keywords = grab_keywords(iter);

  const parseAuthor = ({given, family}) => `
- given: ${given}
  family: ${family}`

  const parseKeyword = k => `
- ${k}`

  const yaml = `---
title: "${title}"${subtitle ? `\nsubtitle: "${subtitle}"` : ''}
description: "${abstract.substr(0, 140)}"
date: ${new Date(Date.now() + startPage * 1000).toISOString()}
authors:${authors.map(parseAuthor).join('')}
tags:${
      keywords.replace(/\.$/, '')
          .split('.')
          .map(s => s.trim())
          .map(parseKeyword)
          .join('')}
pages: [${startPage}, ${endPage}]
series: [n3]
section: "${part}"
number: 3
semester: 1
year: 2021
---

**Resumo:** ${abstract}

**Palavras-chave:** ${keywords}
`

  return yaml;
}

function generate_frontmatter_page(section, startPage, endPage) {
  const part = "Editorial";

  const txt = child_process.execSync(`detex -1 tmp`).toString().split('\n');

  const iter = filter_section(txt, section);

  const title = grab_title(iter);

  const paragraphs = [];
  {
    let paragraph = [];
    let line;
    let done;
    while ({value : line, done} = iter.next(), !done) {
      line = line.trim()
      if (line.length === 0) {
        if (!paragraph.length)
          continue;
        paragraphs.push(paragraph.join(' '));
        paragraph = [];
      }
      else {
        paragraph.push(line);
      }
    }
    if (paragraph.length) {
      paragraphs.push(paragraph.join(' '));
    }
  }
  const author =
      grab_author([][Symbol.iterator](), paragraphs[paragraphs.length - 2]);

  const parseAuthor = ({given, family}) => `
- given: ${given}
  family: ${family}`

  const yaml = `---
title: ${title}
description: ${title} da Revista Galo ano 2 Nº 3
date: ${new Date(Date.now() - (100 - startPage) * 1000).toISOString()}
authors:${parseAuthor(author)}
tags:
- ${title}
pages: [${startPage}, ${endPage}]
series: [n3]
section: Editorial
number: 3
semester: 1
year: 2021
---

${paragraphs[0].substr(0, 240)}...
`

  return yaml;
}
