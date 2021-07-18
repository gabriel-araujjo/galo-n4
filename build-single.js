#!/bin/node
const fs = require('fs');
const child_process = require("child_process");

const mainPdf = "main.pdf";

const labels = JSON.parse(
    child_process.execSync(`qpdf --json --json-key=pagelabels ${mainPdf} | jq .pagelabels`));

function label(i) {
    i--;
    let chosen;
    for (let l of labels) {
        if (l.index <= i) chosen = l;
        else break;
    }

    return (i - chosen.index) + chosen.label['/St'];
}

const outline = child_process.execSync(`mutool show ${mainPdf} outline`)
                    .toString()
                    .split('\n')
                    .filter(l => l.startsWith('|\t\t'))
                    .map(l => l.split('#')[1].split(',')[0])
                    .map(Number).map(label);

let articles = fs.readdirSync('articles').sort();

child_process.execSync('mkdir -p pdf');

for (let i = 0; i < articles.length; ++i) {
    const article = articles[i];
    const page = outline[i];

    child_process.execSync(`sed 's/%\\\\include{articles\\/${article}\\/main}/\\\\include{articles\\/${article}\\/main}/g' single.tex > tmp.tex`);

    child_process.execSync(`sed -i 's/thepage/${page}/g' tmp.tex`);

    child_process.execSync('pdflatex -synctex=1 -interaction=nonstopmode -file-line-error tmp');
    child_process.execSync('biber tmp');
    child_process.execSync('pdflatex -synctex=1 -interaction=nonstopmode -file-line-error tmp');
    child_process.execSync('pdflatex -synctex=1 -interaction=nonstopmode -file-line-error tmp');
    child_process.execSync(`mv tmp.pdf pdf/${article}.pdf`);
    child_process.execSync('rm tmp.*');
}





// for f in articles/01-o-patrimonio-da-comp
// do
//     article=${f##articles/}
//     arg='s/%\\include{articles\/'$article'\/main}/\\include{articles\/'$article'\/main}/g'

//     sed "$arg" single.tex > tmp.tex

//     pdflatex -synctex=1 -interaction=nonstopmode -file-line-error tmp
//     biber tmp
//     pdflatex -synctex=1 -interaction=nonstopmode -file-line-error tmp
//     pdflatex -synctex=1 -interaction=nonstopmode -file-line-error tmp
//     mv tmp.pdf pdf/$article.pdf

//     rm tmp.*
// done
