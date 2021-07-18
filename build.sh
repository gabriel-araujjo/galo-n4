#!/bin/sh

pdflatex -synctex=1 -interaction=nonstopmode -file-line-error main
biber main
pdflatex -synctex=1 -interaction=nonstopmode -file-line-error main
pdflatex -synctex=1 -interaction=nonstopmode -file-line-error main
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dNOPAUSE -dQUIET -dBATCH -dPrinted=false -sOutputFile=tmp-compressed.pdf main.pdf
